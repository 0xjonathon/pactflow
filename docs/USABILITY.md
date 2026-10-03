# PactFlow usability study

Status: **pending — no real participant feedback has been collected**.

Recruit a person with no Web3 background. Open the landing page in their preferred language. Do not explain PactFlow, wallet terminology, or where to click. Ask:

1. What does this website do?
2. Where would you click to hire someone to build a website?
3. Where would you click to find work?
4. When does the worker receive payment?
5. What does AI do here?

The expected interpretation is: post a brief or find a task; choose a person; funds are protected; agreed delivery is reviewed by the client or AI; payment follows successful review. AI evaluates agreed criteria, and Hybrid still needs client approval.

Then ask the participant to draft a job and explain the collaboration deposit. Record whether they find the five steps without help, understand that funds are locked after matching, and know deposits are returned after normal completion. Repeat on a phone.

Record language, device, answers verbatim with consent, task completion, points of confusion, and any assistance. Do not invent responses. Automated Playwright checks verify UI behavior; they do not establish human comprehension.

Known testnet limitation: settlement requires a wallet and test tokens. Account setup introduces the wallet after role and profile selection. The deployed v1 protocol cannot resubmit an already submitted milestone; the UI must explain this rather than offer a nonfunctional action.
