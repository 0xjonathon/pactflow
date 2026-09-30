// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {PactFactory} from "../src/PactFactory.sol";
import {VerifierRegistry} from "../src/VerifierRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

contract DeployProtocol is Script {
    function run() external {
        uint256 privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        address treasury = vm.envOr("PROTOCOL_TREASURY_ADDRESS", deployer);
        address token = vm.envAddress("SETTLEMENT_TOKEN_ADDRESS");
        require(block.chainid == vm.envUint("NEXT_PUBLIC_MONAD_CHAIN_ID"), "unexpected chain");
        require(token.code.length > 0, "settlement token not deployed");

        vm.startBroadcast(privateKey);
        VerifierRegistry verifier = new VerifierRegistry(deployer);
        ReputationRegistry reputation = new ReputationRegistry(deployer);
        // PactFactory creates and locks its PactEscrow implementation internally.
        PactFactory factory = new PactFactory(deployer, address(verifier), address(reputation), treasury, 0);
        verifier.setFactory(address(factory));
        reputation.setFactory(address(factory));
        vm.stopBroadcast();

        console2.log("PactFactory", address(factory));
        console2.log("PactEscrowImplementation", factory.implementation());
        console2.log("ReputationRegistry", address(reputation));
        console2.log("VerifierRegistry", address(verifier));
        console2.log("SettlementToken", token);
    }
}
