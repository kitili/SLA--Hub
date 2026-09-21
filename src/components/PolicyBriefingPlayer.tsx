"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type { PolicyBriefing } from "@/lib/policy-briefings";
import styles from "./PolicyBriefing.module.css";

interface Props {
  briefing: PolicyBriefing;
  /** Compact chrome for the admin preview. */
  preview?: boolean;
}

interface Slide {
  kicker: string;
  heading: string;
  body: string;
  spoken: string;
}

function slidesFromBriefing(briefing: PolicyBriefing): Slide[] {
  const script = briefing.script;
  if (!script) return [];
  const slides: Slide[] = [
    {
      kicker: "Policy briefing",
      heading: script.title || briefing.title,
      body: script.intro,
      spoken: script.intro,
    },
  ];
  for (const chapter of script.chapters) {
    slides.push({
      kicker: script.title || briefing.title,
      heading: chapter.heading,
      body: chapter.body,
      spoken: `${chapter.heading}. ${chapter.body}`,
    });
  }
  slides.push({
    kicker: "Next step",
    heading: "Open the full policy",
    body: script.close,
    spoken: script.close,
  });
  return slides;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => v.lang.startsWith("en") && /female|jenny|samantha|zira/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith("en-US")) ??
    voices.find((v) => v.lang.startsWith("en"));
  return preferred ?? voices[0] ?? null;
}

/** Narrated slide player — used when a generated briefing script is published. */
export default function PolicyBriefingPlayer({ briefing, preview = false }: Props) {
  const t = useTranslations("member.section.policyBriefing");
  const slides = useMemo(() => slidesFromBriefing(briefing), [briefing]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const playingRef = useRef(false);
  const indexRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const speakOrAdvance = useCallback(
    (slideIndex: number) => {
      stopSpeech();
      const slide = slides[slideIndex];
      if (!slide || !playingRef.current) return;

      const advance = () => {
        if (!playingRef.current) return;
        if (slideIndex >= slides.length - 1) {
          playingRef.current = false;
          setPlaying(false);
          return;
        }
        const next = slideIndex + 1;
        indexRef.current = next;
        setIndex(next);
        speakOrAdvance(next);
      };

      if (typeof window !== "undefined" && window.speechSynthesis && slide.spoken) {
        const utterance = new SpeechSynthesisUtterance(slide.spoken);
        utterance.rate = 0.92;
        utterance.lang = "en-US";
        const voice = pickVoice();
        if (voice) utterance.voice = voice;
        utterance.onend = advance;
        utterance.onerror = advance;
        window.speechSynthesis.speak(utterance);
        return;
      }

      const seconds = Math.min(18, Math.max(6, slide.spoken.split(/\s+/).length / 2.2));
      timerRef.current = window.setTimeout(advance, seconds * 1000);
    },
    [slides, stopSpeech],
  );

  useEffect(() => {
    setSpeechAvailable(
      typeof window !== "undefined" && "speechSynthesis" in window,
    );
    const refresh = () => {
      setSpeechAvailable(
        typeof window !== "undefined" && "speechSynthesis" in window,
      );
    };
    window.speechSynthesis?.addEventListener("voiceschanged", refresh);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", refresh);
      playingRef.current = false;
      stopSpeech();
    };
  }, [stopSpeech]);

  if (slides.length === 0) return null;

  const slide = slides[index] ?? slides[0]!;
  const progress = ((index + 1) / slides.length) * 100;

  function playFrom(startIndex: number) {
    setStarted(true);
    indexRef.current = startIndex;
    setIndex(startIndex);
    playingRef.current = true;
    setPlaying(true);
    speakOrAdvance(startIndex);
  }

  function togglePlay() {
    if (playing) {
      playingRef.current = false;
      setPlaying(false);
      stopSpeech();
      return;
    }
    playFrom(index);
  }

  function goTo(nextIndex: number) {
    const clamped = Math.max(0, Math.min(slides.length - 1, nextIndex));
    stopSpeech();
    indexRef.current = clamped;
    setIndex(clamped);
    if (playingRef.current) speakOrAdvance(clamped);
  }

  return (
    <div className={styles.player}>
      <div className={styles.stage} aria-live="polite">
        <p className={styles.stageKicker}>{slide.kicker}</p>
        <h5 className={styles.stageHeading}>{slide.heading}</h5>
        <p className={styles.stageBody}>{slide.body}</p>
        <div className={styles.stageBar} style={{ width: `${progress}%` }} />
        {!started && (
          <button type="button" className={styles.playOverlay} onClick={() => playFrom(0)}>
            {t("play")}
          </button>
        )}
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.controlBtn}
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
        >
          {t("prev")}
        </button>
        <button type="button" className={styles.controlBtn} onClick={togglePlay}>
          {playing ? t("pause") : started ? t("resume") : t("play")}
        </button>
        <button
          type="button"
          className={styles.controlBtn}
          onClick={() => goTo(index + 1)}
          disabled={index === slides.length - 1}
        >
          {t("next")}
        </button>
        <span className={styles.slideCount}>
          {t("slideOf", { current: index + 1, total: slides.length })}
        </span>
      </div>

      {!speechAvailable && !preview ? (
        <p className={styles.speechHint}>{t("noSpeech")}</p>
      ) : null}
    </div>
  );
}
