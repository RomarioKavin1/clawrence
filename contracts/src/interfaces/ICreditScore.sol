// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICreditScore {
    function getScore(address agent) external view returns (uint256);
    function getLTV(address agent) external view returns (uint256);
    function updateScore(address agent, uint256 loanAmount, uint256 maxBorrowAtTime, uint256 loanDuration, bool repaidOnTime) external;
    function penalizeDefault(address agent) external;
    function setAgentId(address agent, uint256 agentId) external;
}
