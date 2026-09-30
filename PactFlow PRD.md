你现在要构建一个真实可运行的 Monad 应用，项目名为 PactFlow。

首先阅读仓库中的：

- `docs/PRD.md`
    
- `docs/ARCHITECTURE.md`
    
- `docs/CONTRACTS.md`
    

PRD 是产品和架构的最高优先级规范。除非规范在技术上无法实现，否则不要自行改变核心业务设计。

本阶段不要开始开发完整 UI，也不要为了展示效果写 mock 链上数据。

目标是建立 monorepo，并完成 PactFlow Protocol 第一版。

技术要求：

- pnpm workspace
    
- Turborepo
    
- TypeScript
    
- Solidity
    
- Foundry
    
- OpenZeppelin Contracts 5.x
    
- viem
    
- PostgreSQL / Drizzle 的 package skeleton
    
- Next.js web skeleton
    
- Fastify API skeleton
    

建立以下目录：

`apps/web`  
`apps/api`  
`apps/verifier`  
`packages/contracts`  
`packages/db`  
`packages/sdk`  
`packages/chain`  
`packages/shared`  
`packages/ui`  
`indexer`  
`docs`

首先完成四个 Solidity 合约：

1. `PactFactory.sol`
    
2. `PactEscrow.sol`
    
3. `ReputationRegistry.sol`
    
4. `VerifierRegistry.sol`
    

采用：

`PactFactory → EIP-1167 PactEscrow Clone`

不要给每个 Pact 使用 UUPS Proxy。

PactEscrow 必须支持：

- ERC20 settlement token
    
- client funding
    
- client bond
    
- worker bond
    
- fixed worker 或 open worker
    
- multiple milestones
    
- ClientOnly / AIOnly / Hybrid / Arbitrator verification mode
    
- deliverable hash
    
- deliverable URI
    
- EIP-712 verifier attestation
    
- milestone release
    
- review timeout claim
    
- dispute
    
- partial arbitration settlement
    
- bond slashing
    
- cancellation before acceptance
    
- protocol fee
    
- final bond return
    
- ReputationRegistry callback
    

VerifierRegistry 必须：

- 注册/撤销 verifier
    
- verifier type
    
- metadata URI/hash
    
- EIP-712 signature validation
    
- expiry validation
    
- nonce/digest replay protection
    

ReputationRegistry 原则：

只记录客观事实，不在 Solidity 内实现复杂 reputation score。

必须防止非 Factory PactEscrow 写入 ReputationRegistry。

安全要求：

- SafeERC20
    
- ReentrancyGuard
    
- Checks-Effects-Interactions
    
- Custom Errors
    
- AccessControl
    
- Pausable
    
- no arbitrary external calls
    
- no delegatecall
    
- protection against double release
    
- protection against replay
    
- strict deadline validation
    

第一批测试必须覆盖：

- create pact
    
- invalid milestone total
    
- client funding
    
- worker acceptance
    
- worker bond
    
- milestone submission
    
- client approval
    
- AI attestation
    
- invalid verifier
    
- expired attestation
    
- replayed attestation
    
- incorrect rules hash
    
- payment release
    
- protocol fee
    
- review timeout
    
- dispute creation
    
- partial dispute resolution
    
- client bond slash
    
- worker bond slash
    
- normal bond refund
    
- cancellation
    
- unauthorized calls
    
- reentrancy-sensitive flows
    

必须增加 invariant tests：

1. `releasedBudget <= totalBudget`
    
2. Escrow 在任何状态下不能支付超过其合法 obligations
    
3. 同一 milestone 不能 settlement 两次
    
4. consumed attestation 不能再次使用
    

同时生成：

- `.env.example`
    
- `README.md`
    
- `docs/ARCHITECTURE.md`
    
- `docs/CONTRACTS.md`
    

不要硬编码 Monad RPC、Chain ID、USDC 地址或部署地址。

全部通过环境和 chain config 注入。

完成后：

1. 运行 forge fmt
    
2. 运行 forge test
    
3. 运行 TypeScript typecheck
    
4. 修复全部错误
    
5. 输出当前目录树
    
6. 输出已经完成的能力
    
7. 输出剩余 TODO
    
8. 不要声称未实际运行的测试已经通过
    

先完成 Protocol Foundation，再进入 Web UI。