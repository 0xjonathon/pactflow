// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

interface IPactFactoryV2 {
    function isPact(address pact) external view returns (bool);
}

contract ReputationRegistryV2 is AccessControl, Pausable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    address public factory;

    struct Facts {
        uint64 completedPacts;
        uint64 settledMilestones;
        uint64 disputes;
        uint64 slashes;
        uint256 earned;
    }
    mapping(address => Facts) public facts;

    error InvalidFactory();
    error UnauthorizedPact();

    event PactCompleted(address indexed client, address indexed worker);
    event FactorySet(address indexed factory);
    event MilestoneSettled(address indexed client, address indexed worker, uint256 workerAmount, bool disputed);
    event BondSlashed(address indexed account, uint256 amount);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    modifier onlyPact() {
        if (factory == address(0) || !IPactFactoryV2(factory).isPact(msg.sender)) revert UnauthorizedPact();
        _;
    }

    function setFactory(address factory_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (factory != address(0) || factory_ == address(0) || factory_.code.length == 0) revert InvalidFactory();
        factory = factory_;
        emit FactorySet(factory_);
    }

    function recordMilestone(address client, address worker, uint256 workerAmount, bool disputed)
        external
        onlyPact
        whenNotPaused
    {
        facts[worker].settledMilestones++;
        facts[worker].earned += workerAmount;
        if (disputed) {
            facts[client].disputes++;
            facts[worker].disputes++;
        }
        emit MilestoneSettled(client, worker, workerAmount, disputed);
    }

    function recordSlash(address account, uint256 amount) external onlyPact whenNotPaused {
        if (amount != 0) {
            facts[account].slashes++;
            emit BondSlashed(account, amount);
        }
    }

    function recordCompletion(address client, address worker) external onlyPact whenNotPaused {
        facts[client].completedPacts++;
        facts[worker].completedPacts++;
        emit PactCompleted(client, worker);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
