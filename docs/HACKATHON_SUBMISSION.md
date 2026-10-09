# PactFlow — hackathon submission kit

Prepared on 2026-10-09 after inspecting the authenticated PactFlow submission page. Copy suggestions below fit the observed field limits. No project fields or submission were changed during this inspection.

## Project name

PactFlow

## Tagline

Money secured. Work verified. Reputation earned.

## One-sentence description

PactFlow connects clients and collaborators through escrow, verified delivery, and real reputation, making work and payments more trustworthy.

## Short description

PactFlow is a collaboration platform built for Monad: publish work briefs, choose partners, secure milestone payments in escrow, verify delivery, and turn completed work into a verifiable reputation.

## Full description

Clients need confidence that paid work will be delivered, and collaborators need confidence that accepted work will be paid. PactFlow connects both sides through a complete workflow: publish a brief, receive applications, select a partner, and confirm an agreement with clear milestones, deadlines, acceptance rules, and revision limits.

Smart contracts secure milestone funds and enforce participant permissions. Collaborators submit private evidence; clients can review delivery manually, while configured verification adapters can evaluate supported rules. Failed checks preserve the submission history and allow agreed revisions. Accepted delivery leads to settlement, with transaction evidence visible in the Pact Room and Activity feed.

Work Passports and mutually approved public receipts connect completed work with verifiable history. English and Chinese interfaces support desktop and mobile. Wallet authority is separate from optional account identity.

PactFlow targets Monad and preserves V1 records alongside a revision-capable V2 protocol. The current V2 demo is validated on a local test chain; public V2 deployment and external-provider acceptance are pending. It is a working prototype, not a production launch.

## Problem and solution

Problem: freelance collaboration separates discovery, agreement, payment, evidence, and reputation across disconnected tools, making delivery expectations and payment outcomes hard to verify.

Solution: PactFlow connects these steps in one workflow, with immutable funded terms, private submission history, explicit acceptance, contract-enforced settlement, and consent-based public proof.

## Monad integration

PactFlow uses EVM smart contracts designed for Monad to create agreements, hold milestone funds, enforce participant and verifier permissions, and settle accepted work. The TypeScript chain layer and SDK track protocol versions and transaction receipts; Envio handlers support V1 and V2 events for activity and reputation read models.

V2 local-chain end-to-end tests exercise actual funding, acceptance, failed verification, revision, approval, and payment. A public Monad V2 smoke test still requires funded test accounts and configured production services. Do not present local transactions as public Monad transactions.

## Technical stack

Next.js, React, TypeScript, Fastify, Drizzle, PostgreSQL, Solidity, Foundry, viem, Envio, Redis, S3-compatible private object storage, and Playwright. Local acceptance uses Anvil and a private local database. Production deployment materials use Linux Docker Compose.

## Go-to-market and user acquisition strategy

We will start with small, clearly scoped collaborations in Monad builder communities: design tasks, documentation, integrations, and software contributions. Our initial users are clients who need an auditable delivery process and contributors who want secured milestone payments and a portable work history.

The first acquisition channel will be hands-on onboarding through community pilots. We will help a small group publish briefs, define acceptance rules, select partners, and complete their first paid milestone. With both parties' permission, public work receipts can demonstrate outcomes and link back to new opportunities. We will then explore partnerships with ecosystem communities and project teams that regularly commission contributor work.

We will measure the funnel from brief publication to qualified applications, funded agreements, successful first settlements, and repeat collaborations. Early priorities are clarity, dispute prevention, and reliable verification rather than broad paid advertising. These are planned experiments; we do not claim existing partnerships, revenue, or acquired users.

## Pitch video script

Add a brief introduction with your real name and team before this script. Keep the complete pitch under two minutes.

“PactFlow connects people who need work done with collaborators who can deliver it. Today, finding a partner, agreeing on requirements, securing payment, checking delivery, and proving past work often happen in separate tools.

We bring those steps into one workflow. A client publishes a brief, receives applications, and selects a partner. Both sides confirm milestones, acceptance rules, deadlines, and revisions before funds are locked. The collaborator submits evidence, the work is reviewed or verified, and accepted milestones settle through smart contracts.

Failed checks keep their history and allow agreed revisions. Completed work can become a mutually approved public receipt, helping collaborators build a verifiable work history without exposing private evidence.

We are building for Monad, with English and Chinese interfaces. Our V2 prototype has passed real transaction flows on a local test chain; public deployment and external-provider acceptance are the next operational steps.

We plan to start with small contributor tasks in builder communities and improve the product through completed collaborations. Our goal is simple: money secured, work verified, reputation earned.”

## Validation and development status

- Latest fixed-build local browser acceptance: 22/22 passed, including English/Chinese manual and automatic revision/settlement flows.
- Application tests: 34 passed, 2 skipped for unavailable PostgreSQL/Redis services on the local host. CI provisions these services; its result must be checked separately.
- Type checks, lint, formatting, optimized Web build, bilingual key parity, responsive checks, and automated accessibility checks passed in the recorded local run.
- Foundry protocol evidence and test scope are documented in [the production audit](../qa/PRODUCTION_AUDIT.md).
- Public V2 deployment, hosted fresh-browser smoke, real Google OAuth, external verification providers, and production service acceptance remain pending.
- Agent identity/workflows, Work Graph, Judge Mode, and other gated P1 items are roadmap work.

## Links and assets

- Source repository: https://github.com/0xjonathon/pactflow
- Product journey: [guide](PRODUCT_JOURNEY.md)
- Reproducible setup: [README](../README.md)
- Demo script: [150-second judge demo](../qa/JUDGE_DEMO.md)
- Local proof: [validation evidence](../qa/evidence/VALIDATION.md)
- Screenshots: [English journey](../qa/evidence/journey-en.png), [Chinese journey](../qa/evidence/journey-zh-CN.png)
- Public app URL: pending deployment; localhost is not a public demo URL.
- Demo video URL: pending recording and upload.
- Public V2 contract and transaction links: pending actual deployment/smoke.

## 报名填写步骤

已登录页面为 https://hackathon.monad.xyz/project?tab=submission 。当前项目名称与一句话介绍已保存；Submission checklist 显示 **0 / 5**，这是五组材料的完成情况，不是只有五个必填字段。页面截止时间为 **2026-10-14 11:59 GMT+8（北京时间上午 11:59）**。

1. 在 `SUBMISSION` 标签填写下表。用原报名时相同的 Google、GitHub 或 Discord 方式登录；页面明确提示不同登录方式是独立账户。
2. 选择主赛道。当前菜单提供 `Onchain Finance & Trading`、`Consumer Products & Payments`、`Social, Attention & Culture`、`Trust, Identity & AI Infrastructure`。按当前面向客户与交付方的协作支付流程，建议优先考虑 **Consumer Products & Payments**；这是产品定位建议，具体资格仍以赛事规则为准。
3. `TEAM` 可管理成员，页面明确允许单人参赛。`PROGRESS UPDATES` 可以发布进展；页面提示至少一条进展才能获得导师支持。Sponsor bounties 可选，须先选择主赛道，再完成对应问题。
4. 点击 `SAVE CHANGES` 保存，支持 Cmd+Enter / Ctrl+Enter。点击 `REVIEW ENTRY` 检查预览、链接和剩余项；依据下一页实际提示完成最终步骤并保留确认信息。目前未进入最终确认，也未提交报名材料。

| 字段                                       | 必填 | 实际限制 / 填写建议                                                                                    |
| ------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------ |
| Primary track                              | 是   | 只能选一个主赛道                                                                                       |
| Project logo                               | 是   | PNG/JPG/WEBP，最大 2 MB，至少 500 px，总像素不超过 400 万；方形或矩形                                  |
| Project name                               | 是   | 最多 120 字符；当前 PactFlow 已填                                                                      |
| One-line description                       | 是   | 最多 200 字符；当前已填 142 字符                                                                       |
| Description                                | 是   | 最多 8,000 字符；使用 Full description                                                                 |
| Go-to-market and user acquisition strategy | 是   | 最多 8,000 字符；使用上面的策略文本                                                                    |
| GitHub repository                          | 是   | https://github.com/0xjonathon/pactflow；公开仓库，或向 metropolis@hackathon.monad.xyz 提供私有仓库访问 |
| Live product                               | 是   | **必须运行在 Monad Mainnet 或 Testnet**；目前 V2 只有本地验证，尚未满足此项                            |
| Technical demo video                       | 是   | 最多 3 分钟；展示实际产品，不用幻灯片或代码讲解代替；YouTube/Loom/Vimeo 或其他视频托管                 |
| Pitch video                                | 是   | 最多 2 分钟；介绍真实团队、问题和构建动机                                                              |
| Judge access instructions                  | 否   | 最多 8,000 字符，仅团队、评委和主办方可见；可提供测试步骤，不填写私人钱包密钥                          |
| Sponsor bounties                           | 否   | 完成选中 bounty 的对应必填问题                                                                         |
| Product advertisement                      | 否   | 最多 30 秒，赛后推广使用，不影响评审                                                                   |
| X profile link                             | 否   | 填写真实项目账号，获奖项目可能被提及                                                                   |

主要缺项：主赛道、完整描述/获客策略/仓库链接、Logo、公开 Monad 运行产品、技术演示与 Pitch 两个视频。GitHub 上传不等于完成赛事提交；local-chain prototype 的说明不能替代 Live product 的 Monad 网络要求。上线与视频链接准备好后，再填写可执行的 Judge access instructions。
