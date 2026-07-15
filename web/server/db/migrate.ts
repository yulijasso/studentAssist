/**
 * Drizzle migration runner — applies pending SQL migrations from the
 * drizzle/migrations folder.
 *
 * Run via: `make db-migrate` (calls `tsx server/db/migrate.ts`)
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require("dotenv") as typeof import("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://campus_assist:campus_assist@localhost:5432/campus_assist";

/**
 * Connects to the database, applies all pending migrations, and exits.
 *
 * @throws Will exit with code 1 if the migration fails.
 */
async function runMigrations() {
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  console.log("Running migrations…");
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "migrations") });
  console.log("Migrations complete.");

  await client.end();
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
