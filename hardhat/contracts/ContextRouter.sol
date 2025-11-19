// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ContextRouter
 * @notice Simple payment router for Context AI tool marketplace
 * @dev Splits query payments: 90% to developer, 10% to platform
 * 
 * This contract handles micropayments for AI tool queries. When users pay
 * to use a tool, the contract automatically:
 * 1. Takes 10% platform fee
 * 2. Credits 90% to the tool developer
 * 3. Allows both parties to claim their earnings anytime
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

    /**
     * @notice Initialize the ContextRouter with USDC token address
     * @param _usdcAddress The address of the USDC token contract on this chain
     */
    constructor(address _usdcAddress) Ownable(msg.sender) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        usdc = IERC20(_usdcAddress);
    }

    /**
     * @notice User pays for a tool query
     * @dev User must approve this contract to spend USDC first
     * @param toolId The ID of the tool being used
     * @param developerWallet The wallet address of the tool creator
     * @param amount The total amount to pay in USDC (e.g., 10000 = $0.01 with 6 decimals)
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
     * @dev Can only claim your own balance
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
     * @dev Only callable by contract owner
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
     * @param developer The developer's wallet address
     * @return The unclaimed balance in USDC
     */
    function getUnclaimedBalance(address developer) external view returns (uint256) {
        return developerBalances[developer];
    }

    /**
     * @notice Get platform's unclaimed fees
     * @return The unclaimed platform fees in USDC
     */
    function getPlatformBalance() external view returns (uint256) {
        return platformBalance;
    }
}

