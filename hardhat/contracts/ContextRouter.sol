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
 * 
 * STAKING SYSTEM (Trust Level 3):
 * ALL tools (including free) require developers to stake collateral.
 * Minimum stake is $10.00 USDC, or 100x query price if higher.
 * This provides economic security against scams - if a tool is fraudulent,
 * the stake can be slashed by the admin to compensate affected users.
 * Stake parameters are configurable by admin without redeployment.
 * Example: Free = $10 stake, $0.50/query = $50 stake, $1.00/query = $100 stake
 */
contract ContextRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // State variables
    IERC20 public immutable usdc;
    uint256 public constant PLATFORM_FEE_PERCENT = 10;
    
    // Staking parameters (USDC has 6 decimals)
    // ALL tools require a minimum stake to prevent spam and ensure quality.
    // Formula: requiredStake = MAX(minimumStake, pricePerQuery * stakeMultiplier)
    //
    // These are configurable by admin to allow adjustment without redeployment.
    // Changes take effect immediately for new stakes.
    //
    // Examples (with default $10 minimum and 100x multiplier):
    //   Free tool ($0.00/query)   → $10.00 stake (minimum applies)
    //   $0.01/query tool          → $10.00 stake (minimum applies)
    //   $0.10/query tool          → $10.00 stake (100x = minimum)
    //   $0.50/query tool          → $50.00 stake (100x applies)
    //   $1.00/query tool          → $100.00 stake (100x applies)
    uint256 public stakeMultiplier = 100;
    uint256 public minimumStake = 10_000_000; // $10.00 USDC (6 decimals)
    
    // Tracking
    mapping(address => uint256) public developerBalances;
    uint256 public platformBalance;
    
    // Operators (servers authorized to trigger payments on behalf of users)
    mapping(address => bool) public operators;
    
    // ============================================================
    // STAKING STATE (Trust Level 3)
    // ============================================================
    
    // Tool staking: toolId => staked USDC amount
    mapping(uint256 => uint256) public toolStakes;
    // Tool ownership: toolId => developer wallet (set on first stake)
    mapping(uint256 => address) public toolDevelopers;
    // Slashed balance available for claims (goes to platform for redistribution)
    uint256 public slashedBalance;
    
    // Withdrawal timelock: toolId => timestamp when withdrawal was requested
    // Prevents front-running slashes - must wait WITHDRAWAL_DELAY after requesting
    mapping(uint256 => uint256) public withdrawalRequestTime;
    // 7-day delay between requesting withdrawal and executing it
    uint256 public constant WITHDRAWAL_DELAY = 7 days;
    
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
    
    // Staking events
    event StakeDeposited(uint256 indexed toolId, address indexed developer, uint256 amount);
    event WithdrawalRequested(uint256 indexed toolId, address indexed developer, uint256 availableAt);
    event StakeWithdrawn(uint256 indexed toolId, address indexed developer, uint256 amount);
    event StakeSlashed(uint256 indexed toolId, address indexed developer, uint256 amount, string reason);
    event StakeParametersUpdated(uint256 minimumStake, uint256 stakeMultiplier);

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

    // ============================================================
    // STAKING FUNCTIONS (Trust Level 3 - Economic Security)
    // ============================================================

    /**
     * @notice Calculate the minimum stake required for a tool based on its query price
     * @param pricePerQuery The tool's price per query in USDC (6 decimals)
     * @return The minimum stake required - MAX(minimumStake, price * stakeMultiplier)
     *
     * All tools require a minimum stake to prevent spam and ensure quality.
     * This creates accountability even for free tools, similar to Apple's $99/year
     * developer fee but much lower and fully refundable.
     */
    function getMinimumStake(uint256 pricePerQuery) public view returns (uint256) {
        uint256 proportionalStake = pricePerQuery * stakeMultiplier;
        // Return the greater of minimum stake or proportional stake
        if (proportionalStake > minimumStake) {
            return proportionalStake;
        }
        return minimumStake;
    }

    /**
     * @notice Admin updates staking parameters
     * @dev Only callable by contract owner. Allows adjusting minimum stake and multiplier
     *      without redeploying the contract.
     * @param _minimumStake The new minimum stake in USDC (6 decimals)
     * @param _stakeMultiplier The new stake multiplier (e.g., 100 = 100x query price)
     */
    function setStakeParameters(uint256 _minimumStake, uint256 _stakeMultiplier) external onlyOwner {
        require(_minimumStake > 0, "Minimum stake must be > 0");
        require(_stakeMultiplier > 0, "Multiplier must be > 0");
        minimumStake = _minimumStake;
        stakeMultiplier = _stakeMultiplier;
        emit StakeParametersUpdated(_minimumStake, _stakeMultiplier);
    }

    /**
     * @notice Check if a tool requires staking based on its price
     * @return True - ALL tools require staking (minimum $1.00)
     */
    function requiresStaking(uint256) public pure returns (bool) {
        return true; // All tools require staking
    }

    /**
     * @notice Developer deposits stake for a tool
     * @dev Developer must approve this contract to spend USDC first.
     *      First stake must meet the minimum stake requirement.
     *      Additional stakes can be any amount (topping up).
     * @param toolId The ID of the tool to stake for
     * @param amount The amount of USDC to stake
     */
    function depositStake(uint256 toolId, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        // If tool already has a developer assigned, only they can add stake
        address existingDev = toolDevelopers[toolId];
        if (existingDev != address(0)) {
            require(existingDev == msg.sender, "Only tool owner can add stake");
        } else {
            // First stake - enforce minimum stake requirement
            require(amount >= minimumStake, "Initial stake must meet minimum");
            // First stake registers ownership
            toolDevelopers[toolId] = msg.sender;
        }

        // Transfer USDC from developer to this contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Update stake balance
        toolStakes[toolId] += amount;

        emit StakeDeposited(toolId, msg.sender, amount);
    }

    /**
     * @notice Request withdrawal of stake (starts 7-day timelock)
     * @dev Must be called before withdrawStake. Prevents front-running slashes.
     * @param toolId The ID of the tool to request withdrawal for
     */
    function requestWithdrawal(uint256 toolId) external {
        require(toolDevelopers[toolId] == msg.sender, "Not tool owner");
        require(toolStakes[toolId] > 0, "No stake to withdraw");
        
        // Start the withdrawal timer
        uint256 availableAt = block.timestamp + WITHDRAWAL_DELAY;
        withdrawalRequestTime[toolId] = block.timestamp;
        
        emit WithdrawalRequested(toolId, msg.sender, availableAt);
    }

    /**
     * @notice Cancel a pending withdrawal request
     * @dev Allows developer to cancel if they change their mind
     * @param toolId The ID of the tool to cancel withdrawal for
     */
    function cancelWithdrawal(uint256 toolId) external {
        require(toolDevelopers[toolId] == msg.sender, "Not tool owner");
        require(withdrawalRequestTime[toolId] > 0, "No pending withdrawal");
        
        withdrawalRequestTime[toolId] = 0;
    }

    /**
     * @notice Developer withdraws stake from a tool (after 7-day delay)
     * @dev Must call requestWithdrawal first and wait WITHDRAWAL_DELAY
     * @param toolId The ID of the tool to withdraw stake from
     * @param amount The amount of USDC to withdraw
     */
    function withdrawStake(uint256 toolId, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(toolDevelopers[toolId] == msg.sender, "Not tool owner");
        require(toolStakes[toolId] >= amount, "Insufficient stake");
        
        // Timelock check: must have requested withdrawal and waited 7 days
        uint256 requestTime = withdrawalRequestTime[toolId];
        require(requestTime > 0, "Must request withdrawal first");
        require(block.timestamp >= requestTime + WITHDRAWAL_DELAY, "Withdrawal delay not met");

        // Update stake balance
        toolStakes[toolId] -= amount;
        
        // Clear withdrawal request if fully withdrawn
        if (toolStakes[toolId] == 0) {
            withdrawalRequestTime[toolId] = 0;
        }

        // Transfer USDC back to developer
        usdc.safeTransfer(msg.sender, amount);

        emit StakeWithdrawn(toolId, msg.sender, amount);
    }

    /**
     * @notice Admin slashes stake from a fraudulent tool
     * @dev Only callable by contract owner. Used to penalize scam tools.
     *      Also resets any pending withdrawal request to prevent escape.
     * @param toolId The ID of the tool to slash
     * @param amount The amount of USDC to slash
     * @param reason Human-readable reason for the slash (stored in event)
     */
    function slash(uint256 toolId, uint256 amount, string calldata reason) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(toolStakes[toolId] >= amount, "Insufficient stake to slash");
        
        address developer = toolDevelopers[toolId];
        require(developer != address(0), "Tool has no stake");

        // Reset any pending withdrawal request (prevent front-running)
        if (withdrawalRequestTime[toolId] > 0) {
            withdrawalRequestTime[toolId] = 0;
        }

        // Reduce tool stake
        toolStakes[toolId] -= amount;

        // Add to slashed balance (admin can claim and redistribute to affected users)
        slashedBalance += amount;

        emit StakeSlashed(toolId, developer, amount, reason);
    }

    /**
     * @notice Admin claims slashed funds for redistribution to affected users
     * @dev Only callable by contract owner
     */
    function claimSlashedFunds() external onlyOwner nonReentrant {
        uint256 balance = slashedBalance;
        require(balance > 0, "No slashed funds to claim");

        slashedBalance = 0;
        usdc.safeTransfer(owner(), balance);
    }

    /**
     * @notice Get the current stake for a tool
     * @param toolId The ID of the tool
     * @return The staked amount in USDC
     */
    function getStake(uint256 toolId) external view returns (uint256) {
        return toolStakes[toolId];
    }

    /**
     * @notice Get the developer wallet for a staked tool
     * @param toolId The ID of the tool
     * @return The developer's wallet address (address(0) if not staked)
     */
    function getToolDeveloper(uint256 toolId) external view returns (address) {
        return toolDevelopers[toolId];
    }

    /**
     * @notice Check if a tool has sufficient stake for its price
     * @param toolId The ID of the tool
     * @param pricePerQuery The tool's current price per query
     * @return True if the tool has sufficient stake (or doesn't require staking)
     */
    function hasRequiredStake(uint256 toolId, uint256 pricePerQuery) external view returns (bool) {
        uint256 required = getMinimumStake(pricePerQuery);
        if (required == 0) {
            return true; // Tool doesn't require staking
        }
        return toolStakes[toolId] >= required;
    }

    /**
     * @notice Get withdrawal request status for a tool
     * @param toolId The ID of the tool
     * @return requestTime When withdrawal was requested (0 if not requested)
     * @return availableAt When withdrawal can be executed (0 if not requested)
     * @return canWithdraw Whether the delay has passed and withdrawal is ready
     */
    function getWithdrawalStatus(uint256 toolId) external view returns (
        uint256 requestTime,
        uint256 availableAt,
        bool canWithdraw
    ) {
        requestTime = withdrawalRequestTime[toolId];
        if (requestTime > 0) {
            availableAt = requestTime + WITHDRAWAL_DELAY;
            canWithdraw = block.timestamp >= availableAt;
        }
    }
}

