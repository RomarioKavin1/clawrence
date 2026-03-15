// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ClawrenceVault} from "../src/ClawrenceVault.sol";
import {CreditScore} from "../src/CreditScore.sol";
import {MockDIAOracle} from "./mocks/MockDIAOracle.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockERC8004} from "./mocks/MockERC8004.sol";

/// @notice Full lifecycle: deposit → borrow → repay × 3 → score improves → better LTV
contract IntegrationTest is Test {
    ClawrenceVault vault;
    CreditScore cs;
    MockDIAOracle oracle;
    MockERC20 usdc;
    MockERC8004 registry;

    address agent = address(0xA6E47);
    uint128 constant BTC_PRICE = 200_000_000_000; // $2000 with 8 decimals

    function setUp() public {
        usdc     = new MockERC20("USDC", "USDC", 6);
        oracle   = new MockDIAOracle(BTC_PRICE);
        registry = new MockERC8004();
        cs       = new CreditScore(address(registry));
        vault    = new ClawrenceVault(address(usdc), address(oracle), address(cs));
        cs.setVault(address(vault));
        usdc.mint(address(vault), 1_000_000e6);
        vm.deal(agent, 10 ether);
        vm.prank(agent);
        usdc.approve(address(vault), type(uint256).max);
    }

    function test_fullCreditJourney() public {
        assertEq(cs.getScore(agent), 50);
        assertEq(cs.getLTV(agent), 75);

        // Round 1: deposit 1 BTC, borrow 500 USDC (~33% util of 1500 max), hold >24h
        vm.startPrank(agent);
        vault.deposit{value: 1 ether}();
        vault.borrow(500e6);
        vm.warp(block.timestamp + 25 hours);
        oracle.setPrice(BTC_PRICE); // refresh oracle
        vault.repay(500e6);
        vm.stopPrank();

        uint256 score1 = cs.getScore(agent);
        assertGt(score1, 50);
        console.log("Score after round 1:", score1);

        // Round 2: wait cooldown, borrow again
        vm.warp(block.timestamp + 6 hours);
        oracle.setPrice(BTC_PRICE);
        vm.startPrank(agent);
        vault.borrow(500e6);
        vm.warp(block.timestamp + 25 hours);
        oracle.setPrice(BTC_PRICE);
        vault.repay(500e6);
        vm.stopPrank();

        uint256 score2 = cs.getScore(agent);
        assertGt(score2, score1);
        console.log("Score after round 2:", score2);

        // Round 3: streak of 3 triggers bonus
        vm.warp(block.timestamp + 6 hours);
        oracle.setPrice(BTC_PRICE);
        vm.startPrank(agent);
        vault.borrow(500e6);
        vm.warp(block.timestamp + 25 hours);
        oracle.setPrice(BTC_PRICE);
        vault.repay(500e6);
        vm.stopPrank();

        uint256 score3 = cs.getScore(agent);
        assertGt(score3, score2);
        console.log("Score after round 3 (streak):", score3);
        assertGe(cs.getLTV(agent), 75);
        console.log("Final LTV:", cs.getLTV(agent));
    }

    function test_liquidationScenario() public {
        vm.startPrank(agent);
        vault.deposit{value: 1 ether}();
        vault.borrow(1_000e6);
        vm.stopPrank();

        uint256 scoreBefore = cs.getScore(agent);

        // Crash BTC to $900
        oracle.setPrice(90_000_000_000);
        assertLt(vault.getHealthFactor(agent), 100);

        address liquidator = address(0xDEAD);
        vm.prank(liquidator);
        vault.liquidate(agent);

        assertEq(vault.debt(agent), 0);
        assertLt(cs.getScore(agent), scoreBefore);
    }
}
