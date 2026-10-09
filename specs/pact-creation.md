# V2 creation validation

The outcome step accepts trimmed nonempty titles/outcomes up to 160/12,000 characters, matching the V2 spec API. Short Chinese text is valid. Empty and overlong values show translated errors attached to the field, and focus moves to the first invalid field.

The direct Pact creation form requires three distinct nonzero wallet addresses: the connected requester, the delivery partner who receives payment, and the agreed third party who resolves disputes. Copied surrounding whitespace is removed; wallet checksum validation is preserved. The page shows the current requester wallet and explains the other roles.

USDC amounts are positive with at most six decimal places. `.5` and `1.` are valid decimal inputs; exponent notation and ambiguous comma separators are rejected. Neither excess precision nor oversized individual/combined uint256 budgets may silently round or overflow. The normalized amounts and addresses are used consistently in the agreement hash, API spec and transaction.

Acceptance must be in the future and no more than 90 days away. Each milestone deadline must strictly follow acceptance/the previous milestone and be no more than 365 days away. These limits mirror V2 initialization. Times use the browser's local timezone. No entered deadline is automatically moved to make the form pass.

Review duration supports fractional hours, converts to at least one whole second and is capped at 720 hours/30 days. Revisions are nonempty integers from zero through ten. Payment validation is repeated before the first creation transaction to catch expired deadlines or changed requester wallets; a failure returns to funding and focuses the affected field. Existing escrows retain their immutable terms and remain available for upload/funding retries.

Validation errors are displayed at individual fields with invalid/description attributes. API and transaction errors have one form-level message; a transaction timeline still records the relevant transaction failure. No private keys or account identifiers from Google are accepted in the wallet address fields.
