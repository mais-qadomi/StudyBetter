import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function check() {
  const users = await db.select().from(usersTable);
  console.log("Users found:", users.length);
  for (const u of users) {
    console.log("  -", u.email, "|", u.name, "|", u.id);
    const match = await bcrypt.compare("changeme123", u.passwordHash);
    console.log("    password match:", match);
    console.log("    hash prefix:", u.passwordHash.substring(0, 7));
  }

  // Also try creating a fresh user
  console.log("\nCreating fresh test user...");
  const hash = await bcrypt.hash("changeme123", 12);
  console.log("  New hash:", hash);
  const match = await bcrypt.compare("changeme123", hash);
  console.log("  Verify:", match);

  process.exit(0);
}

check().catch((err) => { console.error(err); process.exit(1); });
