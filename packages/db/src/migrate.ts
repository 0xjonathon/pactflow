import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";

config({ path: resolve(process.cwd(), "../../.env.local"), quiet: true });
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required in root .env.local");
if (url.startsWith("pglite:")) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Production migrations require PostgreSQL");
  const directory = url.slice("pglite:".length);
  mkdirSync(dirname(directory), { recursive: true });
  const client = new PGlite(directory);
  try {
    await migratePglite(drizzlePglite(client), {
      migrationsFolder: resolve(process.cwd(), "drizzle"),
    });
  } finally {
    await client.close();
  }
} else {
  const sql = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(sql), {
      migrationsFolder: resolve(process.cwd(), "drizzle"),
    });
  } finally {
    await sql.end();
  }
}
console.log("Verification database migrations applied");
