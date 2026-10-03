# Evidence

Ten supported kinds: GitHub repository, pull request, deployment URL, file, text, image, transaction, API endpoint, JSON and other URL. Each submission freezes a bounded typed manifest and independent content digest; required milestone evidence kinds must be present.

Worker prepares through authenticated API, signs submit, then confirms matching chain event after three confirmations. Sequence/history is append-only. Default participant visibility; verifier-only items are filtered from other participants. Chain reference is opaque, not a private URL. Private objects have content/type/size checks, scanner quarantine, ownership/referenced-submission authorization and 60-second signed downloads.

## Acceptance and boundaries

SSRF-safe fetches pin public DNS and bound redirects/body/time. Local tests cover privacy/hash/scan failure; real MinIO/ClamAV storage and recovery remain external gates.

Required acceptance: actual user flow, English/Chinese, keyboard and mobile, empty/loading/failure states. Executed gates and evidence are recorded in `qa/PRODUCTION_AUDIT.md`; full source requirements are in `product/MASTER_DIRECTIVE.md`.
