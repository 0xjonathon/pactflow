// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {PactFactoryV2} from "../src/v2/PactFactoryV2.sol";
import {VerifierRegistryV2} from "../src/v2/VerifierRegistryV2.sol";
import {ReputationRegistryV2} from "../src/v2/ReputationRegistryV2.sol";

contract DeployProtocolV2 is Script {
    function run() external {
        require(block.chainid == 10143, "Monad testnet only");
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address admin = vm.addr(key);
        address token = vm.envAddress("SETTLEMENT_TOKEN_ADDRESS");
        address verifierAddress = vm.envAddress("NEXT_PUBLIC_VERIFIER_ADDRESS");
        require(token.code.length > 0 && verifierAddress != address(0), "missing token or verifier");
        address treasury = vm.envOr("PROTOCOL_TREASURY_ADDRESS", admin);
        uint256 configuredFee = vm.envOr("PROTOCOL_FEE_BPS", uint256(0));
        require(configuredFee <= 1000, "fee exceeds protocol maximum");
        uint16 fee = uint16(configuredFee);
        vm.startBroadcast(key);
        VerifierRegistryV2 registry = new VerifierRegistryV2(admin);
        ReputationRegistryV2 reputation = new ReputationRegistryV2(admin);
        PactFactoryV2 factory = new PactFactoryV2(admin, address(registry), address(reputation), treasury, fee);
        registry.setFactory(address(factory));
        reputation.setFactory(address(factory));
        registry.register(verifierAddress, 1, "pactflow:verifier:engine-v2", keccak256("pactflow-engine-v2"));
        vm.stopBroadcast();
        console2.log("PactFactoryV2", address(factory));
        console2.log("VerifierRegistryV2", address(registry));
        console2.log("ReputationRegistryV2", address(reputation));
        console2.log("ImplementationV2", factory.implementation());
    }
}
