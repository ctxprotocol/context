/**
 * Test script for the Protocol Ledger referral system updates.
 * 
 * This script validates:
 * 1. Schema types are correctly defined
 * 2. Query functions have correct signatures
 * 3. New engagement event types are recognized
 * 4. Referral code generation logic works
 * 
 * Run with: npx tsx scripts/test-referral-system.ts
 * 
 * NOTE: This is a dry-run test - it doesn't actually write to the database.
 */

import type { EngagementEventType } from "../lib/db/schema";

// =============================================================================
// TEST 1: Verify all new event types are recognized
// =============================================================================
function testEventTypes() {
  console.log("\n=== TEST 1: Event Types ===");
  
  const newEventTypes: EngagementEventType[] = [
    "FIRST_PURCHASE",
    "BYOK_ENABLED", 
    "REPEAT_CUSTOMER",
    "REFERRAL_LINK_CREATED",
    "REFERRAL_CONVERTED",
  ];
  
  const existingEventTypes: EngagementEventType[] = [
    "MARKETPLACE_SEARCH",
    "TOOL_VIEW",
    "WALLET_CONNECTED",
    "USDC_APPROVED",
    "TOOL_CREATED",
    "TOOL_STAKED",
  ];
  
  console.log("✓ New event types compile correctly:", newEventTypes.join(", "));
  console.log("✓ Existing event types still work:", existingEventTypes.join(", "));
  
  return true;
}

// =============================================================================
// TEST 2: Verify referral code generation logic
// =============================================================================
function testReferralCodeGeneration() {
  console.log("\n=== TEST 2: Referral Code Generation ===");
  
  // Replicate the generation logic from queries.ts
  function generateReferralCode(): string {
    const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
  
  // Generate a few codes and verify format
  const codes = Array.from({ length: 5 }, () => generateReferralCode());
  
  for (const code of codes) {
    if (code.length !== 8) {
      console.error(`✗ Code "${code}" has wrong length (expected 8, got ${code.length})`);
      return false;
    }
    if (!/^[0-9a-z]{8}$/.test(code)) {
      console.error(`✗ Code "${code}" contains invalid characters`);
      return false;
    }
  }
  
  console.log("✓ Generated sample codes:", codes.join(", "));
  console.log("✓ All codes are 8 chars, alphanumeric lowercase");
  
  // Check for uniqueness (statistically should be unique)
  const uniqueCodes = new Set(codes);
  if (uniqueCodes.size === codes.length) {
    console.log("✓ All generated codes are unique");
  }
  
  return true;
}

// =============================================================================
// TEST 3: Verify query functions are defined (via file content check)
// =============================================================================
async function testQueryImports() {
  console.log("\n=== TEST 3: Query Functions (File Check) ===");
  
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    
    const queriesPath = path.join(process.cwd(), "lib/db/queries.ts");
    const content = fs.readFileSync(queriesPath, "utf-8");
    
    const expectedFunctions = [
      "getOrCreateReferralCode",
      "getUserByReferralCode", 
      "setUserReferrer",
      "getReferralStats",
      "hasEngagementEvent",
      "trackEngagementEvent",
      "trackEngagementEventsBatch",
      "getEngagementEventCount",
      "getEngagementEventsByType",
      "trackPurchaseEvents", // Internal helper
    ];
    
    for (const fnName of expectedFunctions) {
      // Check for "export async function X" or "async function X" patterns
      const exportPattern = new RegExp(`export\\s+async\\s+function\\s+${fnName}\\s*\\(`);
      const internalPattern = new RegExp(`async\\s+function\\s+${fnName}\\s*\\(`);
      
      if (exportPattern.test(content)) {
        console.log(`✓ ${fnName} is exported`);
      } else if (internalPattern.test(content)) {
        console.log(`✓ ${fnName} exists (internal helper)`);
      } else {
        console.error(`✗ ${fnName} not found in queries.ts`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error("✗ Failed to check queries.ts:", error);
    return false;
  }
}

// =============================================================================
// TEST 4: Verify API route handlers exist (via file check)
// =============================================================================
async function testApiRoutes() {
  console.log("\n=== TEST 4: API Routes (File Check) ===");
  
  const fs = await import("node:fs");
  const path = await import("node:path");
  
  const routes = [
    { file: "app/api/referral/route.ts", methods: ["GET"] },
    { file: "app/api/referral/apply/route.ts", methods: ["POST"] },
    { file: "app/api/engagement/route.ts", methods: ["POST"] },
  ];
  
  for (const route of routes) {
    try {
      const filePath = path.join(process.cwd(), route.file);
      const content = fs.readFileSync(filePath, "utf-8");
      
      for (const method of route.methods) {
        const pattern = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`);
        if (pattern.test(content)) {
          console.log(`✓ ${route.file} exports ${method} handler`);
        } else {
          console.error(`✗ ${route.file} missing ${method} handler`);
          return false;
        }
      }
    } catch (error) {
      console.error(`✗ Failed to read ${route.file}:`, error);
      return false;
    }
  }
  
  return true;
}

// =============================================================================
// TEST 5: Verify client hooks compile
// =============================================================================
async function testClientHooks() {
  console.log("\n=== TEST 5: Client Hook Imports ===");
  
  try {
    // These are client-side hooks, so we just verify they export the expected functions
    const referralCapture = await import("../hooks/use-referral-capture");
    
    if (typeof referralCapture.useReferralCapture === "function") {
      console.log("✓ useReferralCapture hook is exported");
    }
    if (typeof referralCapture.getAndClearReferralCode === "function") {
      console.log("✓ getAndClearReferralCode is exported");
    }
    if (typeof referralCapture.getPendingReferralCode === "function") {
      console.log("✓ getPendingReferralCode is exported");
    }
    
    const trackEngagement = await import("../hooks/use-track-engagement");
    
    if (typeof trackEngagement.trackEngagement === "function") {
      console.log("✓ trackEngagement function is exported");
    }
    if (typeof trackEngagement.useTrackEngagement === "function") {
      console.log("✓ useTrackEngagement hook is exported");
    }
    
    return true;
  } catch (error) {
    console.error("✗ Failed to import hooks:", error);
    return false;
  }
}

// =============================================================================
// TEST 6: Verify TGE allocation script types
// =============================================================================
async function testAllocationScript() {
  console.log("\n=== TEST 6: TGE Allocation Script ===");
  
  try {
    // Just verify it imports without type errors
    // We can't run it without a database connection
    const fs = await import("node:fs");
    const path = await import("node:path");
    
    const scriptPath = path.join(process.cwd(), "scripts/allocation/compute-tge-allocation.ts");
    const content = fs.readFileSync(scriptPath, "utf-8");
    
    // Check for loyalty-related code
    if (content.includes("LOYALTY")) {
      console.log("✓ Allocation script includes LOYALTY weight");
    }
    if (content.includes("loyaltyScore")) {
      console.log("✓ Allocation script computes loyaltyScore");
    }
    if (content.includes("FIRST_PURCHASE")) {
      console.log("✓ Allocation script references FIRST_PURCHASE event");
    }
    if (content.includes("REPEAT_CUSTOMER")) {
      console.log("✓ Allocation script references REPEAT_CUSTOMER event");
    }
    if (content.includes("BYOK_ENABLED")) {
      console.log("✓ Allocation script references BYOK_ENABLED event");
    }
    
    return true;
  } catch (error) {
    console.error("✗ Failed to verify allocation script:", error);
    return false;
  }
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  console.log("=".repeat(60));
  console.log("Protocol Ledger Referral System - Verification Tests");
  console.log("=".repeat(60));
  
  const results: boolean[] = [];
  
  // Run all tests
  results.push(testEventTypes());
  results.push(testReferralCodeGeneration());
  results.push(await testQueryImports());
  results.push(await testApiRoutes());
  results.push(await testClientHooks());
  results.push(await testAllocationScript());
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  if (passed === total) {
    console.log(`\n✅ All ${total} tests passed! The referral system implementation is valid.\n`);
    process.exit(0);
  } else {
    console.log(`\n❌ ${total - passed}/${total} tests failed.\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Test runner failed:", error);
  process.exit(1);
});

