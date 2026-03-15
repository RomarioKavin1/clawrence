// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IDIAOracle} from "./interfaces/IDIAOracle.sol";
import {ICreditScore} from "./interfaces/ICreditScore.sol";

contract ClawrenceVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    IDIAOracle public immutable diaOracle;
    ICreditScore public immutable creditScore;

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
    event Borrowed(address indexed agent, uint256 amount, uint256 healthFactor);
    event Repaid(address indexed agent, uint256 amount, uint256 newScore);
    event Liquidated(address indexed agent, address indexed liquidator, uint256 collateralSeized);

    error ScoreTooLow(uint256 score);
    error ExceedsMaxBorrow(uint256 requested, uint256 max);
    error HealthFactorTooLow(uint256 hf);
    error CooldownActive(uint256 remainingSeconds);
    error LoanTooNew(uint256 remainingSeconds);
    error NoDebt();
    error NotLiquidatable();
    error StaleOracle();
    error ZeroAmount();

    constructor(address _usdc, address _diaOracle, address _creditScore) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        diaOracle = IDIAOracle(_diaOracle);
        creditScore = ICreditScore(_creditScore);
    }

    /// @notice Deposit native BTC as collateral — only the agent (owner) can call
    function deposit() external payable onlyOwner nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        collateral[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        require(collateral[msg.sender] >= amount, "Insufficient collateral");
        collateral[msg.sender] -= amount;
        if (debt[msg.sender] > 0) {
            uint256 hf = getHealthFactor(msg.sender);
            if (hf < HEALTH_FACTOR_MIN) revert HealthFactorTooLow(hf);
        }
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "BTC transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 s = creditScore.getScore(msg.sender);
        if (s < MIN_SCORE) revert ScoreTooLow(s);
        if (lastLoanTime[msg.sender] != 0 && block.timestamp - lastLoanTime[msg.sender] < BORROW_COOLDOWN)
            revert CooldownActive(BORROW_COOLDOWN - (block.timestamp - lastLoanTime[msg.sender]));
        uint256 maxBorrow = getMaxBorrow(msg.sender);
        if (amount > maxBorrow) revert ExceedsMaxBorrow(amount, maxBorrow);
        debt[msg.sender] += amount;
        uint256 hf = getHealthFactor(msg.sender);
        if (hf < HEALTH_FACTOR_MIN) revert HealthFactorTooLow(hf);
        loanTimestamp[msg.sender] = block.timestamp;
        lastLoanTime[msg.sender] = block.timestamp;
        maxBorrowAtLoan[msg.sender] = maxBorrow + amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount, hf);
    }

    function repay(uint256 amount) external onlyOwner nonReentrant {
        if (debt[msg.sender] == 0) revert NoDebt();
        if (amount == 0) revert ZeroAmount();
        uint256 loanAge = block.timestamp - loanTimestamp[msg.sender];
        if (loanAge < MIN_LOAN_HOLD) revert LoanTooNew(MIN_LOAN_HOLD - loanAge);
        uint256 actualRepay = amount > debt[msg.sender] ? debt[msg.sender] : amount;
        usdc.safeTransferFrom(msg.sender, address(this), actualRepay);
        debt[msg.sender] -= actualRepay;
        bool onTime = loanAge <= LATE_THRESHOLD;
        uint256 max = maxBorrowAtLoan[msg.sender];
        if (max == 0) max = actualRepay;
        creditScore.updateScore(msg.sender, actualRepay, max, loanAge, onTime);
        uint256 newScore = creditScore.getScore(msg.sender);
        emit Repaid(msg.sender, actualRepay, newScore);
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
        (bool ok,) = msg.sender.call{value: seizedCollateral}("");
        require(ok, "BTC transfer failed");
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
        uint256 maxBorrow = collatValueUSD * ltv / 100;
        if (debt[agent] >= maxBorrow) return 0;
        return maxBorrow - debt[agent];
    }

    function getCollateralValueUSD(address agent) public view returns (uint256) {
        uint256 btcAmount = collateral[agent];
        if (btcAmount == 0) return 0;
        (uint128 price, uint128 ts) = diaOracle.getValue("BTC/USD");
        if (block.timestamp - ts > 1 hours) revert StaleOracle();
        return btcAmount * uint256(price) / 1e20;
    }
}
