import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";

export const featureResultsTable = pgTable("feature_results", {
  id: text("id").primaryKey(),
  fileId: text("file_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  featureType: text("feature_type", { enum: ["explanation", "summary", "quiz", "flashcards", "translation"] }).notNull(),
  status: text("status", { enum: ["processing", "completed", "failed"] }).notNull().default("processing"),
  resultData: text("result_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFeatureResultSchema = createInsertSchema(featureResultsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFeatureResult = z.infer<typeof insertFeatureResultSchema>;
export type FeatureResult = typeof featureResultsTable.$inferSelect;
