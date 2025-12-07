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

// ============================================================
// STAKING CONSTANTS
// ============================================================
// All tools require a minimum stake to prevent spam and ensure quality.
// This creates accountability even for free tools, similar to Apple's
// $99/year developer fee but fully refundable with 7-day withdrawal delay.
//
// Formula: requiredStake = MAX(MINIMUM_STAKE_USDC, pricePerQuery * STAKE_MULTIPLIER)
//
// Examples:
//   Free tool ($0.00/query)   → $10.00 stake (minimum applies)
//   $0.005/query tool         → $10.00 stake (minimum applies)
//   $0.01/query tool          → $10.00 stake (minimum applies)
//   $0.10/query tool          → $10.00 stake (100x = minimum)
//   $0.50/query tool          → $50.00 stake (100x applies)
//   $1.00/query tool          → $100.00 stake (100x applies)

/** Minimum stake required for ANY tool (including free tools) - $10.00 USDC */
export const MINIMUM_STAKE_USDC = 10.0;

/** Stake multiplier for paid tools - 100x the query price */
export const STAKE_MULTIPLIER = 100;

/**
 * Calculate required stake for a tool
 * @param pricePerQuery - Price per query in USD (as number)
 * @returns Required stake in USD
 */
export function calculateRequiredStake(pricePerQuery: number): number {
  const proportionalStake = pricePerQuery * STAKE_MULTIPLIER;
  return Math.max(MINIMUM_STAKE_USDC, proportionalStake);
}

// Vercel Cron Job Configuration
//
// IMPORTANT: These values must be manually synced to vercel.json
// (Vercel doesn't support dynamic cron schedules from code)
//
// Current Plan: Hobby
// - Max 2 cron jobs per project
// - Each job: once per day max
// - Execution can occur anytime within the specified hour
// - Max duration: 60 seconds
//
// When upgrading to Pro plan, update these schedules and vercel.json:
// - Pro allows: 40 cron jobs, every 1 minute frequency
//
// Cron format: "minute hour day month weekday"
// Examples:
//   "0 0 * * *"    = daily at midnight UTC
//   "0 * * * *"    = hourly (Pro only)
//   "0 0,6,12,18 * * *" = every 6 hours (Pro only)
export const CRON_CONFIG = {
  // Health check cron - validates tool endpoints are online
  // Hobby: Daily at 6 AM UTC
  // Pro recommendation: Hourly "0 * * * *"
  VALIDATE_TOOLS_SCHEDULE: "0 6 * * *",

  // Stake sync cron - syncs on-chain stake amounts to database
  // Hobby: Daily at 6 PM UTC (12 hours offset from health check)
  // Pro recommendation: Every 6 hours "0 0,6,12,18 * * *"
  SYNC_STAKES_SCHEDULE: "0 18 * * *",

  // Vercel plan limits reference
  PLAN: "hobby" as "hobby" | "pro",
  MAX_CRON_JOBS: 2,
  MIN_FREQUENCY_HOURS: 24, // Hobby = 24h, Pro = 0.0167h (1 min)
} as const;
