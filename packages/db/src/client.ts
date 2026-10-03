import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";

export function connectDatabase(url: string) {
  if (url.startsWith("pglite:")) {
    if (process.env.NODE_ENV === "production") throw new Error("PGlite is for local development only");
    const directory = url.slice("pglite:".length);
    mkdirSync(dirname(directory), { recursive: true });
    const client = new PGlite(directory);
    return { db: drizzlePglite(client, { schema }) as unknown as ReturnType<typeof drizzle<typeof schema>>, close: () => client.close() };
  }
  const sql = postgres(url, { max: 5 });
  const db = drizzle(sql, { schema });
  return { db, close: () => sql.end() };
}
export type PactFlowDatabase = ReturnType<typeof connectDatabase>["db"];
