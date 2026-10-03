// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {PactEscrowV2} from "./PactEscrowV2.sol";

contract PactFactoryV2 is AccessControl, Pausable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    uint16 public constant MAX_FEE_BPS = 1_000;

    address public immutable implementation;
    address public immutable guardian;
    address public immutable verifierRegistry;
    address public immutable reputationRegistry;
    address public feeTreasury;
    uint16 public feeBps;
    mapping(address => bool) public isPact;

    error InvalidAddress();
    error InvalidFee();

    event PactCreated(address indexed pact, address indexed client, address indexed worker);
    event PactConfigured(
        address indexed pact,
        address token,
        address arbitrator,
        uint256 totalBudget,
        uint256 clientBond,
        uint256 workerBond,
        uint64 acceptanceDeadline,
        uint64 reviewPeriod,
        bytes32 agreementHash
    );
    event MilestoneConfigured(
        address indexed pact,
        uint256 indexed id,
        uint256 amount,
        uint64 dueAt,
        bytes32 rulesHash,
        uint8 mode,
        uint8 maxRevisions,
        address verifier
    );
    event FeeConfigChanged(address indexed treasury, uint16 feeBps);

    constructor(
        address admin,
        address verifierRegistry_,
        address reputationRegistry_,
        address treasury_,
        uint16 feeBps_
    ) {
        if (admin == address(0) || verifierRegistry_ == address(0) || reputationRegistry_ == address(0)) {
            revert InvalidAddress();
        }
        implementation = address(new PactEscrowV2());
        guardian = admin;
        verifierRegistry = verifierRegistry_;
        reputationRegistry = reputationRegistry_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(FEE_MANAGER_ROLE, admin);
        _setFee(treasury_, feeBps_);
    }

    function createPact(PactEscrowV2.Config calldata config, PactEscrowV2.MilestoneInput[] calldata milestones)
        external
        whenNotPaused
        returns (address pact)
    {
        if (config.client != msg.sender) revert PactEscrowV2.Unauthorized();
        pact = Clones.clone(implementation);
        PactEscrowV2(pact)
            .initialize(config, milestones, verifierRegistry, reputationRegistry, feeTreasury, guardian, feeBps);
        isPact[pact] = true;
        emit PactCreated(pact, config.client, config.worker);
        emit PactConfigured(
            pact,
            config.token,
            config.arbitrator,
            config.totalBudget,
            config.clientBond,
            config.workerBond,
            config.acceptanceDeadline,
            config.reviewPeriod,
            config.agreementHash
        );
        for (uint256 i; i < milestones.length; i++) {
            PactEscrowV2.MilestoneInput calldata m = milestones[i];
            emit MilestoneConfigured(pact, i, m.amount, m.dueAt, m.rulesHash, uint8(m.mode), m.maxRevisions, m.verifier);
        }
    }

    function setFee(address treasury, uint16 bps) external onlyRole(FEE_MANAGER_ROLE) {
        _setFee(treasury, bps);
    }

    function _setFee(address treasury, uint16 bps) private {
        if (treasury == address(0)) revert InvalidAddress();
        if (bps > MAX_FEE_BPS) revert InvalidFee();
        feeTreasury = treasury;
        feeBps = bps;
        emit FeeConfigChanged(treasury, bps);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
