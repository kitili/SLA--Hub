"use client";

/**
 * DocumentCard — a single onboarding document item: title/note, a link to open
 * the material in the viewer (or a gentle "coming soon" when no material is
 * uploaded yet), a completion badge, and a "Mark as done" action.
 *
 * Ported from legacy/client/src/components/DocumentCard.jsx and wired (Wave 4A)
 * to localised chrome (next-intl `member.section.*`) and a server-action-backed
 * `onMarkDone` supplied by the section page's interactive shell.
 */

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import PolicyBriefingPanel from "@/components/PolicyBriefing";
import PolicySignatureForm from "@/components/section/PolicySignatureForm";
import { getPolicyBriefing } from "@/lib/policy-briefings";
import styles from "./DocumentCard.module.css";

/** Known Central Team roles keyed by display name (filename without extension). */
const TEAM_ROLES: Record<string, string> = {
  "Aloyce Shirima": "Senior Manager of Talent Academy",
  "Grace Kambona": "Central Team",
  "Julius Kimani": "Executive Principal",
  "Lilian Kimaro": "Finance Associate",
  "Ludwigy Bwana": "Director of Operations",
  "Neema Emmanuel": "Central Team",
  "Paul Victor": "Tech, Data & MEL Manager",
};

function roleForLabel(label: string): string | undefined {
  return TEAM_ROLES[label.trim()] ?? TEAM_ROLES[label.replace(/\s+/g, " ").trim()];
}

/** A resolved, openable file link (built by the parent from a material row). */
export interface DocumentFileLink {
  /** Display name, e.g. "handbook.pdf". */
  label: string;
  /** Href into the /view route, e.g. "/view?key=...". */
  href: string;
  /** True for video items — renders an inline player instead of a link. */
  isVideo?: boolean;
  /** Direct stream URL for the inline <video> source (videos only). */
  streamUrl?: string;
  /** True for YouTube embeds — renders an iframe instead of a <video>. */
  isYoutube?: boolean;
  /** YouTube embed URL (https://www.youtube.com/embed/VIDEO_ID). */
  youtubeUrl?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  note?: string;
  type?: string;
}

export interface DocumentCardProps {
  item: DocumentItem;
  /** 1-based display index shown in the numbered circle. */
  index: number;
  /** Resolved openable materials for this item (empty → "coming soon"). */
  fileLinks?: DocumentFileLink[];
  /** When true, the card is dimmed and links are hidden. */
  locked?: boolean;
  /** Whether the member has read this item. */
  isRead?: boolean;
  /** Called when the user clicks "Mark as done" (server action). */
  onMarkDone?: (itemId: string) => void;
  /** Disables the button while a mark-done request is in flight. */
  pending?: boolean;
  /** Scroll to this card on mount if it matches (resume=itemId). */
  resumeItemId?: string;
  /** Prefill for per-policy digital signature. */
  defaultSignedName?: string;
  /** Existing signature for this policy item, if any. */
  signature?: {
    signedName: string;
    signedAtISO: string;
  } | null;
  /** Called after a successful per-policy digital signature. */
  onPolicySigned?: (result: {
    itemId: string;
    readItems: string[];
    signedName: string;
    signedAtISO: string;
  }) => void;
  /** Override: policy items in the policies section always require a signature. */
  requiresSignature?: boolean;
  /** Resolved briefing (published script or static MP4 fallback). */
  briefing?: ReturnType<typeof getPolicyBriefing>;
}

export default function DocumentCard({
  item,
  index,
  fileLinks = [],
  locked = false,
  isRead = false,
  onMarkDone,
  pending = false,
  resumeItemId,
  defaultSignedName = "",
  signature = null,
  onPolicySigned,
  requiresSignature: requiresSignatureProp,
  briefing: briefingProp,
}: DocumentCardProps) {
  const t = useTranslations("member");

  const hasFiles = fileLinks.length > 0;
  const youtubes = fileLinks.filter((f) => f.isYoutube && f.youtubeUrl);
  const videos = fileLinks.filter((f) => f.isVideo && f.streamUrl);
  const mediaItems = [...youtubes, ...videos];
  const isGallery = mediaItems.length > 1;
  const docs = fileLinks.filter(
    (f) =>
      !f.isVideo &&
      !f.isYoutube &&
      !/key points/i.test(f.label) &&
      !/Key Points/.test(f.href),
  );
  const briefing = briefingProp ?? getPolicyBriefing(item.id);
  const requiresSignature = requiresSignatureProp ?? Boolean(briefing);
  const showComplete = requiresSignature ? Boolean(signature) : isRead;

  // Scroll to this card when it matches the resume param.
  useEffect(() => {
    if (resumeItemId !== item.id) return;
    requestAnimationFrame(() => {
      document
        .getElementById(`doc-${item.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [resumeItemId, item.id]);

  const handleMarkDone = () => {
    if (locked || isRead || pending) return;
    onMarkDone?.(item.id);
  };

  const cardClass = [
    styles.documentCard,
    showComplete ? styles.complete : "",
    locked ? styles.locked : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div id={`doc-${item.id}`} className={cardClass}>
      <div className={styles.documentHeader}>
        <span className={styles.documentNumber}>{index}</span>
        <div className={styles.documentInfo}>
          <span className={styles.documentEyebrow}>Learning item</span>
          <h3 className={styles.documentTitle}>{item.title}</h3>
          {item.note && <p className={styles.documentNote}>{item.note}</p>}
        </div>
        {showComplete ? (
          <span className={styles.completeBadge}>✓ {t("section.complete")}</span>
        ) : (
          <span className={styles.quizReadyBadge}>{t("section.notDone")}</span>
        )}
      </div>

      {briefing ? (
        <PolicyBriefingPanel briefing={briefing} />
      ) : requiresSignature ? (
        <PolicyBriefingPanel
          briefing={{
            itemId: item.id,
            title: item.title,
            nextStep: t("section.policyBriefing.signAfterBriefing"),
          }}
        />
      ) : null}

      {!hasFiles && !briefing ? (
        <p className={styles.lockedMessage}>{t("section.comingSoonHint")}</p>
      ) : hasFiles ? (
        <>
          {docs.length > 0 && (
            <div className={styles.documentFiles}>
              {docs.map((file) => (
                <Link
                  key={file.href}
                  href={file.href as never}
                  className={
                    isGallery ? styles.directoryLink : styles.fileLink
                  }
                >
                  <span className={styles.directoryIcon} aria-hidden>
                    {isGallery ? "🗂️" : "📄"}
                  </span>
                  <span className={styles.fileCopy}>
                    <span className={styles.fileName}>
                      {isGallery
                        ? file.label.replace(/\s*\.pdf$/i, "") || file.label
                        : file.label}
                    </span>
                    {isGallery && (
                      <span className={styles.directoryHint}>
                        Open the team directory first
                      </span>
                    )}
                  </span>
                  <span className={styles.viewIcon}>👁</span>
                  <span className={styles.viewLabel}>{t("section.open")}</span>
                </Link>
              ))}
            </div>
          )}

          {mediaItems.length > 0 && !briefing && (
            <section
              className={isGallery ? styles.videoGallery : styles.videoSolo}
              aria-label={isGallery ? "Central team introductions" : undefined}
            >
              {isGallery ? (
                <>
                  <header className={styles.videoGalleryHeader}>
                    <p className={styles.videoGalleryKicker}>
                      Video introductions
                    </p>
                    <h4 className={styles.videoGalleryTitle}>
                      Hear from the Central Team
                    </h4>
                    <p className={styles.videoGalleryLead}>
                      Click a name to watch their introduction in a new tab.
                    </p>
                  </header>

                  <div className={styles.teamPicker} aria-label="Team videos">
                    {mediaItems.map((media, mediaIndex) => {
                      const role = roleForLabel(media.label);
                      return (
                        <Link
                          key={media.youtubeUrl ?? media.streamUrl ?? media.href}
                          href={media.href as never}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.teamPick}
                        >
                          <span className={styles.teamPickIndex} aria-hidden>
                            {String(mediaIndex + 1).padStart(2, "0")}
                          </span>
                          <span className={styles.teamPickCopy}>
                            <span className={styles.teamPickName}>
                              {media.label}
                            </span>
                            {role && (
                              <span className={styles.teamPickRole}>{role}</span>
                            )}
                          </span>
                          <span className={styles.teamPickAction}>
                            Watch ↗
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </>
              ) : (
                mediaItems[0] && (
                  <figure
                    className={styles.videoCard}
                    onContextMenu={
                      mediaItems[0].streamUrl
                        ? (e) => e.preventDefault()
                        : undefined
                    }
                  >
                    <div className={styles.videoFrame}>
                      {mediaItems[0].youtubeUrl ? (
                        <iframe
                          className={styles.welcomeVideo}
                          src={mediaItems[0].youtubeUrl}
                          title={mediaItems[0].label || item.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video
                          controls
                          controlsList="nodownload noplaybackrate"
                          disablePictureInPicture
                          preload="metadata"
                          className={styles.welcomeVideo}
                        >
                          <source
                            src={mediaItems[0].streamUrl}
                            type="video/mp4"
                          />
                        </video>
                      )}
                    </div>
                  </figure>
                )
              )}
            </section>
          )}
        </>
      ) : null}

      {requiresSignature ? (
        <PolicySignatureForm
          itemId={item.id}
          policyTitle={item.title}
          defaultSignedName={defaultSignedName}
          alreadySigned={Boolean(signature)}
          signedName={signature?.signedName ?? null}
          signedAtISO={signature?.signedAtISO ?? null}
          onSigned={(result) =>
            onPolicySigned?.({
              itemId: item.id,
              readItems: result.readItems,
              signedName: result.signedName,
              signedAtISO: result.signedAtISO,
            })
          }
        />
      ) : (
        !isRead &&
        onMarkDone && (
          <div className={styles.readActions}>
            <button
              type="button"
              className={styles.btnMarkRead}
              onClick={handleMarkDone}
              disabled={pending}
            >
              {pending ? t("section.marking") : `✓ ${t("section.markDone")}`}
            </button>
          </div>
        )
      )}
    </div>
  );
}
