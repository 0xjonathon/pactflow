import { ReceiptPage } from "../../../components/NetworkPages";
import type { Metadata } from "next";
import { publicReceipt } from "../../../lib/public-receipt";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const receipt = await publicReceipt(publicId);
  if (!receipt)
    return {
      title: "PactFlow · Work Receipt",
      robots: { index: false, follow: false },
    };
  return {
    title: `${receipt.title} · PactFlow Work Receipt`,
    description: receipt.description,
    alternates: { canonical: `/p/${publicId}` },
    openGraph: {
      title: receipt.title,
      description: receipt.description,
      images: [
        { url: `/p/${publicId}/opengraph-image`, width: 1200, height: 630 },
      ],
    },
    twitter: { card: "summary_large_image" },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return <ReceiptPage id={publicId} />;
}
