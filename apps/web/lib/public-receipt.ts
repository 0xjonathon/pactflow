import { cache } from "react";
export const publicReceipt = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const base =
      process.env.INTERNAL_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://127.0.0.1:3012";
    const response = await fetch(`${base}/api/v1/receipts/${id}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const value = await response.json();
    if (
      typeof value.title !== "string" ||
      typeof value.description !== "string"
    )
      return null;
    // Read exactly the fields approved by both parties; never fetch private PactSpec or evidence.
    return {
      title: value.title.slice(0, 160),
      description: value.description.slice(0, 500),
      publicId: id,
    };
  } catch {
    return null;
  }
});
