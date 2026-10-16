// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Crowdfunding} from "../src/Crowdfunding.sol";
import {MockERC20} from "../src/MockERC20.sol";

contract DeployLocal is Script {
    uint256 internal constant ANVIL_CHAIN_ID = 31_337;

    error WrongLocalChain(uint256 actual);

    function run() external returns (MockERC20 token, Crowdfunding crowdfunding) {
        if (block.chainid != ANVIL_CHAIN_ID) revert WrongLocalChain(block.chainid);

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        token = new MockERC20("FundChain Test Token", "FCT");
        token.mint(deployer, 1_000_000 ether);
        address[] memory trustedTokens = new address[](1);
        trustedTokens[0] = address(token);
        crowdfunding = new Crowdfunding(trustedTokens);
        vm.stopBroadcast();

        console2.log("Chain ID", block.chainid);
        console2.log("Deployer", deployer);
        console2.log("Mock token", address(token));
        console2.log("Crowdfunding", address(crowdfunding));
    }
}
