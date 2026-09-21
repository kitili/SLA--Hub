import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { contentRepo, policyBriefingsRepo, policySignaturesRepo, progressRepo, quizzesRepo } from "@/lib/db/repositories";
import { getMaterialsForItems } from "@/lib/db/queries/member";
import { resolveLocalized } from "@/lib/i18n-content";
import { getSectionGuidance } from "@/lib/onboarding-guidance";
import { getAllSettings } from "@/lib/app-settings";
import { getSectionStory } from "@/lib/onboarding-story";
import { getSectionTeamIntros } from "@/lib/onboarding-team";
import { itemRequiresPolicySignature, resolveMemberBriefing } from "@/lib/policy-briefings";
import { isDeclarationSection } from "@/lib/section-declarations";
import { REQUIRED_SECTION_IDS } from "@/lib/required-sections";
import type { DocumentFileLink } from "@/components/DocumentCard";
import type { QuizQuestionView } from "@/components/CheckpointQuiz";
import SectionFlow, { type SectionFlowItem } from "./SectionFlow";
import styles from "./section.module.css";

type Params = Promise<{ locale: string; sectionId: string }>;
type SearchParams = Promise<{ resume?: string }>;

/** Build the /view href for a material from its storage key. */
function viewerHref(storageKey: string): string {
  return `/view?key=${encodeURIComponent(storageKey)}`;
}

function viewerChapterHref(storageKey: string, startSeconds: number): string {
  return `${viewerHref(storageKey)}&t=${startSeconds}`;
}

function materialSrc(storageKey: string, startSeconds?: number): string {
  const base = `/api/materials/${encodeURIComponent(storageKey)}`;
  return startSeconds === undefined ? base : `${base}#t=${startSeconds}`;
}

/**
 * Section page — the read-then-checkpoint flow for one section.
 *
 * Server-enforced gating:
 *   - unauthenticated → redirect to the dashboard (which shows the sign-in gate)
 *
 * Every section is open from the start — there is no sequential locking.
 *
 * Dynamic: reads the session + per-member progress, so it renders per-request.
 */
export const dynamic = "force-dynamic";

export default async function SectionPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale, sectionId } = await params;
  setRequestLocale(locale);
  const { resume } = await searchParams;

  const member = await getCurrentUser();
  if (!member) {
    // Not signed in → send to the localized dashboard, which renders the
    // sign-in gate. `redirect` (next/navigation) throws, so TS narrows `member`.
    redirect(`/${locale}`);
  }

  const t = await getTranslations("member");

  const [tree, progress] = await Promise.all([
    contentRepo.getSectionsWithItems(),
    progressRepo.getProgressForStaff(member.id),
  ]);

  const index = tree.findIndex((s) => s.id === sectionId);
  if (index === -1) notFound();
  const section = tree[index]!;
  const nextSection = tree[index + 1] ?? null;

  // Every section is open from the start — no sequential locking.
  const passedSet = new Set(progress.passedCheckpoints);

  const sectionTitle =
    resolveLocalized(section, "title", locale as Locale) ?? section.id;
  const guidance = getSectionGuidance(section.id, locale as Locale);
  const story = getSectionStory(section.id, locale as Locale);
  const teamIntros = getSectionTeamIntros(section.id, locale as Locale);

  // ── Team intro video URLs (from admin settings) ───────────────────────
  const teamVideoUrls: Record<string, string> = {};
  if (teamIntros) {
    const allSettings = await getAllSettings();
    const KEY_MAP: Record<string, string> = {
      "CEO / Founder":   "team_video_ceo",
      "Head of School":  "team_video_hos",
      "People / HR":     "team_video_hr",
      "Department Leads":"team_video_dept",
    };
    for (const person of teamIntros.people) {
      const settingKey = KEY_MAP[person.name];
      if (settingKey && allSettings[settingKey]) {
        teamVideoUrls[person.name] = allSettings[settingKey];
      }
    }
  }

  // ── Resolve materials per item → openable file links ──────────────────
  const itemIds = section.items.map((it) => it.id);
  const [materialsByItem, policySignatures, publishedBriefings] = await Promise.all([
    getMaterialsForItems(itemIds),
    isDeclarationSection(section.id)
      ? policySignaturesRepo.listSignaturesForMemberItems(member.id, itemIds)
      : Promise.resolve([]),
    isDeclarationSection(section.id)
      ? policyBriefingsRepo.listPublishedBriefingsForItems(itemIds)
      : Promise.resolve([]),
  ]);
  const signatureByItem = new Map(
    policySignatures.map((row) => [
      row.itemId,
      {
        signedName: row.signedName,
        signedAtISO: row.signedAt.toISOString(),
      },
    ]),
  );
  const publishedScriptByItem = new Map(
    publishedBriefings.map((row) => [row.sectionItemId, row.scriptEn]),
  );

  const flowItems: SectionFlowItem[] = section.items.map((item) => {
    const itemMaterials = materialsByItem.get(item.id) ?? [];
    const fileLinks: DocumentFileLink[] = itemMaterials.map((material) => {
      const isYoutube = material.contentType === "video/youtube";
      const isVideo =
        !isYoutube &&
        (item.type === "video" || material.contentType.startsWith("video/"));
      const isKeyPoints =
        /key points/i.test(material.filename) ||
        material.storageKey.includes("AI Key Points");
      const label = isKeyPoints
        ? `AI Key Points — ${material.filename.replace(/^.*?—\s*/, "").replace(/\s*—\s*Key Points\.html$/i, "").trim() || material.filename}`
        : isVideo || isYoutube
          ? material.filename.replace(/\.[^.]+$/, "")
          : material.filename;
      return {
        label,
        href: viewerHref(material.storageKey),
        isVideo,
        streamUrl: isVideo ? materialSrc(material.storageKey) : undefined,
        isYoutube,
        youtubeUrl: isYoutube ? material.storageKey : undefined,
      };
    });
    return {
      id: item.id,
      title: resolveLocalized(item, "title", locale as Locale) ?? item.id,
      note: resolveLocalized(item, "note", locale as Locale),
      type: item.type,
      fileLinks,
      signature: signatureByItem.get(item.id) ?? null,
      requiresSignature: itemRequiresPolicySignature(item.id, section.id),
      briefing: resolveMemberBriefing(
        item.id,
        resolveLocalized(item, "title", locale as Locale) ?? item.id,
        publishedScriptByItem.get(item.id) ?? null,
      ),
    };
  });

  // ── Quiz (localised, no correct answers) ──────────────────────────────
  const quizId = `section-${section.id}`;
  const quiz = await quizzesRepo.getQuizForMember(quizId);
  const questions: QuizQuestionView[] | null = quiz
    ? quiz.questions.map((q) => ({
        id: q.id,
        text: resolveLocalized(q, "text", locale as Locale) ?? "",
        options: q.options.map((o) => ({
          id: o.id,
          text: resolveLocalized(o, "text", locale as Locale) ?? "",
        })),
      }))
    : null;

  const initialReadIds = section.items
    .map((it) => it.id)
    .filter((id) => progress.readItems.includes(id));
  const initialPassed = passedSet.has(quizId);

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>
        ← {t("section.backToDashboard")}
      </Link>

      <header className={styles.header}>
        {section.icon && (
          <span className={styles.sectionEmoji} aria-hidden>
            {section.icon}
          </span>
        )}
        <div>
          <span className={styles.sectionLabel}>
            {t("section.sectionLabel", { number: section.number })}
          </span>
          <h1 className={styles.title}>{sectionTitle}</h1>
          {resolveLocalized(section, "description", locale as Locale) && (
            <p className={styles.description}>
              {resolveLocalized(section, "description", locale as Locale)}
            </p>
          )}
        </div>
      </header>

      {story && (
        <section className={styles.story} aria-labelledby="story-heading">
          <div className={styles.storyCopy}>
            <span className={styles.storyKicker}>{story.kicker}</span>
            <h2 id="story-heading">{story.title}</h2>
            <p>{story.intro}</p>
          </div>

          <div className={styles.storyChapters}>
            {story.chapters.map((chapter) => (
              <Link
                key={chapter.title}
                href={viewerChapterHref(story.videoKey, chapter.startSeconds) as never}
                className={styles.storyChapter}
              >
                <span>{chapter.eyebrow}</span>
                <h3>{chapter.title}</h3>
                <p>{chapter.summary}</p>
                <em>{chapter.prompt}</em>
              </Link>
            ))}
          </div>
        </section>
      )}

      {teamIntros && (
        <section className={styles.team} aria-labelledby="team-heading">
          <div className={styles.teamIntro}>
            <span className={styles.teamKicker}>{teamIntros.kicker}</span>
            <h2 id="team-heading">{teamIntros.title}</h2>
            <p>{teamIntros.intro}</p>
          </div>

          <div className={styles.teamGrid}>
            {teamIntros.people.flatMap((person) => {
              const rawUrl = teamVideoUrls[person.name];

              // Department Leads: stored as a JSON array of {label, url} entries.
              if (person.name === "Department Leads") {
                let deptEntries: { label: string; url: string; active?: boolean }[] = [];
                try {
                  const parsed = rawUrl ? JSON.parse(rawUrl) : [];
                  if (Array.isArray(parsed)) deptEntries = parsed as typeof deptEntries;
                } catch {
                  // ignore
                }

                if (deptEntries.length === 0) {
                  return [
                    <article key="dept-placeholder" className={styles.teamCard}>
                      <div className={styles.teamAvatar} aria-hidden>DL</div>
                      <div className={styles.teamCardBody}>
                        <span className={styles.teamVideoTag}>Video coming soon</span>
                        <h3>{person.name}</h3>
                        <p className={styles.teamRole}>{person.role}</p>
                        <p>{person.helpsWith}</p>
                        <blockquote>{person.firstMonthPrompt}</blockquote>
                      </div>
                    </article>,
                  ];
                }

                return deptEntries
                  .filter((entry) => entry.active !== false)
                  .map((entry) => {
                    const embedUrl = toYoutubeEmbed(entry.url);
                    return (
                      <article key={entry.url} className={`${styles.teamCard}${embedUrl ? ` ${styles.teamCardVideo}` : ""}`}>
                        {embedUrl ? (
                          <div className={styles.teamVideoEmbed}>
                            <iframe
                              src={embedUrl}
                              title={`${entry.label} intro video`}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        ) : (
                          <div className={styles.teamAvatar} aria-hidden>DL</div>
                        )}
                        <div className={styles.teamCardBody}>
                          <span className={styles.teamVideoTag} style={embedUrl ? { color: "#16a34a" } : {}}>
                            {embedUrl ? "▶ Intro video" : "Video coming soon"}
                          </span>
                          <h3>{entry.label}</h3>
                          <p className={styles.teamRole}>{person.role}</p>
                          <p>{person.helpsWith}</p>
                          <blockquote>{person.firstMonthPrompt}</blockquote>
                        </div>
                      </article>
                    );
                  });
              }

              // All other people: single video (blob or YouTube).
              const isBlob = rawUrl?.includes("blob.vercel-storage.com");
              const embedUrl = isBlob ? null : toYoutubeEmbed(rawUrl);
              const hasVideo = isBlob || !!embedUrl;
              return [
                <article key={person.name} className={`${styles.teamCard}${hasVideo ? ` ${styles.teamCardVideo}` : ""}`}>
                  {isBlob ? (
                    <div className={styles.teamVideoEmbed}>
                      <video
                        src={`/api/materials/${encodeURIComponent(rawUrl ?? "")}`}
                        controls
                        preload="metadata"
                      />
                    </div>
                  ) : embedUrl ? (
                    <div className={styles.teamVideoEmbed}>
                      <iframe
                        src={embedUrl}
                        title={`${person.name} intro video`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className={styles.teamAvatar} aria-hidden>
                      {person.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                  )}
                  <div className={styles.teamCardBody}>
                    <span className={styles.teamVideoTag} style={hasVideo ? { color: "#16a34a" } : {}}>
                      {hasVideo ? "▶ Intro video" : "Video coming soon"}
                    </span>
                    <h3>{person.name}</h3>
                    <p className={styles.teamRole}>{person.role}</p>
                    <p>{person.helpsWith}</p>
                    <blockquote>{person.firstMonthPrompt}</blockquote>
                  </div>
                </article>,
              ];
            })}
          </div>
        </section>
      )}

      {guidance && (
        <section className={styles.guidance} aria-labelledby="guidance-heading">
          <div className={styles.guidanceIntro}>
            <span className={styles.guidanceKicker}>Guided orientation</span>
            <h2 id="guidance-heading">Before you start</h2>
            <p>{guidance.purpose}</p>
          </div>

          <div className={styles.guidanceGrid}>
            <div className={styles.guidancePanel}>
              <h3>What you should take away</h3>
              <p>{guidance.outcome}</p>
            </div>

            <div className={styles.guidancePanel}>
              <h3>How to move through this section</h3>
              <ul>
                {guidance.howToUse.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {guidance.mediaNote && (
            <p className={styles.mediaNote}>
              <strong>Media note:</strong> {guidance.mediaNote}
            </p>
          )}

          <blockquote className={styles.reflection}>
            <span>Reflection prompt</span>
            <p>{guidance.reflection}</p>
          </blockquote>
        </section>
      )}

      {section.items.length === 0 ? (
        <div className={styles.noItems}>
          <span aria-hidden>📦</span>
          <h2>{t("section.noItemsTitle")}</h2>
          <p>{t("section.noItemsBody")}</p>
        </div>
      ) : (
        <SectionFlow
          sectionId={section.id}
          sectionNumber={section.number}
          sectionTitle={sectionTitle}
          quizId={quizId}
          items={flowItems}
          questions={questions}
          initialReadIds={initialReadIds}
          initialPassed={initialPassed}
          nextSectionId={nextSection?.id ?? null}
          resumeItemId={resume}
          defaultSignedName={member.fullName ?? ""}
          finalSignOffPrerequisitesMet={
            isDeclarationSection(section.id)
              ? REQUIRED_SECTION_IDS.filter((id) => id !== "policies").every(
                  (id) => passedSet.has(`section-${id}`),
                )
              : false
          }
        />
      )}
    </main>
  );
}

/** Convert any YouTube URL to an embed URL, or return null if unrecognised. */
function toYoutubeEmbed(raw: string | undefined): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (url.includes("youtube.com/embed/")) return url.split("?")[0]!;
  const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;
  const watch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`;
  return null;
}
