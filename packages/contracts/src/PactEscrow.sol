// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {VerifierRegistry} from "./VerifierRegistry.sol";
import {ReputationRegistry} from "./ReputationRegistry.sol";

contract PactEscrow is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Clones have independent zeroed storage; the implementation cannot be initialized.
    constructor() {
        initialized = true;
    }

    enum Mode {
        ClientOnly,
        AIOnly,
        Hybrid,
        Arbitrator
    }

    struct Config {
        address client;
        address worker; // zero means open worker
        address token;
        address arbitrator;
        uint256 totalBudget;
        uint256 clientBond;
        uint256 workerBond;
        uint64 acceptanceDeadline;
        uint64 reviewPeriod;
    }

    struct MilestoneInput {
        uint256 amount;
        uint64 dueAt;
        bytes32 rulesHash;
        Mode mode;
    }

    struct Milestone {
        uint256 amount;
        uint64 dueAt;
        bytes32 rulesHash;
        Mode mode;
        bytes32 deliverableHash;
        string deliverableURI;
        uint64 reviewDeadline;
        bool submitted;
        bool clientApproved;
        bool aiAttested;
        bool disputed;
        bool settled;
    }

    address public factory;
    address public guardian;
    address public client;
    address public worker;
    address public fixedWorker;
    address public arbitrator;
    address public treasury;
    IERC20 public token;
    VerifierRegistry public verifierRegistry;
    ReputationRegistry public reputationRegistry;
    uint256 public totalBudget;
    uint256 public clientBondBalance;
    uint256 public workerBondBalance;
    uint256 public settledBudget;
    uint256 public releasedBudget;
    uint256 public settledCount;
    uint16 public feeBps;
    uint64 public acceptanceDeadline;
    uint64 public reviewPeriod;
    bool public initialized;
    bool public funded;
    bool public accepted;
    bool public cancelled;
    bool public completed;
    Milestone[] private _milestones;

    error Unauthorized();
    error InvalidConfig();
    error InvalidMilestones();
    error InvalidState();
    error InvalidDeadline();
    error InvalidDeliverable();
    error InvalidAttestation();
    error InvalidAward();
    error UnsupportedToken();

    event Funded(uint256 budget, uint256 clientBond);
    event Accepted(address indexed worker, uint256 workerBond);
    event Submitted(uint256 indexed id, bytes32 deliverableHash, string deliverableURI);
    event MilestoneSettled(uint256 indexed id, uint256 workerAward, uint256 clientRefund, uint256 fee);
    event DisputeOpened(uint256 indexed id, address indexed opener);
    event BondSlashed(uint256 clientSlash, uint256 workerSlash);
    event Cancelled();
    event Completed();

    modifier onlyClient() {
        if (msg.sender != client) revert Unauthorized();
        _;
    }
    modifier onlyWorker() {
        if (msg.sender != worker) revert Unauthorized();
        _;
    }
    modifier active() {
        if (!accepted || cancelled || completed) revert InvalidState();
        _;
    }

    function initialize(
        Config calldata c,
        MilestoneInput[] calldata inputs,
        address verifierRegistry_,
        address reputationRegistry_,
        address treasury_,
        address guardian_,
        uint16 feeBps_
    ) external {
        if (initialized) revert InvalidState();
        if (
            c.client == address(0) || c.token == address(0) || c.token.code.length == 0 || c.arbitrator == address(0)
                || c.arbitrator == c.client || c.arbitrator == c.worker || verifierRegistry_ == address(0)
                || reputationRegistry_ == address(0) || treasury_ == address(0) || guardian_ == address(0)
                || feeBps_ > 1_000 || c.totalBudget == 0 || c.reviewPeriod == 0 || c.reviewPeriod > 30 days
        ) {
            revert InvalidConfig();
        }
        if (c.acceptanceDeadline <= block.timestamp || c.acceptanceDeadline > block.timestamp + 90 days) {
            revert InvalidDeadline();
        }
        if (inputs.length == 0 || inputs.length > 32) revert InvalidMilestones();
        uint256 sum;
        uint64 previous = c.acceptanceDeadline;
        for (uint256 i; i < inputs.length; ++i) {
            MilestoneInput calldata m = inputs[i];
            if (m.amount == 0 || m.rulesHash == bytes32(0)) revert InvalidMilestones();
            if (m.dueAt <= previous || m.dueAt > block.timestamp + 365 days) revert InvalidDeadline();
            previous = m.dueAt;
            sum += m.amount;
            _milestones.push(
                Milestone({
                    amount: m.amount,
                    dueAt: m.dueAt,
                    rulesHash: m.rulesHash,
                    mode: m.mode,
                    deliverableHash: bytes32(0),
                    deliverableURI: "",
                    reviewDeadline: 0,
                    submitted: false,
                    clientApproved: false,
                    aiAttested: false,
                    disputed: false,
                    settled: false
                })
            );
        }
        if (sum != c.totalBudget) revert InvalidMilestones();
        initialized = true;
        factory = msg.sender;
        guardian = guardian_;
        client = c.client;
        fixedWorker = c.worker;
        arbitrator = c.arbitrator;
        token = IERC20(c.token);
        verifierRegistry = VerifierRegistry(verifierRegistry_);
        reputationRegistry = ReputationRegistry(reputationRegistry_);
        treasury = treasury_;
        totalBudget = c.totalBudget;
        clientBondBalance = c.clientBond;
        workerBondBalance = c.workerBond;
        acceptanceDeadline = c.acceptanceDeadline;
        reviewPeriod = c.reviewPeriod;
        feeBps = feeBps_;
    }

    function milestoneCount() external view returns (uint256) {
        return _milestones.length;
    }

    function milestone(uint256 id) external view returns (Milestone memory) {
        return _milestones[id];
    }

    function fund() external nonReentrant whenNotPaused onlyClient {
        if (!initialized || funded || cancelled || block.timestamp > acceptanceDeadline) revert InvalidState();
        uint256 amount = totalBudget + clientBondBalance;
        funded = true;
        _pullExact(client, amount);
        emit Funded(totalBudget, clientBondBalance);
    }

    function accept() external nonReentrant whenNotPaused {
        if (!funded || accepted || cancelled || block.timestamp > acceptanceDeadline) revert InvalidState();
        if (fixedWorker != address(0) && msg.sender != fixedWorker) revert Unauthorized();
        if (msg.sender == client || msg.sender == arbitrator) revert Unauthorized();
        accepted = true;
        worker = msg.sender;
        _pullExact(worker, workerBondBalance);
        emit Accepted(worker, workerBondBalance);
    }

    function submit(uint256 id, bytes32 deliverableHash, string calldata deliverableURI)
        external
        nonReentrant
        whenNotPaused
        active
        onlyWorker
    {
        Milestone storage m = _milestones[id];
        if (m.submitted || m.settled || block.timestamp > m.dueAt) revert InvalidState();
        if (deliverableHash == bytes32(0) || bytes(deliverableURI).length == 0) revert InvalidDeliverable();
        m.submitted = true;
        m.deliverableHash = deliverableHash;
        m.deliverableURI = deliverableURI;
        m.reviewDeadline = uint64(block.timestamp + reviewPeriod);
        emit Submitted(id, deliverableHash, deliverableURI);
    }

    function approve(uint256 id) external nonReentrant whenNotPaused active {
        Milestone storage m = _milestones[id];
        if (!m.submitted || m.settled || m.disputed || block.timestamp > m.reviewDeadline) revert InvalidState();
        if (m.mode == Mode.Arbitrator) {
            if (msg.sender != arbitrator) revert Unauthorized();
            _settle(id, m.amount, 0, false);
            _finishIfComplete();
        } else {
            if (msg.sender != client || m.mode == Mode.AIOnly) revert Unauthorized();
            m.clientApproved = true;
            if (m.mode == Mode.ClientOnly || m.aiAttested) {
                _settle(id, m.amount, 0, false);
                _finishIfComplete();
            }
        }
    }

    function attest(uint256 id, VerifierRegistry.Attestation calldata a, bytes calldata signature)
        external
        nonReentrant
        whenNotPaused
        active
    {
        Milestone storage m = _milestones[id];
        if (
            !m.submitted || m.settled || m.disputed || m.aiAttested || block.timestamp > m.reviewDeadline
                || (m.mode != Mode.AIOnly && m.mode != Mode.Hybrid)
        ) revert InvalidState();
        if (
            a.pact != address(this) || a.milestoneId != id || a.deliverableHash != m.deliverableHash
                || a.rulesHash != m.rulesHash || !a.approved
        ) revert InvalidAttestation();
        verifierRegistry.consume(a, signature);
        m.aiAttested = true;
        if (m.mode == Mode.AIOnly || m.clientApproved) {
            _settle(id, m.amount, 0, false);
            _finishIfComplete();
        }
    }

    function claimReviewTimeout(uint256 id) external nonReentrant whenNotPaused active onlyWorker {
        Milestone storage m = _milestones[id];
        if (
            !m.submitted || m.settled || m.disputed || block.timestamp <= m.reviewDeadline
                || (m.mode != Mode.ClientOnly && m.mode != Mode.Hybrid) || (m.mode == Mode.Hybrid && !m.aiAttested)
        ) revert InvalidState();
        _settle(id, m.amount, 0, false);
        _finishIfComplete();
    }

    function openDispute(uint256 id) external nonReentrant whenNotPaused active {
        if (msg.sender != client && msg.sender != worker) revert Unauthorized();
        Milestone storage m = _milestones[id];
        if (!m.submitted || m.settled || m.disputed || block.timestamp > m.reviewDeadline) revert InvalidState();
        m.disputed = true;
        emit DisputeOpened(id, msg.sender);
    }

    function resolveDispute(uint256 id, uint256 workerAward, uint256 clientSlash, uint256 workerSlash)
        external
        nonReentrant
        whenNotPaused
        active
    {
        if (msg.sender != arbitrator) revert Unauthorized();
        Milestone storage m = _milestones[id];
        if (
            !m.disputed || m.settled || workerAward > m.amount || clientSlash > clientBondBalance
                || workerSlash > workerBondBalance
        ) revert InvalidAward();
        clientBondBalance -= clientSlash;
        workerBondBalance -= workerSlash;
        _settle(id, workerAward, m.amount - workerAward, true);
        if (clientSlash != 0) {
            reputationRegistry.recordSlash(client, clientSlash);
            token.safeTransfer(worker, clientSlash);
        }
        if (workerSlash != 0) {
            reputationRegistry.recordSlash(worker, workerSlash);
            token.safeTransfer(client, workerSlash);
        }
        emit BondSlashed(clientSlash, workerSlash);
        _finishIfComplete();
    }

    function cancelBeforeAcceptance() external nonReentrant whenNotPaused onlyClient {
        if (!initialized || accepted || cancelled) revert InvalidState();
        cancelled = true;
        uint256 refund = funded ? totalBudget + clientBondBalance : 0;
        clientBondBalance = 0;
        workerBondBalance = 0;
        if (refund != 0) token.safeTransfer(client, refund);
        emit Cancelled();
    }

    function _settle(uint256 id, uint256 workerAward, uint256 clientRefund, bool disputed) private {
        Milestone storage m = _milestones[id];
        if (m.settled || workerAward + clientRefund != m.amount) revert InvalidAward();
        m.settled = true;
        settledBudget += m.amount;
        releasedBudget += workerAward;
        settledCount++;
        uint256 fee = workerAward * feeBps / 10_000;
        reputationRegistry.recordMilestone(client, worker, workerAward, disputed);
        if (clientRefund != 0) token.safeTransfer(client, clientRefund);
        if (fee != 0) token.safeTransfer(treasury, fee);
        if (workerAward != fee) token.safeTransfer(worker, workerAward - fee);
        emit MilestoneSettled(id, workerAward, clientRefund, fee);
    }

    function _finishIfComplete() private {
        if (settledCount == _milestones.length) {
            completed = true;
            reputationRegistry.recordCompletion(client, worker);
            uint256 cb = clientBondBalance;
            uint256 wb = workerBondBalance;
            clientBondBalance = 0;
            workerBondBalance = 0;
            if (cb != 0) token.safeTransfer(client, cb);
            if (wb != 0) token.safeTransfer(worker, wb);
            emit Completed();
        }
    }

    function _pullExact(address from, uint256 amount) private {
        if (amount == 0) return;
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedToken();
    }

    function pause() external {
        if (msg.sender != guardian) revert Unauthorized();
        _pause();
    }

    function unpause() external {
        if (msg.sender != guardian) revert Unauthorized();
        _unpause();
    }
}
