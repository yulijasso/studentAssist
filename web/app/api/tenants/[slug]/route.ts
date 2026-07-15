/**
 * Plain REST endpoint for the widget's tenant config fetch.
 * GET /api/tenants/{slug}
 * Returns public tenant fields (slug, name, websiteDomain, apiKey).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getTenantBySlug } from "@/server/services/tenant_service";

export async function GET(_req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const tenant = await getTenantBySlug(db, params.slug);
  if (!tenant || !tenant.isActive) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const ws = (tenant.widgetSettings ?? {}) as Record<string, unknown>;

  return NextResponse.json({
    slug: tenant.slug,
    name: tenant.name,
    website_domain: tenant.websiteDomain,
    api_key: tenant.apiKey,
    brand_color: (ws.primaryColor as string) ?? undefined,
    greeting: (ws.welcomeMessage as string) ?? undefined,
    city_name: (ws.cityName as string) ?? undefined,
    assistant_name: (ws.assistantName as string) ?? undefined,
    logo_url: (ws.logoUrl as string) ?? undefined,
    auto_open: (ws.autoOpen as boolean) ?? false,
    position: (ws.position as string) ?? "bottom-right",
  });
}
