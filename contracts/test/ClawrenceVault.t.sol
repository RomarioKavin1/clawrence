// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ClawrenceVault} from "../src/ClawrenceVault.sol";
import {CreditScore} from "../src/CreditScore.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockReputationRegistry} from "./mocks/MockReputationRegistry.sol";

/// The test contract is Clawrence (owner). alice is a borrower agent. bob is a liquidator.
contract ClawrenceVaultTest is Test {
    ClawrenceVault vault;
    CreditScore cs;
    MockERC20 usdc;
    MockERC20 weth;
    MockReputationRegistry registry;

    address alice = address(0xA11CE); // borrower agent
    address bob   = address(0xB0B);   // liquidator / third party

    uint256 constant ETH_PRICE = 200_000_000_000; // $2000 with 8 decimals

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        registry = new MockReputationRegistry();
        cs = new CreditScore(address(registry));
        vault = new ClawrenceVault(address(usdc), address(weth), address(cs));
        cs.setVault(address(vault));
        usdc.mint(address(vault), 1_000_000e6);
        // Mint WETH to alice and bob for collateral
        weth.mint(alice, 10 ether);
        weth.mint(bob, 10 ether);
        weth.mint(address(this), 10 ether);
        // Set initial price
        vault.setPrice(ETH_PRICE, block.timestamp);
        // alice and bob approve WETH for deposits and USDC for repayments
        vm.startPrank(alice);
        weth.approve(address(vault), type(uint256).max);
        usdc.approve(address(vault), type(uint256).max);
        vm.stopPrank();
        vm.startPrank(bob);
        weth.approve(address(vault), type(uint256).max);
        usdc.approve(address(vault), type(uint256).max);
        vm.stopPrank();
        weth.approve(address(vault), type(uint256).max);
        usdc.approve(address(vault), type(uint256).max);
    }

    // ── Deposit (open to anyone) ──────────────────────────────────────────────

    function test_anyoneCanDeposit() public {
        vm.prank(alice); vault.deposit(1 ether);
        assertEq(vault.collateral(alice), 1 ether);
    }

    function test_depositZeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(ClawrenceVault.ZeroAmount.selector);
        vault.deposit(0);
    }

    function test_collateralValueUSD() public {
        vm.prank(alice); vault.deposit(1 ether);
        assertEq(vault.getCollateralValueUSD(alice), 2_000e6);
    }

    function test_staleOracleReverts() public {
        vm.prank(alice); vault.deposit(1 ether);
        vm.warp(block.timestamp + 3601);
        vm.expectRevert(ClawrenceVault.StaleOracle.selector);
        vault.getCollateralValueUSD(alice);
    }

    // ── Borrow (onlyOwner = Clawrence brokers it) ─────────────────────────────

    function test_clawrenceBorrowsForAlice() public {
        vm.prank(alice); vault.deposit(1 ether);
        // Clawrence (this contract = owner) calls borrow on alice's behalf
        vault.borrow(alice, 500e6);
        assertEq(vault.debt(alice), 500e6);
        assertEq(usdc.balanceOf(alice), 500e6);
    }

    function test_nonOwnerCannotBorrow() public {
        vm.prank(alice); vault.deposit(1 ether);
        vm.prank(bob);
        vm.expectRevert();
        vault.borrow(alice, 500e6);
    }

    function test_borrowRevertsExceedsMax() public {
        vm.prank(alice); vault.deposit(1 ether);
        vm.expectRevert();
        vault.borrow(alice, 2_000e6);
    }

    function test_maxBorrowWithDefaultScore() public {
        vm.prank(alice); vault.deposit(1 ether);
        assertEq(vault.getMaxBorrow(alice), 1_500e6);
    }

    function test_borrowCooldown() public {
        vm.prank(alice); vault.deposit(2 ether);
        vault.borrow(alice, 100e6);
        vm.warp(block.timestamp + 2 hours);
        vault.setPrice(ETH_PRICE, block.timestamp);
        vm.prank(alice); vault.repay(alice, 100e6);
        vm.expectRevert();
        vault.borrow(alice, 100e6);
    }

    function test_borrowAfterCooldown() public {
        vm.prank(alice); vault.deposit(2 ether);
        vault.borrow(alice, 100e6);
        vm.warp(block.timestamp + 2 hours);
        vault.setPrice(ETH_PRICE, block.timestamp);
        vm.prank(alice); vault.repay(alice, 100e6);
        vm.warp(block.timestamp + 5 hours);
        vault.setPrice(ETH_PRICE, block.timestamp);
        vault.borrow(alice, 100e6);
    }

    function test_healthFactor() public {
        vm.prank(alice); vault.deposit(1 ether);
        vault.borrow(alice, 500e6);
        assertEq(vault.getHealthFactor(alice), 400);
    }

    function test_healthFactorMaxWithNoDebt() public view {
        assertEq(vault.getHealthFactor(alice), type(uint256).max);
    }

    // ── Repay (open — agent repays their own debt) ────────────────────────────

    function test_repay() public {
        vm.prank(alice); vault.deposit(1 ether);
        vault.borrow(alice, 500e6);
        vm.warp(block.timestamp + 2 hours);
        vault.setPrice(ETH_PRICE, block.timestamp);
        vm.prank(alice); vault.repay(alice, 500e6);
        assertEq(vault.debt(alice), 0);
    }

    function test_repayUpdatesScore() public {
        vm.prank(alice); vault.deposit(1 ether);
        vault.borrow(alice, 500e6);
        vm.warp(block.timestamp + 2 hours);
        vault.setPrice(ETH_PRICE, block.timestamp);
        uint256 scoreBefore = cs.getScore(alice);
        vm.prank(alice); vault.repay(alice, 500e6);
        assertGt(cs.getScore(alice), scoreBefore);
    }

    function test_repayTooEarlyReverts() public {
        vm.prank(alice); vault.deposit(1 ether);
        vault.borrow(alice, 100e6);
        vm.prank(alice);
        vm.expectRevert();
        vault.repay(alice, 100e6);
    }

    function test_repayNoDebtReverts() public {
        vm.prank(alice);
        vm.expectRevert(ClawrenceVault.NoDebt.selector);
        vault.repay(alice, 100e6);
    }

    // ── Withdraw (open — agent withdraws their own collateral) ───────────────

    function test_withdraw() public {
        vm.startPrank(alice);
        vault.deposit(1 ether);
        uint256 before = weth.balanceOf(alice);
        vault.withdraw(0.5 ether);
        vm.stopPrank();
        assertEq(vault.collateral(alice), 0.5 ether);
        assertGt(weth.balanceOf(alice), before);
    }

    // ── Liquidate (open) ──────────────────────────────────────────────────────

    function test_liquidate() public {
        vm.prank(alice); vault.deposit(1 ether);
        vault.borrow(alice, 1_000e6);
        vault.setPrice(90_000_000_000, block.timestamp);
        uint256 bobBefore = weth.balanceOf(bob);
        vm.prank(bob); vault.liquidate(alice);
        assertEq(vault.debt(alice), 0);
        assertEq(vault.collateral(alice), 0);
        assertGt(weth.balanceOf(bob), bobBefore);
    }

    function test_liquidateHealthyPositionReverts() public {
        vm.prank(alice); vault.deposit(1 ether);
        vault.borrow(alice, 500e6);
        vm.prank(bob);
        vm.expectRevert(ClawrenceVault.NotLiquidatable.selector);
        vault.liquidate(alice);
    }

    function test_liquidatePenalizesScore() public {
        vm.prank(alice); vault.deposit(1 ether);
        vault.borrow(alice, 1_000e6);
        vault.setPrice(90_000_000_000, block.timestamp);
        uint256 scoreBefore = cs.getScore(alice);
        vm.prank(bob); vault.liquidate(alice);
        assertLt(cs.getScore(alice), scoreBefore);
    }
}
