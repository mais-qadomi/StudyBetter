import { pgTable, text, integer, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const foldersTable = pgTable("folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  parentFolderId: text("parent_folder_id").references((): AnyPgColumn => foldersTable.id, { onDelete: "set null" }),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFolderSchema = createInsertSchema(foldersTable).omit({ createdAt: true, updatedAt: true });
export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type Folder = typeof foldersTable.$inferSelect;
