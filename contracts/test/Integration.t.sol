// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ClawrenceVault} from "../src/ClawrenceVault.sol";
import {CreditScore} from "../src/CreditScore.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockReputationRegistry} from "./mocks/MockReputationRegistry.sol";

/// Broker model: agent deposits WETH, Clawrence (this contract = owner) brokers borrows.
contract IntegrationTest is Test {
    ClawrenceVault vault;
    CreditScore cs;
    MockERC20 usdc;
    MockERC20 weth;
    MockReputationRegistry registry;

    address agent = address(0xA6E47);
    uint256 constant ETH_PRICE = 200_000_000_000;

    function setUp() public {
        usdc     = new MockERC20("USDC", "USDC", 6);
        weth     = new MockERC20("WETH", "WETH", 18);
        registry = new MockReputationRegistry();
        cs       = new CreditScore(address(registry));
        vault    = new ClawrenceVault(address(usdc), address(weth), address(cs));
        cs.setVault(address(vault));
        usdc.mint(address(vault), 1_000_000e6);
        weth.mint(agent, 10 ether);
        // Set initial price
        vault.setPrice(ETH_PRICE, block.timestamp);
        // agent approves WETH for deposits and USDC for repayments
        vm.startPrank(agent);
        weth.approve(address(vault), type(uint256).max);
        usdc.approve(address(vault), type(uint256).max);
        vm.stopPrank();
    }

    function test_fullCreditJourney() public {
        assertEq(cs.getScore(agent), 50);
        assertEq(cs.getLTV(agent), 75);

        // Agent deposits WETH
        vm.prank(agent); vault.deposit(1 ether);

        // Round 1: Clawrence brokers the borrow, agent repays directly
        vault.borrow(agent, 500e6);
        vm.warp(block.timestamp + 25 hours);
        vault.setPrice(ETH_PRICE, block.timestamp);
        vm.prank(agent); vault.repay(agent, 500e6);

        uint256 score1 = cs.getScore(agent);
        assertGt(score1, 50);
        console.log("Score after round 1:", score1);

        // Round 2
        vm.warp(block.timestamp + 6 hours);
        vault.setPrice(ETH_PRICE, block.timestamp);
        vault.borrow(agent, 500e6);
        vm.warp(block.timestamp + 25 hours);
        vault.setPrice(ETH_PRICE, block.timestamp);
        vm.prank(agent); vault.repay(agent, 500e6);

        uint256 score2 = cs.getScore(agent);
        assertGt(score2, score1);
        console.log("Score after round 2:", score2);

        // Round 3: streak bonus
        vm.warp(block.timestamp + 6 hours);
        vault.setPrice(ETH_PRICE, block.timestamp);
        vault.borrow(agent, 500e6);
        vm.warp(block.timestamp + 25 hours);
        vault.setPrice(ETH_PRICE, block.timestamp);
        vm.prank(agent); vault.repay(agent, 500e6);

        uint256 score3 = cs.getScore(agent);
        assertGt(score3, score2);
        console.log("Score after round 3 (streak):", score3);
        assertGe(cs.getLTV(agent), 75);
        console.log("Final LTV:", cs.getLTV(agent));
    }

    function test_liquidationScenario() public {
        vm.prank(agent); vault.deposit(1 ether);
        vault.borrow(agent, 1_000e6);

        uint256 scoreBefore = cs.getScore(agent);
        vault.setPrice(90_000_000_000, block.timestamp);
        assertLt(vault.getHealthFactor(agent), 100);

        address liquidator = address(0xDEAD);
        vm.prank(liquidator); vault.liquidate(agent);

        assertEq(vault.debt(agent), 0);
        assertLt(cs.getScore(agent), scoreBefore);
    }
}
