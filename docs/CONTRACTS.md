# PactFlow protocol contract

## Factory and registries

- `PactFactory.createPact(config, milestones)` requires `msg.sender == config.client`, deploys an EIP-1167 clone, initializes it, then marks it as authorized. The factory admin controls pausing; the fee manager can change fee settings for **future** pacts. Maximum fee is 1,000 basis points.
- `VerifierRegistry.register/revoke` manage verifier status, type, and metadata URI/hash. `consume` is callable only by a factory-created pact and checks the EIP-712 signature, registered key, expiry, per-verifier nonce, and digest. The domain is `PactFlow Verifier`, version `1`, chain ID from the network, verifying contract equal to the registry address.
- `ReputationRegistry` accepts writes only from `factory.isPact(msg.sender)`. It records completed pacts, settled milestones, dispute counts, slashes, and gross worker earnings. It does not compute a reputation score.

## Escrow states

`created → funded → accepted → submitted → settled → completed`. An unaccepted pact may be cancelled by the client, returning all deposited funds. A submitted milestone may enter `disputed`; only the specified arbitrator settles it.

The client deposits `totalBudget + clientBond` before the acceptance deadline. The worker deposits `workerBond` when accepting. Milestone due times are strictly increasing and later than the acceptance deadline. A submission must occur no later than its due time. Client approval and AI attestation must occur no later than the submission's `reviewDeadline`.

| Mode         | Normal release condition                                           | Timeout path                                                      |
| ------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `ClientOnly` | Client approval                                                    | Worker claims after review deadline                               |
| `AIOnly`     | Valid positive verifier attestation                                | None; verifier attestation is required                            |
| `Hybrid`     | Client approval and positive verifier attestation, in either order | Worker claims after review deadline only if AI attestation exists |
| `Arbitrator` | Named arbitrator approval                                          | None; arbitrator decision is required                             |

The client or worker may open a dispute during the review window. The arbitrator chooses `workerAward` from zero to the milestone amount; the rest returns to the client. The arbitrator may slash either bond up to its remaining balance. Client bond slashes go to the worker; worker bond slashes go to the client. The protocol fee is charged on the gross worker award, including a partial award, and paid to the treasury. All remaining bonds return when every milestone is settled.

## Invariants

`releasedBudget <= settledBudget <= totalBudget`. For an accepted pact using a standard non-rebasing ERC20, escrow balance equals `totalBudget - settledBudget + clientBondBalance + workerBondBalance`. A milestone's `settled` flag and aggregate counters prevent a second settlement. Registry nonce and digest mappings prevent an attestation from being consumed twice.

## Integration notes

Initialize both registries with the deployed factory address before creating a usable pact. The settlement token's decimals are chosen by the token contract; all contract amounts use raw token units. Hash deliverables and rules off chain with a documented canonicalization policy before signing attestations. `deliverableURI` is public, so use a content address or encrypted payload reference for private work.
