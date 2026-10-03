const env = process.env;

function required(name: string, fallback: string): string {
  const value = env[name];
  return value && value.length > 0 ? value : fallback;
}

/**
 * Android emulators cannot see the host through `localhost`; 10.0.2.2 is the
 * loopback alias. A real device needs the LAN IP of the dev machine.
 */
function defaultHost(): string {
  return process.env.EXPO_OS === "ios" ? "localhost" : "10.0.2.2";
}

const host = required("EXPO_PUBLIC_API_HOST", defaultHost());
const port = required("EXPO_PUBLIC_API_PORT", "4000");

export const config = {
  apiUrl: required("EXPO_PUBLIC_API_URL", `http://${host}:${port}`),
  wsUrl: required("EXPO_PUBLIC_WS_URL", `ws://${host}:${port}/ws`),
  clerkPublishableKey: env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
  tileUrl: required(
    "EXPO_PUBLIC_TILE_URL",
    "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
  ),
  tileMaxZoom: Number(required("EXPO_PUBLIC_TILE_MAX_ZOOM", "20")),
  /** Silence before level 1 puts a decoy incoming call on screen. */
  fakeCallDelayMs: Number(required("EXPO_PUBLIC_FAKE_CALL_DELAY_MS", "10000")),
  /** How long the thumb has to rest at level 0 to stand the alert down. */
  holdToStandDownMs: Number(
    required("EXPO_PUBLIC_HOLD_TO_STAND_DOWN_MS", "2200"),
  ),
} as const;

export const isClerkConfigured = config.clerkPublishableKey.startsWith("pk_");
