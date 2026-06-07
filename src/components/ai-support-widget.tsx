"use client";

import { FormEvent, useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { useLanguage } from "./language-provider";

type AssistantAction = {
  label: string;
  href: string;
};

export function AiSupportWidget() {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [action, setAction] = useState<AssistantAction | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    setAction(null);

    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const payload = (await response.json().catch(() => ({}))) as { answer?: string; action?: AssistantAction };
    setAnswer(payload.answer || (language === "ar" ? "لم أتمكن من الرد الآن." : "I could not answer right now."));
    setAction(payload.action || null);
    setLoading(false);
  }

  return (
    <div className="fixed bottom-20 end-4 z-50 lg:bottom-5">
      {open ? (
        <div className="mb-3 w-[min(92vw,360px)] rounded-[8px] bg-white p-4 text-slate-950 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-800">
          <h2 className="flex items-center gap-2 text-sm font-black">
            <Bot className="h-4 w-4 text-sky-600" />
            {language === "ar" ? "مساعد VAYAX" : "VAYAX Assistant"}
          </h2>
          <form onSubmit={ask} className="mt-3 grid gap-2">
            <textarea
              className="field min-h-20"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={language === "ar" ? "اسأل عن الحجز أو السعر أو حالة الحجز" : "Ask about booking, pricing, or booking status"}
            />
            <button type="submit" disabled={loading || !message.trim()} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white disabled:bg-slate-400">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {language === "ar" ? "إرسال" : "Ask"}
            </button>
          </form>
          {answer ? (
            <div className="mt-3 rounded-[8px] bg-slate-50 p-3 text-sm font-bold leading-6 dark:bg-slate-800">
              <p>{answer}</p>
              {action ? (
                <a href={action.href} className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-[8px] bg-sky-600 px-4 text-xs font-black text-white">
                  {action.label}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <button type="button" onClick={() => setOpen((current) => !current)} className="inline-flex h-12 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-black text-white shadow-xl dark:bg-white dark:text-slate-950">
        <Bot className="h-4 w-4" />
        {language === "ar" ? "مساعدة" : "Help"}
      </button>
    </div>
  );
}
