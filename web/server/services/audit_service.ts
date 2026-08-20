/**
 * Audit logging for platform governance actions.
 *
 * `recordAudit` is best-effort — it never throws, so an audit-write failure can
 * never break the action being audited. Actor/target labels are denormalized at
 * write time so entries stay readable even after the referenced rows are deleted.
 */
import { desc, eq } from "drizzle-orm";
import type { DB } from "@/server/db/index";
import { auditLogs, users } from "@/server/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuditActor {
  userId: string | null;
  clerkId: string | null;
}

export interface RecordAuditOpts {
  actor: AuditActor;
  /** Dotted action, e.g. "institution.delete", "role.assign", "user.deactivate". */
  action: string;
  /** "institution" | "user" | "member" | "role" | ... */
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  tenantId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Records a governance action. Resolves the actor's display label from the users
 * table when possible; falls back to the Clerk id. Swallows all errors.
 */
export async function recordAudit(db: DB, opts: RecordAuditOpts): Promise<void> {
  try {
    const actorUserId =
      opts.actor.userId && UUID_RE.test(opts.actor.userId) ? opts.actor.userId : null;

    let actorLabel = opts.actor.clerkId ?? "system";
    if (actorUserId) {
      const [u] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, actorUserId))
        .limit(1);
      if (u) actorLabel = u.name ?? u.email ?? actorLabel;
    }

    await db.insert(auditLogs).values({
      action: opts.action,
      actorUserId,
      actorLabel,
      targetType: opts.targetType,
      targetId: opts.targetId ?? null,
      targetLabel: opts.targetLabel ?? null,
      tenantId: opts.tenantId ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch {
    // Never let audit logging break the underlying action.
  }
}

/**
 * Builds a `{ field: { from, to } }` diff for the given keys, including only
 * fields whose value actually changed. Keys in `redactKeys` have their values
 * masked (for secrets like API keys).
 */
export function computeDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  keys: string[],
  redactKeys: string[] = [],
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of keys) {
    const b = before?.[k] ?? null;
    const a = after?.[k] ?? null;
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    out[k] = redactKeys.includes(k)
      ? { from: b ? "***" : null, to: a ? "***" : null }
      : { from: b, to: a };
  }
  return out;
}

/** Returns the most recent audit entries, newest first. */
export async function listAuditLogs(db: DB, limit = 200) {
  return db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
