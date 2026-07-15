import { describe, it, expect, vi } from "vitest";
import { setCurrentTenant, getCurrentTenant } from "@/server/agent/tools/web_search";
import type { Tenant } from "@/server/db/schema";

const mockTenant: Tenant = {
  id: "t1",
  name: "City of Testville",
  slug: "city-of-testville",
  apiKey: "key-123",
  websiteDomain: "testville.gov",
  searchDomains: ["testville.gov"],
  logoPath: null,
  isActive: true,
  dailyRequestQuota: null,
  llmApiKey: null,
  widgetSettings: null,
  location: null,
  latitude: null,
  longitude: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("web_search tool", () => {
  it("setCurrentTenant makes tenant accessible via getCurrentTenant", async () => {
    let captured: Tenant | null = null;
    await setCurrentTenant(mockTenant, async () => {
      captured = getCurrentTenant();
    });
    expect(captured).toBe(mockTenant);
  });

  it("getCurrentTenant throws outside of AsyncLocalStorage context", () => {
    expect(() => getCurrentTenant()).toThrow("No tenant in AsyncLocalStorage context");
  });

  it("searchUniversityWebsite calls Tavily with tenant domains", async () => {
    const mockSearch = vi.fn().mockResolvedValue({
      results: [
        {
          title: "City Hall Hours",
          content: "Open Mon-Fri 9-5",
          url: "https://testville.gov/hours",
          score: 0.9,
        },
      ],
    });

    vi.doMock("@tavily/core", () => ({
      tavily: () => ({ search: mockSearch }),
    }));

    const { searchUniversityWebsite } = await import("@/server/agent/tools/web_search");

    let result: string = "";
    await setCurrentTenant(mockTenant, async () => {
      result = await searchUniversityWebsite.invoke({ query: "financial aid office hours" });
    });

    const parsed = JSON.parse(result);
    expect(parsed.source).toBe("university_website_live");

    vi.doUnmock("@tavily/core");
  });
});
