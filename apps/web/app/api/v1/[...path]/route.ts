import { NextResponse } from "next/server";

function unavailable() {
  return NextResponse.json(
    { code: "BACKEND_NOT_CONFIGURED" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

// Fail closed when no upstream is configured. Configured requests are forwarded
// by the beforeFiles rewrite, including Authorization, method, body and query.
export const GET = unavailable;
export const POST = unavailable;
export const PUT = unavailable;
export const PATCH = unavailable;
export const DELETE = unavailable;
