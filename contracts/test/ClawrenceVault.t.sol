// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ClawrenceVault} from "../src/ClawrenceVault.sol";
import {CreditScore} from "../src/CreditScore.sol";
import {MockDIAOracle} from "./mocks/MockDIAOracle.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockERC8004} from "./mocks/MockERC8004.sol";

/// @notice The test contract IS the owner/agent — it deploys the vault.
contract ClawrenceVaultTest is Test {
    ClawrenceVault vault;
    CreditScore cs;
    MockDIAOracle oracle;
    MockERC20 usdc;
    MockERC8004 registry;

    // bob is a third party — can liquidate but not touch the vault otherwise
    address bob = address(0xB0B);

    uint128 constant BTC_PRICE = 200_000_000_000; // $2000 with 8 decimals

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        oracle = new MockDIAOracle(BTC_PRICE);
        registry = new MockERC8004();
        cs = new CreditScore(address(registry));
        vault = new ClawrenceVault(address(usdc), address(oracle), address(cs));
        cs.setVault(address(vault));
        usdc.mint(address(vault), 1_000_000e6);
        // Fund this contract (the agent) and bob
        vm.deal(address(this), 10 ether);
        vm.deal(bob, 10 ether);
        // Approve USDC for repayments from this contract
        usdc.approve(address(vault), type(uint256).max);
    }

    // Allow test contract to receive BTC
    receive() external payable {}

    function test_deposit() public {
        vault.deposit{value: 1 ether}();
        assertEq(vault.collateral(address(this)), 1 ether);
    }

    function test_depositZeroReverts() public {
        vm.expectRevert(ClawrenceVault.ZeroAmount.selector);
        vault.deposit{value: 0}();
    }

    function test_nonOwnerDepositReverts() public {
        vm.prank(bob);
        vm.expectRevert();
        vault.deposit{value: 1 ether}();
    }

    function test_collateralValueUSD() public {
        vault.deposit{value: 1 ether}();
        assertEq(vault.getCollateralValueUSD(address(this)), 2_000e6);
    }

    function test_staleOracleReverts() public {
        vault.deposit{value: 1 ether}();
        oracle.setStale();
        vm.warp(3601);
        vm.expectRevert(ClawrenceVault.StaleOracle.selector);
        vault.getCollateralValueUSD(address(this));
    }

    function test_maxBorrowWithDefaultScore() public {
        vault.deposit{value: 1 ether}();
        assertEq(vault.getMaxBorrow(address(this)), 1_500e6);
    }

    function test_borrow() public {
        vault.deposit{value: 1 ether}();
        vault.borrow(500e6);
        assertEq(vault.debt(address(this)), 500e6);
        assertEq(usdc.balanceOf(address(this)), 500e6);
    }

    function test_borrowRevertsExceedsMax() public {
        vault.deposit{value: 1 ether}();
        vm.expectRevert();
        vault.borrow(2_000e6);
    }

    function test_borrowCooldown() public {
        vault.deposit{value: 2 ether}();
        vault.borrow(100e6);
        vm.warp(block.timestamp + 2 hours);
        oracle.setPrice(BTC_PRICE);
        vault.repay(100e6);
        vm.expectRevert();
        vault.borrow(100e6);
    }

    function test_borrowAfterCooldown() public {
        vault.deposit{value: 2 ether}();
        vault.borrow(100e6);
        vm.warp(block.timestamp + 2 hours);
        oracle.setPrice(BTC_PRICE);
        vault.repay(100e6);
        vm.warp(block.timestamp + 5 hours);
        oracle.setPrice(BTC_PRICE);
        vault.borrow(100e6);
    }

    function test_healthFactor() public {
        vault.deposit{value: 1 ether}();
        vault.borrow(500e6);
        assertEq(vault.getHealthFactor(address(this)), 400);
    }

    function test_healthFactorMaxWithNoDebt() public view {
        assertEq(vault.getHealthFactor(address(this)), type(uint256).max);
    }

    function test_repay() public {
        vault.deposit{value: 1 ether}();
        vault.borrow(500e6);
        vm.warp(block.timestamp + 2 hours);
        vault.repay(500e6);
        assertEq(vault.debt(address(this)), 0);
    }

    function test_repayUpdatesScore() public {
        vault.deposit{value: 1 ether}();
        vault.borrow(500e6);
        vm.warp(block.timestamp + 2 hours);
        uint256 scoreBefore = cs.getScore(address(this));
        vault.repay(500e6);
        assertGt(cs.getScore(address(this)), scoreBefore);
    }

    function test_repayTooEarlyReverts() public {
        vault.deposit{value: 1 ether}();
        vault.borrow(100e6);
        vm.expectRevert();
        vault.repay(100e6);
    }

    function test_repayNoDebtReverts() public {
        vm.expectRevert(ClawrenceVault.NoDebt.selector);
        vault.repay(100e6);
    }

    function test_liquidate() public {
        vault.deposit{value: 1 ether}();
        vault.borrow(1_000e6);
        oracle.setPrice(90_000_000_000);
        uint256 bobEthBefore = bob.balance;
        vm.prank(bob); vault.liquidate(address(this));
        assertEq(vault.debt(address(this)), 0);
        assertEq(vault.collateral(address(this)), 0);
        assertGt(bob.balance, bobEthBefore);
    }

    function test_liquidateHealthyPositionReverts() public {
        vault.deposit{value: 1 ether}();
        vault.borrow(500e6);
        vm.prank(bob);
        vm.expectRevert(ClawrenceVault.NotLiquidatable.selector);
        vault.liquidate(address(this));
    }

    function test_liquidatePenalizesScore() public {
        vault.deposit{value: 1 ether}();
        vault.borrow(1_000e6);
        oracle.setPrice(90_000_000_000);
        uint256 scoreBefore = cs.getScore(address(this));
        vm.prank(bob); vault.liquidate(address(this));
        assertLt(cs.getScore(address(this)), scoreBefore);
    }
}
