import { apiFetch } from "./api";

export interface PageResultUI {
  translation: string | null;
  explanation: string;
  error: string;
  pageType?: "text" | "image" | "mixed";
}

export async function callExplain(
  text: string,
  images?: string[],
): Promise<PageResultUI> {
  let res: Response;
  try {
    res = await apiFetch("/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, images }),
    });
  } catch {
    throw new Error("فشل الاتصال بالخادم. تحقق من الاتصال بالإنترنت.");
  }
  if (!res.ok) {
    let serverMsg = "";
    try { const body = await res.json() as { error?: string }; serverMsg = body?.error ?? ""; } catch {}
    throw new Error(serverMsg || "خطأ في السيرفر");
  }
  let data: { explanation?: string; translation?: string | null; error?: string };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new Error(`استجابة غير صالحة من الخادم (${res.status}). حاول مجدداً.`);
  }
  return {
    translation: data.translation ?? null,
    explanation: data.explanation ?? "",
    error: "",
  };
}
