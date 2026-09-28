"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { usePathname } from "@/i18n/navigation";
import {
  getAdminSlaBotHistoryAction,
  getSlaBotHistoryAction,
  sendAdminSlaBotMessageAction,
  sendSlaBotMessageAction,
} from "@/lib/actions/sla-bot";
import styles from "./SlaBot.module.css";

interface ChatLine {
  role: "user" | "assistant";
  content: string;
}

const LEARNER_STARTERS = ["help", "whatNext", "feedback", "tech"] as const;
const ADMIN_STARTERS = ["help", "members", "hiring", "alerts"] as const;

export default function SlaBotWidget({
  variant = "learner",
}: {
  variant?: "learner" | "admin";
}) {
  const isAdminBot = variant === "admin";
  const t = useTranslations(isAdminBot ? "adminSlaBot" : "slaBot");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    startTransition(async () => {
      const history = isAdminBot
        ? await getAdminSlaBotHistoryAction()
        : await getSlaBotHistoryAction();
      if (history.ok && history.messages) {
        setLines(
          history.messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
        );
      }
    });
  }, [open, isAdminBot]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, open]);

  function send(raw: string) {
    const message = raw.trim();
    if (!message || pending) return;
    setError(null);
    setInput("");
    setLines((prev) => [...prev, { role: "user", content: message }]);
    startTransition(async () => {
      const result = isAdminBot
        ? await sendAdminSlaBotMessageAction({ message })
        : await sendSlaBotMessageAction({ message, locale });
      if (!result.ok || !result.reply) {
        setError(t("error"));
        return;
      }
      setLines((prev) => [
        ...prev,
        { role: "assistant", content: result.reply! },
      ]);
    });
  }

  if (!isAdminBot && pathname.startsWith("/admin")) {
    return null;
  }

  const starters = isAdminBot ? ADMIN_STARTERS : LEARNER_STARTERS;
  const panelId = isAdminBot ? "hr-bot-panel" : "sla-bot-panel";
  const inputId = isAdminBot ? "hr-bot-input" : "sla-bot-input";

  return (
    <div className={styles.root}>
      {open && (
        <section
          id={panelId}
          className={styles.panel}
          aria-label={t("title")}
          role="dialog"
        >
          <header
            className={`${styles.header} ${isAdminBot ? styles.headerAdmin : ""}`}
          >
            <div>
              <p className={styles.kicker}>{t("kicker")}</p>
              <h2 className={styles.title}>{t("title")}</h2>
            </div>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setOpen(false)}
              aria-label={t("close")}
            >
              ×
            </button>
          </header>

          <div className={styles.starters}>
            {starters.map((key) => (
              <button
                key={key}
                type="button"
                className={styles.chip}
                disabled={pending}
                onClick={() => send(t(`starters.${key}`))}
              >
                {t(`starterLabels.${key}`)}
              </button>
            ))}
          </div>

          <div className={styles.messages}>
            {lines.length === 0 && (
              <p className={styles.welcome}>{t("welcome")}</p>
            )}
            {lines.map((line, i) => (
              <div
                key={`${line.role}-${i}`}
                className={
                  line.role === "user" ? styles.bubbleUser : styles.bubbleBot
                }
              >
                {line.content}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <form
            className={styles.composer}
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <label className={styles.srOnly} htmlFor={inputId}>
              {t("placeholder")}
            </label>
            <textarea
              id={inputId}
              className={styles.input}
              rows={2}
              value={input}
              disabled={pending}
              placeholder={t("placeholder")}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <button
              type="submit"
              className={styles.send}
              disabled={pending || !input.trim()}
            >
              {pending ? t("sending") : t("send")}
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`${styles.fab} ${isAdminBot ? styles.fabAdmin : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.fabLabel}>{open ? t("close") : t("open")}</span>
        <span className={styles.fabName}>
          {isAdminBot ? "HR-bot" : "SLA-bot"}
        </span>
      </button>
    </div>
  );
}
