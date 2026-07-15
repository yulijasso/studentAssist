/**
 * Tavily web search tool for the Campus Assist agent.
 *
 * Tenant context is injected via AsyncLocalStorage so the tool can access it
 * even when running inside the LangChain agent executor without passing it
 * as a function argument.
 *
 * The Tavily client is created once at module load time (singleton) so that
 * connection setup and module resolution overhead are not repeated on every
 * search call.
 */
import { AsyncLocalStorage } from "async_hooks";
import { tavily } from "@tavily/core";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { env } from "@/server/config";
import type { Tenant } from "@/server/db/schema";

/** Module-level Tavily client — created once, reused across all search calls. */
const tavilyClient = tavily({ apiKey: env.TAVILY_API_KEY });

// AsyncLocalStorage replaces Python's ContextVar
const tenantStorage = new AsyncLocalStorage<Tenant>();

export function setCurrentTenant<T>(tenant: Tenant, fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(tenant, fn);
}

export function getCurrentTenant(): Tenant {
  const tenant = tenantStorage.getStore();
  if (!tenant) throw new Error("No tenant in AsyncLocalStorage context");
  return tenant;
}

export const searchUniversityWebsite = tool(
  async ({ query }: { query: string }) => {
    const tenant = getCurrentTenant();

    try {
      const domains: string[] =
        (tenant.searchDomains as string[] | null)?.length
          ? (tenant.searchDomains as string[])
          : [tenant.websiteDomain];

      const response = await tavilyClient.search(query, {
        includeDomains: domains,
        searchDepth: "basic",
        maxResults: 3,
        timeout: 8000,
      });

      const results = (response.results ?? [])
        .filter((r: { score?: number }) => (r.score ?? 0) >= 0.3)
        .map((r: { title?: string; content?: string; url?: string }) => ({
          title: r.title ?? "",
          content: r.content ?? "",
          url: r.url ?? "",
        }));

      return JSON.stringify({ source: "university_website_live", results });
    } catch (err) {
      return JSON.stringify({
        source: "university_website_live",
        results: [],
        error: String(err),
      });
    }
  },
  {
    name: "search_university_website",
    description:
      "Search the institution's official website and approved domains for current information " +
      "about admissions, registration, tuition, financial aid, academics, housing, " +
      "student services, campus offices, deadlines, and university policies.",
    schema: z.object({
      query: z.string().describe("The search query to look up on the university website."),
    }),
  },
);
