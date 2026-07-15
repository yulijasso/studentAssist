import { eq } from "drizzle-orm";
import type { DB } from "@/server/db";
import { users } from "@/server/db/schema";

export async function getUserByClerkId(db: DB, clerkId: string) {
  const rows = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return rows[0] ?? null;
}

export async function getOrCreateUser(
  db: DB,
  clerkId: string,
  email: string,
  name?: string | null,
) {
  const existing = await getUserByClerkId(db, clerkId);
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({ clerkId, email, name: name ?? null })
    .returning();
  return created;
}
