/**
 * Jedna obudowa telefonu, dwa warianty.
 *
 * Celowo **jeden komponent**, a nie dwa do podmiany: gdyby obudowa zmieniała
 * typ elementu (`<PhoneFrame>` → `<PixelFrame>`), React zremontowałby całe
 * poddrzewo razem z `DemoPhone` i demo gubiłoby stan alarmu w połowie
 * zamiany. Przy jednym komponencie dziecko zostaje w tym samym miejscu drzewa,
 * więc przeżywa zmianę obudowy.
 */
import React from "react";

export const PHONE_W = 393;
export const PHONE_H = 852;
/** Wyspa + pasek stanu — tyle treści nie wchodzi na prawdziwym sprzęcie. */
export const SAFE_TOP = 59;
export const SAFE_BOTTOM = 34;

/**
 * Wymiary samego ekranu (bez ramki). Wspólne dla obu wariantów, żeby zamiana
 * nie przeliczała układu UI — przekłada się tylko obudowa.
 */
export const SCREEN_W = PHONE_W - 22;
export const SCREEN_H = PHONE_H - 22;

export type DeviceVariant = "iphone" | "pixel";

/** Wymiary zewnętrzne każdego wariantu — landing rezerwuje miejsce. */
export const DEVICE_SIZE: Record<DeviceVariant, { w: number; h: number }> = {
  // iPhone: ekran wcięty 11 px z każdej strony.
  iphone: { w: PHONE_W, h: PHONE_H },
  // Pixel: cieńszy bezel, ale wyższy dół pod pasek gestów.
  pixel: { w: SCREEN_W + 22, h: SCREEN_H + 26 },
};

const PUNCH_HOLE = 11;

export const DeviceFrame: React.FC<{
  children: React.ReactNode;
  variant: DeviceVariant;
  /** Czy jest ekran, z którego można wyjść — steruje widocznością przycisku. */
  canGoBack?: boolean;
  onBack?: () => void;
}> = ({ children, variant, canGoBack = false, onBack }) => {
  const isPixel = variant === "pixel";

  return (
    <div
      className="relative"
      style={{ width: DEVICE_SIZE[variant].w, height: DEVICE_SIZE[variant].h }}
    >
      {/* Boczne przyciski — tylko iPhone, Pixel ich nie ma z przodu. */}
      {!isPixel ? (
        <>
          <div
            className="absolute rounded-l-[3px]"
            style={{
              left: -2.5,
              top: 132,
              width: 3,
              height: 34,
              background:
                "linear-gradient(180deg,#8e8e93,#3a3a3c 40%,#3a3a3c 60%,#8e8e93)",
            }}
          />
          <div
            className="absolute rounded-l-[3px]"
            style={{
              left: -2.5,
              top: 190,
              width: 3,
              height: 62,
              background:
                "linear-gradient(180deg,#8e8e93,#3a3a3c 40%,#3a3a3c 60%,#8e8e93)",
            }}
          />
          <div
            className="absolute rounded-l-[3px]"
            style={{
              left: -2.5,
              top: 262,
              width: 3,
              height: 62,
              background:
                "linear-gradient(180deg,#8e8e93,#3a3a3c 40%,#3a3a3c 60%,#8e8e93)",
            }}
          />
          <div
            className="absolute rounded-r-[3px]"
            style={{
              right: -2.5,
              top: 218,
              width: 3,
              height: 92,
              background:
                "linear-gradient(180deg,#8e8e93,#3a3a3c 40%,#3a3a3c 60%,#8e8e93)",
            }}
          />
        </>
      ) : null}

      {/*
        Przycisk „wstecz" siedzi W RAMCE, nie w aplikacji, i celowo wystaje poza
        obrys telefonu. W apce tę rolę oddaje systemowy przycisk; na landingu
        go nie ma, a przycisk wewnątrz ekranu wyglądałby jak element Mokosh.
      */}
      {canGoBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Wróć do mapy"
          title="Wróć do mapy"
          className="absolute z-[90] rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{
            left: isPixel ? -44 : -46,
            top: isPixel ? 76 : 84,
            width: 52,
            height: 52,
            background:
              "linear-gradient(160deg,#2a2a2e 0%,#17171a 55%,#101013 100%)",
            border: "1px solid rgba(255,255,255,.14)",
            boxShadow:
              "0 12px 26px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.14), 0 0 0 5px rgba(9,10,16,.9)",
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M15 5L8 12L15 19"
              stroke="#F4F5F7"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}

      {/* Krawędź obudowy */}
      <div
        className="absolute inset-0"
        style={
          isPixel
            ? {
                borderRadius: 30,
                background:
                  "linear-gradient(155deg,#3a3a40 0%,#1b1b1e 18%,#0d0d0f 55%,#26262b 100%)",
                padding: 4,
                boxShadow:
                  "0 44px 80px -30px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.08)",
              }
            : {
                borderRadius: 57,
                background:
                  "linear-gradient(150deg,#d8d8dc 0%,#8e8e93 12%,#5f5f63 26%,#3d3d40 50%,#5f5f63 74%,#8e8e93 88%,#d8d8dc 100%)",
                padding: 2.5,
                boxShadow:
                  "0 50px 90px -30px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.10)",
              }
        }
      >
        {/* Korpus */}
        <div
          className="relative h-full w-full"
          style={
            isPixel
              ? {
                  borderRadius: 26,
                  background:
                    "linear-gradient(180deg,#151517 0%,#08080a 60%,#151517 100%)",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,.05)",
                }
              : {
                  borderRadius: 54.5,
                  background:
                    "linear-gradient(180deg,#1a1a1c 0%,#0a0a0b 12%,#08080a 88%,#1a1a1c 100%)",
                  boxShadow:
                    "inset 0 0 0 1px rgba(255,255,255,.07), inset 0 1px 1px rgba(255,255,255,.14)",
                }
          }
        >
          {/* Ekran. Pozycja zależna od wariantu, rozmiar zawsze ten sam. */}
          <div
            className="relative overflow-hidden"
            style={
              isPixel
                ? {
                    position: "absolute",
                    left: 8,
                    right: 8,
                    top: 9,
                    height: SCREEN_H,
                    borderRadius: 20,
                    backgroundColor: "#0b0c0e",
                    boxShadow: "0 0 0 1px rgba(0,0,0,1)",
                  }
                : {
                    position: "absolute",
                    inset: 11,
                    borderRadius: 44,
                    backgroundColor: "#0b0c0e",
                    boxShadow:
                      "0 0 0 1px rgba(0,0,0,1), 0 0 0 2.5px rgba(255,255,255,.05)",
                  }
            }
          >
            {children}

            {isPixel ? <PixelStatusBar /> : <IphoneStatusBar />}
            {isPixel ? <PunchHole /> : <DynamicIsland />}
            <GestureBar android={isPixel} />

            {/* Refleks na szkle — subtelny, bez góry pod przekątną. */}
            <div
              className="pointer-events-none absolute inset-0 z-[60]"
              style={{
                background: isPixel
                  ? "linear-gradient(160deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,0) 34%)"
                  : "linear-gradient(148deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,.035) 18%, rgba(255,255,255,0) 38%)",
              }}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/** iOS: czas po lewej, zasięg kreskami, Wi‑Fi i bateria w stylu iOS. */
const IphoneStatusBar = () => (
  <div
    className="pointer-events-none absolute inset-x-0 top-0 z-[70] flex items-center justify-between"
    style={{ height: SAFE_TOP, padding: "0 32px 0 36px" }}
  >
    <span
      className="text-white font-semibold tabular-nums"
      style={{ fontSize: 16, letterSpacing: 0.2, paddingTop: 18 }}
    >
      21:37
    </span>
    <div
      className="flex items-end"
      style={{ gap: 6, paddingTop: 20, paddingRight: 2 }}
      aria-hidden
    >
      <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
        <rect x="0" y="7.5" width="3" height="4.5" rx="1" fill="#fff" />
        <rect x="5" y="5" width="3" height="7" rx="1" fill="#fff" />
        <rect x="10" y="2.5" width="3" height="9.5" rx="1" fill="#fff" />
        <rect
          x="15"
          y="0"
          width="3"
          height="12"
          rx="1"
          fill="#fff"
          opacity="0.35"
        />
      </svg>
      <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
        <path d="M8 10.2 9.9 8.1a3 3 0 0 0-3.8 0L8 10.2Z" fill="#fff" />
        <path
          d="M3.6 5.4a7.2 7.2 0 0 1 8.8 0"
          stroke="#fff"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M1.1 2.6a11.4 11.4 0 0 1 13.8 0"
          stroke="#fff"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
      <svg width="26" height="13" viewBox="0 0 26 13" fill="none">
        <rect
          x="0.6"
          y="0.6"
          width="21"
          height="11.8"
          rx="3.4"
          stroke="#fff"
          strokeOpacity="0.5"
          strokeWidth="1.1"
        />
        <rect x="2.4" y="2.4" width="13.5" height="8.2" rx="2.1" fill="#fff" />
        <path
          d="M23.4 4.4v4.2c1.1-.35 1.8-1.05 1.8-2.1s-.7-1.75-1.8-2.1Z"
          fill="#fff"
          fillOpacity="0.5"
        />
      </svg>
    </div>
  </div>
);

/** Android: mniejsza czcionka, zasięg trójkątem, inna bateria. */
const PixelStatusBar = () => (
  <div
    className="pointer-events-none absolute inset-x-0 top-0 z-[70] flex items-center justify-between"
    style={{ height: SAFE_TOP, padding: "0 18px 0 22px" }}
  >
    <span
      style={{
        fontSize: 13,
        fontWeight: 500,
        color: "#E8EAED",
        letterSpacing: 0.2,
        paddingTop: 15,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      21:37
    </span>
    <div
      className="flex items-center"
      style={{ gap: 5, paddingTop: 17 }}
      aria-hidden
    >
      <svg width="15" height="12" viewBox="0 0 15 12" fill="none">
        <path d="M0 12h15L0 0v12Z" fill="#E8EAED" opacity="0.9" />
      </svg>
      <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
        <path
          d="M1 3.4a9 9 0 0 1 12 0"
          stroke="#E8EAED"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M3.4 6a5.4 5.4 0 0 1 7.2 0"
          stroke="#E8EAED"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="7" cy="9" r="1.1" fill="#E8EAED" />
      </svg>
      <svg width="20" height="11" viewBox="0 0 20 11" fill="none">
        <path
          d="M1 4.2h13.5v2.6H1z"
          fill="#E8EAED"
          fillOpacity="0.35"
          stroke="#E8EAED"
          strokeOpacity="0.7"
          strokeWidth="1"
        />
        <rect x="2.4" y="5.4" width="8.4" height="1.6" fill="#E8EAED" />
        <path
          d="M16.4 6.1v1.6l1.4-.8-1.4-.8Z"
          fill="#E8EAED"
          fillOpacity="0.6"
        />
      </svg>
    </div>
  </div>
);

/** Dynamic Island — wyrwa w ekranie, z soczewką. */
const DynamicIsland = () => (
  <div
    className="pointer-events-none absolute left-1/2 z-[80]"
    style={{
      top: 11,
      width: 125,
      height: 37,
      transform: "translateX(-50%)",
      borderRadius: 20,
      background: "#000",
      boxShadow:
        "inset 0 0 0 1px rgba(255,255,255,.045), 0 1px 2px rgba(0,0,0,.6)",
    }}
    aria-hidden
  >
    <span
      className="absolute rounded-full"
      style={{
        right: 11,
        top: "50%",
        width: 11,
        height: 11,
        transform: "translateY(-50%)",
        background:
          "radial-gradient(circle at 35% 32%, #1d2b44 0%, #0a0f18 55%, #05070b 100%)",
        boxShadow: "inset 0 0 1px rgba(120,160,255,.35)",
      }}
    />
  </div>
);

/** Otwór na aparat — mały krążek wtopiony w ekran. */
const PunchHole = () => (
  <div
    className="pointer-events-none absolute left-1/2 z-[80]"
    style={{
      top: 14,
      width: PUNCH_HOLE,
      height: PUNCH_HOLE,
      transform: "translateX(-50%)",
      borderRadius: "50%",
      background:
        "radial-gradient(circle at 34% 30%, #22334d 0%, #0a0f18 58%, #04060a 100%)",
      boxShadow: "0 0 0 1.5px #000, inset 0 0 1px rgba(120,160,255,.4)",
    }}
    aria-hidden
  />
);

/** Pasek gestów: iOS szeroki, Android krótki i wyżej. */
const GestureBar = ({ android }: { android: boolean }) => (
  <div
    className="pointer-events-none absolute inset-x-0 bottom-0 z-[70] flex justify-center"
    style={{ paddingBottom: android ? SAFE_BOTTOM - 16 : 8 }}
    aria-hidden
  >
    <span
      style={
        android
          ? {
              width: 108,
              height: 3.5,
              borderRadius: 2,
              background: "rgba(232,234,237,.85)",
            }
          : {
              width: 139,
              height: 5,
              borderRadius: 3,
              background: "rgba(255,255,255,.82)",
            }
      }
    />
  </div>
);
