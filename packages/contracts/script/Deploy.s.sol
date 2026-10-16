// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Crowdfunding} from "../src/Crowdfunding.sol";

contract Deploy is Script {
    error ChainIdMismatch(uint256 actual, uint256 expected);

    function run() external returns (Crowdfunding crowdfunding) {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        if (block.chainid != expectedChainId) revert ChainIdMismatch(block.chainid, expectedChainId);

        // uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        // address deployer = vm.addr(deployerPrivateKey);
        address deployer = vm.addr(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        address token = vm.envAddress("TOKEN_ADDRESS");
        address[] memory trustedTokens = new address[](1);
        trustedTokens[0] = token;

        console2.log("Chain ID", block.chainid);
        console2.log("Deployer", deployer);
        console2.log("Trusted token", token);

        vm.startBroadcast();
        crowdfunding = new Crowdfunding(trustedTokens);
        vm.stopBroadcast();

        console2.log("Crowdfunding", address(crowdfunding));
    }
}
