// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC8004} from "../../src/interfaces/IERC8004.sol";
contract MockERC8004 is IERC8004 {
    mapping(uint256 => string) public uris;
    uint256 public nextId = 1;
    function setAgentURI(uint256 _agentId, string memory uri) external { uris[_agentId] = uri; }
    function registerAgent(string memory uri) external returns (uint256) { uint256 id = nextId++; uris[id] = uri; return id; }
}
