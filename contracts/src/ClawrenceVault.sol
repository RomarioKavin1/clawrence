// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ICreditScore} from "./interfaces/ICreditScore.sol";

contract ClawrenceVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    IERC20 public immutable weth;
    ICreditScore public immutable creditScore;

    uint256 public ethUsdPrice;
    uint256 public priceTimestamp;

    mapping(address => uint256) public collateral;
    mapping(address => uint256) public debt;
    mapping(address => uint256) public loanTimestamp;
    mapping(address => uint256) public lastLoanTime;
    mapping(address => uint256) public maxBorrowAtLoan;

    uint256 public constant BORROW_COOLDOWN   = 6 hours;
    uint256 public constant MIN_LOAN_HOLD     = 1 hours;
    uint256 public constant LATE_THRESHOLD    = 30 days;
    uint256 public constant MIN_SCORE         = 30;
    uint256 public constant HEALTH_FACTOR_MIN = 120;
    uint256 public constant HEALTH_FACTOR_LIQ = 100;

    event Deposited(address indexed agent, uint256 amount);
    event Withdrawn(address indexed agent, uint256 amount);
    event Borrowed(address indexed recipient, uint256 amount, uint256 healthFactor);
    event Repaid(address indexed agent, uint256 amount, uint256 newScore);
    event Liquidated(address indexed agent, address indexed liquidator, uint256 collateralSeized);
    event PriceUpdated(uint256 price, uint256 timestamp);

    error ScoreTooLow(uint256 score);
    error ExceedsMaxBorrow(uint256 requested, uint256 max);
    error HealthFactorTooLow(uint256 hf);
    error CooldownActive(uint256 remainingSeconds);
    error LoanTooNew(uint256 remainingSeconds);
    error NoDebt();
    error NotLiquidatable();
    error StaleOracle();
    error ZeroAmount();

    constructor(address _usdc, address _weth, address _creditScore) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        weth = IERC20(_weth);
        creditScore = ICreditScore(_creditScore);
    }

    function setPrice(uint256 _price, uint256 _timestamp) external onlyOwner {
        require(_price > 0, "Invalid price");
        ethUsdPrice = _price;
        priceTimestamp = _timestamp;
        emit PriceUpdated(_price, _timestamp);
    }

    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        weth.safeTransferFrom(msg.sender, address(this), amount);
        collateral[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Owner deposits WETH on behalf of a user (used by skill server x402 flow)
    function depositFor(address user, uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        weth.safeTransferFrom(msg.sender, address(this), amount);
        collateral[user] += amount;
        emit Deposited(user, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        require(collateral[msg.sender] >= amount, "Insufficient collateral");
        collateral[msg.sender] -= amount;
        if (debt[msg.sender] > 0) {
            uint256 hf = getHealthFactor(msg.sender);
            if (hf < HEALTH_FACTOR_MIN) revert HealthFactorTooLow(hf);
        }
        weth.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Owner withdraws WETH on behalf of a user (used by skill server after EIP-712 signature)
    function withdrawFor(address user, uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        require(collateral[user] >= amount, "Insufficient collateral");
        collateral[user] -= amount;
        if (debt[user] > 0) {
            uint256 hf = getHealthFactor(user);
            if (hf < HEALTH_FACTOR_MIN) revert HealthFactorTooLow(hf);
        }
        weth.safeTransfer(user, amount);
        emit Withdrawn(user, amount);
    }

    function borrow(address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 s = creditScore.getScore(recipient);
        if (s < MIN_SCORE) revert ScoreTooLow(s);
        if (lastLoanTime[recipient] != 0 && block.timestamp - lastLoanTime[recipient] < BORROW_COOLDOWN)
            revert CooldownActive(BORROW_COOLDOWN - (block.timestamp - lastLoanTime[recipient]));
        uint256 maxBorrow = getMaxBorrow(recipient);
        if (amount > maxBorrow) revert ExceedsMaxBorrow(amount, maxBorrow);
        debt[recipient] += amount;
        uint256 hf = getHealthFactor(recipient);
        if (hf < HEALTH_FACTOR_MIN) revert HealthFactorTooLow(hf);
        loanTimestamp[recipient] = block.timestamp;
        lastLoanTime[recipient] = block.timestamp;
        maxBorrowAtLoan[recipient] = maxBorrow + amount;
        usdc.safeTransfer(recipient, amount);
        emit Borrowed(recipient, amount, hf);
    }

    function repay(address onBehalfOf, uint256 amount) external nonReentrant {
        if (debt[onBehalfOf] == 0) revert NoDebt();
        if (amount == 0) revert ZeroAmount();
        uint256 loanAge = block.timestamp - loanTimestamp[onBehalfOf];
        if (loanAge < MIN_LOAN_HOLD) revert LoanTooNew(MIN_LOAN_HOLD - loanAge);
        uint256 actualRepay = amount > debt[onBehalfOf] ? debt[onBehalfOf] : amount;
        usdc.safeTransferFrom(msg.sender, address(this), actualRepay);
        debt[onBehalfOf] -= actualRepay;
        bool onTime = loanAge <= LATE_THRESHOLD;
        uint256 max = maxBorrowAtLoan[onBehalfOf];
        if (max == 0) max = actualRepay;
        creditScore.updateScore(onBehalfOf, actualRepay, max, loanAge, onTime);
        uint256 newScore = creditScore.getScore(onBehalfOf);
        emit Repaid(onBehalfOf, actualRepay, newScore);
    }

    function liquidate(address agent) external nonReentrant {
        if (debt[agent] == 0) revert NoDebt();
        uint256 hf = getHealthFactor(agent);
        if (hf >= HEALTH_FACTOR_LIQ) revert NotLiquidatable();
        uint256 seizedCollateral = collateral[agent];
        collateral[agent] = 0;
        debt[agent] = 0;
        loanTimestamp[agent] = 0;
        creditScore.penalizeDefault(agent);
        weth.safeTransfer(msg.sender, seizedCollateral);
        emit Liquidated(agent, msg.sender, seizedCollateral);
    }

    function getHealthFactor(address agent) public view returns (uint256) {
        if (debt[agent] == 0) return type(uint256).max;
        return getCollateralValueUSD(agent) * 100 / debt[agent];
    }

    function getMaxBorrow(address agent) public view returns (uint256) {
        uint256 ltv = creditScore.getLTV(agent);
        if (ltv == 0) return 0;
        uint256 collatValueUSD = getCollateralValueUSD(agent);
        uint256 maxB = collatValueUSD * ltv / 100;
        if (debt[agent] >= maxB) return 0;
        return maxB - debt[agent];
    }

    function getCollateralValueUSD(address agent) public view returns (uint256) {
        uint256 ethAmount = collateral[agent];
        if (ethAmount == 0) return 0;
        if (block.timestamp - priceTimestamp > 1 hours) revert StaleOracle();
        return ethAmount * ethUsdPrice / 1e20;
    }
}
