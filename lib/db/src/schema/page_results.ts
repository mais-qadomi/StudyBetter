import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";

export const pageResultsTable = pgTable("page_results", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  pageNumber: integer("page_number").notNull(),
  extractedText: text("extracted_text").notNull().default(""),
  translation: text("translation"),
  explanation: text("explanation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPageResultSchema = createInsertSchema(pageResultsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPageResult = z.infer<typeof insertPageResultSchema>;
export type PageResult = typeof pageResultsTable.$inferSelect;
