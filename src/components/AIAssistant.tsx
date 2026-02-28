import React, { useState } from "react";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Role = "user" | "ai";

interface Message {
  role: Role;
  content: string;
}

interface AIAssistantProps {
  context: {
    location: { lat: number; lng: number } | null;
    layer: string;
    horizon: string;
    isConfirmed: boolean;
  };
  uiLanguage: "ru" | "en" | "kk";
  authToken?: string | null;
  onSessionCreated?: () => void;
}

export function AIAssistant({ context, uiLanguage, authToken, onSessionCreated }: AIAssistantProps) {
  const initialMessage =
    uiLanguage === "en"
      ? "I'm AgroSphere AI powered by Groq. Ask anything about your field, yields, degradation risks, moisture, or carbon credits."
      : uiLanguage === "kk"
      ? "Мен Groq негізіндегі AgroSphere AI-мін. Егістік, өнімділік, тозу қаупі, ылғал немесе көміртек несиелері туралы сұрақ қойыңыз."
      : "Я AgroSphere AI на базе Groq. Задайте вопрос про участок, урожайность, риски деградации, влагу или углеродные кредиты.";

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      content: initialMessage,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userContent = input.trim();
    setInput("");

    setMessages((prev) => [...prev, { role: "user", content: userContent }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: userContent,
          context: {
            ...context,
            uiLanguage,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as { text?: string; error?: string };
      const text =
        typeof data.text === "string" && data.text.length > 0
          ? data.text
          : data.error
          ? `Сервер вернул ошибку: ${data.error}`
          : "Не удалось получить ответ от AI сервера.";

      setMessages((prev) => [...prev, { role: "ai", content: text }]);

      // Сохраняем сессию анализа для авторизованного пользователя
      if (authToken && context.location && context.isConfirmed) {
        try {
          await fetch("/api/sessions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              location: `${context.location.lat.toFixed(4)}, ${context.location.lng.toFixed(4)}`,
              data: {
                prompt: userContent,
                response: text,
                layer: context.layer,
                horizon: context.horizon,
                location: context.location,
                createdAt: new Date().toISOString(),
              },
            }),
          });
          onSessionCreated?.();
        } catch (e) {
          console.error("Ошибка сохранения сессии:", e);
        }
      }
    } catch (error) {
      console.error("Ошибка AI:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content:
            "Извини, не удалось связаться с AI-сервером. Убедись, что сервер запущен и ключ Groq настроен в переменных окружения.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="glass-panel p-5 flex flex-col h-[380px]">
      <div className="flex items-center gap-2 mb-4 text-white/40">
        <MessageSquare className="w-4 h-4" />
        <span className="text-xs font-bold uppercase tracking-widest">
          AgroSphere AI Assistant (Groq)
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3 custom-scrollbar">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
              m.role === "user"
                ? "bg-emerald-500/20 text-emerald-50 ml-auto max-w-[85%]"
                : "bg-white/5 text-white/90 mr-auto max-w-[90%]"
            }`}
          >
            {m.role === "ai" ? <ReactMarkdown>{m.content}</ReactMarkdown> : <span>{m.content}</span>}
          </div>
        ))}

        {!context.isConfirmed && (
          <p className="text-[11px] text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            Точка на карте еще не подтверждена. Я могу отвечать в общем по
            региону, но для точного анализа климата, почв и урожайности
            зафиксируй координату на карте.
          </p>
        )}
      </div>

      <div className="mt-auto pt-2 border-t border-white/10">
        <div className="relative">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              uiLanguage === "en"
                ? "Ask about yield, moisture, degradation or carbon credits for the selected point..."
                : uiLanguage === "kk"
                ? "Таңдалған нүкте үшін өнімділік, ылғалдылық, тозу қаупі немесе көміртек несиелері туралы сұраңыз..."
                : "Спроси про урожайность, влагу, деградацию или углеродные кредиты для выбранной точки..."
            }
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 pr-10 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/60 custom-scrollbar"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="absolute right-1 bottom-1.5 p-2 rounded-lg bg-emerald-500/90 hover:bg-emerald-400 text-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}