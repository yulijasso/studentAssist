import { redirect } from "next/navigation";

export default async function DashboardPage(props: {
  params: Promise<{ tenant_slug: string }>;
}) {
  const params = await props.params;
  redirect(`/dashboard/${params.tenant_slug}/conversations`);
}
