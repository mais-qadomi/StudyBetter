import { db, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

async function main() {
  const users = await db.select().from(usersTable);
  console.log("Users found:", users.length);
  for (const u of users) {
    console.log("  email:", u.email, "| name:", u.name, "| id:", u.id);
    const match = await bcrypt.compare("changeme123", u.passwordHash);
    console.log("  password 'changeme123' match:", match);
    console.log("  hash prefix:", u.passwordHash.substring(0, 7));
  }

  if (users.length === 0) {
    console.log("\nNo users found. Creating default user...");
    const hash = await bcrypt.hash("changeme123", 12);
    const id = randomUUID();
    await db.insert(usersTable).values({
      id,
      name: "المستخدم الافتراضي",
      email: "admin@studybetter.local",
      passwordHash: hash,
    });
    console.log("Created user:", id);
  }

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
