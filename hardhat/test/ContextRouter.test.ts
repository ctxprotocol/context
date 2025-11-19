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
});
