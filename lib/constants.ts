import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

/**
 * Base URL for the application
 * Used for generating URLs in API responses, emails, etc.
 *
 * Priority: NEXT_PUBLIC_APP_URL env var > production default > localhost
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (isProductionEnvironment
    ? "https://ctxprotocol.com"
    : "http://localhost:3000");

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();
