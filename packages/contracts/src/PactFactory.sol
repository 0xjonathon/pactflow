// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {PactEscrow} from "./PactEscrow.sol";

contract PactFactory is AccessControl, Pausable {
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
        implementation = address(new PactEscrow());
        guardian = admin;
        verifierRegistry = verifierRegistry_;
        reputationRegistry = reputationRegistry_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(FEE_MANAGER_ROLE, admin);
        _setFee(treasury_, feeBps_);
    }

    function createPact(PactEscrow.Config calldata config, PactEscrow.MilestoneInput[] calldata milestones)
        external
        whenNotPaused
        returns (address pact)
    {
        if (config.client != msg.sender) revert PactEscrow.Unauthorized();
        pact = Clones.clone(implementation);
        PactEscrow(pact)
            .initialize(config, milestones, verifierRegistry, reputationRegistry, feeTreasury, guardian, feeBps);
        isPact[pact] = true;
        emit PactCreated(pact, config.client, config.worker);
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
