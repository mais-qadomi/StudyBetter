import { db, usersTable, projectsTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

async function migrate() {
  console.log("Starting migration: creating default user and linking orphaned data...");

  const existingUsers = await db.select().from(usersTable).limit(1);
  if (existingUsers.length > 0) {
    console.log("Users already exist. Skipping migration.");
    return;
  }

  const defaultPasswordHash = await bcrypt.hash("changeme123", 12);
  const defaultUserId = randomUUID();

  const [user] = await db
    .insert(usersTable)
    .values({
      id: defaultUserId,
      name: "المستخدم الافتراضي",
      email: "admin@studybetter.local",
      passwordHash: defaultPasswordHash,
    })
    .returning({ id: usersTable.id });

  console.log(`Created default user: ${user.id}`);

  const orphanedProjects = await db.select().from(projectsTable);
  for (const p of orphanedProjects) {
    await db.update(projectsTable).set({ userId: user.id }).where(eq(projectsTable.id, p.id));
  }
  console.log(`Linked ${orphanedProjects.length} projects to default user.`);

  const orphanedSessions = await db.select().from(sessionsTable);
  for (const s of orphanedSessions) {
    await db.update(sessionsTable).set({ userId: user.id }).where(eq(sessionsTable.id, s.id));
  }
  console.log(`Linked ${orphanedSessions.length} sessions to default user.`);

  console.log("Migration complete!");
  console.log("Default login: admin@studybetter.local / changeme123");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
