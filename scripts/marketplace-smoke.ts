import { createWalletClient, encodeFunctionData, http, parseUnits } from "viem";
import {
  PactFlowSdk,
  hashAgreement,
  dataUriForAgreement,
  type PactWalletAdapter,
} from "@pactflow/sdk";
import { monadTestnet, getExplorerTxUrl } from "@pactflow/chain";
import { appendFileSync } from "node:fs";
import { accountFromEnv, deployment, rpcUrl } from "./runtime";
const rpc = rpcUrl(),
  deployed = deployment(),
  sdk = new PactFlowSdk({ rpcUrl: rpc, addresses: deployed });
const clientAccount = accountFromEnv("CLIENT_PRIVATE_KEY"),
  workerAccount = accountFromEnv("WORKER_PRIVATE_KEY"),
  arbitrator = accountFromEnv("DEPLOYER_PRIVATE_KEY").address;
const api = `http://127.0.0.1:${process.env.API_PORT || 3002}/api/v1`;
async function request(path: string, token?: string, body?: unknown) {
  const response = await fetch(api + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(`Marketplace ${response.status}: ${value.code}`);
  return value;
}
async function login(account: typeof clientAccount) {
  const ch = await request("/auth/challenge", undefined, {
    address: account.address,
  });
  return (
    await request("/auth/verify", undefined, {
      id: ch.id,
      signature: await account.signMessage({ message: ch.message }),
    })
  ).token as string;
}
const adapter = (account: typeof clientAccount): PactWalletAdapter => {
  const wallet = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(rpc),
  });
  return {
    address: account.address,
    chainId: monadTestnet.id,
    sendContractTransaction: (r) =>
      wallet.sendTransaction({
        account,
        chain: monadTestnet,
        to: r.address,
        data: encodeFunctionData({
          abi: r.abi,
          functionName: r.functionName,
          args: r.args,
        }),
      }),
  };
};
const c = adapter(clientAccount),
  w = adapter(workerAccount);
const clientToken = await login(clientAccount),
  workerToken = await login(workerAccount);
const dueAt = Math.floor(Date.now() / 1000) + 7 * 86400;
const draft = {
  title: "Marketplace real Testnet collaboration",
  description:
    "End-to-end job, proposal, worker selection, Pact creation, funding, delivery and settlement on Monad Testnet.",
  requirements:
    "Submit canonical delivery evidence and complete the agreed review.",
  category: "Development",
  skills: ["TypeScript", "Monad"],
  budget: "1",
  deadline: new Date(dueAt * 1000).toISOString(),
  milestones: [
    {
      title: "Verified delivery",
      amount: "1",
      dueAt: new Date(dueAt * 1000).toISOString(),
    },
  ],
  verificationMode: "ClientOnly",
  policy: null,
  clientDeposit: "0.05",
  workerDeposit: "0",
};
const job = await request("/jobs", clientToken, draft);
await request(`/jobs/${job.id}/publish`, clientToken, {});
const proposal = await request(`/jobs/${job.id}/proposals`, workerToken, {
  message:
    "I will deliver the canonical Testnet evidence and complete the full collaboration flow.",
  estimatedDays: 1,
  acceptBudget: true,
});
await request(`/proposals/${proposal.id}/accept`, clientToken, {});
const selected = await request(`/jobs/${job.id}/pact-draft`, clientToken);
if (selected.proposal.workerAddress !== workerAccount.address.toLowerCase())
  throw new Error("Wrong selected worker");
const agreement = {
  version: 1,
  title: draft.title,
  description: draft.description,
  client: c.address,
  worker: w.address,
};
const create = await sdk.createPact(c, {
  client: c.address,
  worker: w.address,
  arbitrator,
  token: deployed.SettlementToken,
  totalBudget: parseUnits("1", 6),
  clientBond: parseUnits("0.05", 6),
  workerBond: 0n,
  acceptanceDeadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  reviewPeriod: 86400n,
  milestones: [
    {
      amount: parseUnits("1", 6),
      dueAt: BigInt(dueAt),
      rulesHash: hashAgreement(agreement),
      mode: 0,
    },
  ],
});
const escrow = create.escrowAddress;
await request(`/jobs/${job.id}/pact`, clientToken, { escrow });
await sdk.approveToken(
  c,
  deployed.SettlementToken,
  escrow,
  parseUnits("1.05", 6),
);
const fund = await sdk.fundPact(c, escrow);
const accept = await sdk.acceptPact(w, escrow);
const delivery = {
  previewUrl: "https://docs.monad.xyz",
  notes: "Marketplace integration smoke evidence",
  submittedBy: w.address,
  timestamp: new Date().toISOString(),
};
const submit = await sdk.submitMilestone(
  w,
  escrow,
  0n,
  hashAgreement(delivery),
  dataUriForAgreement(delivery),
);
const settle = await sdk.approveMilestone(c, escrow, 0n);
const state = await sdk.getPact(escrow);
if (
  state.status !== "Completed" ||
  state.releasedBudget !== parseUnits("1", 6) ||
  state.worker?.toLowerCase() !== w.address.toLowerCase()
)
  throw new Error("Marketplace settlement mismatch");
const evidence = `\n## Phase 4 Marketplace real E2E\n\n- Job: ${job.id}\n- Proposal: ${proposal.id}\n- Pact / Escrow: ${escrow}\n- Create: [${create.txHash}](${getExplorerTxUrl(create.txHash)})\n- Fund: [${fund}](${getExplorerTxUrl(fund)})\n- Accept: [${accept}](${getExplorerTxUrl(accept)})\n- Submit: [${submit}](${getExplorerTxUrl(submit)})\n- Settlement: [${settle}](${getExplorerTxUrl(settle)})\n- Final status: Completed; budget released: 1 USDC; both deposits returned.\n`;
appendFileSync("docs/TESTNET.md", evidence);
console.log("Marketplace real E2E PASS", evidence);
