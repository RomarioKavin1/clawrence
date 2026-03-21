// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {
        _mint(msg.sender, 1_000_000 * 1e6); // 1M USDC
    }
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {
        _mint(msg.sender, 1000 * 1e18); // 1000 WETH
    }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract DeployTokens is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        MockUSDC usdc = new MockUSDC();
        console.log("USDC deployed at:", address(usdc));

        MockWETH weth = new MockWETH();
        console.log("WETH deployed at:", address(weth));

        vm.stopBroadcast();
    }
}
