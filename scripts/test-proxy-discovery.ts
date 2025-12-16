#!/usr/bin/env npx tsx
/**
 * Test script for Proxy Wallet Discovery
 * 
 * Usage:
 *   npx tsx scripts/test-proxy-discovery.ts [wallet_address] [profile_url]
 * 
 * Examples:
 *   npx tsx scripts/test-proxy-discovery.ts 0x6D046...
 *   npx tsx scripts/test-proxy-discovery.ts 0x6D046... https://polymarket.com/profile/0xABC...
 * 
 * If no address provided, uses a test address.
 */

import { 
  discoverProxyWallets, 
  getWalletAddressesForProtocol,
  queryPolymarketProxyFactory,
  extractProxyFromProfileUrl,
  verifyPolymarketAddress,
  discoverPolymarketProxyAggressive,
} from "../lib/context/proxy-discovery";
import { fetchPolymarketPositions } from "../lib/context/polymarket";

async function main() {
  // Get wallet address from CLI arg or use test address
  const testAddress = process.argv[2] || "0x6D046A9f585541755081f0D424e97A924d8B95c8";
  const profileUrl = process.argv[3]; // Optional profile URL
  
  console.log("=".repeat(70));
  console.log("PROXY WALLET DISCOVERY TEST");
  console.log("=".repeat(70));
  console.log("Testing EOA:", testAddress);
  if (profileUrl) {
    console.log("Profile URL:", profileUrl);
  }
  console.log("");

  // Test 1: Query Gnosis Safe Factory (PRIMARY for MetaMask users)
  console.log("1. Querying Gnosis Safe Factory (computeProxyAddress)...");
  console.log("-".repeat(50));
  
  // Import the new function
  const { queryGnosisSafeFactory } = await import("../lib/context/proxy-discovery");
  
  const gnosisSafeProxy = await queryGnosisSafeFactory(testAddress);
  if (gnosisSafeProxy) {
    console.log("✅ Found Gnosis Safe proxy:");
    console.log("   Address:", gnosisSafeProxy.address);
    console.log("   Type:", gnosisSafeProxy.type);
    console.log("   Deployed:", gnosisSafeProxy.isDeployed);
  } else {
    console.log("❌ No Gnosis Safe proxy found for this EOA");
  }
  console.log("");

  // Test 1b: Query Polymarket Custom Proxy Factory (for MagicLink users)
  console.log("1b. Querying Polymarket Custom Proxy Factory...");
  console.log("-".repeat(50));
  const polymarketProxy = await queryPolymarketProxyFactory(testAddress);
  if (polymarketProxy) {
    console.log("✅ Found Polymarket custom proxy:");
    console.log("   Address:", polymarketProxy.address);
    console.log("   Type:", polymarketProxy.type);
    console.log("   Deployed:", polymarketProxy.isDeployed);
  } else {
    console.log("❌ No Polymarket custom proxy found for this EOA");
    console.log("   (This is expected if user uses MetaMask, not MagicLink)");
  }
  console.log("");

  // Test 2: Full discovery
  console.log("2. Running full proxy discovery...");
  console.log("-".repeat(50));
  const result = await discoverProxyWallets(testAddress, {
    polymarket: true,
    hyperliquid: true,
    scanEvents: false, // Set to true for thorough scan (slower)
  });
  
  console.log("Discovery result:");
  console.log("   EOA:", result.eoa);
  console.log("   Proxies found:", result.proxies.length);
  
  for (const proxy of result.proxies) {
    console.log("");
    console.log(`   ${proxy.protocol.toUpperCase()} (${proxy.type}):`);
    console.log("   - Address:", proxy.address);
    console.log("   - Method:", proxy.discoveryMethod);
    console.log("   - Deployed:", proxy.isDeployed);
  }
  
  if (result.errors.length > 0) {
    console.log("");
    console.log("   Errors:", result.errors);
  }
  console.log("");

  // Test 3: Get addresses for Polymarket
  console.log("3. Getting all addresses to query for Polymarket...");
  console.log("-".repeat(50));
  const polymarketAddresses = await getWalletAddressesForProtocol(testAddress, "polymarket");
  console.log("Addresses to query:", polymarketAddresses);
  console.log("");

  // Test 4: Try fetching positions from each address
  console.log("4. Fetching positions from discovered addresses...");
  console.log("-".repeat(50));
  
  for (const addr of polymarketAddresses) {
    console.log(`\nFetching from ${addr}...`);
    const positions = await fetchPolymarketPositions(addr);
    if (positions.length > 0) {
      console.log(`✅ Found ${positions.length} positions!`);
      for (const pos of positions.slice(0, 3)) {
        console.log(`   - ${pos.marketTitle?.slice(0, 50) || 'Unknown'}`);
        console.log(`     ${pos.outcome}: ${pos.shares} shares @ $${pos.avgEntryPrice.toFixed(3)}`);
      }
      if (positions.length > 3) {
        console.log(`   ... and ${positions.length - 3} more`);
      }
    } else {
      console.log("   No positions found");
    }
  }

  // Test 5: Profile URL extraction (if provided)
  if (profileUrl) {
    console.log("");
    console.log("5. Extracting proxy from profile URL...");
    console.log("-".repeat(50));
    const extracted = extractProxyFromProfileUrl(profileUrl);
    if (extracted) {
      console.log("✅ Extracted address:", extracted);
      
      // Verify this address has positions
      const verification = await verifyPolymarketAddress(extracted);
      console.log("   Verification:", verification);
      
      if (verification.hasPositions) {
        console.log("✅ This address has", verification.positionCount, "positions!");
        
        // Fetch and show positions
        const positions = await fetchPolymarketPositions(extracted);
        for (const pos of positions.slice(0, 3)) {
          console.log(`   - ${pos.marketTitle?.slice(0, 50) || 'Unknown'}`);
          console.log(`     ${pos.outcome}: ${pos.shares} shares @ $${pos.avgEntryPrice.toFixed(3)}`);
        }
      }
    } else {
      console.log("❌ Could not extract address from URL");
    }
  }

  // Test 6: Aggressive discovery (tries all methods)
  console.log("");
  console.log("6. Running aggressive proxy discovery...");
  console.log("-".repeat(50));
  const aggressiveResult = await discoverPolymarketProxyAggressive(testAddress, {
    profileUrl,
    scanEvents: false, // Set true for full scan (very slow)
  });
  if (aggressiveResult) {
    console.log("✅ Found proxy via aggressive discovery:");
    console.log("   Address:", aggressiveResult.address);
    console.log("   Type:", aggressiveResult.type);
    console.log("   Method:", aggressiveResult.discoveryMethod);
  } else {
    console.log("❌ No proxy found via any method");
    console.log("");
    console.log("💡 TIP: To manually find your Polymarket proxy wallet:");
    console.log("   1. Go to polymarket.com and log in");
    console.log("   2. Click your profile icon (top right)");
    console.log("   3. Copy the URL - it contains your proxy wallet address");
    console.log("   4. Run this test again with the URL:");
    console.log(`      npx tsx scripts/test-proxy-discovery.ts ${testAddress} YOUR_PROFILE_URL`);
  }

  console.log("");
  console.log("=".repeat(70));
  console.log("TEST COMPLETE");
  console.log("=".repeat(70));
}

main().catch(console.error);

