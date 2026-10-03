import { CollaborationDraft } from "../../../../components/CollaborationDraft";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const value = await params;
  return <CollaborationDraft id={value.id} />;
}
