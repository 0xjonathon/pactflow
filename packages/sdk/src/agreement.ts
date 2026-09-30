import { keccak256, toBytes, type Hex } from "viem";

export type CanonicalValue = null | boolean | number | string | CanonicalValue[] | { [key: string]: CanonicalValue };

export function canonicalizeAgreement(value: CanonicalValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Agreement contains a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeAgreement).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalizeAgreement(value[key])}`).join(",")}}`;
}

export function hashAgreement(value: CanonicalValue): Hex {
  return keccak256(toBytes(canonicalizeAgreement(value)));
}

export function dataUriForAgreement(value: CanonicalValue): string {
  return `data:application/json;charset=utf-8,${encodeURIComponent(canonicalizeAgreement(value))}`;
}

export function parseVerifiedDataUri(uri: string, expectedHash: Hex): CanonicalValue | null {
  if (!uri.startsWith("data:application/json;charset=utf-8,")) return null;
  try {
    const value = JSON.parse(decodeURIComponent(uri.slice("data:application/json;charset=utf-8,".length))) as CanonicalValue;
    return hashAgreement(value).toLowerCase() === expectedHash.toLowerCase() ? value : null;
  } catch { return null; }
}
