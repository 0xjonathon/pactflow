import { NextResponse } from "next/server";

function unavailable() {
  return NextResponse.json(
    { code: "BACKEND_NOT_CONFIGURED" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

// This deployment only serves the website; it never manufactures API data.
export const GET = unavailable;
export const POST = unavailable;
export const PUT = unavailable;
export const PATCH = unavailable;
export const DELETE = unavailable;
