import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { sendAssistantMessage } from "@/services/interview";


interface Message {
  role: "user" | "assistant";
  content: string;
}


export function AssistantPanel({
  sessionToken,
  questionId,
  currentAnswer,
  disabled = false,
}: {
  sessionToken?: string;
  questionId?: string;
  currentAnswer?: string;
  disabled?: boolean;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Ask for a hint, concept clarification, or help structuring your answer. Direct answer requests are logged.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const mutation = useMutation({
    mutationFn: async (message: string) => {
      if (!questionId || !sessionToken) {
        return { reply: "Start the interview to use the assistant." };
      }
      return sendAssistantMessage({ sessionToken, questionId, message, currentAnswer });
    },
    onSuccess: (data, message) => {
      setMessages((current) => [
        ...current,
        { role: "user", content: message },
        { role: "assistant", content: data.reply },
      ]);
      setInput("");
    },
    onError: () => {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "Try again. The assistant is temporarily unavailable.",
        },
      ]);
    },
  });

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages, mutation.isPending]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) {
      return;
    }
    if (disabled) {
      return;
    }
    mutation.mutate(input.trim());
  };

  return (
    <section className="flex h-full max-h-[32rem] flex-col rounded-[28px] border border-slate-200/70 bg-white/85 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/80">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-200">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-white">AI Assistant</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Hint-only support with full usage tracking.</p>
            </div>
            <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-medium text-cyan-700 dark:text-cyan-100">
              Logged
            </div>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-[24px] bg-slate-100/80 p-3 dark:bg-white/[0.03]"
      >
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[88%] rounded-[22px] px-4 py-3 text-sm shadow-sm ${
                message.role === "assistant"
                  ? "rounded-bl-md bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  : "rounded-br-md bg-cyan-500 text-white"
              }`}
            >
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] opacity-60">
                {message.role === "assistant" ? "Assistant" : "You"}
              </div>
              <p className="leading-6">{message.content}</p>
            </div>
          </div>
        ))}

        {mutation.isPending && (
          <div className="flex justify-start">
            <div className="max-w-[88%] rounded-[22px] rounded-bl-md bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-100">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] opacity-60">
                <Sparkles className="h-3 w-3" />
                Assistant
              </div>
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <textarea
          className="input-premium h-24 resize-none bg-white dark:bg-white/5"
          placeholder="Ask for a hint or clarification..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={disabled}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            Ask for guidance, not direct solutions.
          </p>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-cyan-500/60 disabled:hover:bg-cyan-500/60"
            disabled={disabled || mutation.isPending || !input.trim()}
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {mutation.isPending ? "Thinking..." : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}
