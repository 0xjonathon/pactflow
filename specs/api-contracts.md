# V2 API and compatibility contract

Existing `/api/v1` marketplace consumers remain compatible. Versioned chain fields and new endpoints extend the API. Bearer sessions derive from a one-use wallet challenge, are hashed in storage and revoked by server logout. Requests never authorize wallet asset movement: all such actions still use wallet-signed SDK transactions.

| Endpoint under `/api/v1`                                               | Access / behavior                                                                                                                       |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/challenge`, `auth/verify`, `auth/logout`                         | Address ownership, challenge expiry/replay prevention; logout revokes stored session                                                    |
| `pacts/:escrow/spec` GET/POST                                          | Participants read; client stores hash-matching full frozen V2 terms; no mutation after funding                                          |
| `pacts/:escrow/submissions` POST/GET                                   | Accepted worker prepares; participants read their permitted evidence; immutable sequence/manifest hash                                  |
| `submissions/:id/confirm` POST                                         | Submitter only; actual matching Submitted receipt and three confirmations                                                               |
| `pacts/:escrow/manual-review` POST                                     | Eligible client; canonical report hash for current submission                                                                           |
| `manual-reviews/:id/confirm` POST                                      | Reviewer only; actual matching ClientApprovalRecorded event and three confirmations                                                     |
| `pacts/:escrow/revision-feedback` POST                                 | Client; canonical reason hash and matching RevisionRequested event                                                                      |
| `pacts/:escrow/audit` GET                                              | Participants; append-only review/feedback/preparation records                                                                           |
| `verification/policies` POST                                           | Eligible participant; immutable milestone rules hash must match supplied policy                                                         |
| `verification/jobs` POST                                               | Participant and current onchain submission; unique version/milestone/sequence; recoverable ERROR retry                                  |
| `verification/jobs/:id` and `/report` GET                              | Participants, or mutually authorized public projection; private URI, raw signed transaction and private reasoning are excluded publicly |
| `verification/capabilities` GET                                        | Explicit configured capability flags; unavailable AI/adapters are not represented as working                                            |
| `criteria/suggest` POST                                                | Signed-in actor; bounded rate, configured provider and explicit suggestion acceptance                                                   |
| `uploads` POST; `uploads/:id/download` GET                             | Private bounded/scanned content; uploader or authorized submission participant; 60-second signed download                               |
| `pacts/:escrow/disclosure` POST                                        | Completed Pact; both parties must agree to exact public title/description                                                               |
| `receipts/:publicId` GET                                               | 404 until matching mutual consent; no private evidence in receipt                                                                       |
| `activity`, `wallets/:address/reputation`, `proof`, `index/health` GET | Real canonical read model, source/freshness and unavailable denominators                                                                |

Errors have stable codes and translated core UI messages. A timeout after broadcast is recoverable with the existing transaction hash; Room stores confirmation work under the wallet+escrow key and retries the API confirmation, not the wallet transaction. Public OG images fetch only the approved receipt.

Private uploads are not yet runtime-accepted on this host: real S3/ClamAV, PostgreSQL and Redis tests require configured services. Agent credentials/direct invites/Registry UI are P1 and are not enabled by this document.
