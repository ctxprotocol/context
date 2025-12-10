import assert from "node:assert/strict";
import test from "node:test";
import { executeSkillCode } from "@/lib/ai/code-executor";
import type { SkillRuntime } from "@/lib/ai/skills/runtime";

const NOT_PERMITTED_REGEX = /not permitted/i;

const runtime: SkillRuntime = {
  session: {
    user: {
      id: "test-user",
      email: "test@example.com",
      name: "Test User",
      type: "free",
    } as any,
  },
};

test("executeSkillCode runs allowed weather skill and returns structured data", async () => {
  const originalFetch = global.fetch;
  global.fetch = ((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("geocoding-api")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          results: [{ latitude: 10, longitude: 20 }],
        }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        current: { temperature_2m: 22 },
        hourly: { time: [], temperature_2m: [] },
        daily: { sunrise: [], sunset: [] },
      }),
    });
  }) as typeof fetch;

  try {
    const result = await executeSkillCode({
      code: `import { getWeather } from "@/lib/ai/skills/weather";

export async function main() {
  const weather = await getWeather({ city: "Lisbon" });
  return {
    city: weather.cityName,
    temperature: weather.current?.temperatureCelsius,
  };
}`,
      allowedModules: ["@/lib/ai/skills/weather"],
      runtime,
    });

    if (!result.ok) {
      console.error("executeSkillCode error:", result.error);
    }

    assert.equal(result.ok, true);
    if (result.ok) {
      const payload = result.data as { city?: string; temperature?: number };
      assert.equal(payload.city, "Lisbon");
      assert.equal(payload.temperature, 22);
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test("executeSkillCode rejects unauthorized modules", async () => {
  const result = await executeSkillCode({
    code: `import { getWeather } from "@/lib/ai/skills/weather";

export async function main() {
  // Try to use weather module when only a different module is allowed
  return getWeather({ city: "Test" });
}`,
    allowedModules: ["@/lib/ai/skills/storage"],
    runtime,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error ?? "", NOT_PERMITTED_REGEX);
  }
});
