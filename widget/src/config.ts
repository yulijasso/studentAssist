import type { TenantConfig } from './types';

/**
 * Fetches tenant configuration from the backend.
 *
 * Endpoint: GET {apiUrl}/tenants/{slug}/config
 * Returns TenantConfig on success, throws on network or HTTP error.
 */
export async function fetchTenantConfig(
  apiUrl: string,
  tenantSlug: string,
): Promise<TenantConfig> {
  const url = `${apiUrl}/api/tenants/${encodeURIComponent(tenantSlug)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to load tenant config for "${tenantSlug}": HTTP ${response.status}`,
    );
  }

  return response.json() as Promise<TenantConfig>;
}
