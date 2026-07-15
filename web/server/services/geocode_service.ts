/**
 * Geocoding service using OpenStreetMap Nominatim API (free, no key required).
 *
 * Looks up latitude/longitude for a city name. Uses the website domain
 * and country bias to improve accuracy. Used to auto-pin cities
 * on the admin map view when they are created or updated.
 */

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Extracts a location hint from a website domain.
 * E.g. "edinburg.tx.gov" → "Edinburg TX", "cityofaustin.org" → null.
 *
 * @param domain - The tenant's website domain.
 * @returns A location hint string, or null if no useful info found.
 */
function extractDomainHint(domain: string | null | undefined): string | null {
  if (!domain) return null;

  // Remove protocol, www, trailing slashes
  const clean = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

  // Match patterns like "edinburg.tx.gov" or "cityofmcallen.org"
  const parts = clean.split(".");

  // Check for state abbreviation in .gov domains (e.g. edinburg.tx.gov)
  if (parts.length >= 3) {
    const possibleState = parts[parts.length - 2];
    // US state abbreviations are 2 chars
    if (possibleState.length === 2 && parts[parts.length - 1] === "gov") {
      return possibleState.toUpperCase();
    }
  }

  return null;
}

/**
 * Cleans a city/tenant name for geocoding by removing non-location words.
 * E.g. "Yuliana's Organization" → null, "City of Edinburg" → "Edinburg".
 *
 * @param name - The raw tenant name.
 * @returns Cleaned name suitable for geocoding, or null if not a real city name.
 */
function cleanCityName(name: string): string | null {
  // Skip names that are clearly not cities
  const skipPatterns = /organization|company|test|demo|sample|admin|dev|staging/i;
  if (skipPatterns.test(name)) return null;

  // Remove common prefixes
  let cleaned = name
    .replace(/^city\s+of\s+/i, "")
    .replace(/^town\s+of\s+/i, "")
    .replace(/^village\s+of\s+/i, "")
    .replace(/^municipality\s+of\s+/i, "")
    .trim();

  // If the cleaned name is too short or has numbers, skip
  if (cleaned.length < 3) return null;
  if (/^\d+/.test(cleaned)) return null;

  return cleaned;
}

/**
 * Geocode a city name to latitude/longitude using Nominatim.
 * Appends ", USA" for better US city matching and uses domain hints
 * for state-level disambiguation.
 *
 * @param cityName - The city name to look up (e.g. "Edinburg").
 * @param websiteDomain - Optional domain for location hints (e.g. "edinburg.tx.gov").
 * @returns Coordinates, or null if not found or on error.
 */
export async function geocodeCity(
  cityName: string,
  websiteDomain?: string | null,
): Promise<{ latitude: number; longitude: number } | null> {
  const cleaned = cleanCityName(cityName) ?? cityName.trim();
  if (!cleaned || cleaned.length < 2) {
    console.log("[geocode] Skipping empty/short name:", cityName);
    return null;
  }

  // Build the search query with hints
  const stateHint = extractDomainHint(websiteDomain);
  const queries: string[] = [];

  // Most specific first
  if (stateHint) {
    queries.push(`${cleaned}, ${stateHint}, USA`);
  }
  queries.push(`${cleaned}, USA`);
  queries.push(cleaned);

  for (const query of queries) {
    try {
      const encoded = encodeURIComponent(query);
      const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=us`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "CampusAssist/1.0 (admin geocoding)",
        },
      });

      if (!res.ok) {
        console.error("[geocode] Nominatim returned", res.status);
        continue;
      }

      const results: NominatimResult[] = await res.json();
      if (results.length > 0) {
        const { lat, lon, display_name } = results[0];
        console.log("[geocode]", cityName, "→", display_name, `(${lat}, ${lon})`);
        return { latitude: parseFloat(lat), longitude: parseFloat(lon) };
      }
    } catch (err) {
      console.error("[geocode] Error querying:", query, err);
    }
  }

  // Fallback: try without country restriction
  try {
    const encoded = encodeURIComponent(cleaned);
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`;

    const res = await fetch(url, {
      headers: { "User-Agent": "CampusAssist/1.0 (admin geocoding)" },
    });

    if (res.ok) {
      const results: NominatimResult[] = await res.json();
      if (results.length > 0) {
        const { lat, lon, display_name } = results[0];
        console.log("[geocode]", cityName, "→", display_name, `(${lat}, ${lon}) [global]`);
        return { latitude: parseFloat(lat), longitude: parseFloat(lon) };
      }
    }
  } catch (err) {
    console.error("[geocode] Global fallback error:", err);
  }

  console.log("[geocode] No results for:", cityName);
  return null;
}
