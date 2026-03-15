// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC8004 {
    function setAgentURI(uint256 agentId, string memory uri) external;
    function registerAgent(string memory uri) external returns (uint256);
}
