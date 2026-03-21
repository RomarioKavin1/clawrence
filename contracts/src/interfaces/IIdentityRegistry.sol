// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IIdentityRegistry {
    function register(string memory uri) external returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function tokenURI(uint256 agentId) external view returns (string memory);
    function setAgentURI(uint256 agentId, string memory uri) external;
    function getMetadata(uint256 agentId, string memory key) external view returns (bytes memory);
    function setMetadata(uint256 agentId, string memory key, bytes memory value) external;
}
