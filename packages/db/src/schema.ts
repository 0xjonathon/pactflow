import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const pacts = pgTable("pacts", {
  address: text("address").primaryKey(),
  chainId: integer("chain_id").notNull(),
  client: text("client").notNull(),
  worker: text("worker"),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
