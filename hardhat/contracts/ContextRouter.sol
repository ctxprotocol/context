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
 * 
 * For Auto Mode (JIT payments), authorized operators can trigger payments
 * on behalf of users who have pre-approved this contract.
 */
contract ContextRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // State variables
    IERC20 public immutable usdc;
    uint256 public constant PLATFORM_FEE_PERCENT = 10;
    
    // Tracking
    mapping(address => uint256) public developerBalances;
    uint256 public platformBalance;
    
    // Operators (servers authorized to trigger payments on behalf of users)
    mapping(address => bool) public operators;
    
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
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    // Model cost event for Convenience tier (100% to platform)
    event ModelCostPaid(address indexed user, uint256 amount);

    // Modifiers
    modifier onlyOperator() {
        require(operators[msg.sender], "Not an authorized operator");
        _;
    }

    /**
     * @notice Initialize the ContextRouter with USDC token address
     * @param _usdcAddress The address of the USDC token contract on this chain
     * @dev Deployer is automatically registered as an operator for Auto Pay
     */
    constructor(address _usdcAddress) Ownable(msg.sender) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        usdc = IERC20(_usdcAddress);
        
        // Auto-register deployer as operator for Auto Pay convenience
        operators[msg.sender] = true;
        emit OperatorAdded(msg.sender);
    }

    /**
     * @notice Add an operator (e.g., Context server wallet)
     * @param operator The address to authorize as operator
     */
    function addOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid operator address");
        operators[operator] = true;
        emit OperatorAdded(operator);
    }

    /**
     * @notice Remove an operator
     * @param operator The address to remove from operators
     */
    function removeOperator(address operator) external onlyOwner {
        operators[operator] = false;
        emit OperatorRemoved(operator);
    }

    /**
     * @notice Check if an address is an operator
     * @param operator The address to check
     * @return True if the address is an authorized operator
     */
    function isOperator(address operator) external view returns (bool) {
        return operators[operator];
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
     * @notice Operator triggers payment on behalf of a user (for Auto Mode / JIT payments)
     * @dev User must have pre-approved this contract to spend their USDC
     * @param user The user's wallet address (must have approved this contract)
     * @param toolId The ID of the tool being used
     * @param developerWallet The wallet address of the tool creator
     * @param amount The total amount to pay in USDC
     */
    function executePaidQueryFor(
        address user,
        uint256 toolId,
        address developerWallet,
        uint256 amount
    ) external onlyOperator nonReentrant {
        require(user != address(0), "Invalid user address");
        require(developerWallet != address(0), "Invalid developer address");
        require(amount > 0, "Amount must be greater than 0");

        // Transfer USDC from user to this contract (user must have pre-approved)
        usdc.safeTransferFrom(user, address(this), amount);

        // Calculate platform fee (10%)
        uint256 platformFee = (amount * PLATFORM_FEE_PERCENT) / 100;
        uint256 developerEarning = amount - platformFee;

        // Update balances
        developerBalances[developerWallet] += developerEarning;
        platformBalance += platformFee;

        emit QueryPaid(toolId, user, developerWallet, amount, platformFee);
    }

    /**
     * @notice Operator triggers batch payment on behalf of a user (for Auto Mode with multiple tools)
     * @dev User must have pre-approved this contract to spend their USDC
     * @param user The user's wallet address
     * @param toolIds Array of tool IDs being used
     * @param developerWallets Array of wallet addresses for each tool's creator
     * @param amounts Array of amounts to pay for each tool in USDC
     */
    function executeBatchPaidQueryFor(
        address user,
        uint256[] calldata toolIds,
        address[] calldata developerWallets,
        uint256[] calldata amounts
    ) external onlyOperator nonReentrant {
        require(user != address(0), "Invalid user address");
        require(toolIds.length == developerWallets.length, "Array length mismatch");
        require(toolIds.length == amounts.length, "Array length mismatch");
        require(toolIds.length > 0, "Empty arrays");

        // Calculate total amount needed
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "Amount must be greater than 0");
            require(developerWallets[i] != address(0), "Invalid developer address");
            totalAmount += amounts[i];
        }

        // Transfer total USDC from user to this contract (ONE transaction)
        usdc.safeTransferFrom(user, address(this), totalAmount);

        // Split payments to each developer
        for (uint256 i = 0; i < toolIds.length; i++) {
            uint256 platformFee = (amounts[i] * PLATFORM_FEE_PERCENT) / 100;
            uint256 developerEarning = amounts[i] - platformFee;

            developerBalances[developerWallets[i]] += developerEarning;
            platformBalance += platformFee;

            emit QueryPaid(toolIds[i], user, developerWallets[i], amounts[i], platformFee);
        }
    }

    /**
     * @notice User pays for multiple tools in a single transaction
     * @dev User must approve this contract to spend the total USDC amount first
     * @param toolIds Array of tool IDs being used
     * @param developerWallets Array of wallet addresses for each tool's creator
     * @param amounts Array of amounts to pay for each tool in USDC
     */
    function executeBatchPaidQuery(
        uint256[] calldata toolIds,
        address[] calldata developerWallets,
        uint256[] calldata amounts
    ) external nonReentrant {
        require(toolIds.length == developerWallets.length, "Array length mismatch");
        require(toolIds.length == amounts.length, "Array length mismatch");
        require(toolIds.length > 0, "Empty arrays");

        // Calculate total amount needed
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "Amount must be greater than 0");
            require(developerWallets[i] != address(0), "Invalid developer address");
            totalAmount += amounts[i];
        }

        // Transfer total USDC from user to this contract (ONE transaction)
        usdc.safeTransferFrom(msg.sender, address(this), totalAmount);

        // Split payments to each developer
        for (uint256 i = 0; i < toolIds.length; i++) {
            uint256 platformFee = (amounts[i] * PLATFORM_FEE_PERCENT) / 100;
            uint256 developerEarning = amounts[i] - platformFee;

            developerBalances[developerWallets[i]] += developerEarning;
            platformBalance += platformFee;

            emit QueryPaid(toolIds[i], msg.sender, developerWallets[i], amounts[i], platformFee);
        }
    }

    // ============================================================
    // MODEL COST FUNCTIONS (Convenience Tier - 100% to Platform)
    // ============================================================

    /**
     * @notice User pays for AI model costs (Convenience tier)
     * @dev 100% goes to platform balance - used for pass-through model API costs
     * @param toolAmount The tool fee amount (will be split 90/10 with developer)
     * @param developerWallet The wallet address of the tool creator
     * @param modelCost The model cost amount (100% to platform)
     * @param toolId The ID of the tool being used
     */
    function executeQueryWithModelCost(
        uint256 toolId,
        address developerWallet,
        uint256 toolAmount,
        uint256 modelCost
    ) external nonReentrant {
        require(developerWallet != address(0), "Invalid developer address");
        require(toolAmount > 0 || modelCost > 0, "Total amount must be greater than 0");

        uint256 totalAmount = toolAmount + modelCost;
        
        // Transfer total USDC from user to this contract
        usdc.safeTransferFrom(msg.sender, address(this), totalAmount);

        // Handle tool payment (90/10 split) if there's a tool fee
        if (toolAmount > 0) {
            uint256 platformFee = (toolAmount * PLATFORM_FEE_PERCENT) / 100;
            uint256 developerEarning = toolAmount - platformFee;
            developerBalances[developerWallet] += developerEarning;
            platformBalance += platformFee;
            emit QueryPaid(toolId, msg.sender, developerWallet, toolAmount, platformFee);
        }

        // Handle model cost (100% to platform)
        if (modelCost > 0) {
            platformBalance += modelCost;
            emit ModelCostPaid(msg.sender, modelCost);
        }
    }

    /**
     * @notice Operator triggers query payment with model cost on behalf of user
     * @dev For Auto Mode with Convenience tier - combines tool fee + model cost
     * @param user The user's wallet address
     * @param toolId The ID of the tool being used
     * @param developerWallet The wallet address of the tool creator
     * @param toolAmount The tool fee amount (90/10 split)
     * @param modelCost The model cost amount (100% to platform)
     */
    function executeQueryWithModelCostFor(
        address user,
        uint256 toolId,
        address developerWallet,
        uint256 toolAmount,
        uint256 modelCost
    ) external onlyOperator nonReentrant {
        require(user != address(0), "Invalid user address");
        require(developerWallet != address(0), "Invalid developer address");
        require(toolAmount > 0 || modelCost > 0, "Total amount must be greater than 0");

        uint256 totalAmount = toolAmount + modelCost;
        
        // Transfer total USDC from user to this contract
        usdc.safeTransferFrom(user, address(this), totalAmount);

        // Handle tool payment (90/10 split) if there's a tool fee
        if (toolAmount > 0) {
            uint256 platformFee = (toolAmount * PLATFORM_FEE_PERCENT) / 100;
            uint256 developerEarning = toolAmount - platformFee;
            developerBalances[developerWallet] += developerEarning;
            platformBalance += platformFee;
            emit QueryPaid(toolId, user, developerWallet, toolAmount, platformFee);
        }

        // Handle model cost (100% to platform)
        if (modelCost > 0) {
            platformBalance += modelCost;
            emit ModelCostPaid(user, modelCost);
        }
    }

    /**
     * @notice User pays for multiple tools with model cost in a single transaction
     * @dev For Convenience tier batch payments - combines tool fees + model cost
     * @param toolIds Array of tool IDs being used
     * @param developerWallets Array of wallet addresses for each tool's creator
     * @param amounts Array of amounts to pay for each tool in USDC (90/10 split each)
     * @param modelCost The model cost amount (100% to platform)
     */
    function executeBatchQueryWithModelCost(
        uint256[] calldata toolIds,
        address[] calldata developerWallets,
        uint256[] calldata amounts,
        uint256 modelCost
    ) external nonReentrant {
        require(toolIds.length == developerWallets.length, "Array length mismatch");
        require(toolIds.length == amounts.length, "Array length mismatch");
        require(toolIds.length > 0 || modelCost > 0, "No payment specified");

        // Calculate total tool amount needed
        uint256 totalToolAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(developerWallets[i] != address(0), "Invalid developer address");
            totalToolAmount += amounts[i];
        }

        uint256 totalAmount = totalToolAmount + modelCost;
        require(totalAmount > 0, "Total amount must be greater than 0");

        // Transfer total USDC from user to this contract (ONE transaction)
        usdc.safeTransferFrom(msg.sender, address(this), totalAmount);

        // Split payments to each developer (90/10 split)
        for (uint256 i = 0; i < toolIds.length; i++) {
            if (amounts[i] > 0) {
                uint256 platformFee = (amounts[i] * PLATFORM_FEE_PERCENT) / 100;
                uint256 developerEarning = amounts[i] - platformFee;

                developerBalances[developerWallets[i]] += developerEarning;
                platformBalance += platformFee;

                emit QueryPaid(toolIds[i], msg.sender, developerWallets[i], amounts[i], platformFee);
            }
        }

        // Handle model cost (100% to platform)
        if (modelCost > 0) {
            platformBalance += modelCost;
            emit ModelCostPaid(msg.sender, modelCost);
        }
    }

    /**
     * @notice Operator triggers batch payment with model cost on behalf of user
     * @dev For Auto Mode with Convenience tier - combines multiple tool fees + model cost
     * @param user The user's wallet address
     * @param toolIds Array of tool IDs being used
     * @param developerWallets Array of wallet addresses for each tool's creator
     * @param amounts Array of amounts to pay for each tool in USDC (90/10 split each)
     * @param modelCost The model cost amount (100% to platform)
     */
    function executeBatchQueryWithModelCostFor(
        address user,
        uint256[] calldata toolIds,
        address[] calldata developerWallets,
        uint256[] calldata amounts,
        uint256 modelCost
    ) external onlyOperator nonReentrant {
        require(user != address(0), "Invalid user address");
        require(toolIds.length == developerWallets.length, "Array length mismatch");
        require(toolIds.length == amounts.length, "Array length mismatch");
        require(toolIds.length > 0 || modelCost > 0, "No payment specified");

        // Calculate total tool amount needed
        uint256 totalToolAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(developerWallets[i] != address(0), "Invalid developer address");
            totalToolAmount += amounts[i];
        }

        uint256 totalAmount = totalToolAmount + modelCost;
        require(totalAmount > 0, "Total amount must be greater than 0");

        // Transfer total USDC from user to this contract (ONE transaction)
        usdc.safeTransferFrom(user, address(this), totalAmount);

        // Split payments to each developer (90/10 split)
        for (uint256 i = 0; i < toolIds.length; i++) {
            if (amounts[i] > 0) {
                uint256 platformFee = (amounts[i] * PLATFORM_FEE_PERCENT) / 100;
                uint256 developerEarning = amounts[i] - platformFee;

                developerBalances[developerWallets[i]] += developerEarning;
                platformBalance += platformFee;

                emit QueryPaid(toolIds[i], user, developerWallets[i], amounts[i], platformFee);
            }
        }

        // Handle model cost (100% to platform)
        if (modelCost > 0) {
            platformBalance += modelCost;
            emit ModelCostPaid(user, modelCost);
        }
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

