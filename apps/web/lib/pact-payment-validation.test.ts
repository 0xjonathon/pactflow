import assert from "node:assert/strict";
import { test } from "node:test";
import { formatUnits, maxUint256, zeroAddress } from "viem";
import {
  validatePactPayment,
  type PaymentInput,
} from "./pact-payment-validation";

const now = Date.UTC(2026, 9, 9, 8);
const day = 86400000;
const date = (days: number) => new Date(now + days * day).toISOString();
const base: PaymentInput = {
  client: "0x1111111111111111111111111111111111111111",
  worker: "0x2222222222222222222222222222222222222222",
  arbitrator: "0x3333333333333333333333333333333333333333",
  acceptBy: date(1),
  hours: "24",
  revisions: "2",
  deliveries: [{ amount: "1", due: date(7) }],
};
const check = (patch: Partial<PaymentInput>) =>
  validatePactPayment({ ...base, ...patch }, now);

test("copied wallet whitespace and exact six-decimal USDC amounts remain valid", () => {
  assert.deepEqual(
    check({
      worker: `  ${base.worker}  `,
      arbitrator: ` ${base.arbitrator}\n`,
      hours: "0.5",
      revisions: "0",
      deliveries: [{ amount: " 0.000001 ", due: date(7) }],
    }),
    [],
  );
  assert.deepEqual(
    check({
      deliveries: [
        { amount: ".5", due: date(7) },
        { amount: "1.", due: date(8) },
      ],
    }),
    [],
  );
});

test("each conflicting actor identifies the role that must change", () => {
  assert.deepEqual(check({ worker: base.client! }), [
    { field: "worker", code: "v2.workerIsClient" },
  ]);
  assert.deepEqual(check({ arbitrator: base.client! }), [
    { field: "arbitrator", code: "v2.arbitratorIsClient" },
  ]);
  assert.deepEqual(check({ arbitrator: base.worker }), [
    { field: "arbitrator", code: "v2.arbitratorIsWorker" },
  ]);
});

test("empty, malformed and zero wallets cannot be payment or dispute destinations", () => {
  for (const value of ["", "Google user", "0x123", zeroAddress]) {
    assert.equal(check({ worker: value })[0].code, "v2.workerInvalid");
    assert.equal(check({ arbitrator: value })[0].code, "v2.arbitratorInvalid");
  }
});

test("acceptance and delivery bounds match the V2 90/365-day contract limits", () => {
  assert.deepEqual(
    check({
      acceptBy: date(90),
      deliveries: [{ amount: "1", due: date(365) }],
    }),
    [],
  );
  assert.equal(check({ acceptBy: date(90.001) })[0].code, "v2.acceptanceRange");
  assert.equal(check({ acceptBy: date(0) })[0].code, "v2.acceptanceFuture");
  assert.equal(check({ acceptBy: "" })[0].code, "v2.acceptanceFuture");
  assert.equal(
    check({ deliveries: [{ amount: "1", due: date(365.001) }] })[0].code,
    "v2.dueRange",
  );
});

test("acceptance-before-delivery and ordered milestones identify their own date fields", () => {
  assert.deepEqual(
    check({
      deliveries: [
        { amount: "1", due: date(1) },
        { amount: "1", due: date(1) },
      ],
    }),
    [
      { field: "delivery-0-due", code: "v2.dueAfterAcceptance" },
      { field: "delivery-1-due", code: "v2.dueAfterPrevious" },
    ],
  );
  for (const due of ["", "invalid date", date(0)])
    assert.deepEqual(check({ deliveries: [{ amount: "1", due }] }), [
      { field: "delivery-0-due", code: "v2.dueFuture" },
    ]);
});

test("invalid amounts and extra precision never round into a valid budget", () => {
  for (const amount of [
    "",
    "0",
    "-1",
    "1e3",
    "1,000",
    "NaN",
    "0.0000001",
    "1.1234567",
  ]) {
    assert.deepEqual(check({ deliveries: [{ amount, due: date(7) }] }), [
      { field: "delivery-0-amount", code: "v2.amountInvalid" },
    ]);
  }
});

test("combined budgets cannot overflow the contract uint256 even if each amount fits", () => {
  const maximum = formatUnits(maxUint256, 6);
  assert.deepEqual(
    check({ deliveries: [{ amount: maximum, due: date(7) }] }),
    [],
  );
  assert.deepEqual(
    check({
      deliveries: [
        { amount: maximum, due: date(7) },
        { amount: "0.000001", due: date(8) },
      ],
    }),
    [{ field: "delivery-0-amount", code: "v2.budgetTooLarge" }],
  );
  assert.deepEqual(
    check({
      deliveries: [{ amount: formatUnits(maxUint256 + 1n, 6), due: date(7) }],
    }),
    [{ field: "delivery-0-amount", code: "v2.budgetTooLarge" }],
  );
});

test("review duration supports fractional hours but cannot round to zero or exceed thirty days", () => {
  assert.deepEqual(check({ hours: "720" }), []);
  for (const hours of ["", " ", "0", "-1", "0.0001", "720.01", "Infinity"])
    assert.deepEqual(check({ hours }), [
      { field: "hours", code: "v2.reviewHoursInvalid" },
    ]);
});

test("revision counts are nonempty integers from zero through ten", () => {
  assert.deepEqual(check({ revisions: "10" }), []);
  for (const revisions of ["", " ", "-1", "11", "1.5", "Infinity"])
    assert.deepEqual(check({ revisions }), [
      { field: "revisions", code: "v2.revisionsInvalid" },
    ]);
});
