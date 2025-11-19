# Context: Simple Payment Infrastructure (MVP)

## Vision Alignment
Context is the "crypto-decentralized App Store for AI" where developers earn as data brokers. This **simplified MVP plan** implements the core economic loop: developers list tools → you manually verify → users pay micropayments → developers claim earnings.

**Key Difference from Full Plan:** No community staking system. Manual verification only. Add staking later as v2.

---

## PHASE 1: Minimal Database Schema (Future-Proof)

### 1.1 Update `aiTool` Table

Modify existing table with fields you'll USE NOW + placeholders for future:

**Fields to Use Immediately:**
- `isVerified: boolean (default false)` - Manual approval badge
- `verifiedBy: uuid (FK → user, nullable)` - Admin who approved
- `verifiedAt: timestamp (nullable)` - When approved
- `averageRating: numeric(3, 2) (nullable)` - 0-5 stars (start collecting)
- `totalReviews: integer (default 0)` - Review count
- `uptimePercent: numeric(5, 2) (default 100)` - Track from day 1
- `successRate: numeric(5, 2) (default 100)` - Query success %
- `totalFlags: integer (default 0)` - User reports

**Future-Proof Placeholders (nullable, unused for now):**
- `listingFee: numeric(18, 6) (nullable)` - For Phase 2
- `totalStaked: numeric(18, 6) (default 0)` - For Phase 3 (staking)

**Keep Existing:**
- id, name, description, developerId, developerWallet, pricePerQuery, toolSchema, apiEndpoint, isActive, category, iconUrl, totalQueries, totalRevenue, createdAt, updatedAt

### 1.2 Keep Existing `toolQuery` Table ✅

Already tracks query transactions with all needed fields.

### 1.3 Create Simple `toolReport` Table (Optional)

Minimal moderation system:

```typescript
{
  id: uuid (PK),
  toolId: uuid (FK → aiTool),
  reporterId: uuid (FK → user),
  reason: text,
  status: varchar (enum: 'pending', 'resolved'),
  createdAt: timestamp
}
```

### 1.4 Skip These Tables (Add in Phase 3)
- ❌ `toolStake` (no staking yet)
- ❌ `toolReview` (can add later)
- ❌ `toolMetric` (can track in toolQuery for now)

### 1.5 Generate & Apply Migration

Run `pnpm db:generate` and `pnpm db:migrate`

---

## PHASE 2: Simple Smart Contract (ContextRouter)

### 2.1 Contract Architecture

**File:** `/hardhat/contracts/ContextRouter.sol`

The contract handles ONLY payment operations. ~120 lines of Solidity.

**Core Operations:**
- `executePaidQuery(toolId, developerWallet, amount)` - User pays for query
- `claimEarnings()` - Developer withdraws earnings
- `claimPlatformFees()` - Platform withdraws 10% fees

**That's it.** No staking, no slashing, no complexity.

### 2.2 State Variables

```solidity
IERC20 public immutable usdc;
uint256 public constant PLATFORM_FEE_PERCENT = 10; // 10%

// Revenue tracking
mapping(address => uint256) public developerBalances; // developer => unclaimed earnings
uint256 public platformBalance; // unclaimed platform fees
```

### 2.3 Complete Contract Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ContextRouter
 * @notice Simple payment router for Context AI tool marketplace
 * @dev Splits query payments: 90% to developer, 10% to platform
 */
contract ContextRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // State variables
    IERC20 public immutable usdc;
    uint256 public constant PLATFORM_FEE_PERCENT = 10;
    
    // Tracking
    mapping(address => uint256) public developerBalances;
    uint256 public platformBalance;
    
    // Events
    event QueryPaid(
        uint256 indexed toolId,
        address indexed user,
        address indexed developer,
        uint256 amount,
        uint256 platformFee
    );
    event EarningsClaimed(address indexed developer, uint256 amount);
    event PlatformFeesClaimed(address indexed platform, uint256 amount);

    constructor(address _usdcAddress) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        usdc = IERC20(_usdcAddress);
    }

    /**
     * @notice User pays for a tool query
     * @param toolId The ID of the tool being used
     * @param developerWallet The wallet address of the tool creator
     * @param amount The total amount to pay (in USDC, e.g., 10000 = $0.01)
     */
    function executePaidQuery(
        uint256 toolId,
        address developerWallet,
        uint256 amount
    ) external nonReentrant {
        require(developerWallet != address(0), "Invalid developer address");
        require(amount > 0, "Amount must be greater than 0");

        // Transfer USDC from user to this contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate platform fee (10%)
        uint256 platformFee = (amount * PLATFORM_FEE_PERCENT) / 100;
        uint256 developerEarning = amount - platformFee;

        // Update balances
        developerBalances[developerWallet] += developerEarning;
        platformBalance += platformFee;

        emit QueryPaid(toolId, msg.sender, developerWallet, amount, platformFee);
    }

    /**
     * @notice Developer claims their accumulated earnings
     */
    function claimEarnings() external nonReentrant {
        uint256 balance = developerBalances[msg.sender];
        require(balance > 0, "No earnings to claim");

        developerBalances[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, balance);

        emit EarningsClaimed(msg.sender, balance);
    }

    /**
     * @notice Platform owner claims accumulated fees
     */
    function claimPlatformFees() external onlyOwner nonReentrant {
        uint256 balance = platformBalance;
        require(balance > 0, "No fees to claim");

        platformBalance = 0;
        usdc.safeTransfer(owner(), balance);

        emit PlatformFeesClaimed(owner(), balance);
    }

    /**
     * @notice Get unclaimed balance for a developer
     */
    function getUnclaimedBalance(address developer) external view returns (uint256) {
        return developerBalances[developer];
    }

    /**
     * @notice Get platform's unclaimed fees
     */
    function getPlatformBalance() external view returns (uint256) {
        return platformBalance;
    }
}
```

### 2.4 Comprehensive Tests

**File:** `/hardhat/test/ContextRouter.test.ts`

Test Coverage (>80%):
- ✅ Successful query payment
- ✅ Correct fee split (10% platform, 90% developer)
- ✅ Multiple queries accumulate balance
- ✅ Developer claims earnings correctly
- ✅ Platform claims fees correctly
- ✅ Cannot claim zero balance
- ✅ Cannot claim other's balance
- ✅ ReentrancyGuard prevents reentrancy
- ✅ Revert on zero amount
- ✅ Revert on zero address
- ✅ Multiple developers independently
- ✅ Event emissions with correct parameters

### 2.5 Hardhat Setup

**Directory:** `/hardhat/`

**Dependencies:**
```bash
hardhat
@nomicfoundation/hardhat-toolbox
@nomicfoundation/hardhat-verify
@openzeppelin/contracts
typescript
ts-node
@types/node
```

**hardhat.config.ts:**
```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 84532,
    },
    base: {
      url: process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 8453,
    },
  },
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_API_KEY || "",
      base: process.env.BASESCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      }
    ]
  },
};

export default config;
```

**USDC Addresses:**
- Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Base Mainnet: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

### 2.6 Deployment Script

**File:** `/hardhat/scripts/deploy.ts`

```typescript
import { ethers } from "hardhat";

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`Deploying to: ${network.name} (chainId: ${network.chainId})`);

  // USDC addresses
  const USDC_ADDRESSES: Record<number, string> = {
    84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  // Base Mainnet
  };

  const usdcAddress = USDC_ADDRESSES[network.chainId];
  if (!usdcAddress) {
    throw new Error(`USDC not configured for chain ${network.chainId}`);
  }

  console.log(`Using USDC: ${usdcAddress}`);

  // Deploy
  const ContextRouter = await ethers.getContractFactory("ContextRouter");
  const router = await ContextRouter.deploy(usdcAddress);
  await router.deployed();

  console.log(`✅ ContextRouter deployed: ${router.address}`);
  console.log(`\nAdd to .env.local:`);
  console.log(`NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS=${router.address}`);

  // Wait for confirmations
  console.log("\nWaiting for confirmations...");
  await router.deployTransaction.wait(5);

  console.log(`\n🔍 Verify with:`);
  console.log(`npx hardhat verify --network ${network.name} ${router.address} ${usdcAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

---

## PHASE 3: Wagmi Integration

### 3.1 Install Dependencies

In project root:
```bash
pnpm add wagmi @privy-io/wagmi @tanstack/react-query viem
```

### 3.2 Create Wagmi Config

**File:** `/lib/wagmi.ts`

```typescript
import { createConfig } from '@privy-io/wagmi'; // ⚠️ From Privy, NOT wagmi!
import { base, baseSepolia } from 'viem/chains';
import { http } from 'wagmi';

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});
```

### 3.3 Update Providers

**File:** `/components/providers.tsx`

**Critical nesting order:**
```
PrivyProvider
  └─ QueryClientProvider (NEW)
      └─ WagmiProvider (NEW - from @privy-io/wagmi)
          └─ SessionProvider
              └─ SessionSyncManager
                  └─ {children}
```

**Code:**
```typescript
'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { SessionProvider } from 'next-auth/react';
import { WagmiProvider } from '@privy-io/wagmi'; // ⚠️ From Privy!
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { privyConfig } from '../privy.config';
import { wagmiConfig } from '@/lib/wagmi';
import { useSessionSync } from '@/hooks/use-session-sync';

const queryClient = new QueryClient();

function SessionSyncManager({ children }: { children: React.ReactNode }) {
  useSessionSync();
  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
      config={privyConfig}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <SessionProvider>
            <SessionSyncManager>
              {children}
            </SessionSyncManager>
          </SessionProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
```

### 3.4 Contract Hooks

**File:** `/hooks/contracts/use-context-router.ts`

```typescript
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import ContextRouterABI from '@/lib/contracts/ContextRouter.json';

const CONTEXT_ROUTER_ADDRESS = process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS as `0x${string}`;
const USDC_DECIMALS = 6;

/**
 * Hook to execute a paid query
 */
export function useExecutePaidQuery() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();

  const executePaidQuery = async (
    toolId: number,
    developerWallet: `0x${string}`,
    amountUSD: number // e.g., 0.01 for $0.01
  ) => {
    const amountInWei = parseUnits(amountUSD.toString(), USDC_DECIMALS);
    
    return await writeContractAsync({
      address: CONTEXT_ROUTER_ADDRESS,
      abi: ContextRouterABI.abi,
      functionName: 'executePaidQuery',
      args: [BigInt(toolId), developerWallet, amountInWei],
    });
  };

  return { executePaidQuery, hash, isPending, error };
}

/**
 * Hook to claim developer earnings
 */
export function useClaimEarnings() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();

  const claimEarnings = async () => {
    return await writeContractAsync({
      address: CONTEXT_ROUTER_ADDRESS,
      abi: ContextRouterABI.abi,
      functionName: 'claimEarnings',
    });
  };

  return { claimEarnings, hash, isPending, error };
}

/**
 * Hook to get unclaimed balance for a developer
 */
export function useGetUnclaimedBalance(developerAddress?: `0x${string}`) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTEXT_ROUTER_ADDRESS,
    abi: ContextRouterABI.abi,
    functionName: 'getUnclaimedBalance',
    args: developerAddress ? [developerAddress] : undefined,
  });

  const balanceUSD = data ? Number(formatUnits(data as bigint, USDC_DECIMALS)) : 0;

  return { balance: data as bigint | undefined, balanceUSD, isLoading, error, refetch };
}

/**
 * Hook to wait for transaction confirmation
 */
export function useWaitForTransaction(hash?: `0x${string}`) {
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return { isConfirmed: isSuccess, isLoading };
}
```

### 3.5 Copy Contract ABI

After deployment:
```bash
mkdir -p lib/contracts
cp hardhat/artifacts/contracts/ContextRouter.sol/ContextRouter.json lib/contracts/
```

---

## PHASE 4: Database Query Functions

### 4.1 Extend `/lib/db/queries.ts`

**Core Tool Functions (8 total):**

1. `createAITool(toolData)` - Create tool, set `isDeveloper = true` on user
2. `getAIToolById(toolId)` - Fetch tool details
3. `getAllActiveTools()` - Marketplace listing
4. `getVerifiedTools()` - Only verified tools
5. `getToolsByDeveloper(developerId)` - Developer's tools
6. `updateAITool(toolId, updates)` - Edit tool
7. `verifyTool(toolId, adminId)` - Set `isVerified = true`, record who approved
8. `updateToolStats(toolId, stats)` - Increment queries, update revenue

**Query Tracking (3 functions):**

9. `recordToolQuery(queryData)` - Log transaction from blockchain
10. `getToolQueryHistory(toolId)` - Analytics
11. `getUserQueryHistory(userId)` - User's payment history

**Developer Earnings (1 function):**

12. `getDeveloperEarnings(developerId)` - Combine on-chain + DB data

**Total: 12 functions** (vs 21 in full plan)

---

## Environment Variables

Add to `/.env.local`:

```bash
# Hardhat Deployment
DEPLOYER_PRIVATE_KEY=0x...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=...

# Contracts (after deployment)
NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Platform
PLATFORM_TREASURY_ADDRESS=0x...
```

---

## Step-by-Step Execution Checklist

### CHECKPOINT 1: Database Schema ✅ (DONE - Basic version)
- [x] aiTool table exists
- [x] toolQuery table exists
- [x] user.walletAddress added
- [x] user.isDeveloper exists

### CHECKPOINT 2: Enhanced Schema (Minimal)
- [ ] Add verification fields to aiTool (isVerified, verifiedBy, verifiedAt)
- [ ] Add reputation fields (averageRating, totalReviews, uptimePercent, etc.)
- [ ] Add future-proof placeholders (listingFee, totalStaked - nullable)
- [ ] Optionally create toolReport table
- [ ] Generate migration
- [ ] Apply migration
- **PAUSE FOR REVIEW**

### CHECKPOINT 3: Hardhat Setup
- [ ] Create /hardhat/ directory
- [ ] Install dependencies
- [ ] Create hardhat.config.ts
- [ ] Create .gitignore
- **PAUSE FOR REVIEW**

### CHECKPOINT 4: Smart Contract
- [ ] Implement ContextRouter.sol (simple version)
- [ ] Write comprehensive tests
- [ ] Run tests - all pass
- [ ] Check coverage >80%
- **PAUSE FOR REVIEW**

### CHECKPOINT 5: Deploy Contract
- [ ] Deploy to Base Sepolia
- [ ] Verify on Basescan
- [ ] Test transaction manually
- [ ] Document contract address
- **PAUSE FOR REVIEW**

### CHECKPOINT 6: Wagmi Integration
- [ ] Install dependencies
- [ ] Create lib/wagmi.ts
- [ ] Update components/providers.tsx
- [ ] Copy contract ABI
- [ ] Create hooks/contracts/use-context-router.ts
- [ ] No TypeScript errors
- **PAUSE FOR REVIEW**

### CHECKPOINT 7: Database Queries
- [ ] Implement 12 query functions
- [ ] Test createAITool sets isDeveloper
- [ ] Test verifyTool function
- [ ] Test recordToolQuery
- **PAUSE FOR REVIEW**

### CHECKPOINT 8: Integration Test (Optional)
- [ ] Create test page to execute full flow
- [ ] Pay for query via UI
- [ ] Verify transaction on Basescan
- [ ] Developer claims earnings
- **FINAL REVIEW**

---

## Success Criteria

✅ Database has aiTool (enhanced), toolQuery, optional toolReport
✅ ContextRouter.sol deployed and verified on Base Sepolia
✅ All tests pass with >80% coverage
✅ Wagmi hooks work in Next.js components
✅ Can execute: create tool → approve → pay for query → claim earnings
✅ No TypeScript or linter errors
✅ Provide test transaction hash showing payment
✅ Total implementation time: ~1-2 weeks (vs 4-6 weeks for full version)

---

## Key Simplifications vs Full Plan

| Feature | Full Plan (ContextVault) | This Plan (ContextRouter) |
|---------|-------------------------|--------------------------|
| **Contract** | ~400 lines + staking | ~120 lines, payments only |
| **Database Tables** | 6 tables | 2-3 tables |
| **Verification** | Community staking OR manual | Manual only |
| **Listing Fee** | $50 USDC on-chain | Optional, can add later |
| **Query Functions** | 21 functions | 12 functions |
| **Test Complexity** | High (staking flows) | Medium (payment flows) |
| **Implementation Time** | 4-6 weeks | 1-2 weeks |
| **Smart Contract Risk** | Higher (more complexity) | Lower (simple logic) |

---

## Migration Path to Full Version

When you're ready to add staking:

1. **Deploy NEW contract:** ContextVault.sol (with staking)
2. **Keep ContextRouter running:** Existing tools continue working
3. **Add database tables:** toolStake, toolReview, toolMetric
4. **Update UI:** Add "Stake" buttons, show staking progress
5. **Dual verification:** Tools can be "manually verified" OR "community verified"
6. **Gradual migration:** New tools use new system, old tools grandfathered

**The key:** Payment logic is separate from verification logic, so you can upgrade one without breaking the other.

---

## Why This MVP Approach Wins

1. **Speed:** Ship in 2 weeks vs 6 weeks
2. **Validation:** Test core thesis (will people pay?) faster
3. **Flexibility:** Learn what verification method users actually want
4. **Lower risk:** Simpler contract = easier audit, fewer bugs
5. **Same revenue:** 90/10 split works identically
6. **Future-proof:** Database ready for staking when needed
7. **Focus:** You manually curate quality instead of building governance

**Build this first. Add complexity only after you have users and revenue.**

