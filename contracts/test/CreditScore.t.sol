// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CreditScore} from "../src/CreditScore.sol";
import {MockERC8004} from "./mocks/MockERC8004.sol";

contract CreditScoreTest is Test {
    CreditScore cs;
    MockERC8004 registry;
    address vault = address(0xBEEF);
    address alice = address(0xA11CE);

    function setUp() public {
        registry = new MockERC8004();
        cs = new CreditScore(address(registry));
        cs.setVault(vault);
    }

    function test_onlyVaultCanUpdateScore() public {
        vm.prank(alice);
        vm.expectRevert(CreditScore.OnlyVault.selector);
        cs.updateScore(alice, 100e6, 500e6, 2 hours, true);
    }

    function test_onlyVaultCanPenalizeDefault() public {
        vm.prank(alice);
        vm.expectRevert(CreditScore.OnlyVault.selector);
        cs.penalizeDefault(alice);
    }

    function test_initialScoreIs50() public view { assertEq(cs.getScore(alice), 50); }
    function test_initialLTVIs75() public view { assertEq(cs.getLTV(alice), 75); }

    function test_microLoanGain() public {
        vm.prank(vault);
        cs.updateScore(alice, 9e6, 100e6, 2 hours, true);
        assertEq(cs.getScore(alice), 52);
    }

    function test_midLoanGain() public {
        vm.prank(vault);
        cs.updateScore(alice, 30e6, 100e6, 2 hours, true);
        assertEq(cs.getScore(alice), 55);
    }

    function test_highLoanGain() public {
        vm.prank(vault);
        cs.updateScore(alice, 65e6, 100e6, 2 hours, true);
        assertEq(cs.getScore(alice), 60);
    }

    function test_maxLoanGain() public {
        vm.prank(vault);
        cs.updateScore(alice, 85e6, 100e6, 2 hours, true);
        assertEq(cs.getScore(alice), 65);
    }

    function test_durationBonus24h() public {
        vm.prank(vault);
        cs.updateScore(alice, 30e6, 100e6, 25 hours, true);
        assertEq(cs.getScore(alice), 58);
    }

    function test_durationBonus72h() public {
        vm.prank(vault);
        cs.updateScore(alice, 30e6, 100e6, 73 hours, true);
        assertEq(cs.getScore(alice), 60);
    }

    function test_streakBonusAt3() public {
        vm.startPrank(vault);
        cs.updateScore(alice, 30e6, 100e6, 2 hours, true);
        cs.updateScore(alice, 30e6, 100e6, 2 hours, true);
        cs.updateScore(alice, 30e6, 100e6, 2 hours, true);
        vm.stopPrank();
        assertEq(cs.getScore(alice), 70);
    }

    function test_streakBonusAt5() public {
        vm.startPrank(vault);
        for (uint i = 0; i < 4; i++) { cs.updateScore(alice, 30e6, 100e6, 2 hours, true); }
        cs.updateScore(alice, 30e6, 100e6, 2 hours, true);
        vm.stopPrank();
        assertEq(cs.getScore(alice), 90);
    }

    function test_scoreCapAt100() public {
        vm.startPrank(vault);
        for (uint i = 0; i < 10; i++) { cs.updateScore(alice, 85e6, 100e6, 73 hours, true); }
        vm.stopPrank();
        assertEq(cs.getScore(alice), 100);
    }

    function test_lateRepaymentPenalty() public {
        vm.prank(vault);
        cs.updateScore(alice, 30e6, 100e6, 2 hours, false);
        assertEq(cs.getScore(alice), 35);
    }

    function test_lateRepaymentResetsStreak() public {
        vm.startPrank(vault);
        cs.updateScore(alice, 30e6, 100e6, 2 hours, true);
        cs.updateScore(alice, 30e6, 100e6, 2 hours, false);
        vm.stopPrank();
        assertEq(cs.consecutiveRepayments(alice), 0);
    }

    function test_defaultPenalty() public {
        vm.prank(vault);
        cs.penalizeDefault(alice);
        assertEq(cs.getScore(alice), 10);
    }

    function test_defaultResetsStreak() public {
        vm.startPrank(vault);
        cs.updateScore(alice, 30e6, 100e6, 2 hours, true);
        cs.penalizeDefault(alice);
        vm.stopPrank();
        assertEq(cs.consecutiveRepayments(alice), 0);
    }

    function test_defaultDoesNotGoBelowZero() public {
        vm.startPrank(vault);
        cs.penalizeDefault(alice);
        cs.penalizeDefault(alice);
        vm.stopPrank();
        assertEq(cs.getScore(alice), 0);
    }

    function test_decayAfter7Days() public {
        vm.prank(vault);
        cs.updateScore(alice, 30e6, 100e6, 2 hours, true); // score=55
        vm.warp(block.timestamp + 8 days);
        assertEq(cs.getScore(alice), 50);
    }

    function test_decayAfter30Days() public {
        vm.prank(vault);
        cs.updateScore(alice, 30e6, 100e6, 2 hours, true); // score=55
        vm.warp(block.timestamp + 31 days);
        assertEq(cs.getScore(alice), 40);
    }

    function test_noDecayBeforeFirstLoan() public {
        vm.warp(block.timestamp + 31 days);
        assertEq(cs.getScore(alice), 50);
    }

    function test_ltvTiers() public {
        assertEq(cs.getLTV(alice), 75);
        vm.prank(vault);
        cs.penalizeDefault(alice);
        assertEq(cs.getLTV(alice), 0);
    }

    function test_erc8004WrittenWhenAgentIdSet() public {
        cs.setAgentId(alice, 1);
        vm.prank(vault);
        cs.updateScore(alice, 30e6, 100e6, 2 hours, true);
        assertTrue(bytes(registry.uris(1)).length > 0);
    }

    function test_erc8004NotWrittenWithoutAgentId() public {
        vm.prank(vault);
        cs.updateScore(alice, 30e6, 100e6, 2 hours, true);
        assertEq(bytes(registry.uris(1)).length, 0);
    }
}
