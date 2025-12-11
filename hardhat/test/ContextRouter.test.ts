import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import type { Contract } from "ethers";
import { ethers } from "hardhat";
import type { ContextRouter } from "../typechain-types";

describe("ContextRouter", () => {
  let contextRouter: ContextRouter;
  let mockUsdc: Contract;
  let owner: SignerWithAddress;
  let developer1: SignerWithAddress;
  let developer2: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const PLATFORM_FEE_PERCENT = 10;
  const INITIAL_MINT = ethers.parseUnits("10000", 6); // 10,000 USDC
  const QUERY_PRICE = ethers.parseUnits("0.01", 6); // $0.01

  beforeEach(async () => {
    // Get signers
    [owner, developer1, developer2, user1, user2] = await ethers.getSigners();

    // Deploy mock USDC (ERC20)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUsdc = await MockERC20.deploy("Mock USDC", "USDC");
    await mockUsdc.waitForDeployment();

    // Mint USDC to users
    await mockUsdc.mint(user1.address, INITIAL_MINT);
    await mockUsdc.mint(user2.address, INITIAL_MINT);

    // Deploy ContextRouter
    const ContextRouter = await ethers.getContractFactory("ContextRouter");
    contextRouter = await ContextRouter.deploy(await mockUsdc.getAddress());
    await contextRouter.waitForDeployment();

    // Approve ContextRouter to spend USDC
    await mockUsdc
      .connect(user1)
      .approve(await contextRouter.getAddress(), ethers.MaxUint256);
    await mockUsdc
      .connect(user2)
      .approve(await contextRouter.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment", () => {
    it("Should set the correct USDC address", async () => {
      expect(await contextRouter.usdc()).to.equal(await mockUsdc.getAddress());
    });

    it("Should set the correct owner", async () => {
      expect(await contextRouter.owner()).to.equal(owner.address);
    });

    it("Should set platform fee to 10%", async () => {
      expect(await contextRouter.PLATFORM_FEE_PERCENT()).to.equal(
        PLATFORM_FEE_PERCENT
      );
    });

    it("Should revert if USDC address is zero", async () => {
      const ContextRouter = await ethers.getContractFactory("ContextRouter");
      await expect(ContextRouter.deploy(ethers.ZeroAddress)).to.be.revertedWith(
        "Invalid USDC address"
      );
    });
  });

  describe("executePaidQuery", () => {
    const toolId = 1;

    it("Should execute a paid query successfully", async () => {
      await expect(
        contextRouter
          .connect(user1)
          .executePaidQuery(toolId, developer1.address, QUERY_PRICE)
      )
        .to.emit(contextRouter, "QueryPaid")
        .withArgs(
          toolId,
          user1.address,
          developer1.address,
          QUERY_PRICE,
          (QUERY_PRICE * BigInt(PLATFORM_FEE_PERCENT)) / 100n
        );
    });

    it("Should split payment correctly (90% developer, 10% platform)", async () => {
      await contextRouter
        .connect(user1)
        .executePaidQuery(toolId, developer1.address, QUERY_PRICE);

      const expectedPlatformFee =
        (QUERY_PRICE * BigInt(PLATFORM_FEE_PERCENT)) / 100n;
      const expectedDeveloperEarning = QUERY_PRICE - expectedPlatformFee;

      expect(
        await contextRouter.developerBalances(developer1.address)
      ).to.equal(expectedDeveloperEarning);
      expect(await contextRouter.platformBalance()).to.equal(
        expectedPlatformFee
      );
    });

    it("Should accumulate multiple payments for the same developer", async () => {
      await contextRouter
        .connect(user1)
        .executePaidQuery(toolId, developer1.address, QUERY_PRICE);
      await contextRouter
        .connect(user2)
        .executePaidQuery(toolId, developer1.address, QUERY_PRICE);

      const expectedTotal = (QUERY_PRICE * 2n * 90n) / 100n;
      expect(
        await contextRouter.developerBalances(developer1.address)
      ).to.equal(expectedTotal);
    });

    it("Should track balances for multiple developers independently", async () => {
      await contextRouter
        .connect(user1)
        .executePaidQuery(toolId, developer1.address, QUERY_PRICE);
      await contextRouter
        .connect(user2)
        .executePaidQuery(toolId, developer2.address, QUERY_PRICE);

      const expectedEach = (QUERY_PRICE * 90n) / 100n;
      expect(
        await contextRouter.developerBalances(developer1.address)
      ).to.equal(expectedEach);
      expect(
        await contextRouter.developerBalances(developer2.address)
      ).to.equal(expectedEach);
    });

    it("Should transfer USDC from user to contract", async () => {
      const userBalanceBefore = await mockUsdc.balanceOf(user1.address);
      const contractBalanceBefore = await mockUsdc.balanceOf(
        await contextRouter.getAddress()
      );

      await contextRouter
        .connect(user1)
        .executePaidQuery(toolId, developer1.address, QUERY_PRICE);

      const userBalanceAfter = await mockUsdc.balanceOf(user1.address);
      const contractBalanceAfter = await mockUsdc.balanceOf(
        await contextRouter.getAddress()
      );

      expect(userBalanceAfter).to.equal(userBalanceBefore - QUERY_PRICE);
      expect(contractBalanceAfter).to.equal(
        contractBalanceBefore + QUERY_PRICE
      );
    });

    it("Should revert if developer address is zero", async () => {
      await expect(
        contextRouter
          .connect(user1)
          .executePaidQuery(toolId, ethers.ZeroAddress, QUERY_PRICE)
      ).to.be.revertedWith("Invalid developer address");
    });

    it("Should revert if amount is zero", async () => {
      await expect(
        contextRouter
          .connect(user1)
          .executePaidQuery(toolId, developer1.address, 0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should revert if user hasn't approved USDC", async () => {
      const [, , , , , newUser] = await ethers.getSigners();
      await mockUsdc.mint(newUser.address, QUERY_PRICE);

      await expect(
        contextRouter
          .connect(newUser)
          .executePaidQuery(toolId, developer1.address, QUERY_PRICE)
      ).to.be.reverted;
    });

    it("Should revert if user doesn't have enough USDC", async () => {
      const [, , , , , poorUser] = await ethers.getSigners();
      await mockUsdc
        .connect(poorUser)
        .approve(await contextRouter.getAddress(), ethers.MaxUint256);

      await expect(
        contextRouter
          .connect(poorUser)
          .executePaidQuery(toolId, developer1.address, QUERY_PRICE)
      ).to.be.reverted;
    });
  });

  describe("claimEarnings", () => {
    const toolId = 1;

    beforeEach(async () => {
      // Execute a query so developer has earnings
      await contextRouter
        .connect(user1)
        .executePaidQuery(toolId, developer1.address, QUERY_PRICE);
    });

    it("Should allow developer to claim earnings", async () => {
      const expectedEarnings = (QUERY_PRICE * 90n) / 100n;

      await expect(contextRouter.connect(developer1).claimEarnings())
        .to.emit(contextRouter, "EarningsClaimed")
        .withArgs(developer1.address, expectedEarnings);
    });

    it("Should transfer USDC to developer", async () => {
      const devBalanceBefore = await mockUsdc.balanceOf(developer1.address);
      const expectedEarnings = (QUERY_PRICE * 90n) / 100n;

      await contextRouter.connect(developer1).claimEarnings();

      const devBalanceAfter = await mockUsdc.balanceOf(developer1.address);
      expect(devBalanceAfter).to.equal(devBalanceBefore + expectedEarnings);
    });

    it("Should reset developer balance to zero after claim", async () => {
      await contextRouter.connect(developer1).claimEarnings();
      expect(
        await contextRouter.developerBalances(developer1.address)
      ).to.equal(0);
    });

    it("Should revert if no earnings to claim", async () => {
      await expect(
        contextRouter.connect(developer2).claimEarnings()
      ).to.be.revertedWith("No earnings to claim");
    });

    it("Should revert if trying to claim twice", async () => {
      await contextRouter.connect(developer1).claimEarnings();

      await expect(
        contextRouter.connect(developer1).claimEarnings()
      ).to.be.revertedWith("No earnings to claim");
    });
  });

  describe("claimPlatformFees", () => {
    const toolId = 1;

    beforeEach(async () => {
      // Execute a query so platform has fees
      await contextRouter
        .connect(user1)
        .executePaidQuery(toolId, developer1.address, QUERY_PRICE);
    });

    it("Should allow owner to claim platform fees", async () => {
      const expectedFees = (QUERY_PRICE * BigInt(PLATFORM_FEE_PERCENT)) / 100n;

      await expect(contextRouter.connect(owner).claimPlatformFees())
        .to.emit(contextRouter, "PlatformFeesClaimed")
        .withArgs(owner.address, expectedFees);
    });

    it("Should transfer USDC to owner", async () => {
      const ownerBalanceBefore = await mockUsdc.balanceOf(owner.address);
      const expectedFees = (QUERY_PRICE * BigInt(PLATFORM_FEE_PERCENT)) / 100n;

      await contextRouter.connect(owner).claimPlatformFees();

      const ownerBalanceAfter = await mockUsdc.balanceOf(owner.address);
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + expectedFees);
    });

    it("Should reset platform balance to zero after claim", async () => {
      await contextRouter.connect(owner).claimPlatformFees();
      expect(await contextRouter.platformBalance()).to.equal(0);
    });

    it("Should revert if no fees to claim", async () => {
      await contextRouter.connect(owner).claimPlatformFees();

      await expect(
        contextRouter.connect(owner).claimPlatformFees()
      ).to.be.revertedWith("No fees to claim");
    });

    it("Should revert if non-owner tries to claim", async () => {
      await expect(
        contextRouter.connect(user1).claimPlatformFees()
      ).to.be.revertedWithCustomError(
        contextRouter,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("View functions", () => {
    const toolId = 1;

    it("Should return correct unclaimed balance for developer", async () => {
      await contextRouter
        .connect(user1)
        .executePaidQuery(toolId, developer1.address, QUERY_PRICE);

      const expectedEarnings = (QUERY_PRICE * 90n) / 100n;
      expect(
        await contextRouter.getUnclaimedBalance(developer1.address)
      ).to.equal(expectedEarnings);
    });

    it("Should return zero for developer with no earnings", async () => {
      expect(
        await contextRouter.getUnclaimedBalance(developer2.address)
      ).to.equal(0);
    });

    it("Should return correct platform balance", async () => {
      await contextRouter
        .connect(user1)
        .executePaidQuery(toolId, developer1.address, QUERY_PRICE);

      const expectedFees = (QUERY_PRICE * BigInt(PLATFORM_FEE_PERCENT)) / 100n;
      expect(await contextRouter.getPlatformBalance()).to.equal(expectedFees);
    });
  });

  describe("Complex scenarios", () => {
    it("Should handle multiple developers and users correctly", async () => {
      const toolId1 = 1;
      const toolId2 = 2;

      // User1 pays for tool1 (dev1)
      await contextRouter
        .connect(user1)
        .executePaidQuery(toolId1, developer1.address, QUERY_PRICE);

      // User2 pays for tool2 (dev2)
      await contextRouter
        .connect(user2)
        .executePaidQuery(toolId2, developer2.address, QUERY_PRICE);

      // User1 pays for tool2 (dev2)
      await contextRouter
        .connect(user1)
        .executePaidQuery(toolId2, developer2.address, QUERY_PRICE);

      const expectedPerQuery = (QUERY_PRICE * 90n) / 100n;

      expect(
        await contextRouter.developerBalances(developer1.address)
      ).to.equal(expectedPerQuery);
      expect(
        await contextRouter.developerBalances(developer2.address)
      ).to.equal(expectedPerQuery * 2n);

      const expectedPlatformFees =
        (QUERY_PRICE * BigInt(PLATFORM_FEE_PERCENT) * 3n) / 100n;
      expect(await contextRouter.platformBalance()).to.equal(
        expectedPlatformFees
      );
    });

    it("Should accumulate fees correctly over many transactions", async () => {
      const numQueries = 100;
      const largeAmount = ethers.parseUnits("1", 6); // $1

      for (let i = 0; i < numQueries; i++) {
        await contextRouter
          .connect(user1)
          .executePaidQuery(i, developer1.address, largeAmount);
      }

      const expectedDeveloperTotal =
        (largeAmount * 90n * BigInt(numQueries)) / 100n;
      const expectedPlatformTotal =
        (largeAmount * BigInt(PLATFORM_FEE_PERCENT) * BigInt(numQueries)) /
        100n;

      expect(
        await contextRouter.developerBalances(developer1.address)
      ).to.equal(expectedDeveloperTotal);
      expect(await contextRouter.platformBalance()).to.equal(
        expectedPlatformTotal
      );
    });
  });

  // ============================================================
  // STAKING TESTS
  // ============================================================
  describe("Staking", () => {
    const toolId = 1n;
    const MINIMUM_STAKE = ethers.parseUnits("10", 6); // $10 minimum
    const LARGE_STAKE = ethers.parseUnits("100", 6); // $100

    beforeEach(async () => {
      // Mint USDC to developer for staking
      await mockUsdc.mint(developer1.address, LARGE_STAKE * 2n);
      await mockUsdc
        .connect(developer1)
        .approve(await contextRouter.getAddress(), ethers.MaxUint256);
    });

    describe("depositStake", () => {
      it("Should allow developer to deposit stake", async () => {
        await expect(
          contextRouter.connect(developer1).depositStake(toolId, MINIMUM_STAKE)
        )
          .to.emit(contextRouter, "StakeDeposited")
          .withArgs(toolId, developer1.address, MINIMUM_STAKE);

        expect(await contextRouter.toolStakes(toolId)).to.equal(MINIMUM_STAKE);
        expect(await contextRouter.toolDevelopers(toolId)).to.equal(
          developer1.address
        );
      });

      it("Should enforce minimum stake on first deposit", async () => {
        const tooSmall = ethers.parseUnits("5", 6); // $5 < $10 minimum
        await expect(
          contextRouter.connect(developer1).depositStake(toolId, tooSmall)
        ).to.be.revertedWith("Initial stake must meet minimum");
      });

      it("Should allow topping up stake after initial deposit", async () => {
        await contextRouter
          .connect(developer1)
          .depositStake(toolId, MINIMUM_STAKE);

        const topUp = ethers.parseUnits("5", 6); // $5 top-up is fine after initial
        await contextRouter.connect(developer1).depositStake(toolId, topUp);

        expect(await contextRouter.toolStakes(toolId)).to.equal(
          MINIMUM_STAKE + topUp
        );
      });

      it("Should reject stake from non-owner after first stake", async () => {
        await contextRouter
          .connect(developer1)
          .depositStake(toolId, MINIMUM_STAKE);

        // Mint to developer2 and try to stake on same tool
        await mockUsdc.mint(developer2.address, MINIMUM_STAKE);
        await mockUsdc
          .connect(developer2)
          .approve(await contextRouter.getAddress(), ethers.MaxUint256);

        await expect(
          contextRouter.connect(developer2).depositStake(toolId, MINIMUM_STAKE)
        ).to.be.revertedWith("Only tool owner can add stake");
      });

      it("Should revert if amount is zero", async () => {
        await expect(
          contextRouter.connect(developer1).depositStake(toolId, 0)
        ).to.be.revertedWith("Amount must be greater than 0");
      });
    });

    describe("Withdrawal flow", () => {
      beforeEach(async () => {
        // Developer stakes first
        await contextRouter
          .connect(developer1)
          .depositStake(toolId, LARGE_STAKE);
      });

      it("Should allow requesting withdrawal", async () => {
        const tx = await contextRouter
          .connect(developer1)
          .requestWithdrawal(toolId);
        const receipt = await tx.wait();
        const block = await ethers.provider.getBlock(receipt!.blockNumber);
        const expectedAvailableAt = BigInt(block!.timestamp) + 7n * 24n * 60n * 60n;

        await expect(tx)
          .to.emit(contextRouter, "WithdrawalRequested")
          .withArgs(toolId, developer1.address, expectedAvailableAt);
      });

      it("Should reject withdrawal request from non-owner", async () => {
        await expect(
          contextRouter.connect(developer2).requestWithdrawal(toolId)
        ).to.be.revertedWith("Not tool owner");
      });

      it("Should allow canceling withdrawal request", async () => {
        await contextRouter.connect(developer1).requestWithdrawal(toolId);
        await contextRouter.connect(developer1).cancelWithdrawal(toolId);

        const status = await contextRouter.getWithdrawalStatus(toolId);
        expect(status.requestTime).to.equal(0);
      });

      it("Should reject withdrawal before delay period", async () => {
        await contextRouter.connect(developer1).requestWithdrawal(toolId);

        await expect(
          contextRouter.connect(developer1).withdrawStake(toolId, LARGE_STAKE)
        ).to.be.revertedWith("Withdrawal delay not met");
      });

      it("Should allow withdrawal after delay period", async () => {
        await contextRouter.connect(developer1).requestWithdrawal(toolId);

        // Fast forward 7 days
        await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
        await ethers.provider.send("evm_mine", []);

        const balanceBefore = await mockUsdc.balanceOf(developer1.address);

        await expect(
          contextRouter.connect(developer1).withdrawStake(toolId, LARGE_STAKE)
        )
          .to.emit(contextRouter, "StakeWithdrawn")
          .withArgs(toolId, developer1.address, LARGE_STAKE);

        const balanceAfter = await mockUsdc.balanceOf(developer1.address);
        expect(balanceAfter).to.equal(balanceBefore + LARGE_STAKE);
        expect(await contextRouter.toolStakes(toolId)).to.equal(0);
      });

      it("Should allow partial withdrawal", async () => {
        await contextRouter.connect(developer1).requestWithdrawal(toolId);

        // Fast forward 7 days
        await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
        await ethers.provider.send("evm_mine", []);

        const partialAmount = ethers.parseUnits("30", 6);
        await contextRouter
          .connect(developer1)
          .withdrawStake(toolId, partialAmount);

        expect(await contextRouter.toolStakes(toolId)).to.equal(
          LARGE_STAKE - partialAmount
        );
      });
    });

    describe("getMinimumStake", () => {
      it("Should return minimum stake for free tools", async () => {
        const minStake = await contextRouter.getMinimumStake(0);
        expect(minStake).to.equal(MINIMUM_STAKE);
      });

      it("Should return 100x for expensive tools", async () => {
        const pricePerQuery = ethers.parseUnits("0.50", 6); // $0.50
        const minStake = await contextRouter.getMinimumStake(pricePerQuery);
        expect(minStake).to.equal(ethers.parseUnits("50", 6)); // 100x = $50
      });

      it("Should return minimum when 100x is less than minimum", async () => {
        const pricePerQuery = ethers.parseUnits("0.05", 6); // $0.05, 100x = $5 < $10
        const minStake = await contextRouter.getMinimumStake(pricePerQuery);
        expect(minStake).to.equal(MINIMUM_STAKE); // $10 minimum
      });
    });
  });

  // ============================================================
  // SLASH AND COMPENSATE TESTS
  // ============================================================
  describe("slashAndCompensateAll", () => {
    const toolId = 1n;
    const STAKE_AMOUNT = ethers.parseUnits("100", 6); // $100 stake
    const QUERY_AMOUNT = ethers.parseUnits("5", 6); // $5 per query

    let reporter1: SignerWithAddress;
    let reporter2: SignerWithAddress;
    let reporter3: SignerWithAddress;

    beforeEach(async () => {
      [owner, developer1, developer2, user1, user2, reporter1, reporter2, reporter3] =
        await ethers.getSigners();

      // Developer stakes
      await mockUsdc.mint(developer1.address, STAKE_AMOUNT);
      await mockUsdc
        .connect(developer1)
        .approve(await contextRouter.getAddress(), ethers.MaxUint256);
      await contextRouter
        .connect(developer1)
        .depositStake(toolId, STAKE_AMOUNT);
    });

    it("Should compensate single user correctly", async () => {
      const refundAmount = QUERY_AMOUNT;
      const balanceBefore = await mockUsdc.balanceOf(reporter1.address);

      await contextRouter.connect(owner).slashAndCompensateAll(
        toolId,
        STAKE_AMOUNT,
        [reporter1.address],
        [refundAmount],
        reporter1.address,
        "Test slash"
      );

      // Check user received refund + bounty
      // Remaining = $100 - $5 = $95
      // Bounty = 20% of $95 = $19
      // Total to reporter = $5 + $19 = $24
      const balanceAfter = await mockUsdc.balanceOf(reporter1.address);
      const expectedBounty = (STAKE_AMOUNT - refundAmount) * 20n / 100n;
      const expectedTotal = refundAmount + expectedBounty;
      
      expect(balanceAfter).to.equal(balanceBefore + expectedTotal);
    });

    it("Should compensate multiple users correctly", async () => {
      const refund1 = ethers.parseUnits("5", 6);
      const refund2 = ethers.parseUnits("10", 6);
      const refund3 = ethers.parseUnits("5", 6);
      const totalRefunds = refund1 + refund2 + refund3; // $20

      const balance1Before = await mockUsdc.balanceOf(reporter1.address);
      const balance2Before = await mockUsdc.balanceOf(reporter2.address);
      const balance3Before = await mockUsdc.balanceOf(reporter3.address);

      await contextRouter.connect(owner).slashAndCompensateAll(
        toolId,
        STAKE_AMOUNT,
        [reporter1.address, reporter2.address, reporter3.address],
        [refund1, refund2, refund3],
        reporter1.address, // First reporter
        "Test slash multiple"
      );

      // Remaining = $100 - $20 = $80
      // Bounty = 20% of $80 = $16
      const remaining = STAKE_AMOUNT - totalRefunds;
      const bounty = remaining * 20n / 100n;

      // Reporter1 (first) gets refund + bounty
      expect(await mockUsdc.balanceOf(reporter1.address)).to.equal(
        balance1Before + refund1 + bounty
      );
      // Others just get refund
      expect(await mockUsdc.balanceOf(reporter2.address)).to.equal(
        balance2Before + refund2
      );
      expect(await mockUsdc.balanceOf(reporter3.address)).to.equal(
        balance3Before + refund3
      );
    });

    it("Should add adjudication fee to platform balance", async () => {
      const refundAmount = ethers.parseUnits("20", 6);

      const platformBefore = await contextRouter.platformBalance();

      await contextRouter.connect(owner).slashAndCompensateAll(
        toolId,
        STAKE_AMOUNT,
        [reporter1.address],
        [refundAmount],
        reporter1.address,
        "Test slash"
      );

      // Remaining = $100 - $20 = $80
      // Bounty = 20% of $80 = $16
      // Adjudication fee = $80 - $16 = $64
      const remaining = STAKE_AMOUNT - refundAmount;
      const bounty = remaining * 20n / 100n;
      const adjudicationFee = remaining - bounty;

      expect(await contextRouter.platformBalance()).to.equal(
        platformBefore + adjudicationFee
      );
    });

    it("Should emit correct events", async () => {
      const refundAmount = QUERY_AMOUNT;
      const remaining = STAKE_AMOUNT - refundAmount;
      const bounty = remaining * 20n / 100n;

      await expect(
        contextRouter.connect(owner).slashAndCompensateAll(
          toolId,
          STAKE_AMOUNT,
          [reporter1.address],
          [refundAmount],
          reporter1.address,
          "Test slash"
        )
      )
        .to.emit(contextRouter, "UsersCompensated")
        .withArgs(toolId, refundAmount, 1)
        .to.emit(contextRouter, "BountyPaid")
        .withArgs(toolId, reporter1.address, bounty)
        .to.emit(contextRouter, "StakeSlashed")
        .withArgs(toolId, developer1.address, STAKE_AMOUNT, "Test slash");
    });

    it("Should reduce tool stake correctly", async () => {
      expect(await contextRouter.toolStakes(toolId)).to.equal(STAKE_AMOUNT);

      await contextRouter.connect(owner).slashAndCompensateAll(
        toolId,
        STAKE_AMOUNT,
        [reporter1.address],
        [QUERY_AMOUNT],
        reporter1.address,
        "Test slash"
      );

      expect(await contextRouter.toolStakes(toolId)).to.equal(0);
    });

    it("Should allow partial slash", async () => {
      const partialSlash = ethers.parseUnits("50", 6); // $50 of $100

      await contextRouter.connect(owner).slashAndCompensateAll(
        toolId,
        partialSlash,
        [reporter1.address],
        [QUERY_AMOUNT],
        reporter1.address,
        "Partial slash"
      );

      expect(await contextRouter.toolStakes(toolId)).to.equal(
        STAKE_AMOUNT - partialSlash
      );
    });

    it("Should reset pending withdrawal on slash", async () => {
      // Developer requests withdrawal
      await contextRouter.connect(developer1).requestWithdrawal(toolId);
      let status = await contextRouter.getWithdrawalStatus(toolId);
      expect(status.requestTime).to.be.gt(0);

      // Admin slashes
      await contextRouter.connect(owner).slashAndCompensateAll(
        toolId,
        STAKE_AMOUNT,
        [reporter1.address],
        [QUERY_AMOUNT],
        reporter1.address,
        "Slash resets withdrawal"
      );

      // Withdrawal request should be reset
      status = await contextRouter.getWithdrawalStatus(toolId);
      expect(status.requestTime).to.equal(0);
    });

    it("Should enforce minimum bounty", async () => {
      // Set up scenario where 20% bounty would be less than $1
      // Refund = $99, remaining = $1, 20% of $1 = $0.20 < $1 minimum
      const highRefund = ethers.parseUnits("99", 6);
      const balanceBefore = await mockUsdc.balanceOf(reporter1.address);

      await contextRouter.connect(owner).slashAndCompensateAll(
        toolId,
        STAKE_AMOUNT,
        [reporter1.address],
        [highRefund],
        reporter1.address,
        "Test minimum bounty"
      );

      // Should get refund + $1 minimum bounty (since remaining = $1 >= $1 minimum)
      const minimumBounty = ethers.parseUnits("1", 6);
      const balanceAfter = await mockUsdc.balanceOf(reporter1.address);
      expect(balanceAfter).to.equal(balanceBefore + highRefund + minimumBounty);
    });

    it("Should cap bounty when remaining is less than minimum", async () => {
      // Refund = $99.50, remaining = $0.50 < $1 minimum bounty
      // Bounty should be capped at $0.50
      const highRefund = ethers.parseUnits("99.50", 6);
      const balanceBefore = await mockUsdc.balanceOf(reporter1.address);

      await contextRouter.connect(owner).slashAndCompensateAll(
        toolId,
        STAKE_AMOUNT,
        [reporter1.address],
        [highRefund],
        reporter1.address,
        "Test bounty cap"
      );

      // 20% of $0.50 = $0.10, less than $1 min, but remaining ($0.50) < min, so bounty = 20% of $0.50 = $0.10
      const remaining = STAKE_AMOUNT - highRefund;
      const bounty = remaining * 20n / 100n;
      const balanceAfter = await mockUsdc.balanceOf(reporter1.address);
      expect(balanceAfter).to.equal(balanceBefore + highRefund + bounty);
    });

    describe("Reverts", () => {
      it("Should revert if not owner", async () => {
        await expect(
          contextRouter.connect(user1).slashAndCompensateAll(
            toolId,
            STAKE_AMOUNT,
            [reporter1.address],
            [QUERY_AMOUNT],
            reporter1.address,
            "Unauthorized"
          )
        ).to.be.revertedWithCustomError(
          contextRouter,
          "OwnableUnauthorizedAccount"
        );
      });

      it("Should revert if slash amount is zero", async () => {
        await expect(
          contextRouter.connect(owner).slashAndCompensateAll(
            toolId,
            0,
            [reporter1.address],
            [QUERY_AMOUNT],
            reporter1.address,
            "Zero amount"
          )
        ).to.be.revertedWith("Amount must be > 0");
      });

      it("Should revert if insufficient stake", async () => {
        const tooMuch = ethers.parseUnits("200", 6); // $200 > $100 stake
        await expect(
          contextRouter.connect(owner).slashAndCompensateAll(
            toolId,
            tooMuch,
            [reporter1.address],
            [QUERY_AMOUNT],
            reporter1.address,
            "Too much"
          )
        ).to.be.revertedWith("Insufficient stake");
      });

      it("Should revert if arrays mismatch", async () => {
        await expect(
          contextRouter.connect(owner).slashAndCompensateAll(
            toolId,
            STAKE_AMOUNT,
            [reporter1.address, reporter2.address],
            [QUERY_AMOUNT], // Only 1 amount for 2 recipients
            reporter1.address,
            "Mismatch"
          )
        ).to.be.revertedWith("Array mismatch");
      });

      it("Should revert if no recipients", async () => {
        await expect(
          contextRouter.connect(owner).slashAndCompensateAll(
            toolId,
            STAKE_AMOUNT,
            [],
            [],
            reporter1.address,
            "No recipients"
          )
        ).to.be.revertedWith("No recipients");
      });

      it("Should revert if too many recipients", async () => {
        const recipients = Array(101).fill(reporter1.address);
        const amounts = Array(101).fill(ethers.parseUnits("0.01", 6));

        await expect(
          contextRouter.connect(owner).slashAndCompensateAll(
            toolId,
            STAKE_AMOUNT,
            recipients,
            amounts,
            reporter1.address,
            "Too many"
          )
        ).to.be.revertedWith("Max 100 recipients per call");
      });

      it("Should revert if tool has no stake", async () => {
        const unstaked = 999n; // Tool with no stake
        await expect(
          contextRouter.connect(owner).slashAndCompensateAll(
            unstaked,
            STAKE_AMOUNT,
            [reporter1.address],
            [QUERY_AMOUNT],
            reporter1.address,
            "No stake"
          )
        ).to.be.revertedWith("Insufficient stake");
      });

      it("Should revert if refunds exceed slash", async () => {
        const tooMuchRefund = ethers.parseUnits("150", 6); // $150 > $100 slash
        await expect(
          contextRouter.connect(owner).slashAndCompensateAll(
            toolId,
            STAKE_AMOUNT,
            [reporter1.address],
            [tooMuchRefund],
            reporter1.address,
            "Refunds exceed"
          )
        ).to.be.revertedWith("Refunds exceed slash");
      });

      it("Should revert if recipient is zero address", async () => {
        await expect(
          contextRouter.connect(owner).slashAndCompensateAll(
            toolId,
            STAKE_AMOUNT,
            [ethers.ZeroAddress],
            [QUERY_AMOUNT],
            reporter1.address,
            "Zero recipient"
          )
        ).to.be.revertedWith("Invalid recipient");
      });

      it("Should revert if refund amount is zero", async () => {
        await expect(
          contextRouter.connect(owner).slashAndCompensateAll(
            toolId,
            STAKE_AMOUNT,
            [reporter1.address],
            [0],
            reporter1.address,
            "Zero refund"
          )
        ).to.be.revertedWith("Refund must be > 0");
      });
    });
  });

  // ============================================================
  // BOUNTY PARAMETERS TESTS
  // ============================================================
  describe("setBountyParameters", () => {
    it("Should allow owner to update bounty parameters", async () => {
      const newPercent = 30;
      const newMinimum = ethers.parseUnits("5", 6); // $5

      await expect(
        contextRouter.connect(owner).setBountyParameters(newPercent, newMinimum)
      )
        .to.emit(contextRouter, "BountyParametersUpdated")
        .withArgs(newPercent, newMinimum);

      expect(await contextRouter.bountyPercent()).to.equal(newPercent);
      expect(await contextRouter.minimumBounty()).to.equal(newMinimum);
    });

    it("Should reject bounty percent over 50%", async () => {
      await expect(
        contextRouter.connect(owner).setBountyParameters(51, 0)
      ).to.be.revertedWith("Bounty cannot exceed 50%");
    });

    it("Should reject if not owner", async () => {
      await expect(
        contextRouter.connect(user1).setBountyParameters(20, 0)
      ).to.be.revertedWithCustomError(
        contextRouter,
        "OwnableUnauthorizedAccount"
      );
    });
  });
});
