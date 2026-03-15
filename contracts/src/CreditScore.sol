// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC8004} from "./interfaces/IERC8004.sol";

contract CreditScore is Ownable {
    address public vault;
    IERC8004 public erc8004Registry;

    mapping(address => uint256) public score;
    mapping(address => uint256) public totalLoans;
    mapping(address => uint256) public totalRepaid;
    mapping(address => uint256) public consecutiveRepayments;
    mapping(address => uint256) public lastActivityTimestamp;
    mapping(address => bool)    public hasHistory;
    mapping(address => uint256) public agentId;

    uint256 public constant INITIAL_SCORE = 50;
    uint256 public constant MAX_SCORE = 100;
    uint256 public constant MIN_SCORE = 0;
    uint256 public constant DECAY_7D  = 5;
    uint256 public constant DECAY_30D = 15;
    uint256 public constant PENALTY_LATE    = 15;
    uint256 public constant PENALTY_DEFAULT = 40;

    event ScoreUpdated(address indexed agent, uint256 newScore, int256 delta);
    event DefaultPenalized(address indexed agent, uint256 newScore);
    event VaultSet(address indexed vault);
    event AgentIdSet(address indexed agent, uint256 agentId);

    error OnlyVault();
    error ZeroAddress();

    constructor(address _erc8004Registry) Ownable(msg.sender) {
        if (_erc8004Registry == address(0)) revert ZeroAddress();
        erc8004Registry = IERC8004(_erc8004Registry);
    }

    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        vault = _vault;
        emit VaultSet(_vault);
    }

    function setAgentId(address agent, uint256 _agentId) external {
        if (msg.sender != owner() && msg.sender != vault) revert OnlyVault();
        agentId[agent] = _agentId;
        emit AgentIdSet(agent, _agentId);
    }

    function getScore(address agent) external view returns (uint256) {
        return _computeDecayedScore(agent);
    }

    function getLTV(address agent) external view returns (uint256) {
        return _scoreTier(_computeDecayedScore(agent));
    }

    function updateScore(
        address agent,
        uint256 loanAmount,
        uint256 maxBorrowAtTime,
        uint256 loanDuration,
        bool repaidOnTime
    ) external {
        if (msg.sender != vault) revert OnlyVault();
        _applyDecay(agent);
        if (!hasHistory[agent]) {
            score[agent] = INITIAL_SCORE;
            hasHistory[agent] = true;
        }
        if (repaidOnTime) {
            uint256 gain = _computeGain(agent, loanAmount, maxBorrowAtTime, loanDuration);
            score[agent] = _clamp(score[agent] + gain, MIN_SCORE, MAX_SCORE);
            consecutiveRepayments[agent]++;
            totalRepaid[agent] += loanAmount;
        } else {
            score[agent] = _saturatingSub(score[agent], PENALTY_LATE);
            consecutiveRepayments[agent] = 0;
        }
        totalLoans[agent]++;
        lastActivityTimestamp[agent] = block.timestamp;
        emit ScoreUpdated(agent, score[agent], 0);
        _writeToERC8004(agent);
    }

    function penalizeDefault(address agent) external {
        if (msg.sender != vault) revert OnlyVault();
        if (!hasHistory[agent]) {
            score[agent] = INITIAL_SCORE;
            hasHistory[agent] = true;
        }
        _applyDecay(agent);
        score[agent] = _saturatingSub(score[agent], PENALTY_DEFAULT);
        consecutiveRepayments[agent] = 0;
        lastActivityTimestamp[agent] = block.timestamp;
        emit DefaultPenalized(agent, score[agent]);
        _writeToERC8004(agent);
    }

    function _computeGain(address agent, uint256 loanAmount, uint256 maxBorrowAtTime, uint256 loanDuration)
        internal view returns (uint256 gain)
    {
        if (maxBorrowAtTime == 0) return 2;
        uint256 utilization = loanAmount * 100 / maxBorrowAtTime;
        if (utilization < 10)      gain = 2;
        else if (utilization < 50) gain = 5;
        else if (utilization < 80) gain = 10;
        else                       gain = 15;

        if (loanDuration > 72 hours)      gain += 5;
        else if (loanDuration > 24 hours) gain += 3;

        uint256 streak = consecutiveRepayments[agent] + 1;
        if (streak == 5)      gain += 10;
        else if (streak == 3) gain += 5;
    }

    function _applyDecay(address agent) internal {
        if (!hasHistory[agent]) return;
        uint256 inactiveFor = block.timestamp - lastActivityTimestamp[agent];
        if (inactiveFor > 30 days)     score[agent] = _saturatingSub(score[agent], DECAY_30D);
        else if (inactiveFor > 7 days) score[agent] = _saturatingSub(score[agent], DECAY_7D);
    }

    function _computeDecayedScore(address agent) internal view returns (uint256) {
        if (!hasHistory[agent]) return INITIAL_SCORE;
        uint256 s = score[agent];
        uint256 inactiveFor = block.timestamp - lastActivityTimestamp[agent];
        if (inactiveFor > 30 days)     return _saturatingSub(s, DECAY_30D);
        if (inactiveFor > 7 days)      return _saturatingSub(s, DECAY_7D);
        return s;
    }

    function _scoreTier(uint256 s) internal pure returns (uint256) {
        if (s < 30) return 0;
        if (s < 50) return 65;
        if (s < 70) return 75;
        if (s < 85) return 85;
        if (s < 95) return 92;
        return 100;
    }

    function _writeToERC8004(address agent) internal {
        uint256 id = agentId[agent];
        if (id == 0) return;
        string memory uri = string(abi.encodePacked(
            '{"clawrenceScore":', _uint2str(score[agent]),
            ',"totalLoans":', _uint2str(totalLoans[agent]),
            ',"consecutiveRepayments":', _uint2str(consecutiveRepayments[agent]),
            '}'
        ));
        try erc8004Registry.setAgentURI(id, uri) {} catch {}
    }

    function _clamp(uint256 val, uint256 lo, uint256 hi) internal pure returns (uint256) {
        if (val < lo) return lo;
        if (val > hi) return hi;
        return val;
    }

    function _saturatingSub(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a - b : 0;
    }

    function _uint2str(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 tmp = v; uint256 digits;
        while (tmp != 0) { digits++; tmp /= 10; }
        bytes memory buf = new bytes(digits);
        while (v != 0) { digits--; buf[digits] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(buf);
    }
}
