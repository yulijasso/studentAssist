import type { Config } from "drizzle-kit";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require("dotenv") as typeof import("dotenv");
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export default {
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://campus_assist:campus_assist@localhost:5432/campus_assist",
  },
} satisfies Config;
