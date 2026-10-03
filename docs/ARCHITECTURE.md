# PactFlow architecture — protocol, verification, and product

The protocol is the source of truth for pact creation, collateral, milestone settlement, and verifier attestations. Phase 2 adds a real viem SDK, chain configuration, and wallet connected web flow. Phase 3 adds bounded artifact verification and signed attestations. Phase 4 adds an offchain marketplace, signed profile sessions, proposals, notifications, event indexing, and reputation aggregation. See PRODUCT.md and VERIFIER.md for these services.

```text
client ── createPact ──> PactFactory ── EIP-1167 clone ──> PactEscrow
                              │                              │
                              │ isPact                       ├── ERC20 settlement
                              ▼                              ├── VerifierRegistry
                    ReputationRegistry <───────────────────────┘
```

Each pact is an immutable EIP-1167 clone of the factory's escrow implementation. The factory snapshots fee treasury, fee rate, and protocol registry addresses at creation. It records clone addresses in `isPact`; both registries only accept callbacks from those addresses. After deployment, the registry admin must call `setFactory` exactly once on each registry before any pact is used.

EIP-1167 clones use a fixed implementation `delegatecall` as part of the standard. The application has no arbitrary delegatecall entry point.

## Data flow

1. Client creates a pact with an ERC20 token, funding and acceptance deadline, bonds, arbitrator, and ordered milestones. The milestone amounts must sum exactly to the budget.
2. Client approves and deposits budget plus client bond. A fixed or first eligible open worker accepts and deposits the worker bond.
3. Worker submits a content hash and URI for each milestone before its due time. The review clock starts at submission.
4. Client, verifier, or arbitrator approves according to the milestone mode; a dispute can instead split that milestone's budget and slash either bond.
5. The protocol records objective facts and pays the worker, treasury, and/or client. After the final milestone it returns remaining bonds.

`packages/chain` defines Monad Testnet network values from official documentation and loads protocol addresses from environment or recorded real deployment data. `packages/sdk` wraps chain reads and writes, decodes `PactCreated`, and maps Solidity state to web models. Agreement metadata is canonicalized and committed as a milestone rules hash; the share URL carries a data URI because the current protocol has no agreement URI field.

## Trust and limits

- The verifier manager can register and revoke verifier keys. A signature is valid only while its key is active and before its expiry.
- The protocol admin is the escrow pause guardian. Pausing stops actions on a pact until unpaused. The arbitrator can settle disputed milestones and decide bond slashing within deposited balances.
- The registry admin can pause callbacks, which also pauses settlements. This coupling keeps reputation facts atomic with payments, but requires operational monitoring.
- Settlement tokens must transfer the exact requested amount into escrow. Fee-on-transfer tokens are rejected at deposit. Rebasing or otherwise externally mutable balances are unsupported.
- There is no dispute resolution deadline in this version. A disputed milestone depends on its named arbitrator. This is a protocol risk to address before production deployment.
- The contracts have not been audited. Deployment status and actual Monad transactions are tracked in `docs/TESTNET.md`. The workspace exposes verification and client approval; dispute resolution remains dependent on the configured arbitrator.
