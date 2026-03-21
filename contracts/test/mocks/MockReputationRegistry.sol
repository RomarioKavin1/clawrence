// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IReputationRegistry} from "../../src/interfaces/IReputationRegistry.sol";
contract MockReputationRegistry is IReputationRegistry {
    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        bool exists;
    }
    mapping(uint256 => Feedback) public lastFeedback;
    uint256 public feedbackCount;

    function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, string memory, string memory, bytes32) external {
        lastFeedback[agentId] = Feedback(value, valueDecimals, tag1, tag2, true);
        feedbackCount++;
    }
    function revokeFeedback(uint256, uint64) external {}
    function getSummary(uint256, address[] memory, string memory, string memory) external pure returns (uint256, int128, uint8) { return (0, 0, 0); }
    function getClients(uint256) external pure returns (address[] memory) { return new address[](0); }
    function readFeedback(uint256, address, uint64) external pure returns (int128, uint8, string memory, string memory, bool) { return (0, 0, "", "", false); }
    function readAllFeedback(uint256, address[] memory, string memory, string memory, bool) external pure returns (address[] memory, uint64[] memory, int128[] memory, uint8[] memory, string[] memory, string[] memory, bool[] memory) {
        return (new address[](0), new uint64[](0), new int128[](0), new uint8[](0), new string[](0), new string[](0), new bool[](0));
    }
}
