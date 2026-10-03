# Pact and milestone state machine

Chain controls funds and role transitions. Application processing never invents chain business transitions. V1 uses its unchanged state machine; V2 is detected through known factories and versioned addresses/ABIs.

| Trigger                | Authorized actor                                | Result / guard                                                                                             |
| ---------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Create                 | Client wallet                                   | Immutable agreement, parties, amount, deadlines, mode, revision limit and verifier                         |
| Fund                   | Client                                          | Exact budget + client bond transferred; terms cannot be changed                                            |
| Accept                 | Fixed worker, or permitted worker for open pact | Worker bond transferred; acceptance deadline enforced                                                      |
| Submit                 | Accepted worker                                 | Current milestone, pre-deadline; unique sequence; evidence digest and opaque reference                     |
| Automatic failure      | Configured registered verifier                  | RevisionRequired while attempts remain; otherwise Disputed                                                 |
| Request revision       | Client in eligible manual/hybrid review         | Reason digest/event bound to current submission; prior approval cleared                                    |
| Resubmit               | Worker                                          | New sequence and independent digest; old submission remains readable                                       |
| Approve                | Client in manual/hybrid mode                    | Approval hash and current sequence required; automatic and manual requirements both apply for hybrid       |
| Pass attestation       | Configured registered verifier                  | Current evidence/rules/report/nonce/expiry bound by EIP-712; atomic settlement when requirements satisfied |
| Deadline exhaustion    | Contract deadline path                          | Disputed; no unilateral post-funding deadline change or invented refund                                    |
| Cancel / timeout claim | Existing protocol participants/rules            | V1 cancellation, refund, review timeout and bond semantics retained                                        |
| Resolve dispute        | Fixed arbitrator                                | Bounded worker award/bond slashes; escrow funds conserved                                                  |

Default `maxRevisions=2` means three total submissions. Contract supports 0–10 revisions. Provider outage leaves the current submission Submitted and the job ERROR; retrying a job does not submit evidence again or consume a revision. Exhaustion and final submission deadlines route to dispute rather than a new unilateral refund policy.

`resolvePactStatus` centralizes business projection for SDK and V2 indexed events. Finalized transaction progress is separate from Envio indexing delay. One transaction can emit verification, settlement and completion; Activity displays these real events without pretending additional wallet actions occurred.

Contract validation includes history/replay, wrong verifier, immutable terms, expiry, manual/hybrid transitions, exhaustion, duplicate settlement and funding invariants. See `qa/CONTRACT_INVARIANTS.md` and `qa/PRODUCTION_AUDIT.md` for executed evidence and external gates.
