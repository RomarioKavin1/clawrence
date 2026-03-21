// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IReputationRegistry {
    function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, string memory endpoint, string memory feedbackURI, bytes32 feedbackHash) external;
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external;
    function getSummary(uint256 agentId, address[] memory clients, string memory tag1, string memory tag2) external view returns (uint256 count, int128 value, uint8 valueDecimals);
    function getClients(uint256 agentId) external view returns (address[] memory);
    function readFeedback(uint256 agentId, address client, uint64 feedbackIndex) external view returns (int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, bool isRevoked);
    function readAllFeedback(uint256 agentId, address[] memory clients, string memory tag1, string memory tag2, bool includeRevoked) external view returns (address[] memory, uint64[] memory, int128[] memory, uint8[] memory, string[] memory, string[] memory, bool[] memory);
}
