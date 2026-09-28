import Link from "next/link";
import { brand } from "@/lib/brand";

/** Public install page — no login required to grab the APK. */
export default function GetDriverPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#001a4d] px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_420px_at_20%_0%,rgba(128,191,236,0.3),transparent_55%),radial-gradient(600px_360px_at_90%_100%,rgba(255,201,82,0.18),transparent_50%)]"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white px-7 py-9 text-center shadow-[0_20px_60px_rgba(0,35,104,0.28)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-light-blue">
          {brand.shortName}
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold text-electric-blue">
          Download Matron app
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Android app with QR boarding, live GPS, Google Maps route, and
          stop-by-stop trip tools. Install, then sign in with your{" "}
          <strong>matron</strong> account.
        </p>

        <a
          href="/downloads/sl-driver.apk"
          download="Silverleaf-Matron.apk"
          className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl bg-electric-blue text-base font-bold text-white no-underline"
        >
          Download APK (4.6 MB)
        </a>

        <ol className="mt-5 list-decimal space-y-1.5 px-2 text-left text-sm text-ink-muted">
          <li>Open the downloaded file on your phone</li>
          <li>Allow “Install unknown apps” if asked</li>
          <li>Open <strong className="text-ink">SL Matron</strong> and sign in</li>
        </ol>

        <p className="mt-4 text-xs leading-relaxed text-ink-muted">
          iPhone: open the{" "}
          <Link href="/matron" className="font-semibold text-electric-blue">
            Matron app
          </Link>{" "}
          in Safari → Share → Add to Home Screen.
        </p>

        <Link
          href="/"
          className="mt-5 inline-block text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          Staff login
        </Link>
      </div>
    </main>
  );
}
