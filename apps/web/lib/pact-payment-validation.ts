import { isAddress, maxUint256, parseUnits, zeroAddress } from "viem";
import type { MessageKey } from "./i18n";

export type PaymentField =
  | "worker"
  | "arbitrator"
  | "acceptBy"
  | "hours"
  | "revisions"
  | `delivery-${number}-amount`
  | `delivery-${number}-due`;
export type PaymentIssue = { field: PaymentField; code: MessageKey };
export type PaymentInput = {
  client?: string;
  worker: string;
  arbitrator: string;
  acceptBy: string;
  hours: string;
  revisions: string;
  deliveries: Array<{ amount: string; due: string }>;
};

export function validatePactPayment(
  input: PaymentInput,
  now = Date.now(),
): PaymentIssue[] {
  const issues: PaymentIssue[] = [];
  const add = (field: PaymentField, code: MessageKey) =>
    issues.push({ field, code });
  const client = input.client?.trim().toLowerCase();
  const worker = input.worker.trim();
  const arbitrator = input.arbitrator.trim();
  const validAddress = (value: string) =>
    isAddress(value) && value.toLowerCase() !== zeroAddress;
  if (!validAddress(worker)) add("worker", "v2.workerInvalid");
  else if (worker.toLowerCase() === client) add("worker", "v2.workerIsClient");
  if (!validAddress(arbitrator)) add("arbitrator", "v2.arbitratorInvalid");
  else if (arbitrator.toLowerCase() === client)
    add("arbitrator", "v2.arbitratorIsClient");
  else if (arbitrator.toLowerCase() === worker.toLowerCase())
    add("arbitrator", "v2.arbitratorIsWorker");

  const acceptance = Date.parse(input.acceptBy);
  if (!Number.isFinite(acceptance) || acceptance <= now)
    add("acceptBy", "v2.acceptanceFuture");
  else if (acceptance > now + 90 * 86400000)
    add("acceptBy", "v2.acceptanceRange");
  let total = 0n;
  let allAmountsValid = true;
  input.deliveries.forEach((delivery, index) => {
    const amount = delivery.amount.trim();
    // Reject excess precision before parseUnits can round the entered amount.
    if (
      amount.length > 86 ||
      !/^(?:\d+(?:\.\d{0,6})?|\.\d{1,6})$/.test(amount)
    ) {
      add(`delivery-${index}-amount`, "v2.amountInvalid");
      allAmountsValid = false;
    } else {
      const units = parseUnits(amount, 6);
      if (units <= 0n || units > maxUint256) {
        add(
          `delivery-${index}-amount`,
          units > maxUint256 ? "v2.budgetTooLarge" : "v2.amountInvalid",
        );
        allAmountsValid = false;
      } else total += units;
    }
    const due = Date.parse(delivery.due);
    const previous = index
      ? Date.parse(input.deliveries[index - 1].due)
      : acceptance;
    if (!Number.isFinite(due) || due <= now)
      add(`delivery-${index}-due`, "v2.dueFuture");
    else if (due > now + 365 * 86400000)
      add(`delivery-${index}-due`, "v2.dueRange");
    else if (Number.isFinite(previous) && due <= previous)
      add(
        `delivery-${index}-due`,
        index ? "v2.dueAfterPrevious" : "v2.dueAfterAcceptance",
      );
  });
  if (allAmountsValid && total > maxUint256)
    add("delivery-0-amount", "v2.budgetTooLarge");
  const hours = Number(input.hours);
  if (
    !input.hours.trim() ||
    !Number.isFinite(hours) ||
    Math.floor(hours * 3600) < 1 ||
    hours > 720
  )
    add("hours", "v2.reviewHoursInvalid");
  const revisions = Number(input.revisions);
  if (
    !input.revisions.trim() ||
    !Number.isInteger(revisions) ||
    revisions < 0 ||
    revisions > 10
  )
    add("revisions", "v2.revisionsInvalid");
  return issues;
}
