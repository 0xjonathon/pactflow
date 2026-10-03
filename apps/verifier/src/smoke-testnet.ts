import { config } from "dotenv";
import { resolve } from "node:path";
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";
import { createWalletClient, encodeFunctionData, formatUnits, http, parseUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { connectDatabase } from "@pactflow/db/client";
import { createPactPublicClient, getExplorerAddressUrl, getExplorerTxUrl, getProtocolAddresses, monadTestnet } from "@pactflow/chain";
import { PactFlowSdk, dataUriForAgreement, hashAgreement, type CanonicalValue, type PactWalletAdapter } from "@pactflow/sdk";
import { hashVerificationPolicy, type VerificationPolicy } from "./policy";
import { VerificationRepository } from "./storage/repository";
import { processVerificationJob } from "./pipeline/process-job";

config({ path: resolve(process.cwd(), "../../.env.local"), quiet: true });
function key(name: string): Hex {
  const value = process.env[name];
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} is missing from ignored .env.local`);
  return value as Hex;
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!process.env.OPENAI_API_KEY || !process.env.AI_MODEL) throw new Error("Semantic model is not configured");
const clientAccount = privateKeyToAccount(key("CLIENT_PRIVATE_KEY"));
const workerAccount = privateKeyToAccount(key("WORKER_PRIVATE_KEY"));
const deployerAccount = privateKeyToAccount(key("DEPLOYER_PRIVATE_KEY"));
if (new Set([clientAccount.address, workerAccount.address, deployerAccount.address].map(value => value.toLowerCase())).size !== 3) throw new Error("Three distinct test wallets are required");
const rpcUrl = process.env.MONAD_TESTNET_RPC_URL || monadTestnet.rpcUrls.default.http[0];
const publicClient = createPactPublicClient(rpcUrl);
if (await publicClient.getChainId() !== monadTestnet.id) throw new Error("Wrong chain");
const sdk = new PactFlowSdk({ rpcUrl });
const addresses = getProtocolAddresses(monadTestnet.id);
const token = addresses.SettlementToken;
const decimals = (await sdk.getTokenMetadata(token)).decimals;
const budget = parseUnits("1", decimals);
const bond = parseUnits("0.2", decimals);
if (await sdk.getTokenBalance(token, clientAccount.address) < (budget + bond) * 3n) throw new Error("Client needs at least 3.6 test USDC");
if (await sdk.getTokenBalance(token, workerAccount.address) < bond * 3n) throw new Error("Worker needs test USDC for bonds");
const makeWallet = (account: typeof clientAccount): PactWalletAdapter => {
  const wallet = createWalletClient({ account, chain: monadTestnet, transport: http(rpcUrl) });
  return { address: account.address, chainId: monadTestnet.id, sendContractTransaction: request => wallet.sendTransaction({ account, chain: monadTestnet, to: request.address, data: encodeFunctionData({ abi: request.abi, functionName: request.functionName, args: request.args }) }) };
};
const client = makeWallet(clientAccount);
const worker = makeWallet(workerAccount);
const server = createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/html;charset=utf-8" });
  response.end(request.url === "/pass" ? "<html><body><nav>Dashboard Activity</nav><h1>Monad Analytics Dashboard</h1><button data-testid='connect-wallet'>Connect Wallet</button><main><section>Transactions 12481</section><section>Active Wallets 3420</section><section>Settled Volume 82000 USDC</section></main></body></html>" : "<html><body><h1>Hello World</h1></body></html>");
});
await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
const binding = server.address();
if (!binding || typeof binding === "string") throw new Error("Fixture server failed");
const origin = `http://127.0.0.1:${binding.port}`;
const { db, close } = connectDatabase(process.env.DATABASE_URL);
const repository = new VerificationRepository(db);

type Outcome = { label: string; pact: Address; create: Hex; fund: Hex; accept: Hex; submit: Hex; verification?: Hex; settlement?: Hex; score: number; reportHash: Hex; workerBefore: bigint; workerAtVerification: bigint; workerAfter: bigint; releasedBefore: bigint; releasedAfter: bigint; workerRepBefore: bigint; workerRepAfter: bigint };
const outcomes: Outcome[] = [];
async function scenario(label: string, mode: "AI_ONLY" | "HYBRID", fixture: "pass" | "fail") {
  const url = `${origin}/${fixture}`;
  const policy: VerificationPolicy = { version: 1, name: `${label} PactFlow verifier smoke`, mode, minScore: 80, requireAllMandatoryRules: true, semanticVerificationEnabled: true,
    rules: [
      { id: "http", type: "HTTP_STATUS", target: url, expected: 200, weight: 25, required: true },
      { id: "wallet-button", type: "DOM_SELECTOR", selector: "[data-testid='connect-wallet']", weight: 20, required: true },
      { id: "headline", type: "DOM_TEXT", selector: "h1", contains: "Monad", weight: 20, required: true },
      { id: "semantic", type: "LLM_RUBRIC", rubric: "Verify the page visibly identifies a Monad analytics dashboard with a Connect Wallet action and three metrics: Transactions, Active Wallets, Settled Volume.", criteria: ["Monad analytics dashboard", "Connect Wallet action", "Three protocol metrics"], weight: 35, required: true },
    ] };
  const rulesHash = hashVerificationPolicy(policy);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const workerBefore = await sdk.getTokenBalance(token, worker.address);
  const workerRepBefore = (await sdk.getReputation(worker.address)).completedPacts;
  const created = await sdk.createPact(client, { client: client.address, worker: worker.address, arbitrator: deployerAccount.address, token, totalBudget: budget, clientBond: bond, workerBond: bond,
    acceptanceDeadline: now + 6n * 3600n, reviewPeriod: 24n * 3600n, milestones: [{ amount: budget, dueAt: now + 2n * 86400n, rulesHash, mode: mode === "AI_ONLY" ? 1 : 2 }] });
  const escrow = created.escrowAddress;
  await repository.savePolicy({ escrow, pactId: created.pactId as Address, milestoneIndex: 0, policy, rulesHash });
  if (await sdk.getAllowance(token, client.address, escrow) < budget + bond) await sdk.approveToken(client, token, escrow, budget + bond);
  const fund = await sdk.fundPact(client, escrow);
  if (await sdk.getAllowance(token, worker.address, escrow) < bond) await sdk.approveToken(worker, token, escrow, bond);
  const accept = await sdk.acceptPact(worker, escrow);
  const metadata: CanonicalValue = { previewUrl: url, notes: `${label} verification fixture`, submittedBy: worker.address, timestamp: new Date().toISOString() };
  const deliverableHash = hashAgreement(metadata);
  const submit = await sdk.submitMilestone(worker, escrow, 0n, deliverableHash, dataUriForAgreement(metadata));
  const workerBeforeVerification = await sdk.getTokenBalance(token, worker.address);
  const releasedBefore = (await sdk.getPact(escrow)).releasedBudget;
  const job = await repository.createOrGetJob({ escrow, pactId: created.pactId as Address, milestoneIndex: 0, deliverableHash, deliverableUri: dataUriForAgreement(metadata), rulesHash });
  const result = await processVerificationJob(job.id, repository, { rpcUrl, fetchLimits: { allowLocalhost: true } });
  const saved = await repository.getReport(job.id);
  if (!result || !saved) throw new Error(`${label}: report missing`);
  const proof = result.status === "PASSED" ? result.proof : undefined;
  const finalJob = await repository.getJob(job.id);
  if (fixture === "pass" && (finalJob?.status !== "PASSED" || !result.report.result.passed || !proof)) throw new Error(`${label}: verification did not pass`);
  if (fixture === "fail" && (finalJob?.status !== "FAILED" || result.report.result.passed || saved.attestationTxHash)) throw new Error(`${label}: failure did not hold funds`);
  let settlement: Hex | undefined;
  if (fixture === "pass" && mode === "HYBRID") {
    const mid = await sdk.getPact(escrow);
    if (!mid.milestones[0].aiAttested || mid.releasedBudget !== 0n) throw new Error("Hybrid settled before client approval");
    settlement = await sdk.approveMilestone(client, escrow, 0n);
  }
  if (fixture === "pass" && mode === "AI_ONLY") settlement = proof?.txHash;
  const [pact, workerAfter, workerRepAfter] = await Promise.all([sdk.getPact(escrow), sdk.getTokenBalance(token, worker.address), sdk.getReputation(worker.address)]);
  if (fixture === "pass" && (pact.status !== "Completed" || pact.milestones[0].status !== "Paid" || pact.releasedBudget !== budget || pact.clientBond !== 0n || pact.workerBond !== 0n || workerAfter - workerBefore !== budget || workerRepAfter.completedPacts !== workerRepBefore + 1n)) throw new Error(`${label}: settlement assertions failed`);
  if (fixture === "fail" && (pact.releasedBudget !== releasedBefore || pact.milestones[0].status === "Paid" || workerAfter !== workerBeforeVerification || await sdk.getTokenBalance(token, escrow) !== budget + bond * 2n)) throw new Error(`${label}: payment occurred after FAIL`);
  outcomes.push({ label, pact: escrow, create: created.txHash, fund, accept, submit, verification: proof?.txHash, settlement, score: result.report.result.score, reportHash: result.reportHash,
    workerBefore, workerAtVerification: workerBeforeVerification, workerAfter, releasedBefore, releasedAfter: pact.releasedBudget, workerRepBefore, workerRepAfter: workerRepAfter.completedPacts });
}
try {
  await scenario("HYBRID PASS", "HYBRID", "pass");
  await scenario("AI ONLY PASS", "AI_ONLY", "pass");
  await scenario("FAIL CASE", "AI_ONLY", "fail");
  const lines = ["", "## Phase 3 real verifier smoke", "", "Fixtures were served by a local HTTP server with an explicit test-only localhost allowance. Protocol transactions, attestations, settlement, balances, and reputation were read from Monad Testnet.", ""];
  for (const outcome of outcomes) {
    lines.push(`### ${outcome.label}`, "", `- Pact / Escrow: [${outcome.pact}](${getExplorerAddressUrl(outcome.pact)})`, `- Create: [${outcome.create}](${getExplorerTxUrl(outcome.create)})`, `- Fund: [${outcome.fund}](${getExplorerTxUrl(outcome.fund)})`, `- Accept: [${outcome.accept}](${getExplorerTxUrl(outcome.accept)})`, `- Submit: [${outcome.submit}](${getExplorerTxUrl(outcome.submit)})`, `- Score: ${outcome.score}`, `- Report hash: ${outcome.reportHash}`);
    if (outcome.verification) lines.push(`- Verification TX: [${outcome.verification}](${getExplorerTxUrl(outcome.verification)})`);
    if (outcome.settlement) lines.push(`- Settlement TX: [${outcome.settlement}](${getExplorerTxUrl(outcome.settlement)})`);
    lines.push(`- Worker USDC before Pact: ${formatUnits(outcome.workerBefore, decimals)}`, `- Worker USDC before / after verification: ${formatUnits(outcome.workerAtVerification, decimals)} → ${formatUnits(outcome.workerAfter, decimals)}`, `- Released budget: ${formatUnits(outcome.releasedBefore, decimals)} → ${formatUnits(outcome.releasedAfter, decimals)}`, `- Worker completed Pacts: ${outcome.workerRepBefore} → ${outcome.workerRepAfter}`, "");
  }
  appendFileSync(resolve(process.cwd(), "../../docs/TESTNET.md"), lines.join("\n"));
  console.log("PHASE 3 VERIFIER TESTNET\n" + lines.join("\n") + "\nPASS");
} finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await close(); }
