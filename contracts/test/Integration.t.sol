// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ClawrenceVault} from "../src/ClawrenceVault.sol";
import {CreditScore} from "../src/CreditScore.sol";
import {MockDIAOracle} from "./mocks/MockDIAOracle.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockERC8004} from "./mocks/MockERC8004.sol";

/// Broker model: agent deposits own BTC, Clawrence (this contract = owner) brokers borrows.
contract IntegrationTest is Test {
    ClawrenceVault vault;
    CreditScore cs;
    MockDIAOracle oracle;
    MockERC20 usdc;
    MockERC8004 registry;

    address agent = address(0xA6E47);
    uint128 constant BTC_PRICE = 200_000_000_000;

    function setUp() public {
        usdc     = new MockERC20("USDC", "USDC", 6);
        oracle   = new MockDIAOracle(BTC_PRICE);
        registry = new MockERC8004();
        cs       = new CreditScore(address(registry));
        vault    = new ClawrenceVault(address(usdc), address(oracle), address(cs));
        cs.setVault(address(vault));
        usdc.mint(address(vault), 1_000_000e6);
        vm.deal(agent, 10 ether);
        // agent approves USDC for direct repayments
        vm.prank(agent); usdc.approve(address(vault), type(uint256).max);
    }

    function test_fullCreditJourney() public {
        assertEq(cs.getScore(agent), 50);
        assertEq(cs.getLTV(agent), 75);

        // Agent deposits BTC directly
        vm.prank(agent); vault.deposit{value: 1 ether}();

        // Round 1: Clawrence brokers the borrow, agent repays directly
        vault.borrow(agent, 500e6);
        vm.warp(block.timestamp + 25 hours);
        oracle.setPrice(BTC_PRICE);
        vm.prank(agent); vault.repay(agent, 500e6);

        uint256 score1 = cs.getScore(agent);
        assertGt(score1, 50);
        console.log("Score after round 1:", score1);

        // Round 2
        vm.warp(block.timestamp + 6 hours);
        oracle.setPrice(BTC_PRICE);
        vault.borrow(agent, 500e6);
        vm.warp(block.timestamp + 25 hours);
        oracle.setPrice(BTC_PRICE);
        vm.prank(agent); vault.repay(agent, 500e6);

        uint256 score2 = cs.getScore(agent);
        assertGt(score2, score1);
        console.log("Score after round 2:", score2);

        // Round 3: streak bonus
        vm.warp(block.timestamp + 6 hours);
        oracle.setPrice(BTC_PRICE);
        vault.borrow(agent, 500e6);
        vm.warp(block.timestamp + 25 hours);
        oracle.setPrice(BTC_PRICE);
        vm.prank(agent); vault.repay(agent, 500e6);

        uint256 score3 = cs.getScore(agent);
        assertGt(score3, score2);
        console.log("Score after round 3 (streak):", score3);
        assertGe(cs.getLTV(agent), 75);
        console.log("Final LTV:", cs.getLTV(agent));
    }

    function test_liquidationScenario() public {
        vm.prank(agent); vault.deposit{value: 1 ether}();
        vault.borrow(agent, 1_000e6);

        uint256 scoreBefore = cs.getScore(agent);
        oracle.setPrice(90_000_000_000);
        assertLt(vault.getHealthFactor(agent), 100);

        address liquidator = address(0xDEAD);
        vm.prank(liquidator); vault.liquidate(agent);

        assertEq(vault.debt(agent), 0);
        assertLt(cs.getScore(agent), scoreBefore);
    }
}
