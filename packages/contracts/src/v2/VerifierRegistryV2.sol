// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IPactFactoryV2} from "./ReputationRegistryV2.sol";

contract VerifierRegistryV2 is AccessControl, Pausable, EIP712 {
    bytes32 public constant VERIFIER_MANAGER_ROLE = keccak256("VERIFIER_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant ATTESTATION_TYPEHASH = keccak256(
        "Attestation(address pact,uint256 milestoneId,bytes32 deliverableHash,bytes32 rulesHash,uint256 submissionId,bytes32 reportHash,bool approved,uint256 nonce,uint256 expiry,address verifier)"
    );

    struct Verifier {
        bool active;
        uint8 verifierType;
        string metadataURI;
        bytes32 metadataHash;
    }

    struct Attestation {
        address pact;
        uint256 milestoneId;
        bytes32 deliverableHash;
        bytes32 rulesHash;
        uint256 submissionId;
        bytes32 reportHash;
        bool approved;
        uint256 nonce;
        uint256 expiry;
        address verifier;
    }

    address public factory;
    mapping(address => Verifier) public verifiers;
    mapping(address => mapping(uint256 => bool)) public usedNonce;
    mapping(bytes32 => bool) public usedDigest;

    error InvalidFactory();
    error UnauthorizedPact();
    error InvalidVerifier();
    error ExpiredAttestation();
    error ReplayedAttestation();
    error InvalidSignature();

    event VerifierRegistered(address indexed verifier, uint8 verifierType, bytes32 metadataHash, string metadataURI);
    event FactorySet(address indexed factory);
    event VerifierRevoked(address indexed verifier);
    event AttestationConsumed(bytes32 indexed digest, address indexed verifier, address indexed pact);

    constructor(address admin) EIP712("PactFlow Verifier", "2") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_MANAGER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function setFactory(address factory_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (factory != address(0) || factory_ == address(0) || factory_.code.length == 0) revert InvalidFactory();
        factory = factory_;
        emit FactorySet(factory_);
    }

    function register(address verifier, uint8 verifierType, string calldata metadataURI, bytes32 metadataHash)
        external
        onlyRole(VERIFIER_MANAGER_ROLE)
    {
        if (verifier == address(0) || verifierType == 0 || metadataHash == bytes32(0)) {
            revert InvalidVerifier();
        }
        verifiers[verifier] = Verifier(true, verifierType, metadataURI, metadataHash);
        emit VerifierRegistered(verifier, verifierType, metadataHash, metadataURI);
    }

    function revoke(address verifier) external onlyRole(VERIFIER_MANAGER_ROLE) {
        verifiers[verifier].active = false;
        emit VerifierRevoked(verifier);
    }

    function hashAttestation(Attestation calldata a) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ATTESTATION_TYPEHASH,
                    a.pact,
                    a.milestoneId,
                    a.deliverableHash,
                    a.rulesHash,
                    a.submissionId,
                    a.reportHash,
                    a.approved,
                    a.nonce,
                    a.expiry,
                    a.verifier
                )
            )
        );
    }

    function consume(Attestation calldata a, bytes calldata signature) external whenNotPaused returns (bytes32 digest) {
        if (factory == address(0) || !IPactFactoryV2(factory).isPact(msg.sender) || a.pact != msg.sender) {
            revert UnauthorizedPact();
        }
        if (!verifiers[a.verifier].active) revert InvalidVerifier();
        if (a.expiry < block.timestamp) revert ExpiredAttestation();
        digest = hashAttestation(a);
        if (usedNonce[a.verifier][a.nonce] || usedDigest[digest]) revert ReplayedAttestation();
        if (!SignatureChecker.isValidSignatureNow(a.verifier, digest, signature)) revert InvalidSignature();
        usedNonce[a.verifier][a.nonce] = true;
        usedDigest[digest] = true;
        emit AttestationConsumed(digest, a.verifier, a.pact);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
