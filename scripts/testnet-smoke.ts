import { readFileSync, writeFileSync } from "node:fs";
import { createWalletClient, encodeFunctionData, formatEther, formatUnits, http, parseUnits, type Address, type Hex } from "viem";
import { createPactPublicClient, getExplorerAddressUrl, getExplorerTxUrl, monadTestnet, pactEscrowAbi } from "@pactflow/chain";
import { PactFlowSdk, dataUriForAgreement, hashAgreement, type CanonicalValue, type PactWalletAdapter } from "@pactflow/sdk";
import { accountFromEnv, deployment, rpcUrl } from "./runtime";

const deployed = deployment();
const rpc = rpcUrl();
const clientAccount = accountFromEnv("CLIENT_PRIVATE_KEY");
const workerAccount = accountFromEnv("WORKER_PRIVATE_KEY");
const arbitrator = process.env.ARBITRATOR_PRIVATE_KEY ? accountFromEnv("ARBITRATOR_PRIVATE_KEY").address : accountFromEnv("DEPLOYER_PRIVATE_KEY").address;
if (clientAccount.address.toLowerCase() === workerAccount.address.toLowerCase() ||
    clientAccount.address.toLowerCase() === arbitrator.toLowerCase() || workerAccount.address.toLowerCase() === arbitrator.toLowerCase()) {
  throw new Error("Client, worker and arbitrator must be distinct addresses");
}

const publicClient = createPactPublicClient(rpc);
if (await publicClient.getChainId() !== monadTestnet.id) throw new Error("RPC is not Monad Testnet");
const sdk = new PactFlowSdk({ rpcUrl: rpc, addresses: deployed });
const makeAdapter = (account: typeof clientAccount): PactWalletAdapter => {
  const wallet = createWalletClient({ account, chain: monadTestnet, transport: http(rpc) });
  return {
    address: account.address, chainId: monadTestnet.id,
    sendContractTransaction: request => wallet.sendTransaction({
      account, chain: monadTestnet, to: request.address,
      data: encodeFunctionData({ abi: request.abi, functionName: request.functionName, args: request.args }),
    }),
  };
};
const client = makeAdapter(clientAccount);
const worker = makeAdapter(workerAccount);
const [clientMon, workerMon] = await Promise.all([
  publicClient.getBalance({ address: client.address }), publicClient.getBalance({ address: worker.address }),
]);
if (clientMon < 1_000_000_000_000_000_000n || workerMon < 1_000_000_000_000_000_000n) {
  throw new Error(`Insufficient test MON for gas. Client ${formatEther(clientMon)}, worker ${formatEther(workerMon)}. Get MON at https://faucet.monad.xyz`);
}
const token = deployed.SettlementToken;
const metadata = await sdk.getTokenMetadata(token);
const budget = parseUnits("0.10", metadata.decimals);
const clientBond = parseUnits("0.01", metadata.decimals);
const workerBond = parseUnits("0.01", metadata.decimals);
const [clientBefore, workerBefore, clientRepBefore, workerRepBefore] = await Promise.all([
  sdk.getTokenBalance(token, client.address), sdk.getTokenBalance(token, worker.address),
  sdk.getReputation(client.address), sdk.getReputation(worker.address),
]);
if (clientBefore < budget + clientBond || workerBefore < workerBond) {
  throw new Error(`Insufficient ${metadata.symbol}. Client needs ${formatUnits(budget + clientBond, metadata.decimals)}, worker needs ${formatUnits(workerBond, metadata.decimals)}. Official token list: https://github.com/monad-crypto/token-list/blob/main/tokenlist-testnet.json`);
}

const now = BigInt(Math.floor(Date.now() / 1000));
const agreement: CanonicalValue = {
  version: 1, title: "PactFlow Monad Testnet smoke", description: "One milestone settlement between two real wallets",
  client: client.address, worker: worker.address, token, budget: budget.toString(),
  clientBond: clientBond.toString(), workerBond: workerBond.toString(),
  milestone: { title: "Smoke deliverable", description: "Submit canonical evidence", amount: budget.toString() },
};
const agreementHash = hashAgreement(agreement);
const create = await sdk.createPact(client, {
  client: client.address, worker: worker.address, token, arbitrator, totalBudget: budget,
  clientBond, workerBond, acceptanceDeadline: now + 6n * 3600n,
  reviewPeriod: 24n * 3600n,
  milestones: [{ amount: budget, dueAt: now + 2n * 24n * 3600n, rulesHash: agreementHash, mode: 0 }],
});
const escrow = create.escrowAddress;
const pactAfterCreate = await sdk.getPact(escrow);
if (pactAfterCreate.status !== "Created" || pactAfterCreate.agreementHash.toLowerCase() !== agreementHash.toLowerCase()) {
  throw new Error("Pact creation state or agreement commitment is wrong");
}

let clientApproveTx: Hex | undefined;
let workerApproveTx: Hex | undefined;
if (await sdk.getAllowance(token, client.address, escrow) < budget + clientBond) {
  clientApproveTx = await sdk.approveToken(client, token, escrow, budget + clientBond);
}
const fundTx = await sdk.fundPact(client, escrow);
if ((await sdk.getPact(escrow)).status !== "Funded") throw new Error("Pact did not reach Funded state");
if (await sdk.getAllowance(token, worker.address, escrow) < workerBond) {
  workerApproveTx = await sdk.approveToken(worker, token, escrow, workerBond);
}
const acceptTx = await sdk.acceptPact(worker, escrow);
if ((await sdk.getPact(escrow)).status !== "Active") throw new Error("Pact did not reach Active state");

const deliverable: CanonicalValue = {
  previewUrl: "data:text/plain,PactFlow%20Monad%20Testnet%20smoke%20deliverable", notes: "Automated real testnet smoke",
  submittedBy: worker.address, timestamp: new Date().toISOString(),
};
const deliverableHash = hashAgreement(deliverable);
const submitTx = await sdk.submitMilestone(worker, escrow, 0n, deliverableHash, dataUriForAgreement(deliverable));
if ((await sdk.getPact(escrow)).status !== "Submitted") throw new Error("Pact did not reach Submitted state");
const settlementTx = await sdk.approveMilestone(client, escrow, 0n);
const [finalPact, clientAfter, workerAfter, clientRepAfter, workerRepAfter, escrowBalance] = await Promise.all([
  sdk.getPact(escrow), sdk.getTokenBalance(token, client.address), sdk.getTokenBalance(token, worker.address),
  sdk.getReputation(client.address), sdk.getReputation(worker.address), sdk.getTokenBalance(token, escrow),
]);
const escrowFeeBps = await publicClient.readContract({ address: escrow, abi: pactEscrowAbi, functionName: "feeBps" });
const fee = budget * BigInt(escrowFeeBps) / 10_000n;
if (finalPact.status !== "Completed" || finalPact.milestones[0]?.status !== "Paid" ||
    finalPact.releasedBudget !== budget || finalPact.clientBond !== 0n || finalPact.workerBond !== 0n ||
    escrowBalance !== 0n || workerAfter - workerBefore !== budget - fee ||
    clientAfter !== clientBefore - budget ||
    clientRepAfter.completedPacts !== clientRepBefore.completedPacts + 1n ||
    workerRepAfter.completedPacts !== workerRepBefore.completedPacts + 1n ||
    workerRepAfter.settledMilestones !== workerRepBefore.settledMilestones + 1n ||
    workerRepAfter.earned !== workerRepBefore.earned + budget) {
  throw new Error("Settlement balance or reputation assertions failed");
}

const format = (value: bigint) => formatUnits(value, metadata.decimals);
const lines = [
  "", "## Real smoke test", "", `- Pact ID: ${create.pactId}`,
  `- Escrow: [${escrow}](${getExplorerAddressUrl(escrow)})`,
  `- Create TX: [${create.txHash}](${getExplorerTxUrl(create.txHash)})`,
  ...(clientApproveTx ? [`- Client token approval TX: [${clientApproveTx}](${getExplorerTxUrl(clientApproveTx)})`] : []),
  `- Fund TX: [${fundTx}](${getExplorerTxUrl(fundTx)})`,
  ...(workerApproveTx ? [`- Worker token approval TX: [${workerApproveTx}](${getExplorerTxUrl(workerApproveTx)})`] : []),
  `- Accept TX: [${acceptTx}](${getExplorerTxUrl(acceptTx)})`,
  `- Submit TX: [${submitTx}](${getExplorerTxUrl(submitTx)})`,
  `- Settlement TX: [${settlementTx}](${getExplorerTxUrl(settlementTx)})`,
  `- Agreement hash: ${agreementHash}`, `- Worker ${metadata.symbol} before: ${format(workerBefore)}`,
  `- Worker ${metadata.symbol} after: ${format(workerAfter)}`,
  `- Worker difference: ${format(workerAfter - workerBefore)}`,
  `- Worker completed pacts: ${workerRepBefore.completedPacts} → ${workerRepAfter.completedPacts}`,
  `- Worker settled milestones: ${workerRepBefore.settledMilestones} → ${workerRepAfter.settledMilestones}`,
  `- Worker earned (gross raw units): ${workerRepBefore.earned} → ${workerRepAfter.earned}`,
  `- Client completed pacts: ${clientRepBefore.completedPacts} → ${clientRepAfter.completedPacts}`, "",
];
const evidencePath = "docs/TESTNET.md";
const evidence = readFileSync(evidencePath, "utf8");
const marker = "Pending real execution.";
writeFileSync(evidencePath, evidence.includes(marker) ? evidence.replace(marker, lines.slice(3).join("\n")) : evidence + lines.join("\n"));
console.log("PASS");
console.log(lines.slice(2).join("\n"));
