// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ClawrenceVault} from "../src/ClawrenceVault.sol";
import {CreditScore} from "../src/CreditScore.sol";
import {MockDIAOracle} from "./mocks/MockDIAOracle.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockERC8004} from "./mocks/MockERC8004.sol";

contract ClawrenceVaultTest is Test {
    ClawrenceVault vault;
    CreditScore cs;
    MockDIAOracle oracle;
    MockERC20 usdc;
    MockERC8004 registry;

    address alice = address(0xA11CE);
    address bob   = address(0xB0B);

    uint128 constant BTC_PRICE = 200_000_000_000; // $2000 with 8 decimals

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        oracle = new MockDIAOracle(BTC_PRICE);
        registry = new MockERC8004();
        cs = new CreditScore(address(registry));
        vault = new ClawrenceVault(address(usdc), address(oracle), address(cs));
        cs.setVault(address(vault));
        usdc.mint(address(vault), 1_000_000e6);
        // Fund alice and bob with native BTC (ETH in Anvil)
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        // Approve USDC for repayments
        vm.prank(alice); usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);   usdc.approve(address(vault), type(uint256).max);
    }

    function test_deposit() public {
        vm.prank(alice); vault.deposit{value: 1 ether}();
        assertEq(vault.collateral(alice), 1 ether);
    }

    function test_depositZeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(ClawrenceVault.ZeroAmount.selector);
        vault.deposit{value: 0}();
    }

    function test_collateralValueUSD() public {
        vm.prank(alice); vault.deposit{value: 1 ether}();
        assertEq(vault.getCollateralValueUSD(alice), 2_000e6);
    }

    function test_staleOracleReverts() public {
        vm.prank(alice); vault.deposit{value: 1 ether}();
        oracle.setStale(); // sets priceTimestamp = 0
        vm.warp(3601);    // block.timestamp = 3601, so 3601 - 0 > 1 hour
        vm.expectRevert(ClawrenceVault.StaleOracle.selector);
        vault.getCollateralValueUSD(alice);
    }

    function test_maxBorrowWithDefaultScore() public {
        vm.prank(alice); vault.deposit{value: 1 ether}();
        assertEq(vault.getMaxBorrow(alice), 1_500e6);
    }

    function test_borrow() public {
        vm.startPrank(alice);
        vault.deposit{value: 1 ether}();
        vault.borrow(500e6);
        vm.stopPrank();
        assertEq(vault.debt(alice), 500e6);
        assertEq(usdc.balanceOf(alice), 500e6);
    }

    function test_borrowRevertsExceedsMax() public {
        vm.startPrank(alice);
        vault.deposit{value: 1 ether}();
        vm.expectRevert();
        vault.borrow(2_000e6);
        vm.stopPrank();
    }

    function test_borrowCooldown() public {
        vm.startPrank(alice);
        vault.deposit{value: 2 ether}();
        vault.borrow(100e6);
        vm.warp(block.timestamp + 2 hours);
        oracle.setPrice(BTC_PRICE); // refresh oracle so it's not stale
        vault.repay(100e6);
        // Only 2h since borrow, cooldown is 6h — should revert with CooldownActive
        vm.expectRevert();
        vault.borrow(100e6);
        vm.stopPrank();
    }

    function test_borrowAfterCooldown() public {
        vm.startPrank(alice);
        vault.deposit{value: 2 ether}();
        vault.borrow(100e6);
        vm.warp(block.timestamp + 2 hours);
        oracle.setPrice(BTC_PRICE); // refresh oracle
        vault.repay(100e6);
        vm.warp(block.timestamp + 5 hours); // total 7h since borrow — past cooldown
        oracle.setPrice(BTC_PRICE); // refresh oracle
        vault.borrow(100e6);
        vm.stopPrank();
    }

    function test_healthFactor() public {
        vm.startPrank(alice);
        vault.deposit{value: 1 ether}();
        vault.borrow(500e6);
        vm.stopPrank();
        assertEq(vault.getHealthFactor(alice), 400);
    }

    function test_healthFactorMaxWithNoDebt() public view {
        assertEq(vault.getHealthFactor(alice), type(uint256).max);
    }

    function test_repay() public {
        vm.startPrank(alice);
        vault.deposit{value: 1 ether}();
        vault.borrow(500e6);
        vm.warp(block.timestamp + 2 hours);
        vault.repay(500e6);
        vm.stopPrank();
        assertEq(vault.debt(alice), 0);
    }

    function test_repayUpdatesScore() public {
        vm.startPrank(alice);
        vault.deposit{value: 1 ether}();
        vault.borrow(500e6);
        vm.warp(block.timestamp + 2 hours);
        uint256 scoreBefore = cs.getScore(alice);
        vault.repay(500e6);
        vm.stopPrank();
        assertGt(cs.getScore(alice), scoreBefore);
    }

    function test_repayTooEarlyReverts() public {
        vm.startPrank(alice);
        vault.deposit{value: 1 ether}();
        vault.borrow(100e6);
        vm.expectRevert();
        vault.repay(100e6);
        vm.stopPrank();
    }

    function test_repayNoDebtReverts() public {
        vm.prank(alice);
        vm.expectRevert(ClawrenceVault.NoDebt.selector);
        vault.repay(100e6);
    }

    function test_liquidate() public {
        vm.startPrank(alice);
        vault.deposit{value: 1 ether}();
        vault.borrow(1_000e6);
        vm.stopPrank();
        oracle.setPrice(90_000_000_000);
        uint256 bobEthBefore = bob.balance;
        vm.prank(bob); vault.liquidate(alice);
        assertEq(vault.debt(alice), 0);
        assertEq(vault.collateral(alice), 0);
        assertGt(bob.balance, bobEthBefore);
    }

    function test_liquidateHealthyPositionReverts() public {
        vm.startPrank(alice);
        vault.deposit{value: 1 ether}();
        vault.borrow(500e6);
        vm.stopPrank();
        vm.prank(bob);
        vm.expectRevert(ClawrenceVault.NotLiquidatable.selector);
        vault.liquidate(alice);
    }

    function test_liquidatePenalizesScore() public {
        vm.startPrank(alice);
        vault.deposit{value: 1 ether}();
        vault.borrow(1_000e6);
        vm.stopPrank();
        oracle.setPrice(90_000_000_000);
        uint256 scoreBefore = cs.getScore(alice);
        vm.prank(bob); vault.liquidate(alice);
        assertLt(cs.getScore(alice), scoreBefore);
    }
}
