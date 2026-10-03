import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { hashAgreement } from "@pactflow/sdk";
import {
  authenticateAdapterResponse,
  runAuthenticatedAdapter,
} from "./authenticated";
test("external adapter proofs reject historical context, tampering, wrong signer and expiry", async () => {
  const signer = privateKeyToAccount(generatePrivateKey());
  const contextHash = hashAgreement({
    submission: 2,
    nonce: "unique-request",
    evidence: "bound-content",
  });
  const values = {
    contextHash,
    passed: true,
    score: 100,
    summary: "Required check passed",
  };
  const proof = {
    ...values,
    signature: await signer.signMessage({ message: hashAgreement(values) }),
  };
  const expires = Date.now() / 1000 + 60;
  assert.equal(
    (
      await authenticateAdapterResponse(
        contextHash,
        expires,
        signer.address,
        proof,
      )
    ).passed,
    true,
  );
  await assert.rejects(
    authenticateAdapterResponse(
      hashAgreement({ submission: 1 }),
      expires,
      signer.address,
      proof,
    ),
  );
  await assert.rejects(
    authenticateAdapterResponse(contextHash, expires, signer.address, {
      ...proof,
      score: 99,
    }),
  );
  await assert.rejects(
    authenticateAdapterResponse(
      contextHash,
      expires,
      privateKeyToAccount(generatePrivateKey()).address,
      proof,
    ),
  );
  await assert.rejects(
    authenticateAdapterResponse(
      contextHash,
      Date.now() / 1000 - 1,
      signer.address,
      proof,
    ),
  );
});
test("unconfigured adapters fail before any network call or attestation", async () => {
  const previous = process.env.VERIFIER_ADAPTERS_JSON;
  process.env.VERIFIER_ADAPTERS_JSON = "[]";
  try {
    await assert.rejects(
      runAuthenticatedAdapter(
        {
          type: "CUSTOM",
          adapterId: "missing",
          adapterAddress: "0x1111111111111111111111111111111111111111",
          adapterVersion: "1",
        },
        {
          escrow: "0x1111111111111111111111111111111111111111",
          milestone: 0,
          submission: 1,
          evidenceHash: hashAgreement({}),
          rulesHash: hashAgreement({}),
          artifact: {
            body: Buffer.from(""),
            contentType: "text/plain",
            url: "https://example.com",
            status: 200,
            redirects: [],
          },
        },
      ),
      { code: "ADAPTER_UNAVAILABLE" },
    );
  } finally {
    if (previous === undefined) delete process.env.VERIFIER_ADAPTERS_JSON;
    else process.env.VERIFIER_ADAPTERS_JSON = previous;
  }
});
