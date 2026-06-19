import { ActionPage } from "@/components/ActionPage";

export default async function ActionRoute({
  params,
}: {
  params: Promise<{ actionId: string }>;
}) {
  const { actionId } = await params;

  return <ActionPage actionId={actionId} />;
}
