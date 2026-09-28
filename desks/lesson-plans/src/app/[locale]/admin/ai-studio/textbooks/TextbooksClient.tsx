"use client";

/**
 * TextbooksClient — interactive Textbooks admin panel.
 *
 * Two views:
 *   list   → table of textbooks + upload PDF panel
 *   detail → textbook_pages list; click page for full content, re-OCR, edit
 *
 * Upload flow: multipart POST to /api/ai/textbooks → textbookId, then poll
 * getIngestStatus every ~2.5 s until done/failed.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import {
  getTextbook,
  getTextbookPage,
  getIngestStatus,
  reOcrPage,
  upsertTextbookPage,
  deleteTextbook,
  type UpsertTextbookPageInput,
} from "@/lib/actions/textbooks";

import styles from "./TextbooksClient.module.css";

// ── types ─────────────────────────────────────────────────────────────────────

type TextbookRow = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  status: string;
  pagesProcessed: number;
  pageCount: number | null;
};

type PageRow = {
  id: string;
  pageNumber: number;
  chapter: string | null;
  heading: string | null;
  contentPreview: string;
};

type FullPage = {
  id: string;
  textbookId: string;
  pageNumber: number;
  chapter: string | null;
  heading: string | null;
  content: string;
  keywords?: string[] | null;
  ocrModel?: string | null;
  imageKey?: string | null;
  ocrAt?: Date | string | null;
  source?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

type TextbookDetail = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  status: string;
  pagesProcessed: number;
  pageCount: number | null;
};

interface TextbooksClientProps {
  initialTextbooks: TextbookRow[];
}

// ── sub-component: PageDetailPanel ────────────────────────────────────────────

function PageDetailPanel({
  page,
  onClose,
  onUpdated,
}: {
  page: FullPage;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const t = useTranslations("lpManage.textbooks");
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(page.content);
  const [chapter, setChapter] = useState(page.chapter ?? "");
  const [heading, setHeading] = useState(page.heading ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSavePage() {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const input: UpsertTextbookPageInput = {
        id: page.id,
        textbookId: page.textbookId,
        pageNumber: page.pageNumber,
        chapter: chapter || null,
        heading: heading || null,
        content,
      };
      const result = await upsertTextbookPage(input);
      if (result.ok) {
        setMsg(t("savedPage"));
        setEditing(false);
        onUpdated();
      } else {
        setError(t("errorGeneric"));
      }
    });
  }

  function handleReOcr() {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const result = await reOcrPage(page.id);
      if (result.ok) {
        setMsg(t("reOcrDone"));
        onUpdated();
      } else {
        setError(t("errorGeneric"));
      }
    });
  }

  return (
    <div className={styles.pageDetailPanel}>
      <div className={styles.pageDetailHeader}>
        <h3>{t("pageHeading", { page: page.pageNumber })}</h3>
        <button className={styles.btnSecondary} onClick={onClose}>
          {t("closeDetail")}
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {msg ? <p className={styles.success}>{msg}</p> : null}

      {editing ? (
        <div className={styles.editPageForm}>
          <label className={styles.fieldLabel}>
            {t("fieldChapter")}
            <input
              className={styles.input}
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              disabled={pending}
            />
          </label>
          <label className={styles.fieldLabel}>
            {t("fieldHeading")}
            <input
              className={styles.input}
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              disabled={pending}
            />
          </label>
          <label className={styles.fieldLabel}>
            {t("fieldContent")}
            <textarea
              className={styles.textarea}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              disabled={pending}
            />
          </label>
          <div className={styles.formActions}>
            <button
              className={styles.btnPrimary}
              onClick={handleSavePage}
              disabled={pending}
            >
              {pending ? t("savingPage") : t("savePage")}
            </button>
            <button
              className={styles.btnSecondary}
              onClick={() => setEditing(false)}
              disabled={pending}
            >
              {t("cancelEdit")}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.pageContent}>
          {page.chapter ? (
            <p className={styles.pageMeta}>
              {t("metaChapter", { chapter: page.chapter })}
            </p>
          ) : null}
          {page.heading ? (
            <p className={styles.pageMeta}>
              {t("metaHeading", { heading: page.heading })}
            </p>
          ) : null}
          <pre className={styles.pageText}>{page.content}</pre>
          <div className={styles.formActions}>
            <button
              className={styles.btnSecondary}
              onClick={() => setEditing(true)}
              disabled={pending}
            >
              {t("editPage")}
            </button>
            {page.imageKey ? (
              <button
                className={styles.btnSecondary}
                onClick={handleReOcr}
                disabled={pending}
              >
                {pending ? t("reOcring") : t("reOcr")}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export default function TextbooksClient({ initialTextbooks }: TextbooksClientProps) {
  const t = useTranslations("lpManage.textbooks");
  const router = useRouter();

  // Render the list straight from the server prop: router.refresh() re-renders
  // this component with fresh props but PRESERVES client state, so a useState
  // copy would never show a newly ingested/deleted textbook until a hard reload.
  const textbooks = initialTextbooks;
  const [view, setView] = useState<"list" | "detail">("list");
  const [detail, setDetail] = useState<TextbookDetail | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [selectedPage, setSelectedPage] = useState<FullPage | null>(null);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadSubject, setUploadSubject] = useState("");
  const [uploadGrade, setUploadGrade] = useState("");
  const [uploadOcrModel, setUploadOcrModel] = useState("");
  const [uploadPending, startUploadTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Ingest polling state
  const [ingestingId, setIngestingId] = useState<string | null>(null);
  const [ingestStatus, setIngestStatus] = useState<{
    status: string;
    pagesProcessed: number;
    pageCount: number | null;
    done: boolean;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detail state
  const [detailPending, startDetailTransition] = useTransition();
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  // ── ingest polling ──────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!ingestingId) return;

    pollRef.current = setInterval(async () => {
      const result = await getIngestStatus(ingestingId);
      if (!result.ok) return;

      setIngestStatus({
        status: result.status ?? "unknown",
        pagesProcessed: result.pagesProcessed ?? 0,
        pageCount: result.pageCount ?? null,
        done: result.done ?? false,
      });

      if (result.done) {
        stopPolling();
        setIngestingId(null);
        router.refresh();
      }
    }, 2500);

    return () => {
      stopPolling();
    };
  }, [ingestingId, stopPolling, router]);

  // ── upload ──────────────────────────────────────────────────────────────────

  function handleUpload() {
    if (!uploadFile) return;
    setUploadError(null);
    setIngestStatus(null);

    startUploadTransition(async () => {
      const fd = new FormData();
      fd.append("file", uploadFile);
      if (uploadTitle) fd.append("title", uploadTitle);
      if (uploadSubject) fd.append("subject", uploadSubject);
      if (uploadGrade) fd.append("grade", uploadGrade);
      if (uploadOcrModel) fd.append("ocrModelId", uploadOcrModel);

      try {
        const res = await fetch("/api/ai/textbooks", {
          method: "POST",
          body: fd,
        });
        const json = (await res.json()) as { textbookId?: string; error?: string };
        if (!res.ok || !json.textbookId) {
          setUploadError(json.error ?? t("errorGeneric"));
          return;
        }
        // Start polling
        setIngestingId(json.textbookId);
        setIngestStatus({ status: "ingesting", pagesProcessed: 0, pageCount: null, done: false });
        // Reset form
        setUploadFile(null);
        setUploadTitle("");
        setUploadSubject("");
        setUploadGrade("");
        setUploadOcrModel("");
      } catch (err) {
        const message = err instanceof Error ? err.message : t("errorGeneric");
        setUploadError(message);
      }
    });
  }

  // ── detail view ─────────────────────────────────────────────────────────────

  function openDetail(textbook: TextbookRow) {
    setDetailError(null);
    setSelectedPage(null);
    startDetailTransition(async () => {
      const result = await getTextbook(textbook.id);
      if (!result.ok) {
        setDetailError(t("errorGeneric"));
        return;
      }
      setDetail({
        id: textbook.id,
        title: result.textbook?.title ?? textbook.title,
        subject: result.textbook?.subject ?? textbook.subject,
        grade: result.textbook?.grade ?? textbook.grade,
        status: result.textbook?.status ?? textbook.status,
        pagesProcessed: result.textbook?.pagesProcessed ?? textbook.pagesProcessed,
        pageCount: result.textbook?.pageCount ?? textbook.pageCount,
      });
      setPages((result.pages as PageRow[]) ?? []);
      setView("detail");
    });
  }

  async function openPage(pageRow: PageRow) {
    const result = await getTextbookPage(pageRow.id);
    if (result.ok && result.page) {
      setSelectedPage(result.page as unknown as FullPage);
    }
  }

  function handlePageUpdated() {
    if (!detail) return;
    startDetailTransition(async () => {
      const result = await getTextbook(detail.id);
      if (result.ok) {
        setPages((result.pages as PageRow[]) ?? []);
        setSelectedPage(null);
      }
    });
  }

  function handleDelete() {
    if (!detail) return;
    if (!confirm(t("deleteConfirm"))) return;
    startDeleteTransition(async () => {
      const result = await deleteTextbook(detail.id);
      if (!result.ok) {
        setDetailError(t("errorGeneric"));
        return;
      }
      setView("list");
      setDetail(null);
      setPages([]);
      setSelectedPage(null);
      router.refresh();
    });
  }

  // ── render: detail ──────────────────────────────────────────────────────────

  if (view === "detail" && detail) {
    return (
      <div className={styles.wrap}>
        <button
          className={styles.backLink}
          onClick={() => {
            setView("list");
            setDetail(null);
            setSelectedPage(null);
          }}
        >
          {t("backToList")}
        </button>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>{detail.title}</h2>
          <p className={styles.meta}>
            {[detail.grade, detail.subject, detail.status]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className={styles.meta}>
            {detail.pageCount != null
              ? t("ocrPages", {
                  processed: detail.pagesProcessed,
                  total: detail.pageCount,
                })
              : t("ocrPagesNoTotal", { processed: detail.pagesProcessed })}
          </p>

          {detailError ? <p className={styles.error}>{detailError}</p> : null}

          {detailPending ? (
            <p className={styles.muted}>{t("uploading")}</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t("pageColumns.page")}</th>
                    <th>{t("pageColumns.chapter")}</th>
                    <th>{t("pageColumns.heading")}</th>
                    <th>{t("pageColumns.preview")}</th>
                    <th>{t("pageColumns.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.id}>
                      <td>{p.pageNumber}</td>
                      <td>{p.chapter ?? "—"}</td>
                      <td>{p.heading ?? "—"}</td>
                      <td className={styles.cellClamp}>{p.contentPreview}</td>
                      <td>
                        <button
                          className={styles.btnSmall}
                          onClick={() => openPage(p)}
                        >
                          {t("view")}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.emptyCell}>
                        {t("empty")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}

          {selectedPage ? (
            <PageDetailPanel
              page={selectedPage}
              onClose={() => setSelectedPage(null)}
              onUpdated={handlePageUpdated}
            />
          ) : null}

          <div className={styles.dangerZone}>
            <button
              className={styles.btnDanger}
              onClick={handleDelete}
              disabled={deletePending}
            >
              {deletePending ? t("deleting") : t("deleteButton")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── render: list ────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>
      {/* Textbook list */}
      {textbooks.length === 0 ? (
        <p className={styles.empty}>{t("empty")}</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("columns.title")}</th>
                <th>{t("columns.grade")}</th>
                <th>{t("columns.subject")}</th>
                <th>{t("columns.status")}</th>
                <th>{t("columns.progress")}</th>
                <th>{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {textbooks.map((tb) => (
                <tr key={tb.id}>
                  <td>{tb.title}</td>
                  <td>{tb.grade ?? "—"}</td>
                  <td>{tb.subject ?? "—"}</td>
                  <td>
                    <span className={styles[`status_${tb.status}`] ?? styles.statusDefault}>
                      {tb.status}
                    </span>
                  </td>
                  <td>
                    {tb.pagesProcessed}
                    {tb.pageCount != null ? `/${tb.pageCount}` : ""}
                  </td>
                  <td>
                    <button
                      className={styles.btnSmall}
                      onClick={() => openDetail(tb)}
                      disabled={detailPending}
                    >
                      {t("view")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ingest progress banner */}
      {ingestStatus ? (
        <div className={styles.ingestBanner}>
          {ingestStatus.done ? (
            ingestStatus.status === "failed" ? (
              <span className={styles.error}>{t("ingestFailed")}</span>
            ) : (
              <span className={styles.success}>
                {t("ingestDone", { pages: ingestStatus.pagesProcessed })}
              </span>
            )
          ) : (
            <span className={styles.muted}>
              {ingestStatus.pageCount != null
                ? t("ingestingPages", {
                    processed: ingestStatus.pagesProcessed,
                    total: ingestStatus.pageCount,
                  })
                : t("ingestingPagesNoTotal", {
                    processed: ingestStatus.pagesProcessed,
                  })}
            </span>
          )}
        </div>
      ) : null}

      {/* Upload panel */}
      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>{t("uploadHeading")}</h2>

        <label className={styles.fieldLabel}>
          {t("uploadLabel")}
          <input
            type="file"
            accept=".pdf"
            className={styles.input}
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            disabled={uploadPending}
          />
        </label>

        <div className={styles.uploadGrid}>
          <label className={styles.fieldLabel}>
            {t("uploadTitle")}
            <input
              className={styles.input}
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              disabled={uploadPending}
              placeholder={t("placeholderTitle")}
            />
          </label>
          <label className={styles.fieldLabel}>
            {t("uploadSubject")}
            <input
              className={styles.input}
              value={uploadSubject}
              onChange={(e) => setUploadSubject(e.target.value)}
              disabled={uploadPending}
              placeholder={t("placeholderSubject")}
            />
          </label>
          <label className={styles.fieldLabel}>
            {t("uploadGrade")}
            <input
              className={styles.input}
              value={uploadGrade}
              onChange={(e) => setUploadGrade(e.target.value)}
              disabled={uploadPending}
              placeholder={t("placeholderGrade")}
            />
          </label>
          <label className={styles.fieldLabel}>
            {t("uploadOcrModel")}
            <input
              className={styles.input}
              value={uploadOcrModel}
              onChange={(e) => setUploadOcrModel(e.target.value)}
              disabled={uploadPending}
              placeholder={t("placeholderOcrModel")}
            />
          </label>
        </div>

        {uploadError ? <p className={styles.error}>{uploadError}</p> : null}

        <button
          className={styles.btnPrimary}
          onClick={handleUpload}
          disabled={!uploadFile || uploadPending}
        >
          {uploadPending ? t("uploading") : t("uploadButton")}
        </button>
      </div>
    </div>
  );
}
