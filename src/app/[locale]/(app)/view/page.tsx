import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { findMaterialByKey } from "@/lib/db/queries/member";
import { resolveLocalized } from "@/lib/i18n-content";
import { contentRepo, policySignaturesRepo, progressRepo } from "@/lib/db/repositories";
import { itemRequiresPolicySignature } from "@/lib/policy-briefings";
import { getStorage } from "@/lib/storage";
import { legacyDocumentExists } from "@/lib/storage/legacy-documents";
import DocxPreview from "./DocxPreview";
import ViewerMarkDoneButton from "./ViewerMarkDoneButton";

import styles from "./view.module.css";

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<{ key?: string; path?: string; t?: string }>;

type MaterialKind = "pdf" | "image" | "video" | "youtube" | "docx" | "office" | "other";

/** Classify a material for rendering from its content type / extension. */
function classify(contentType: string, key: string): MaterialKind {
  if (contentType === "video/youtube") return "youtube";
  const ct = contentType.toLowerCase();
  if (ct.includes("pdf")) return "pdf";
  if (ct.startsWith("image/")) return "image";
  if (ct.startsWith("video/")) return "video";

  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (["mp4", "webm", "mov"].includes(ext)) return "video";
  if (ext === "docx") return "docx";
  if (["doc", "ppt", "pptx", "xls", "xlsx"].includes(ext)) return "office";
  return "other";
}

function parseStartTime(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function withStartTime(src: string, startSeconds: number | null): string {
  return startSeconds === null ? src : `${src}#t=${startSeconds}`;
}

/**
 * Material viewer — renders an uploaded material (pdf / image / video) inline
 * from the app-served `/api/materials/<key>` route, with graceful fallbacks:
 *   - no `key`/`path`, or material not yet uploaded → "coming soon"
 *   - unknown key → "not found"
 *   - unpreviewable type → a link to open/download instead
 *
 * Auth: members only (redirects to the dashboard sign-in gate otherwise).
 * Dynamic: resolves per-request DB state.
 */
export const dynamic = "force-dynamic";

export default async function DocumentViewerPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { key, path, t: startTime } = await searchParams;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}`);
  }

  const t = await getTranslations("member");

  // Accept either the canonical `key` (storage key) or the legacy `path`.
  const storageKey = key ?? path;

  // Back-link: resolve the owning section if we can, else the dashboard.
  const backHref = (sectionId: string | null) =>
    sectionId ? `/section/${sectionId}` : "/";

  // ── No key supplied → coming soon ─────────────────────────────────────
  if (!storageKey) {
    return (
      <ViewerShell
        backHref="/"
        backLabel={t("viewer.backToDashboard")}
        title={t("viewer.comingSoonTitle")}
      >
        <div className={styles.placeholder}>
          <span aria-hidden>🗂️</span>
          <h1>{t("viewer.comingSoonTitle")}</h1>
          <p>{t("viewer.comingSoonBody")}</p>
        </div>
      </ViewerShell>
    );
  }

  const found = await findMaterialByKey(storageKey);

  // ── Unknown key → not found ───────────────────────────────────────────
  if (!found) {
    return (
      <ViewerShell
        backHref="/"
        backLabel={t("viewer.backToDashboard")}
        title={t("viewer.notFoundTitle")}
      >
        <div className={styles.placeholder}>
          <span aria-hidden>🔍</span>
          <h1>{t("viewer.notFoundTitle")}</h1>
          <p>{t("viewer.notFoundBody")}</p>
        </div>
      </ViewerShell>
    );
  }

  const { material, sectionId, itemId } = found;
  const requiresSignature = Boolean(
    itemId && sectionId && itemRequiresPolicySignature(itemId, sectionId),
  );
  const progress = itemId ? await progressRepo.getProgressForStaff(user.id) : null;
  const itemIsRead = itemId ? progress?.readItems.includes(itemId) ?? false : false;
  const policySignature =
    itemId && requiresSignature
      ? await policySignaturesRepo.getSignatureForMemberItem(user.id, itemId)
      : undefined;
  const itemIsSigned = Boolean(policySignature);

  // A nicer title: prefer the owning item's localized title when resolvable.
  // For video materials inside a multi-file item (e.g. Central Team), keep the
  // person's name from the filename so each tab opens with a clear title.
  let title = material.filename;
  const isVideoMaterial =
    material.contentType.startsWith("video/") ||
    /\.(mp4|mov|webm)$/i.test(material.filename);
  if (isVideoMaterial) {
    title = material.filename.replace(/\.[^.]+$/, "");
  } else if (material.sectionItemId) {
    const tree = await contentRepo.getSectionsWithItems();
    for (const section of tree) {
      const item = section.items.find((it) => it.id === material.sectionItemId);
      if (item) {
        title = resolveLocalized(item, "title", locale as Locale) ?? title;
        break;
      }
    }
  }

  // ── Material with no uploaded bytes yet (seeded placeholder) → coming soon
  // Seeded refs have size 0 and a storage key that is just the legacy path.
  if (
    material.size === 0 &&
    material.contentType !== "video/youtube" &&
    !(await legacyDocumentExists(material.storageKey))
  ) {
    return (
      <ViewerShell
        backHref={backHref(sectionId)}
        backLabel={
          sectionId ? t("viewer.backToSection") : t("viewer.backToDashboard")
        }
        title={title}
      >
        <div className={styles.placeholder}>
          <span aria-hidden>🗂️</span>
          <h1>{t("viewer.comingSoonTitle")}</h1>
          <p>{t("viewer.comingSoonBody")}</p>
        </div>
      </ViewerShell>
    );
  }

  // Route the file through the app's /api/materials proxy. For Vercel Blob
  // this signs the request server-side; for local storage it reads from disk.
  const src = await getStorage().getUrl(material.storageKey);
  const mediaSrc = withStartTime(src, parseStartTime(startTime));
  const kind = classify(material.contentType, material.storageKey);

  return (
    <ViewerShell
      backHref={backHref(sectionId)}
      backLabel={
        sectionId ? t("viewer.backToSection") : t("viewer.backToDashboard")
      }
      title={title}
      markDoneSlot={
        itemId ? (
          <ViewerMarkDoneButton
            itemId={itemId}
            initiallyRead={itemIsRead || itemIsSigned}
            requiresSignature={requiresSignature}
            initiallySigned={itemIsSigned}
            sectionId={sectionId}
          />
        ) : null
      }
    >
      {kind === "pdf" && (
        <>
          <iframe className={styles.pdfFrame} src={src} title={title} />
          {/* Mobile fallback — iOS Safari can't render PDFs in iframes */}
          <a
            className={styles.pdfMobileOpen}
            href={src}
            target="_blank"
            rel="noopener noreferrer"
          >
            📄 {t("viewer.openInNewTab")}
          </a>
        </>
      )}

      {kind === "image" && (
        <div className={styles.imageWrap}>
          {/* App-served dynamic asset — plain <img> is appropriate here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.image} src={src} alt={title} />
        </div>
      )}

      {kind === "video" && (
        <div
          className={styles.videoWrap}
          /* Discourage casual download via right-click (not security). */
        >
          <video
            className={styles.video}
            controls
            controlsList="nodownload"
            playsInline
            preload="metadata"
          >
            <source
              src={mediaSrc}
              type={
                /\.(mp4|m4v)$/i.test(material.storageKey)
                  ? "video/mp4"
                  : material.contentType || "video/mp4"
              }
            />
          </video>
        </div>
      )}

      {kind === "youtube" && (
        <div className={styles.videoWrap}>
          <iframe
            className={styles.pdfFrame}
            src={src}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {kind === "docx" && <DocxPreview src={src} title={title} />}

      {kind === "office" && (
        <div className={styles.localFilePanel}>
          <span className={styles.localFileIcon} aria-hidden>
            File
          </span>
          <h1>Local file ready</h1>
          <p>
            This file is stored locally in the hub. Browser preview is limited
            for this Office format, but staff can open it from here without
            leaving the onboarding step.
          </p>
          <a className={styles.openLink} href={src}>
            Open local file
          </a>
        </div>
      )}

      {kind === "other" && (
        <div className={styles.placeholder}>
          <span aria-hidden>📄</span>
          <h1>{t("viewer.unsupportedTitle")}</h1>
          <p>{t("viewer.unsupportedBody")}</p>
          <a
            className={styles.openLink}
            href={src}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("viewer.openInNewTab")}
          </a>
        </div>
      )}

      {(kind === "pdf" || kind === "image" || kind === "video" || kind === "docx") && (
        <p className={styles.openRow}>
          <a
            className={styles.openLinkQuiet}
            href={src}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("viewer.openInNewTab")} ↗
          </a>
        </p>
      )}
    </ViewerShell>
  );
}

/** Shared viewer chrome: back link + title + content slot. */
function ViewerShell({
  backHref,
  backLabel,
  title,
  markDoneSlot,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  markDoneSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.viewerTopbar}>
        <Link href={backHref as never} className={styles.back}>
          ← {backLabel}
        </Link>
        {markDoneSlot}
      </div>
      <h1 className={styles.title}>{title}</h1>
      {children}
    </main>
  );
}
