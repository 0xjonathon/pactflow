import { PactDetail } from "./pact-detail";

export default async function PactDetailPage({ params, searchParams }: {
  params: Promise<{ escrowAddress: string }>;
  searchParams: Promise<{ agreement?: string }>;
}) {
  const { escrowAddress } = await params;
  const { agreement } = await searchParams;
  return <PactDetail escrowAddress={escrowAddress} agreementURI={agreement} />;
}
