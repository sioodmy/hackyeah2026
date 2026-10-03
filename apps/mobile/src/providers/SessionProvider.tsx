import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { ClerkProvider, useAuth, useUser } from "@clerk/clerk-expo";
import { useSession as useClerkSession } from "@clerk/clerk-react";

import { config, isClerkConfigured } from "@/lib/env";
import { setTokenProvider } from "@/lib/api";

/** Header-based auth used when Clerk is not configured, for local demos. */
const DEV_TOKEN_PREFIX = "dev:";

/** Clerk session tokens live ~60s, so keep one fresh well before it lapses. */
const TOKEN_REFRESH_MS = 45_000;

const secureTokenCache = {
  getToken: async (key: string) => SecureStore.getItemAsync(key),
  saveToken: async (key: string, value: string) => {
    await SecureStore.setItemAsync(key, value);
  },
  clearToken: async (key: string) => {
    await SecureStore.deleteItemAsync(key);
  },
};

export interface Session {
  token: string | null;
  userId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isSignedIn: boolean;
  isDev: boolean;
}

const SessionContext = createContext<Session | null>(null);

const DEV_USER_ID = "dev-local-user";

function ClerkSession({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { session } = useClerkSession();
  const { user } = useUser();

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !session) {
      setToken(null);
      return;
    }

    let cancelled = false;
    const refresh = () => {
      void getToken().then((next) => {
        if (!cancelled) setToken(next);
      });
    };

    refresh();
    const timer = setInterval(refresh, TOKEN_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [getToken, isLoaded, isSignedIn, session]);

  useEffect(() => {
    setTokenProvider(() => token);
    return () => setTokenProvider(() => null);
  }, [token]);

  const value = useMemo<Session>(
    () => ({
      token,
      userId: user?.id ?? null,
      displayName:
        user?.firstName ??
        user?.username ??
        user?.emailAddresses[0]?.emailAddress ??
        null,
      avatarUrl: user?.imageUrl ?? null,
      isSignedIn: Boolean(isSignedIn),
      isDev: false,
    }),
    [isSignedIn, token, user],
  );

  if (!isLoaded) return null;

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

function DevSession({ children }: { children: React.ReactNode }) {
  const token = `${DEV_TOKEN_PREFIX}${DEV_USER_ID}`;

  useEffect(() => {
    setTokenProvider(() => token);
    return () => setTokenProvider(() => null);
  }, [token]);

  const value = useMemo<Session>(
    () => ({
      token,
      userId: DEV_USER_ID,
      displayName: "Ty (tryb demo)",
      avatarUrl: null,
      isSignedIn: true,
      isDev: true,
    }),
    [token],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  if (!isClerkConfigured) {
    return <DevSession>{children}</DevSession>;
  }

  return (
    <ClerkProvider
      publishableKey={config.clerkPublishableKey}
      tokenCache={secureTokenCache}
    >
      <ClerkSession>{children}</ClerkSession>
    </ClerkProvider>
  );
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
