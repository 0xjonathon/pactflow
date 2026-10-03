import { canonicalizeAgreement, type CanonicalValue } from "@pactflow/sdk";
import { keccak256, toBytes, type Address, type Hex } from "viem";
import type { VerificationPolicy } from "../policy";
import type { RuleResult } from "../rules/deterministic";
import type { AggregateResult } from "./aggregate";

export type VerificationReport = {
  version: 1;
  network: { chainId: number };
  pact: { pactId: Address; escrow: Address; milestone: number };
  submission: { deliverableHash: Hex; deliverableURI: string };
  policy: { rulesHash: Hex; minScore: number };
  result: AggregateResult;
  checks: RuleResult[];
  verifier: { address: Address; version: "1.0.0" };
  generatedAt: number;
};
export function createVerificationReport(input: {
  chainId: number; escrow: Address; milestone: number; deliverableHash: Hex; deliverableURI: string;
  policy: VerificationPolicy; rulesHash: Hex; result: AggregateResult; checks: RuleResult[]; verifier: Address; now?: number;
}): { report: VerificationReport; canonical: string; reportHash: Hex } {
  const report: VerificationReport = {
    version: 1, network: { chainId: input.chainId }, pact: { pactId: input.escrow, escrow: input.escrow, milestone: input.milestone },
    submission: { deliverableHash: input.deliverableHash, deliverableURI: input.deliverableURI },
    policy: { rulesHash: input.rulesHash, minScore: input.policy.minScore }, result: input.result, checks: input.checks,
    verifier: { address: input.verifier, version: "1.0.0" }, generatedAt: input.now ?? Math.floor(Date.now() / 1000),
  };
  const canonical = canonicalizeAgreement(report as CanonicalValue);
  return { report, canonical, reportHash: keccak256(toBytes(canonical)) };
}
