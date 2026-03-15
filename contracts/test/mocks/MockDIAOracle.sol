// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IDIAOracle} from "../../src/interfaces/IDIAOracle.sol";
contract MockDIAOracle is IDIAOracle {
    uint128 public price;
    uint128 public priceTimestamp;
    constructor(uint128 _price) { price = _price; priceTimestamp = uint128(block.timestamp); }
    function setPrice(uint128 _price) external { price = _price; priceTimestamp = uint128(block.timestamp); }
    function setStale() external { priceTimestamp = 0; }
    function getValue(string memory) external view returns (uint128, uint128) { return (price, priceTimestamp); }
}
