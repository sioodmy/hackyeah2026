import { config } from "../config.js";

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound?: string;
  priority?: "default" | "high";
}

export interface PushProvider {
  send(messages: PushMessage[]): Promise<void>;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Expo push implementation. A no-op when no access token is configured, and it
 * never throws: a failed push must not abort the alert that triggered it.
 */
class ExpoPushProvider implements PushProvider {
  async send(messages: PushMessage[]): Promise<void> {
    if (!config.EXPO_ACCESS_TOKEN || messages.length === 0) return;

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "accept-encoding": "gzip, deflate",
          authorization: `Bearer ${config.EXPO_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        console.warn(`push: Expo odrzucił żądanie (${response.status})`);
        return;
      }

      const body = (await response.json()) as {
        data?: { status?: string; message?: string }[];
      };

      const rejected = (body.data ?? []).filter(
        (item) => item.status === "error",
      );
      if (rejected.length > 0) {
        console.warn(`push: ${rejected.length} powiadomień odrzuconych`);
      }
    } catch (error) {
      console.warn("push: wysyłka nie powiodła się:", error);
    }
  }
}

export const pushProvider: PushProvider = new ExpoPushProvider();
