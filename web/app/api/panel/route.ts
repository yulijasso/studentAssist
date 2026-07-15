/**
 * tRPC Panel — interactive UI for exploring and testing all tRPC procedures.
 *
 * Available at: GET /api/panel
 *
 * Renders a Swagger-like interface that lists every procedure with its Zod
 * input schema as a form and allows direct invocation from the browser.
 *
 * Restricted to non-production environments to avoid exposing internal API
 * structure in production.
 */
import { renderTrpcPanel } from "@metamorph/trpc-panel";
import { appRouter } from "@/server/trpc/root";

/**
 * Serves the tRPC Panel HTML page.
 *
 * @returns 200 HTML response in development, 404 in production.
 */
export function GET() {
  if (process.env.APP_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  return new Response(
    renderTrpcPanel(appRouter, {
      url: "/api/trpc",
      transformer: "superjson",
    }),
    {
      status: 200,
      headers: { "Content-Type": "text/html" },
    },
  );
}
