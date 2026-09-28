"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Props = {
  appName?: string;
  blurb?: string;
};

/** Chrome / Safari “Add to Home Screen” for Matron (and reusable) PWAs. */
export function InstallMatronAppBanner({
  appName = "Matron app",
  blurb = "Add to your home screen for QR boarding, GPS path, and steadier location while on the road.",
}: Props) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean(
        (navigator as Navigator & { standalone?: boolean }).standalone,
      );
    setInstalled(standalone);

    const cap = (
      window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }
    ).Capacitor;
    setIsNative(Boolean(cap?.isNativePlatform?.()));

    function onBip(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (isNative || installed) {
    return (
      <section className="rounded-[1.2rem] border border-success/30 bg-success-15 p-4">
        <h2 className="font-display text-base font-bold text-electric-blue">
          App ready
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          You’re using the installed {appName}. Keep location allowed during
          trips.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.2rem] border border-electric-blue/20 bg-white/95 p-4 shadow-[var(--shadow)] ring-1 ring-electric-blue/10">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-light-blue">
        Buses PWA
      </p>
      <h2 className="mt-1 font-display text-base font-bold text-electric-blue">
        Install the {appName}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">{blurb}</p>

      {deferred ? (
        <button
          type="button"
          className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-electric-blue font-bold text-white"
          onClick={async () => {
            await deferred.prompt();
            const choice = await deferred.userChoice;
            if (choice.outcome === "accepted") setInstalled(true);
            setDeferred(null);
          }}
        >
          Add to Home screen
        </button>
      ) : (
        <p className="mt-4 text-center text-xs text-ink-muted">
          Use Chrome / Safari menu → <strong className="text-ink">Add to Home screen</strong>
        </p>
      )}
    </section>
  );
}
