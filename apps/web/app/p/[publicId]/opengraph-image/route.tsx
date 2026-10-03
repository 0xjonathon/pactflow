import { ImageResponse } from "next/og";
import { publicReceipt } from "../../../../lib/public-receipt";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  const receipt = await publicReceipt(publicId);
  if (!receipt)
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#09090b",
        color: "#f4f4f5",
        padding: 80,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", color: "#8f75ff", fontSize: 32 }}>
        PACTFLOW · PUBLIC WORK RECEIPT
      </div>
      <div style={{ display: "flex", marginTop: 60, fontSize: 60 }}>
        {receipt.title}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 40,
          fontSize: 28,
          color: "#a1a1aa",
        }}
      >
        {receipt.description}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: "auto",
          color: "#34d399",
          fontSize: 30,
        }}
      >
        Payment released · Shared by both parties
      </div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "no-store" } },
  );
}
