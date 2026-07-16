import { Router, type IRouter } from "express";
import { db, usersTable, projectsTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  hashPassword,
  comparePassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  type AuthUser,
} from "../lib/auth";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const router: IRouter = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// ===== AUTH PROVIDERS =====
router.get("/auth/providers", (_req, res) => {
  res.json({
    google: !!GOOGLE_CLIENT_ID,
  });
});

// ===== REGISTER =====
router.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name?.trim() || !email?.trim() || !password) {
    res.status(400).json({ error: "الاسم والبريد وكلمة المرور مطلوبة" });
    return;
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();

  if (trimmedName.length < 2) {
    res.status(400).json({ error: "الاسم يجب أن يكون حرفين على الأقل" });
    return;
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    res.status(400).json({ error: "البريد الإلكتروني غير صحيح" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
    return;
  }

  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, trimmedEmail),
  });

  if (existing) {
    res.status(409).json({ error: "البريد الإلكتروني مستخدم بالفعل" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const userId = randomUUID();

  const [created] = await db
    .insert(usersTable)
    .values({
      id: userId,
      name: trimmedName,
      email: trimmedEmail,
      passwordHash,
    })
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, avatarUrl: usersTable.avatarUrl });

  const user: AuthUser = { id: created.id, name: created.name, email: created.email, avatarUrl: created.avatarUrl };
  const token = signToken(user);
  setAuthCookie(res, token);

  res.status(201).json({ user, token });
});

// ===== LOGIN =====
router.post("/auth/login", async (req, res) => {
  const { email, password, rememberMe } = req.body as {
    email?: string;
    password?: string;
    rememberMe?: boolean;
  };

  if (!email?.trim() || !password) {
    res.status(400).json({ error: "البريد الإلكتروني وكلمة المرور مطلوبة" });
    return;
  }

  const trimmedEmail = email.trim().toLowerCase();

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, trimmedEmail),
  });

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    return;
  }

  if (user.lockedUntil && new Date() < user.lockedUntil) {
    const remainingMs = user.lockedUntil.getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    res.status(423).json({
      error: `الحساب مقفل مؤقتاً. يرجى المحاولة بعد ${remainingMin} دقيقة`,
      lockedUntil: user.lockedUntil.toISOString(),
    });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);

  if (!valid) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const updates: Record<string, unknown> = { failedLoginAttempts: attempts };

    if (attempts >= LOCKOUT_ATTEMPTS) {
      updates.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      updates.failedLoginAttempts = 0;
    }

    await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));

    if (attempts >= LOCKOUT_ATTEMPTS) {
      res.status(423).json({
        error: `تم قفل الحساب مؤقتاً بسبب محاولات فاشلة متكررة. يرجى المحاولة بعد ${LOCKOUT_MINUTES} دقيقة`,
        lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString(),
      });
      return;
    }

    res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    return;
  }

  await db
    .update(usersTable)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(usersTable.id, user.id));

  const authUser: AuthUser = { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl };
  const token = signToken(authUser, rememberMe);
  setAuthCookie(res, token, rememberMe);

  res.json({ user: authUser, token });
});

// ===== ME =====
router.get("/auth/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

// ===== LOGOUT =====
router.post("/auth/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// ===== CHECK EMAIL =====
router.get("/auth/check-email", async (req, res) => {
  const email = (req.query.email as string)?.trim().toLowerCase();

  if (!email || !EMAIL_REGEX.test(email)) {
    res.json({ available: false });
    return;
  }

  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
    columns: { id: true },
  });

  res.json({ available: !existing });
});

// ===== UPDATE PROFILE =====
router.patch("/user/profile", requireAuth, async (req, res) => {
  const { name, avatarUrl } = req.body as { name?: string; avatarUrl?: string };

  const updates: Record<string, unknown> = {};
  if (name?.trim()) updates.name = name.trim();
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "لا يوجد بيانات للتحديث" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user!.id))
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, avatarUrl: usersTable.avatarUrl });

  res.json({ user: updated });
});

// ===== CHANGE PASSWORD =====
router.post("/user/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "كلمة المرور الحالية والجديدة مطلوبة" });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" });
    return;
  }

  if (currentPassword === newPassword) {
    res.status(400).json({ error: "كلمة المرور الجديدة مختلفة عن الحالية" });
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, req.user!.id),
    columns: { id: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    res.status(400).json({ error: "الحساب لا يحتوي على كلمة مرور" });
    return;
  }

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة" });
    return;
  }

  const newHash = await hashPassword(newPassword);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, req.user!.id));

  res.json({ ok: true });
});

// ===== DELETE ACCOUNT =====
router.delete("/user/account", requireAuth, async (req, res) => {
  const { password } = req.body as { password?: string };

  if (!password) {
    res.status(400).json({ error: "كلمة المرور مطلوبة لحذف الحساب" });
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, req.user!.id),
    columns: { id: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    res.status(400).json({ error: "الحساب لا يحتوي على كلمة مرور" });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "كلمة المرور غير صحيحة" });
    return;
  }

  // Delete all user data (sessions, projects, then user)
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, req.user!.id));
  await db.delete(projectsTable).where(eq(projectsTable.userId, req.user!.id));
  await db.delete(usersTable).where(eq(usersTable.id, req.user!.id));

  clearAuthCookie(res);
  res.json({ ok: true });
});

// ===== GOOGLE OAUTH =====
router.get("/auth/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(501).json({ error: "Google OAuth غير مُعد" });
    return;
  }
  const state = randomUUID();
  const scope = "openid email profile";
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}&access_type=offline`;
  // In production, store state in session/cookie for CSRF protection
  res.redirect(url);
});

router.get("/auth/google/callback", async (req, res) => {
  const { code, error } = req.query as { code?: string; error?: string };

  if (error || !code) {
    res.redirect(`${FRONTEND_URL}/login?error=google_cancelled`);
    return;
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
      return;
    }

    // Get user info from Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userRes.json() as { id: string; email: string; name: string; picture?: string };
    if (!googleUser.email) {
      res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
      return;
    }

    const email = googleUser.email.toLowerCase();

    // Check if user exists
    let user = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, email),
      columns: { id: true, name: true, email: true, avatarUrl: true },
    });

    if (!user) {
      // Create new user
      const userId = randomUUID();
      const [created] = await db.insert(usersTable).values({
        id: userId,
        name: googleUser.name || email.split("@")[0],
        email,
        avatarUrl: googleUser.picture || null,
        emailVerifiedAt: new Date(),
      }).returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, avatarUrl: usersTable.avatarUrl });
      user = created;
    }

    const authUser: AuthUser = { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl };
    const token = signToken(authUser);
    setAuthCookie(res, token);

    // Redirect to frontend with token
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
  }
});

// ===== FORGOT PASSWORD =====
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email?.trim()) {
    res.status(400).json({ error: "البريد الإلكتروني مطلوب" });
    return;
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Always return success to prevent email enumeration
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, trimmedEmail),
    columns: { id: true },
  });

  if (!user) {
    res.json({ ok: true, message: "إذا كان البريد مسجّلاً، ستصل رسالة إعادة التعيين" });
    return;
  }

  // Generate reset token (expires in 1 hour)
  const resetToken = randomUUID();
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

  await db.update(usersTable).set({
    passwordResetToken: resetToken,
    passwordResetExpires: resetExpires,
  }).where(eq(usersTable.id, user.id));

  // In production, send email here. For now, log the reset link.
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${resetToken}`;
  console.log(`\n🔗 Password Reset Link:\n${resetUrl}\n`);

  res.json({ ok: true, message: "إذا كان البريد مسجّلاً، ستصل رسالة إعادة التعيين" });
});

// ===== RESET PASSWORD =====
router.post("/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };

  if (!token || !newPassword) {
    res.status(400).json({ error: "التوكن وكلمة المرور الجديدة مطلوبة" });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.passwordResetToken, token),
    columns: { id: true, passwordResetExpires: true },
  });

  if (!user || !user.passwordResetExpires) {
    res.status(400).json({ error: "توكن غير صالح أو منتهي" });
    return;
  }

  if (new Date() > user.passwordResetExpires) {
    res.status(400).json({ error: "انتهت صلاحية التوكن. يرجى طلب رابط جديد" });
    return;
  }

  const newHash = await hashPassword(newPassword);
  await db.update(usersTable).set({
    passwordHash: newHash,
    passwordResetToken: null,
    passwordResetExpires: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
  }).where(eq(usersTable.id, user.id));

  res.json({ ok: true });
});

export default router;
