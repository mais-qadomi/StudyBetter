import { apiFetch } from "./api";

export interface ShareResult {
  token: string;
  shareUrl: string;
  expiresAt: string;
  fileName: string;
}

export interface RevokeResult {
  message: string;
  revokedAt?: string;
}

export async function createShareLink(
  blob: Blob,
  fileName: string,
  sessionId: string,
): Promise<ShareResult> {
  const formData = new FormData();
  formData.append("pdf", blob, fileName);
  formData.append("sessionId", sessionId);

  let res: Response;
  try {
    res = await apiFetch("/share", {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error("فشل الاتصال بالخادم. تحقق من الاتصال بالإنترنت.");
  }

  if (!res.ok) {
    let serverMsg = "";
    try {
      const body = (await res.json()) as { error?: string };
      serverMsg = body?.error ?? "";
    } catch {}
    throw new Error(serverMsg || `خطأ في الخادم (${res.status})`);
  }

  const data = (await res.json()) as ShareResult;
  return data;
}

export async function revokeShareLink(
  token: string,
): Promise<RevokeResult> {
  let res: Response;
  try {
    res = await apiFetch(`/share/${token}/revoke`, {
      method: "POST",
    });
  } catch {
    throw new Error("فشل الاتصال بالخادم.");
  }

  if (!res.ok) {
    let serverMsg = "";
    try {
      const body = (await res.json()) as { error?: string };
      serverMsg = body?.error ?? "";
    } catch {}
    throw new Error(serverMsg || "فشل إلغاء المشاركة");
  }

  return (await res.json()) as RevokeResult;
}
