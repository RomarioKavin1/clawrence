// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ClawrenceVault} from "../src/ClawrenceVault.sol";
import {CreditScore} from "../src/CreditScore.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address diaOracle   = vm.envAddress("DIA_ORACLE_ADDRESS");
        address erc8004     = vm.envAddress("ERC8004_REGISTRY");
        address usdc        = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast(deployerKey);

        CreditScore cs = new CreditScore(erc8004);
        console.log("CreditScore deployed at:", address(cs));

        ClawrenceVault vault = new ClawrenceVault(usdc, diaOracle, address(cs));
        console.log("ClawrenceVault deployed at:", address(vault));

        cs.setVault(address(vault));
        console.log("Vault authorized on CreditScore");

        vm.stopBroadcast();

        console.log("\n--- Set these in your .env ---");
        console.log("VAULT_ADDRESS=", address(vault));
        console.log("CREDIT_SCORE_ADDRESS=", address(cs));
    }
}
