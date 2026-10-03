import {
  THREAT_LEVEL_LABEL,
  type DispatchRequest,
  type DispatchResponse,
  type ServiceKind,
} from "@safecall/shared";

const SERVICE_LABEL: Record<ServiceKind, string> = {
  police: "Policja (997)",
  ambulance: "Karetka (999)",
  fire: "Straż (998)",
};

const LATENCY_MS: Record<ServiceKind, [number, number]> = {
  police: [900, 2400],
  ambulance: [1200, 2800],
  fire: [1400, 3000],
};

const ETA_MINUTES: Record<ServiceKind, number> = {
  police: 7,
  ambulance: 9,
  fire: 11,
};

export interface DispatchProvider {
  dispatch(input: DispatchRequest): Promise<DispatchResponse>;
}

/**
 * Stand-in for the real public-services integration. Kept behind an interface so
 * swapping in a genuine 112/997 gateway later is a one-file change.
 */
class MockDispatchProvider implements DispatchProvider {
  async dispatch(input: DispatchRequest): Promise<DispatchResponse> {
    const window = LATENCY_MS[input.service];
    const latency = window[0] + Math.random() * (window[1] - window[0]);

    await new Promise((resolve) => setTimeout(resolve, latency));

    const reference = buildReference();
    const receivedAt = new Date().toISOString();
    const etaMinutes = ETA_MINUTES[input.service];

    const where =
      input.place ??
      `${input.location.lat.toFixed(5)}, ${input.location.lng.toFixed(5)}`;

    const transcript = [
      `${new Date().toLocaleTimeString("pl-PL")} dyżurny: zgłoszenie przyjęte.`,
      `${new Date().toLocaleTimeString("pl-PL")} system: Safe Call, poziom ${input.level} — ${THREAT_LEVEL_LABEL[input.level].toLowerCase()}.`,
      `${new Date().toLocaleTimeString("pl-PL")} dyżurny: lokalizacja ${where}, dokładność ${input.accuracy ?? "—"}.`,
      `${new Date().toLocaleTimeString("pl-PL")} dyżurny: jednostka w trasie, ETA ${etaMinutes} min.`,
      `SYGNALIZACJA: MOCK — to nie jest prawdziwe zgłoszenie. Nr ${reference}.`,
    ].join("\n");

    console.warn(
      [
        "",
        "=".repeat(64),
        ` MOCK DISPATCH → ${SERVICE_LABEL[input.service]}`,
        ` poziom: ${input.level} (${THREAT_LEVEL_LABEL[input.level]})`,
        ` lokalizacja: ${input.location.lat.toFixed(6)}, ${input.location.lng.toFixed(6)}`,
        ` dokładność: ${input.accuracy ?? "—"} m`,
        ` numer alarmowy: ${input.contactPhone ?? "—"}`,
        ` referencja: ${reference}`,
        "=".repeat(64),
        "",
      ].join("\n"),
    );

    return {
      reference,
      service: input.service,
      receivedAt,
      etaMinutes,
      transcript,
    };
  }
}

function buildReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
  return `MOCK-${day}-${suffix}`;
}

export const dispatchProvider: DispatchProvider = new MockDispatchProvider();
