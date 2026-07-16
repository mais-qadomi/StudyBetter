import { Hono } from "hono";
import { getSql, type AuthUser } from "./_lib/db";
import {
  signToken,
  verifyToken,
  extractToken,
  setAuthCookie,
  clearAuthCookie,
  hashPasswordPBKDF2,
  comparePasswordPBKDF2,
} from "./_lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  GROQ_API_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  FRONTEND_URL?: string;
  NODE_ENV?: string;
}

const app = new Hono<{ Bindings: Env }>();

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function requireAuth(c: { env: Env; req: Request }): Promise<AuthUser | null> {
  const token = extractToken(c.req);
  if (!token) return null;
  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) return null;
  const sql = getSql(c.env.DATABASE_URL);
  const rows = await sql`SELECT id, name, email, avatar_url FROM users WHERE id = ${payload.id}`;
  if (rows.length === 0) return null;
  return { id: rows[0].id, name: rows[0].name, email: rows[0].email, avatarUrl: rows[0].avatar_url };
}

function authError() {
  return json({ error: "غير مصرح" }, 401);
}

// ============ HEALTH ============
app.get("/api/healthz", () => json({ status: "ok" }));

// ============ AUTH PROVIDERS ============
app.get("/api/auth/providers", (c) => {
  return json({ google: !!c.env.GOOGLE_CLIENT_ID });
});

// ============ REGISTER ============
app.post("/api/auth/register", async (c) => {
  const body = await c.req.json<{ name?: string; email?: string; password?: string }>();
  const { name, email, password } = body;

  if (!name?.trim() || !email?.trim() || !password) {
    return json({ error: "الاسم والبريد وكلمة المرور مطلوبة" }, 400);
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();

  if (trimmedName.length < 2) {
    return json({ error: "الاسم يجب أن يكون حرفين على الأقل" }, 400);
  }
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return json({ error: "البريد الإلكتروني غير صحيح" }, 400);
  }
  if (password.length < 8) {
    return json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, 400);
  }

  const sql = getSql(c.env.DATABASE_URL);
  const existing = await sql`SELECT id FROM users WHERE email = ${trimmedEmail}`;
  if (existing.length > 0) {
    return json({ error: "البريد الإلكتروني مستخدم بالفعل" }, 409);
  }

  const passwordHash = await hashPasswordPBKDF2(password);
  const userId = crypto.randomUUID();
  const rows = await sql`INSERT INTO users (id, name, email, password_hash) VALUES (${userId}, ${trimmedName}, ${trimmedEmail}, ${passwordHash}) RETURNING id, name, email, avatar_url`;

  const user: AuthUser = { id: rows[0].id, name: rows[0].name, email: rows[0].email, avatarUrl: rows[0].avatar_url };
  const token = await signToken(user, c.env.JWT_SECRET);
  return json({ user, token }, 201, { "Set-Cookie": setAuthCookie(token) });
});

// ============ LOGIN ============
app.post("/api/auth/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string; rememberMe?: boolean }>();
  const { email, password, rememberMe } = body;

  if (!email?.trim() || !password) {
    return json({ error: "البريد الإلكتروني وكلمة المرور مطلوبة" }, 400);
  }

  const trimmedEmail = email.trim().toLowerCase();
  const sql = getSql(c.env.DATABASE_URL);
  const rows = await sql`SELECT * FROM users WHERE email = ${trimmedEmail}`;

  if (rows.length === 0) {
    return json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }, 401);
  }

  const user = rows[0];

  if (!user.password_hash) {
    return json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }, 401);
  }

  if (user.locked_until && new Date() < new Date(user.locked_until)) {
    const remainingMs = new Date(user.locked_until).getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    return json({ error: `الحساب مقفل مؤقتاً. يرجى المحاولة بعد ${remainingMin} دقيقة`, lockedUntil: user.locked_until }, 423);
  }

  const cmpResult = await comparePasswordPBKDF2(password, user.password_hash);

  if (cmpResult === null) {
    // bcrypt hash — can't verify in Workers, ask user to reset password
    return json({ error: "يرجى إعادة تعيين كلمة المرور عبر نسيت كلمة المرور" }, 401);
  }

  if (!cmpResult) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    const updates: string[] = [];
    const params: unknown[] = [];

    if (attempts >= LOCKOUT_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      await sql`UPDATE users SET failed_login_attempts = 0, locked_until = ${lockUntil} WHERE id = ${user.id}`;
      return json({ error: `تم قفل الحساب مؤقتاً بسبب محاولات فاشلة متكررة. يرجى المحاولة بعد ${LOCKOUT_MINUTES} دقيقة`, lockedUntil: lockUntil }, 423);
    }

    await sql`UPDATE users SET failed_login_attempts = ${attempts} WHERE id = ${user.id}`;
    return json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }, 401);
  }

  await sql`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ${user.id}`;

  const authUser: AuthUser = { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatar_url };
  const token = await signToken(authUser, c.env.JWT_SECRET, rememberMe);
  return json({ user: authUser, token }, 200, { "Set-Cookie": setAuthCookie(token, rememberMe) });
});

// ============ ME ============
app.get("/api/auth/me", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  return json({ user });
});

// ============ LOGOUT ============
app.post("/api/auth/logout", () => {
  return json({ ok: true }, 200, { "Set-Cookie": clearAuthCookie() });
});

// ============ CHECK EMAIL ============
app.get("/api/auth/check-email", async (c) => {
  const email = c.req.query("email")?.trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    return json({ available: false });
  }
  const sql = getSql(c.env.DATABASE_URL);
  const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
  return json({ available: existing.length === 0 });
});

// ============ UPDATE PROFILE ============
app.patch("/api/user/profile", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const body = await c.req.json<{ name?: string; avatarUrl?: string }>();
  const sql = getSql(c.env.DATABASE_URL);

  if (body.name?.trim()) {
    const rows = await sql`UPDATE users SET name = ${body.name.trim()} WHERE id = ${user.id} RETURNING id, name, email, avatar_url`;
    return json({ user: { id: rows[0].id, name: rows[0].name, email: rows[0].email, avatarUrl: rows[0].avatar_url } });
  }
  if (body.avatarUrl !== undefined) {
    const rows = await sql`UPDATE users SET avatar_url = ${body.avatarUrl} WHERE id = ${user.id} RETURNING id, name, email, avatar_url`;
    return json({ user: { id: rows[0].id, name: rows[0].name, email: rows[0].email, avatarUrl: rows[0].avatar_url } });
  }

  return json({ error: "لا يوجد بيانات للتحديث" }, 400);
});

// ============ CHANGE PASSWORD ============
app.post("/api/user/password", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const body = await c.req.json<{ currentPassword?: string; newPassword?: string }>();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return json({ error: "كلمة المرور الحالية والجديدة مطلوبة" }, 400);
  }
  if (newPassword.length < 8) {
    return json({ error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" }, 400);
  }
  if (currentPassword === newPassword) {
    return json({ error: "كلمة المرور الجديدة مختلفة عن الحالية" }, 400);
  }

  const sql = getSql(c.env.DATABASE_URL);
  const rows = await sql`SELECT id, password_hash FROM users WHERE id = ${user.id}`;
  if (!rows[0]?.password_hash) {
    return json({ error: "الحساب لا يحتوي على كلمة مرور" }, 400);
  }

  const cmp = await comparePasswordPBKDF2(currentPassword, rows[0].password_hash);
  if (cmp === null || !cmp) {
    return json({ error: "كلمة المرور الحالية غير صحيحة" }, 401);
  }

  const newHash = await hashPasswordPBKDF2(newPassword);
  await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${user.id}`;
  return json({ ok: true });
});

// ============ DELETE ACCOUNT ============
app.delete("/api/user/account", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const body = await c.req.json<{ password?: string }>();

  if (!body.password) {
    return json({ error: "كلمة المرور مطلوبة لحذف الحساب" }, 400);
  }

  const sql = getSql(c.env.DATABASE_URL);
  const rows = await sql`SELECT id, password_hash FROM users WHERE id = ${user.id}`;
  if (!rows[0]?.password_hash) {
    return json({ error: "الحساب لا يحتوي على كلمة مرور" }, 400);
  }

  const cmp = await comparePasswordPBKDF2(body.password, rows[0].password_hash);
  if (cmp === null || !cmp) {
    return json({ error: "كلمة المرور غير صحيحة" }, 401);
  }

  await sql`DELETE FROM sessions WHERE user_id = ${user.id}`;
  await sql`DELETE FROM projects WHERE user_id = ${user.id}`;
  await sql`DELETE FROM users WHERE id = ${user.id}`;
  return json({ ok: true }, 200, { "Set-Cookie": clearAuthCookie() });
});

// ============ FORGOT PASSWORD ============
app.post("/api/auth/forgot-password", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  if (!body.email?.trim()) {
    return json({ error: "البريد الإلكتروني مطلوب" }, 400);
  }
  const trimmedEmail = body.email.trim().toLowerCase();
  const sql = getSql(c.env.DATABASE_URL);
  const rows = await sql`SELECT id FROM users WHERE email = ${trimmedEmail}`;

  if (rows.length === 0) {
    return json({ ok: true, message: "إذا كان البريد مسجّلاً، ستصل رسالة إعادة التعيين" });
  }

  const resetToken = crypto.randomUUID();
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await sql`UPDATE users SET password_reset_token = ${resetToken}, password_reset_expires = ${resetExpires} WHERE id = ${rows[0].id}`;

  const frontendUrl = c.env.FRONTEND_URL || "http://localhost:5173";
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
  console.log(`\n Password Reset Link:\n${resetUrl}\n`);

  return json({ ok: true, message: "إذا كان البريد مسجّلاً، ستصل رسالة إعادة التعيين" });
});

// ============ RESET PASSWORD ============
app.post("/api/auth/reset-password", async (c) => {
  const body = await c.req.json<{ token?: string; newPassword?: string }>();
  const { token, newPassword } = body;

  if (!token || !newPassword) {
    return json({ error: "التوكن وكلمة المرور الجديدة مطلوبة" }, 400);
  }
  if (newPassword.length < 8) {
    return json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, 400);
  }

  const sql = getSql(c.env.DATABASE_URL);
  const rows = await sql`SELECT id, password_reset_expires FROM users WHERE password_reset_token = ${token}`;

  if (rows.length === 0 || !rows[0].password_reset_expires) {
    return json({ error: "توكن غير صالح أو منتهي" }, 400);
  }

  if (new Date() > new Date(rows[0].password_reset_expires)) {
    return json({ error: "انتهت صلاحية التوكن. يرجى طلب رابط جديد" }, 400);
  }

  const newHash = await hashPasswordPBKDF2(newPassword);
  await sql`UPDATE users SET password_hash = ${newHash}, password_reset_token = NULL, password_reset_expires = NULL, failed_login_attempts = 0, locked_until = NULL WHERE id = ${rows[0].id}`;
  return json({ ok: true });
});

// ============ SESSIONS ============

// GET /api/sessions/:id
app.get("/api/sessions/:id", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const id = c.req.param("id");
  const sql = getSql(c.env.DATABASE_URL);

  const sessions = await sql`SELECT * FROM sessions WHERE id = ${id} AND user_id = ${user.id}`;
  if (sessions.length === 0) return json({ error: "session not found" }, 404);

  const pages = await sql`SELECT * FROM page_results WHERE session_id = ${id} ORDER BY page_number`;
  return json({ session: sessions[0], pages });
});

// POST /api/sessions
app.post("/api/sessions", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const body = await c.req.json<{ sessionId: string; fileName: string; fileSize: number; numPages: number; projectId?: string }>();
  const { sessionId, fileName, fileSize, numPages, projectId } = body;

  if (!sessionId || !fileName) {
    return json({ error: "sessionId and fileName required" }, 400);
  }

  const sql = getSql(c.env.DATABASE_URL);
  const existing = await sql`SELECT id FROM sessions WHERE id = ${sessionId} AND user_id = ${user.id}`;

  if (existing.length > 0) {
    const rows = await sql`UPDATE sessions SET file_name = ${fileName}, file_size = ${fileSize}, num_pages = ${numPages}, project_id = ${projectId ?? null} WHERE id = ${sessionId} RETURNING *`;
    return json(rows[0]);
  }

  const rows = await sql`INSERT INTO sessions (id, file_name, file_size, num_pages, project_id, user_id) VALUES (${sessionId}, ${fileName}, ${fileSize}, ${numPages}, ${projectId ?? null}, ${user.id}) RETURNING *`;
  return json(rows[0]);
});

// PUT /api/sessions/:id/pages/:pageNum
app.put("/api/sessions/:id/pages/:pageNum", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const { id, pageNum } = c.req.param();
  const pageNumber = parseInt(pageNum, 10);
  if (isNaN(pageNumber)) return json({ error: "invalid page number" }, 400);

  const body = await c.req.json<{ extractedText?: string; translation?: string | null; explanation?: string }>();
  const sql = getSql(c.env.DATABASE_URL);

  const sessionExists = await sql`SELECT id FROM sessions WHERE id = ${id} AND user_id = ${user.id}`;
  if (sessionExists.length === 0) return json({ error: "session not found" }, 404);

  const existing = await sql`SELECT id FROM page_results WHERE session_id = ${id} AND page_number = ${pageNumber}`;

  if (existing.length > 0) {
    const updates: string[] = [];
    const vals: unknown[] = [];
    if (body.extractedText !== undefined) { updates.push("extracted_text"); vals.push(body.extractedText); }
    if (body.translation !== undefined) { updates.push("translation"); vals.push(body.translation); }
    if (body.explanation !== undefined) { updates.push("explanation"); vals.push(body.explanation); }
    if (updates.length > 0) {
      const rows = await sql`UPDATE page_results SET extracted_text = COALESCE(${body.extractedText ?? null}, extracted_text), translation = ${body.translation ?? null}, explanation = ${body.explanation ?? null}, updated_at = NOW() WHERE session_id = ${id} AND page_number = ${pageNumber} RETURNING *`;
      return json(rows[0]);
    }
    const rows = await sql`SELECT * FROM page_results WHERE session_id = ${id} AND page_number = ${pageNumber}`;
    return json(rows[0]);
  }

  const rows = await sql`INSERT INTO page_results (session_id, page_number, extracted_text, translation, explanation) VALUES (${id}, ${pageNumber}, ${body.extractedText ?? ""}, ${body.translation ?? null}, ${body.explanation ?? null}) RETURNING *`;
  return json(rows[0]);
});

// DELETE /api/sessions/:id
app.delete("/api/sessions/:id", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const id = c.req.param("id");
  const sql = getSql(c.env.DATABASE_URL);

  const sessions = await sql`SELECT id FROM sessions WHERE id = ${id} AND user_id = ${user.id}`;
  if (sessions.length === 0) return json({ error: "session not found" }, 404);

  await sql`DELETE FROM sessions WHERE id = ${id}`;
  return json({ ok: true });
});

// PATCH /api/sessions/:id/project
app.patch("/api/sessions/:id/project", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const id = c.req.param("id");
  const body = await c.req.json<{ projectId: string | null }>();
  const sql = getSql(c.env.DATABASE_URL);

  const sessions = await sql`SELECT id FROM sessions WHERE id = ${id} AND user_id = ${user.id}`;
  if (sessions.length === 0) return json({ error: "session not found" }, 404);

  const rows = await sql`UPDATE sessions SET project_id = ${body.projectId} WHERE id = ${id} RETURNING *`;
  return json(rows[0]);
});

// PATCH /api/sessions/:id/rename
app.patch("/api/sessions/:id/rename", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const id = c.req.param("id");
  const body = await c.req.json<{ fileName?: string }>();
  if (!body.fileName?.trim()) return json({ error: "fileName is required" }, 400);

  const sql = getSql(c.env.DATABASE_URL);
  const sessions = await sql`SELECT id FROM sessions WHERE id = ${id} AND user_id = ${user.id}`;
  if (sessions.length === 0) return json({ error: "session not found" }, 404);

  await sql`UPDATE sessions SET file_name = ${body.fileName.trim()}, updated_at = NOW() WHERE id = ${id}`;
  return json({ ok: true });
});

// PATCH /api/sessions/:id/folder
app.patch("/api/sessions/:id/folder", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const id = c.req.param("id");
  const body = await c.req.json<{ folderId: string | null }>();
  const sql = getSql(c.env.DATABASE_URL);

  const sessions = await sql`SELECT id FROM sessions WHERE id = ${id} AND user_id = ${user.id}`;
  if (sessions.length === 0) return json({ error: "session not found" }, 404);

  const rows = await sql`UPDATE sessions SET folder_id = ${body.folderId} WHERE id = ${id} RETURNING *`;
  return json(rows[0]);
});

// ============ PROJECTS ============

// GET /api/projects
app.get("/api/projects", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const sql = getSql(c.env.DATABASE_URL);
  const projects = await sql`SELECT * FROM projects WHERE user_id = ${user.id} ORDER BY created_at`;
  return json(projects);
});

// GET /api/projects/:id
app.get("/api/projects/:id", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const id = c.req.param("id");
  const sql = getSql(c.env.DATABASE_URL);

  const projects = await sql`SELECT * FROM projects WHERE id = ${id} AND user_id = ${user.id}`;
  if (projects.length === 0) return json({ error: "project not found" }, 404);

  const sessions = await sql`SELECT * FROM sessions WHERE project_id = ${id} AND user_id = ${user.id} ORDER BY created_at`;
  const folders = await sql`SELECT * FROM folders WHERE project_id = ${id} ORDER BY created_at`;
  return json({ project: projects[0], sessions, folders });
});

// POST /api/projects
app.post("/api/projects", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const body = await c.req.json<{ name: string; description?: string }>();
  if (!body.name?.trim()) return json({ error: "name is required" }, 400);

  const sql = getSql(c.env.DATABASE_URL);
  const id = crypto.randomUUID();
  const rows = await sql`INSERT INTO projects (id, name, description, user_id) VALUES (${id}, ${body.name.trim()}, ${body.description?.trim() ?? null}, ${user.id}) RETURNING *`;
  return json(rows[0]);
});

// PATCH /api/projects/:id
app.patch("/api/projects/:id", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; description?: string }>();
  const sql = getSql(c.env.DATABASE_URL);

  const existing = await sql`SELECT id FROM projects WHERE id = ${id} AND user_id = ${user.id}`;
  if (existing.length === 0) return json({ error: "project not found" }, 404);

  const rows = await sql`UPDATE projects SET name = COALESCE(${body.name?.trim() ?? null}, name), description = ${body.description?.trim() ?? null}, updated_at = NOW() WHERE id = ${id} RETURNING *`;
  return json(rows[0]);
});

// DELETE /api/projects/:id
app.delete("/api/projects/:id", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const id = c.req.param("id");
  const sql = getSql(c.env.DATABASE_URL);

  const existing = await sql`SELECT id FROM projects WHERE id = ${id} AND user_id = ${user.id}`;
  if (existing.length === 0) return json({ error: "project not found" }, 404);

  await sql`DELETE FROM projects WHERE id = ${id}`;
  return json({ ok: true });
});

// ============ FOLDERS ============

// POST /api/folders
app.post("/api/folders", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const body = await c.req.json<{ name: string; projectId: string; parentFolderId?: string | null }>();
  if (!body.name?.trim() || !body.projectId) return json({ error: "name and projectId required" }, 400);

  const sql = getSql(c.env.DATABASE_URL);
  const projCheck = await sql`SELECT id FROM projects WHERE id = ${body.projectId} AND user_id = ${user.id}`;
  if (projCheck.length === 0) return json({ error: "project not found" }, 404);

  const allFolders = await sql`SELECT * FROM folders WHERE project_id = ${body.projectId} ORDER BY "order"`;
  const maxOrder = allFolders.length > 0 ? allFolders[allFolders.length - 1].order : -1;
  const id = crypto.randomUUID();

  const rows = await sql`INSERT INTO folders (id, name, project_id, parent_folder_id, "order") VALUES (${id}, ${body.name.trim()}, ${body.projectId}, ${body.parentFolderId ?? null}, ${maxOrder + 1}) RETURNING *`;
  return json(rows[0]);
});

// PATCH /api/folders/:id
app.patch("/api/folders/:id", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; parentFolderId?: string | null }>();
  const sql = getSql(c.env.DATABASE_URL);

  const folders = await sql`SELECT f.id FROM folders f JOIN projects p ON f.project_id = p.id WHERE f.id = ${id} AND p.user_id = ${user.id}`;
  if (folders.length === 0) return json({ error: "folder not found" }, 404);

  const rows = await sql`UPDATE folders SET name = COALESCE(${body.name?.trim() ?? null}, name), parent_folder_id = ${body.parentFolderId ?? null}, updated_at = NOW() WHERE id = ${id} RETURNING *`;
  return json(rows[0]);
});

// DELETE /api/folders/:id
app.delete("/api/folders/:id", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const id = c.req.param("id");
  const sql = getSql(c.env.DATABASE_URL);

  const folders = await sql`SELECT f.id FROM folders f JOIN projects p ON f.project_id = p.id WHERE f.id = ${id} AND p.user_id = ${user.id}`;
  if (folders.length === 0) return json({ error: "folder not found" }, 404);

  await sql`DELETE FROM folders WHERE id = ${id}`;
  return json({ ok: true });
});

// PATCH /api/folders/reorder
app.patch("/api/folders/reorder", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const body = await c.req.json<{ folderIds: string[] }>();
  if (!Array.isArray(body.folderIds)) return json({ error: "folderIds array required" }, 400);

  const sql = getSql(c.env.DATABASE_URL);
  for (let i = 0; i < body.folderIds.length; i++) {
    const folders = await sql`SELECT f.id FROM folders f JOIN projects p ON f.project_id = p.id WHERE f.id = ${body.folderIds[i]} AND p.user_id = ${user.id}`;
    if (folders.length === 0) return json({ error: `folder ${body.folderIds[i]} not found` }, 404);
    await sql`UPDATE folders SET "order" = ${i} WHERE id = ${body.folderIds[i]}`;
  }
  return json({ ok: true });
});

// ============ FILES / FEATURES ============

// GET /api/files/:fileId/features
app.get("/api/files/:fileId/features", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const fileId = c.req.param("fileId");
  const sql = getSql(c.env.DATABASE_URL);

  const sessions = await sql`SELECT * FROM sessions WHERE id = ${fileId} AND user_id = ${user.id}`;
  if (sessions.length === 0) return json({ error: "file not found" }, 404);

  const results = await sql`SELECT * FROM feature_results WHERE file_id = ${fileId} ORDER BY created_at DESC`;

  const LIVE_FEATURES = ["explanation"];
  const COMING_SOON = ["summary", "quiz", "flashcards", "translation"];
  const appliedTypes = new Set(results.map((r: { feature_type: string }) => r.feature_type));
  const availableFeatures = [
    ...LIVE_FEATURES.map((t) => ({ type: t, status: "live" as const, alreadyApplied: appliedTypes.has(t) })),
    ...COMING_SOON.map((t) => ({ type: t, status: "coming_soon" as const, alreadyApplied: appliedTypes.has(t) })),
  ];

  return json({ file: sessions[0], results, availableFeatures });
});

// POST /api/files/:fileId/features/:featureType
app.post("/api/files/:fileId/features/:featureType", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const fileId = c.req.param("fileId");
  const featureType = c.req.param("featureType");
  const body = await c.req.json<{ text?: string }>();
  const sql = getSql(c.env.DATABASE_URL);

  if (!body.text?.trim()) return json({ error: "text is required" }, 400);
  if (featureType !== "explanation") return json({ error: "feature type is not available" }, 400);

  const sessions = await sql`SELECT id FROM sessions WHERE id = ${fileId} AND user_id = ${user.id}`;
  if (sessions.length === 0) return json({ error: "file not found" }, 404);

  const id = crypto.randomUUID();
  await sql`INSERT INTO feature_results (id, file_id, feature_type, status) VALUES (${id}, ${fileId}, ${featureType}, 'processing')`;

  const apiKey = c.env.GROQ_API_KEY;
  if (!apiKey) {
    await sql`UPDATE feature_results SET status = 'failed', result_data = ${JSON.stringify({ error: "GROQ_API_KEY not configured" })} WHERE id = ${id}`;
    return json({ error: "GROQ_API_KEY not configured" }, 500);
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: 'You are a brilliant professor. Explain the given text in deep Arabic with English terms preserved. Respond in JSON: { "explanation": "..." }' },
          { role: "user", content: body.text },
        ],
        max_tokens: 3000,
        temperature: 0.4,
      }),
    });

    if (!response.ok) throw new Error(`Groq API error: ${response.status}`);
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: { explanation?: string };
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const jsonMatch = /\{[\s\S]*\}/.exec(cleaned);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    } catch {
      parsed = { explanation: raw };
    }

    const rows = await sql`UPDATE feature_results SET status = 'completed', result_data = ${JSON.stringify(parsed)}, updated_at = NOW() WHERE id = ${id} RETURNING *`;
    return json(rows[0]);
  } catch (err) {
    await sql`UPDATE feature_results SET status = 'failed', result_data = ${JSON.stringify({ error: String(err) })}, updated_at = NOW() WHERE id = ${id}`;
    const rows = await sql`SELECT * FROM feature_results WHERE id = ${id}`;
    return json(rows[0], 502);
  }
});

// ============ EXPLAIN ============
const SYSTEM_PROMPT = `You are a brilliant Arab university professor specialized in Computer Networks and Computer Science, with decades of teaching experience. Your explanations are legendary among students for being deep, clear, and intellectually engaging.

The user will send you text extracted from English lecture slides.

## Language & Style
- Write exclusively in formal, eloquent Modern Standard Arabic.
- Every English scientific term must appear naturally embedded within the Arabic sentence, written in English immediately after its Arabic translation in parentheses, like: خوارزمية الترتيب المستقر (Stable Sorting). NEVER drop the English term.
- Your tone is that of a passionate, knowledgeable professor explaining face-to-face.

## Formatting markers (mandatory)
- Section headings: [H] ... [/H]
- English terms inline: [EN] ... [/EN]
- Professor insight notes: [NOTE] ... [/NOTE]
- Exam-critical alerts: [PIN] ... [/PIN]
- Quick summary: [SUM] ... [/SUM]
- Real-world examples: [EX] ... [/EX]

Respond ONLY in valid JSON:
{
  "language": "english",
  "translation": null,
  "explanation": "your full structured Arabic explanation here"
}`;

const VISION_SYSTEM_PROMPT = `You are a brilliant Arab university professor specialized in Computer Networks and Computer Science. The user will send you content from lecture slides, possibly including images. Read ALL visible text, describe diagrams/charts, combine text+images into one coherent Arabic explanation. Use same formatting markers: [H], [EN], [NOTE], [PIN], [SUM], [EX]. Respond ONLY in valid JSON: { "language": "english", "translation": null, "explanation": "..." }`;

const GROQ_MODELS = ["llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct", "llama-3.1-8b-instant"];
const MAX_ATTEMPTS = 5;
const MAX_RETRY_SLEEP_MS = 20_000;

function parseGroqResponse(raw: string) {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const jsonMatch = /\{[\s\S]*\}/.exec(cleaned);
  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    return { language: parsed.language ?? "unknown", translation: parsed.translation ?? null, explanation: parsed.explanation ?? "" };
  } catch {
    return { language: "unknown", translation: null, explanation: raw };
  }
}

function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("aborted")); return; }
    const tid = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(tid); reject(new Error("aborted")); }, { once: true });
  });
}

async function callGroqWithModel(apiKey: string, text: string, model: string, signal: AbortSignal, attempt = 1): Promise<{ result: ReturnType<typeof parseGroqResponse>; rateLimited?: boolean }> {
  if (signal.aborted) throw new Error("انتهت مهلة المعالجة. يرجى المحاولة مجدداً.");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }], max_tokens: 3000, temperature: 0.4 }),
    signal,
  });

  if (response.status === 429) {
    if (attempt >= MAX_ATTEMPTS) return { result: parseGroqResponse(""), rateLimited: true };
    const retryAfterHeader = response.headers.get("retry-after");
    let waitMs = 8000;
    if (retryAfterHeader) {
      const secs = parseFloat(retryAfterHeader);
      if (!isNaN(secs)) waitMs = Math.min(Math.ceil(secs) * 1000 + 500, MAX_RETRY_SLEEP_MS);
    } else {
      try {
        const body = (await response.json()) as { error?: { message?: string } };
        const msg = body?.error?.message ?? "";
        const match = /try again in ([\d.]+)s/i.exec(msg);
        if (match) waitMs = Math.min(Math.ceil(parseFloat(match[1])) * 1000 + 500, MAX_RETRY_SLEEP_MS);
      } catch { /* ignore */ }
    }
    await sleepAbortable(waitMs, signal);
    return callGroqWithModel(apiKey, text, model, signal, attempt + 1);
  }

  if (!response.ok) {
    let errBody = "";
    try { errBody = await response.text(); } catch { /* ignore */ }
    throw new Error(`Groq error (${response.status}): ${errBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return { result: parseGroqResponse(data.choices?.[0]?.message?.content ?? "{}") };
}

async function callGroq(apiKey: string, text: string, signal: AbortSignal) {
  for (const model of GROQ_MODELS) {
    const { result, rateLimited } = await callGroqWithModel(apiKey, text, model, signal);
    if (!rateLimited) return result;
  }
  throw new Error("تجاوز الحد المسموح به من الطلبات على جميع النماذج.");
}

app.post("/api/explain", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();

  const body = await c.req.json<{ text?: string; images?: string[] }>();
  if ((!body.text || body.text.trim().length === 0) && (!body.images || body.images.length === 0)) {
    return json({ error: "النص أو الصور مطلوبة" }, 400);
  }

  const apiKey = c.env.GROQ_API_KEY;
  if (!apiKey) return json({ error: "مفتاح Groq API غير مضبوط" }, 500);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);

  try {
    if (body.images && body.images.length > 0) {
      const content: unknown[] = [{ type: "text", text: body.text || "(هذه الصفحة لا تحتوي على نص رقمي)" }];
      for (const img of body.images) content.push({ type: "image_url", image_url: { url: img } });

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [{ role: "system", content: VISION_SYSTEM_PROMPT }, { role: "user", content }],
          max_completion_tokens: 3000,
          temperature: 0.4,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Groq Vision error: ${response.status}`);
      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      return json(parseGroqResponse(data.choices?.[0]?.message?.content ?? "{}"));
    }

    const result = await callGroq(apiKey, body.text!, controller.signal);
    clearTimeout(timeoutId);
    return json(result);
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : "خطأ غير معروف";
    return json({ error: message }, 502);
  }
});

// ============ BOOKMARKS ============

// GET /api/bookmarks/:projectId
app.get("/api/bookmarks/:projectId", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const projectId = c.req.param("projectId");
  const sql = getSql(c.env.DATABASE_URL);

  const projCheck = await sql`SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${user.id}`;
  if (projCheck.length === 0) return json({ error: "project not found" }, 404);

  const bookmarks = await sql`SELECT * FROM bookmarks WHERE project_id = ${projectId} ORDER BY "order"`;
  return json(bookmarks);
});

// POST /api/bookmarks
app.post("/api/bookmarks", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const body = await c.req.json<{ projectId: string; folderId?: string | null; name: string; type: string; url?: string | null; content?: string | null }>();
  if (!body.projectId || !body.name?.trim() || !body.type) return json({ error: "projectId, name, and type required" }, 400);

  const sql = getSql(c.env.DATABASE_URL);
  const projCheck = await sql`SELECT id FROM projects WHERE id = ${body.projectId} AND user_id = ${user.id}`;
  if (projCheck.length === 0) return json({ error: "project not found" }, 404);

  const allBookmarks = await sql`SELECT * FROM bookmarks WHERE project_id = ${body.projectId} ORDER BY "order"`;
  const maxOrder = allBookmarks.length > 0 ? allBookmarks[allBookmarks.length - 1].order : -1;
  const id = crypto.randomUUID();

  const rows = await sql`INSERT INTO bookmarks (id, project_id, folder_id, name, type, url, content, "order") VALUES (${id}, ${body.projectId}, ${body.folderId ?? null}, ${body.name.trim()}, ${body.type}, ${body.url ?? null}, ${body.content ?? null}, ${maxOrder + 1}) RETURNING *`;
  return json(rows[0]);
});

// PATCH /api/bookmarks/:id
app.patch("/api/bookmarks/:id", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; folderId?: string | null; url?: string | null; content?: string | null }>();
  const sql = getSql(c.env.DATABASE_URL);

  const check = await sql`SELECT b.id FROM bookmarks b JOIN projects p ON b.project_id = p.id WHERE b.id = ${id} AND p.user_id = ${user.id}`;
  if (check.length === 0) return json({ error: "bookmark not found" }, 404);

  const rows = await sql`UPDATE bookmarks SET name = COALESCE(${body.name?.trim() ?? null}, name), folder_id = ${body.folderId ?? null}, url = ${body.url ?? null}, content = ${body.content ?? null}, updated_at = NOW() WHERE id = ${id} RETURNING *`;
  return json(rows[0]);
});

// DELETE /api/bookmarks/:id
app.delete("/api/bookmarks/:id", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  const id = c.req.param("id");
  const sql = getSql(c.env.DATABASE_URL);

  const check = await sql`SELECT b.id FROM bookmarks b JOIN projects p ON b.project_id = p.id WHERE b.id = ${id} AND p.user_id = ${user.id}`;
  if (check.length === 0) return json({ error: "bookmark not found" }, 404);

  await sql`DELETE FROM bookmarks WHERE id = ${id}`;
  return json({ ok: true });
});

// ============ SHARE ============
// Share routes are simplified for Workers (no filesystem access).
// For now, return a 501 for share operations.
app.post("/api/share", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  return json({ error: "Share is not available in this deployment" }, 501);
});

app.get("/api/share/:token", (c) => {
  return json({ error: "Share is not available in this deployment" }, 501);
});

app.post("/api/share/:token/revoke", async (c) => {
  const user = await requireAuth(c);
  if (!user) return authError();
  return json({ error: "Share is not available in this deployment" }, 501);
});

// ============ CATCH-ALL ============
app.all("*", () => json({ error: "Not found" }, 404));

// ============ EXPORT ============
export const onRequest: PagesFunction<Env> = async (context) => {
  try {
    return await app.fetch(context.request, context.env, context);
  } catch (err) {
    console.error("Worker error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};
