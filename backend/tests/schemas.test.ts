import { describe, expect, it } from "vitest";

import {
  alertIdParams,
  alertLevelSchema,
  createAlertBody,
  updateContactBody,
} from "../src/schemas.js";

describe("createAlertBody", () => {
  it("accepts each level", () => {
    for (const level of [1, 2, 3, 4]) {
      expect(createAlertBody.parse({ level })).toMatchObject({ level });
    }
  });

  it("rejects a level outside the scale", () => {
    expect(createAlertBody.safeParse({ level: 5 }).success).toBe(false);
    expect(createAlertBody.safeParse({ level: 0 }).success).toBe(false);
    expect(createAlertBody.safeParse({ level: 2.5 }).success).toBe(false);
  });

  it("rejects a level sent as a string", () => {
    // The API is JSON; the mobile client must send a number, not "4".
    expect(createAlertBody.safeParse({ level: "4" }).success).toBe(false);
  });

  it("rejects coordinates outside the globe", () => {
    expect(createAlertBody.safeParse({ level: 1, lat: 91 }).success).toBe(
      false,
    );
    expect(createAlertBody.safeParse({ level: 1, lng: -181 }).success).toBe(
      false,
    );
  });

  it("allows an alert with no location", () => {
    expect(createAlertBody.safeParse({ level: 2 }).success).toBe(true);
  });

  it("rejects an overlong message", () => {
    expect(
      createAlertBody.safeParse({ level: 1, message: "x".repeat(1001) })
        .success,
    ).toBe(false);
  });
});

describe("updateContactBody", () => {
  it("rejects an empty patch", () => {
    expect(updateContactBody.safeParse({}).success).toBe(false);
  });

  it("rejects an unknown min level", () => {
    expect(updateContactBody.safeParse({ minLevel: 9 }).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(updateContactBody.safeParse({ email: "not-an-email" }).success).toBe(
      false,
    );
  });
});

describe("alertIdParams", () => {
  it("demands a uuid", () => {
    expect(alertIdParams.safeParse({ alertId: "not-a-uuid" }).success).toBe(
      false,
    );
    // Version nibble must be 4, as Postgres generates.
    expect(
      alertIdParams.safeParse({
        alertId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      }).success,
    ).toBe(true);
    expect(
      alertIdParams.safeParse({
        alertId: "11111111-1111-1111-1111-111111111111",
      }).success,
    ).toBe(false);
  });
});

describe("alertLevelSchema", () => {
  it("narrows to the union type", () => {
    expect(alertLevelSchema.parse(3)).toBe(3);
  });
});
