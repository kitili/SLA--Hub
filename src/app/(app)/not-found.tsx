import Link from "next/link";
import styles from "@/components/hub.module.css";

export default function AppNotFound() {
  return (
    <div className={styles.blankCard}>
      <p className={styles.eyebrow}>404</p>
      <h1>That desk is not in the hub yet</h1>
      <p>This page is not one of the department homes. Pick a live desk from the hub.</p>
      <Link className={styles.primary} href="/hub">
        Back to hub
      </Link>
    </div>
  );
}
