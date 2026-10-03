/**
 * Crash-safe persistence for an in-progress evidence session.
 *
 * If the phone is force-killed mid-recording, the next launch has to be able to
 * work out which segment it was on and resume uploading — otherwise the tail of
 * the recording is lost even though the file survived on disk.
 */

import { Directory, File, Paths } from 'expo-file-system';

export type StoredEvidenceState = {
  sessionId: string;
  alertId: string;
  nextSeq: number;
  uploadedSeqs: number[];
  startedAt: number;
};

const DIR_NAME = 'panicmap-evidence';
const FILE_NAME = 'active-session.json';

function stateDir(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function stateFile(): File {
  return new File(stateDir(), FILE_NAME);
}

export function readEvidenceState(): StoredEvidenceState | null {
  try {
    const file = stateFile();
    if (!file.exists) return null;
    const parsed = JSON.parse(file.textSync()) as StoredEvidenceState;
    if (!parsed?.sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeEvidenceState(state: StoredEvidenceState): void {
  try {
    const file = stateFile();
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(state));
  } catch {
    // Losing the resume marker is recoverable; losing a recording is not.
  }
}

export function clearEvidenceState(): void {
  try {
    const file = stateFile();
    if (file.exists) file.delete();
  } catch {
    /* nothing useful to do */
  }
}

export function uploadedBytes(state: StoredEvidenceState | null): number {
  if (!state) return 0;
  return state.uploadedSeqs.length;
}
