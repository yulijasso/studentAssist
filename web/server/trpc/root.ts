/**
 * Root tRPC router — aggregates all sub-routers into the top-level appRouter.
 *
 * Sub-routers:
 *   chat        — resident chat (send mutation)
 *   tenants     — admin tenant CRUD
 *   departments — admin department CRUD
 *   health      — liveness ping
 */
import { router } from "./init";
import { chatRouter } from "./routers/chat";
import { tenantsRouter } from "./routers/tenants";
import { departmentsRouter } from "./routers/departments";
import { knowledgeBaseRouter } from "./routers/knowledgeBase";
import { conversationsAdminRouter } from "./routers/conversationsAdmin";
import { settingsRouter } from "./routers/settings";
import { healthRouter } from "./routers/health";
import { macrosRouter } from "./routers/macros";
import { adminRouter } from "./routers/admin";
import { meRouter } from "./routers/me";

export const appRouter = router({
  chat: chatRouter,
  tenants: tenantsRouter,
  departments: departmentsRouter,
  knowledgeBase: knowledgeBaseRouter,
  conversationsAdmin: conversationsAdminRouter,
  settings: settingsRouter,
  macros: macrosRouter,
  health: healthRouter,
  admin: adminRouter,
  me: meRouter,
});

export type AppRouter = typeof appRouter;
