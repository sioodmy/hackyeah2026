import { describe, expect, it } from "vitest";

import {
  alertLevelName,
  isCritical,
  notificationPriority,
  type Alert,
} from "../src/db/schema.js";
import {
  buildAlertPayload,
  notificationText,
} from "../src/services/notification.service.js";

function makeAlert(level: Alert["level"]): Alert {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    userId: "22222222-2222-2222-2222-222222222222",
    level,
    message: null,
    lat: 52.23,
    lng: 21.01,
    address: "Marszałkowska 1",
    status: "active",
    acknowledgedByContactId: null,
    acknowledgedAt: null,
    resolvedAt: null,
    escalatedFromId: null,
    createdAt: new Date("2026-10-03T12:00:00.000Z"),
    updatedAt: new Date("2026-10-03T12:00:00.000Z"),
  };
}

describe("alert levels", () => {
  it("names every level", () => {
    expect(alertLevelName(1)).toBe("uncomfortable");
    expect(alertLevelName(2)).toBe("unsafe");
    expect(alertLevelName(3)).toBe("danger");
    expect(alertLevelName(4)).toBe("omega");
  });

  it("treats level 3 and above as critical", () => {
    expect(isCritical(1)).toBe(false);
    expect(isCritical(2)).toBe(false);
    expect(isCritical(3)).toBe(true);
    expect(isCritical(4)).toBe(true);
  });

  it("escalates the delivery priority with the level", () => {
    expect(notificationPriority(1)).toBe("normal");
    expect(notificationPriority(2)).toBe("high");
    expect(notificationPriority(3)).toBe("high");
    expect(notificationPriority(4)).toBe("critical");
  });
});

describe("push payload", () => {
  it("carries the sender, location and level the app needs", () => {
    const payload = buildAlertPayload(makeAlert(4), {
      name: "Jane",
      phone: "+48123456789",
    });

    expect(payload).toMatchObject({
      type: "ALERT",
      level: 4,
      level_name: "omega",
      sender_name: "Jane",
      sender_phone: "+48123456789",
      priority: "critical",
      location: { lat: 52.23, lng: 21.01, address: "Marszałkowska 1" },
    });
  });

  it("writes an emergency body when omega has no message", () => {
    const payload = buildAlertPayload(makeAlert(4), {
      name: "Jane",
      phone: null,
    });
    const { title, body } = notificationText(payload);

    expect(title).toBe("Jane needs help");
    expect(body).toMatch(/EMERGENCY/i);
  });

  it("writes a call-me body for level 1", () => {
    const payload = buildAlertPayload(makeAlert(1), {
      name: "Jane",
      phone: null,
    });
    expect(notificationText(payload).body).toMatch(/call/i);
  });

  it("prefers the sender message when one was given", () => {
    const alert = { ...makeAlert(3), message: "on tram 22" };
    const payload = buildAlertPayload(alert, { name: "Jane", phone: null });

    expect(notificationText(payload).body).toBe("on tram 22");
  });

  it("names the contact who acknowledged", () => {
    const text = notificationText({
      type: "ALERT_ACKNOWLEDGED",
      alert_id: "abc",
      level: 4,
      contact_name: "Mama",
      priority: "high",
    });
    expect(text.body).toContain("Mama");
  });
});
