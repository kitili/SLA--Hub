"use client";

import { useState } from "react";
import CollapsibleForm from "./CollapsibleForm";
import MaterialUploadForm, { type UploadItemOption } from "./MaterialUploadForm";
import YoutubeForm from "./YoutubeForm";
import styles from "./admin.module.css";

export default function CreateMaterialPanel({
  openLabel,
  items,
}: {
  openLabel: string;
  items: UploadItemOption[];
}) {
  return (
    <CollapsibleForm openLabel={openLabel}>
      {(close) => <MaterialPanel items={items} onDone={close} />}
    </CollapsibleForm>
  );
}

function MaterialPanel({
  items,
  onDone,
}: {
  items: UploadItemOption[];
  onDone: () => void;
}) {
  const [tab, setTab] = useState<"file" | "youtube">("file");

  return (
    <div>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === "file" ? styles.tabActive : ""}`}
          onClick={() => setTab("file")}
        >
          Upload File
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === "youtube" ? styles.tabActive : ""}`}
          onClick={() => setTab("youtube")}
        >
          YouTube Video
        </button>
      </div>

      {tab === "file" ? (
        <MaterialUploadForm items={items} onDone={onDone} />
      ) : (
        <YoutubeForm items={items} onDone={onDone} />
      )}
    </div>
  );
}
