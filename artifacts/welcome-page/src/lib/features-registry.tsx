import type { ReactNode } from "react";
import { BookOpen, Sparkles, Brain, Layers, Globe } from "lucide-react";

export type FeatureType = "explanation" | "summary" | "quiz" | "flashcards" | "translation";
export type FeatureStatus = "live" | "coming_soon";

export type FeatureDef = {
  type: FeatureType;
  label: string;
  icon: ReactNode;
  status: FeatureStatus;
  description: string;
};

export const FEATURES_REGISTRY: FeatureDef[] = [
  { type: "explanation", label: "شرح الملف", icon: <BookOpen size={20} />, status: "live", description: "شرح أكاديمي عميق للمحتوى بالعربية مع الحفاظ على المصطلحات الإنجليزية" },
  { type: "summary", label: "تلخيص سريع", icon: <Sparkles size={20} />, status: "coming_soon", description: "تلخيص النقاط الرئيسية في الملف" },
  { type: "quiz", label: "إنشاء اختبار", icon: <Brain size={20} />, status: "coming_soon", description: "توليد أسئلة اختبار من محتوى الملف" },
  { type: "flashcards", label: "بطاقات تعليمية", icon: <Layers size={20} />, status: "coming_soon", description: "بطاقات مراجعة للحفظ السريع" },
  { type: "translation", label: "ترجمة المحتوى", icon: <Globe size={20} />, status: "coming_soon", description: "ترجمة النصوص إلى العربية" },
];
