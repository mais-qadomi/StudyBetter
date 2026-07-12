import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { foldersTable } from "./folders";

export const bookmarksTable = pgTable("bookmarks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  folderId: text("folder_id").references(() => foldersTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  type: text("type", { enum: ["link", "note"] }).notNull(),
  url: text("url"),
  content: text("content"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBookmarkSchema = createInsertSchema(bookmarksTable).omit({ createdAt: true, updatedAt: true });
export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;
export type Bookmark = typeof bookmarksTable.$inferSelect;
