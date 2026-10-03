import { VerificationDetail } from "./verification-detail";

export default async function VerificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VerificationDetail id={id} />;
}
