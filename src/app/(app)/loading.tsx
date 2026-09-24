import styles from "@/components/hub.module.css";

export default function Loading() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.skelHero} />
      <div className={styles.skelRow}>
        <div className={styles.skelCard} />
        <div className={styles.skelCard} />
        <div className={styles.skelCard} />
        <div className={styles.skelCard} />
        <div className={styles.skelCard} />
        <div className={styles.skelCard} />
        <div className={styles.skelCard} />
        <div className={styles.skelCard} />
        <div className={styles.skelCard} />
        <div className={styles.skelCard} />
      </div>
    </div>
  );
}
