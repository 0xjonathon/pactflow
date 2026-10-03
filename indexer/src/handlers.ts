import { indexer } from "envio";
indexer.contractRegister(
  { contract: "PactFactory", event: "PactCreated" },
  async ({ event, context }) => {
    context.chain.PactEscrow.add(event.params.pact);
  },
);
indexer.contractRegister(
  { contract: "PactFactoryV2", event: "PactCreated" },
  async ({ event, context }) => {
    context.chain.PactEscrowV2.add(event.params.pact);
  },
);
const contracts = {
  PactFactoryV2: [
    "PactCreated",
    "PactConfigured",
    "MilestoneConfigured",
    "FeeConfigChanged",
  ],
  PactEscrowV2: [
    "Funded",
    "Accepted",
    "Submitted",
    "RevisionRequested",
    "VerificationRecorded",
    "MilestoneSettled",
    "DisputeOpened",
    "MilestoneExpired",
    "ClientApprovalRecorded",
    "BondSlashed",
    "Cancelled",
    "Completed",
  ],
  VerifierRegistryV2: [
    "VerifierRegistered",
    "FactorySet",
    "VerifierRevoked",
    "AttestationConsumed",
  ],
  ReputationRegistryV2: [
    "PactCompleted",
    "FactorySet",
    "MilestoneSettled",
    "BondSlashed",
  ],
  PactFactory: ["PactCreated", "FeeConfigChanged"],
  PactEscrow: [
    "Funded",
    "Accepted",
    "Submitted",
    "MilestoneSettled",
    "DisputeOpened",
    "BondSlashed",
    "Cancelled",
    "Completed",
  ],
  VerifierRegistry: [
    "VerifierRegistered",
    "FactorySet",
    "VerifierRevoked",
    "AttestationConsumed",
  ],
  ReputationRegistry: [
    "PactCompleted",
    "FactorySet",
    "MilestoneSettled",
    "BondSlashed",
  ],
} as const;
for (const [contract, events] of Object.entries(contracts))
  for (const name of events) {
    // The generated Envio union ensures configured event names; the runtime registration loop handles all ABI events uniformly.
    indexer.onEvent(
      {
        contract: contract as "PactFactory",
        event: name as "PactCreated",
        fields: { transaction: ["hash"], block: ["hash", "timestamp"] },
      },
      async ({ event, context }) => {
        const id = `${event.chainId}:${event.transaction.hash.toLowerCase()}:${event.logIndex}`;
        if (await context.ProtocolEvent.get(id)) return;
        context.ProtocolEvent.set({
          id,
          chainId: event.chainId,
          txHash: event.transaction.hash.toLowerCase(),
          logIndex: event.logIndex,
          blockNumber: event.block.number,
          blockHash: event.block.hash,
          address: event.srcAddress.toLowerCase(),
          name,
          args: JSON.stringify(event.params, (_k, v) =>
            typeof v === "bigint" ? v.toString() : v,
          ),
          timestamp: event.block.timestamp,
        });
      },
    );
  }
