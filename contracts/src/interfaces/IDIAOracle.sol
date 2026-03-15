// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDIAOracle {
    function getValue(string memory key) external view returns (uint128 price, uint128 timestamp);
}
