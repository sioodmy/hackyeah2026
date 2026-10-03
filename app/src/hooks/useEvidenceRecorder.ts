/**
 * Segmented evidence recorder — threat level 3 only.
 *
 * Why segments instead of one long file: the phone records ~30s at a time and
 * uploads each segment the moment it closes. If the phone is taken, wiped or
 * simply dies, the worst-case loss is one segment rather than the whole
 * recording. The cost is sub-second gaps at segment boundaries, which the
 * server's manifest records explicitly rather than papering over.
 *
 * Two platform facts shape the implementation:
 *   - `expo-audio` exposes recording through the `useAudioRecorder` hook, so the
 *     recorder is one long-lived instance re-armed segment after segment. Each
 *     segment is read off disk *before* the next one starts, so it does not
 *     matter whether the native side reuses the same path or allocates a new
 *     one.
 *   - Android shows an unavoidable ongoing-microphone indicator while this
 *     runs. That is not fixable from JS; the mitigation is the fake-call pretext,
 *     which has the phone held to the user's ear rather than lying on a table.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioRecorder,
} from 'expo-audio';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

import type { ApiClient } from '@/lib/api';
import { EVIDENCE_CHUNK_SECONDS } from '@/theme/levels';
import { clearEvidenceState, readEvidenceState, writeEvidenceState } from '@/evidence/store';

const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1_500;
/** Give up waiting for a segment to close after this much longer than nominal. */
const SEGMENT_GRACE_MS = 5_000;

export type RecorderStatus = 'idle' | 'arming' | 'recording' | 'stopping' | 'denied' | 'error';

export type EvidenceRecorderApi = {
  status: RecorderStatus;
  isRecording: boolean;
  isUploading: boolean;
  segmentsRecorded: number;
  segmentsUploaded: number;
  lastError: string | null;
  begin: (sessionId: string, alertId: string) => void;
  disarm: () => Promise<void>;
  finalize: (endPosition?: { lat: number; lng: number }) => Promise<void>;
};

const RECORDING_OPTIONS: Parameters<typeof useAudioRecorder>[0] = {
  ...RecordingPresets.HIGH_QUALITY,
  // `document` survives low-storage cleanup, unlike `cache`.
  directory: 'document',
  isMeteringEnabled: false,
};

/** Lets the fake-call ringtone and the recorder share one audio session. */
async function applyRecordingAudioMode(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
      allowsBackgroundRecording: true,
      shouldPlayInBackground: true,
    });
  } catch {
    // Not fatal: recording still works, it just stops on backgrounding.
  }
}

async function releaseRecordingAudioMode(): Promise<void> {
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      allowsBackgroundRecording: false,
      shouldPlayInBackground: false,
    });
  } catch {
    /* nothing to do */
  }
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

/** SHA-256 of a recorded file, as lowercase hex. */
async function digestFile(path: string): Promise<string> {
  const bytes = await new File(path).bytes();
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, toHex(bytes), {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

/** Resolves when the recorder stops recording, or after `timeoutMs`. */
function waitForStop(recorder: AudioRecorder, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timeout);
      resolve();
    };

    const poll = setInterval(() => {
      if (!recorder.isRecording) finish();
    }, 150);

    const timeout = setTimeout(finish, timeoutMs);
  });
}

export type UseEvidenceRecorderArgs = {
  api: ApiClient;
};

export function useEvidenceRecorder({ api }: UseEvidenceRecorderArgs): EvidenceRecorderApi {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);

  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [segmentsRecorded, setSegmentsRecorded] = useState(0);
  const [segmentsUploaded, setSegmentsUploaded] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  // Mutable session state lives in refs: the recording loop must not restart
  // every time a counter changes.
  const sessionIdRef = useRef<string | null>(null);
  const alertIdRef = useRef<string | null>(null);
  const seqRef = useRef(0);
  const recordedRef = useRef(0);
  const uploadedRef = useRef(0);
  const startedAtRef = useRef(0);
  const stopRequestedRef = useRef(true);
  const loopRunningRef = useRef(false);

  const uploadSegment = useCallback(
    async (path: string, segmentSeq: number): Promise<boolean> => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return false;

      let file: File;
      try {
        file = new File(path);
        if (!file.exists) return false;
      } catch {
        return false;
      }

      let sha256: string;
      try {
        sha256 = await digestFile(path);
      } catch (err) {
        setLastError(err instanceof Error ? err.message : 'nie udało się policzyć sumy kontrolnej');
        return false;
      }

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          await api.uploadChunk({
            sessionId,
            seq: segmentSeq,
            offsetS: segmentSeq * EVIDENCE_CHUNK_SECONDS,
            clientTs: startedAtRef.current + segmentSeq * EVIDENCE_CHUNK_SECONDS * 1000,
            file: file as unknown as Blob,
            sha256,
          });
          uploadedRef.current += 1;
          setSegmentsUploaded(uploadedRef.current);
          writeEvidenceState({
            sessionId,
            alertId: alertIdRef.current ?? '',
            nextSeq: segmentSeq + 1,
            uploadedSeqs: Array.from({ length: uploadedRef.current }, (_, i) => i),
            startedAt: startedAtRef.current,
          });
          return true;
        } catch (err) {
          setLastError(err instanceof Error ? err.message : 'wysyłka nieudana');
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_MS * 2 ** (attempt - 1)));
          }
        }
      }
      return false;
    },
    [api],
  );

  const runLoop = useCallback(async () => {
    if (loopRunningRef.current) return;
    loopRunningRef.current = true;

    try {
      // Hand straight from one segment into the next; the gap is milliseconds.
      while (!stopRequestedRef.current && sessionIdRef.current) {
        const segmentSeq = seqRef.current;

        try {
          await recorder.prepareToRecordAsync();
          recorder.record({ forDuration: EVIDENCE_CHUNK_SECONDS });
          setStatus('recording');
          await waitForStop(recorder, EVIDENCE_CHUNK_SECONDS * 1000 + SEGMENT_GRACE_MS);
        } catch (err) {
          setLastError(err instanceof Error ? err.message : 'nagrywanie przerwane');
          setStatus('error');
          break;
        }

        const uri = recorder.uri;
        if (uri) {
          recordedRef.current += 1;
          setSegmentsRecorded(recordedRef.current);

          // Read the segment off disk before re-arming, so it is safe even if
          // the native recorder reuses the same path for the next one.
          void uploadSegment(uri, segmentSeq).then((ok) => {
            if (!ok) return;
            seqRef.current = Math.max(seqRef.current, segmentSeq + 1);
            try {
              const file = new File(uri);
              if (file.exists) file.delete();
            } catch {
              // Already stored server-side; a leftover local file is harmless.
            }
          });
        }

        if (stopRequestedRef.current || !sessionIdRef.current) break;
      }
    } finally {
      loopRunningRef.current = false;
    }
  }, [recorder, uploadSegment]);

  const begin = useCallback(
    (nextSessionId: string, nextAlertId: string) => {
      if (sessionIdRef.current === nextSessionId) return;

      sessionIdRef.current = nextSessionId;
      alertIdRef.current = nextAlertId;
      seqRef.current = 0;
      recordedRef.current = 0;
      uploadedRef.current = 0;
      startedAtRef.current = Date.now();
      stopRequestedRef.current = false;
      setLastError(null);
      setSegmentsRecorded(0);
      setSegmentsUploaded(0);

      writeEvidenceState({
        sessionId: nextSessionId,
        alertId: nextAlertId,
        nextSeq: 0,
        uploadedSeqs: [],
        startedAt: startedAtRef.current,
      });

      setStatus('arming');
      void (async () => {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          // Without the microphone we still alert everyone; there is just no
          // audio. Critically, we do *not* throw a permission dialog at someone
          // in the middle of a crisis.
          setStatus('denied');
          setLastError('brak dostępu do mikrofonu');
          return;
        }
        await applyRecordingAudioMode();
        void runLoop();
      })();
    },
    [runLoop],
  );

  const stop = useCallback(async () => {
    stopRequestedRef.current = true;
    try {
      if (recorder.isRecording) await recorder.stop();
    } catch {
      /* already stopped */
    }
    await releaseRecordingAudioMode();
  }, [recorder]);

  const disarm = useCallback(async () => {
    await stop();
    setStatus('idle');
  }, [stop]);

  const finalize = useCallback(
    async (endPosition?: { lat: number; lng: number }) => {
      await stop();
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;

      setStatus('stopping');
      try {
        await api.finalizeEvidence(sessionId, {
          durationS: recordedRef.current * EVIDENCE_CHUNK_SECONDS,
          chunkCount: recordedRef.current,
          endLat: endPosition?.lat,
          endLng: endPosition?.lng,
        });
        clearEvidenceState();
        setLastError(null);
      } catch (err) {
        setLastError(err instanceof Error ? err.message : 'nie udało się zamknąć nagrania');
      } finally {
        sessionIdRef.current = null;
        setStatus('idle');
      }
    },
    [api, stop],
  );

  // A recording that was interrupted by the app being killed leaves a stored
  // marker behind. Report it once so the UI can offer to finish the upload.
  useEffect(() => {
    const pending = readEvidenceState();
    if (pending && pending.sessionId !== sessionIdRef.current) {
      setLastError(
        `niezakończone nagranie z poprzedniej sesji (${pending.uploadedSeqs.length} segmentów)`,
      );
    }
  }, []);

  return {
    status,
    isRecording: status === 'recording' || status === 'arming',
    isUploading: recordedRef.current > uploadedRef.current,
    segmentsRecorded,
    segmentsUploaded,
    lastError,
    begin,
    disarm,
    finalize,
  };
}
