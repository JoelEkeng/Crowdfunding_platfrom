// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Crowdfunding} from "../src/Crowdfunding.sol";
import {MockERC20} from "../src/MockERC20.sol";

contract DeployTestnetMock is Script {
    error ChainIdMismatch(uint256 actual, uint256 expected);
    error MockDeploymentNotAcknowledged();

    function run() external returns (MockERC20 token, Crowdfunding crowdfunding) {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        if (block.chainid != expectedChainId) revert ChainIdMismatch(block.chainid, expectedChainId);
        if (!vm.envBool("ALLOW_TESTNET_MOCK_TOKEN")) revert MockDeploymentNotAcknowledged();

        // uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        // address deployer = vm.addr(deployerPrivateKey);

        // vm.startBroadcast(deployerPrivateKey);
        address deployer = msg.sender;

        vm.startBroadcast();
        token = new MockERC20("FundChain Testnet Token", "FCT");
        token.mint(deployer, 1_000_000 ether);
        address[] memory trustedTokens = new address[](1);
        trustedTokens[0] = address(token);
        crowdfunding = new Crowdfunding(trustedTokens);
        vm.stopBroadcast();

        console2.log("Chain ID", block.chainid);
        console2.log("Deployer", deployer);
        console2.log("TESTNET-ONLY mock token", address(token));
        console2.log("Crowdfunding", address(crowdfunding));
    }
}
