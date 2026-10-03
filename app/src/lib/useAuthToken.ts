import { useAuth } from '@clerk/expo';
import { useCallback } from 'react';

/**
 * The Clerk session token, as a function.
 *
 * Everything that talks to the backend (REST calls, the WebSocket handshake,
 * evidence uploads) goes through here. Clerk keeps the token fresh internally,
 * so we always get a valid one rather than caching a 60-second JWT ourselves.
 */
export function useAuthToken(): () => Promise<string | null> {
  const { getToken } = useAuth();

  return useCallback(async () => {
    try {
      return await getToken();
    } catch {
      return null;
    }
  }, [getToken]);
}
