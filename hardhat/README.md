# Context Smart Contracts

Payment infrastructure for Context AI tool marketplace.

## 📋 Contracts

- **ContextRouter.sol** - Payment routing with 90/10 revenue split
- **MockERC20.sol** - USDC mock for testing

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment
Create `.env` or use shared `../.env.local`:
```bash
DEPLOYER_KEY=0xYOUR_PRIVATE_KEY
BASESCAN_API_KEY=YOUR_API_KEY
INFURA_API_KEY=YOUR_INFURA_KEY  # Optional
```

### 3. Compile Contracts
```bash
pnpm hardhat compile
```

### 4. Run Tests
```bash
pnpm hardhat test
```

### 5. Check Coverage (Optional)
```bash
pnpm hardhat coverage
```

## 🌐 Deployment

### Deploy to Base Sepolia (Testnet)
```bash
pnpm deploy:sepolia
```

### Deploy to Base Mainnet (Production)
```bash
pnpm deploy:base
```

### Verify on Basescan
After deployment, verify automatically or manually:
```bash
# Automatic (after deploy script completes)
npx hardhat verify --network baseSepolia CONTRACT_ADDRESS USDC_ADDRESS

# Using verify script
npx hardhat run scripts/verify.ts --network baseSepolia CONTRACT_ADDRESS
```

## 📦 Contract Addresses

### Base Sepolia (Testnet)
- USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- ContextRouter: *Deploy and add here*

### Base Mainnet (Production)
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- ContextRouter: *Deploy and add here*

## 🧪 Testing

### Run All Tests
```bash
pnpm hardhat test
```

### Run Specific Test
```bash
pnpm hardhat test test/ContextRouter.test.ts
```

### Gas Report
```bash
REPORT_GAS=true pnpm hardhat test
```

## 🛠️ Development

### Local Hardhat Network
```bash
# Terminal 1: Start local node
pnpm hardhat node

# Terminal 2: Deploy to local
pnpm hardhat run scripts/deploy.ts --network localhost
```

### Test on Hardhat Network
Tests automatically use the local Hardhat network (no need to start a node).

## 📚 Contract Details

### ContextRouter

**Purpose:** Routes micropayments for AI tool queries with automatic fee splitting.

**Key Functions:**
- `executePaidQuery(toolId, developerWallet, amount)` - User pays for query
- `claimEarnings()` - Developer withdraws earnings
- `claimPlatformFees()` - Platform withdraws fees (owner only)
- `getUnclaimedBalance(address)` - View unclaimed earnings

**Fee Structure:**
- Platform: 10%
- Developer: 90%

**Security Features:**
- OpenZeppelin SafeERC20 for safe token transfers
- ReentrancyGuard on all state-changing functions
- Ownable pattern for platform fee claims
- Input validation on all functions

## 🔒 Security Notes

1. **Never commit private keys**
2. Use different keys for testnet vs mainnet
3. Verify contracts on Basescan after deployment
4. Test thoroughly on testnet before mainnet deployment
5. Consider security audit for production deployment

## 📖 Additional Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Base Network Documentation](https://docs.base.org)
- [Basescan](https://basescan.org)

