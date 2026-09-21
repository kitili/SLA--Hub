import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import styles from "@/components/hub.module.css";

export default function NotFound() {
  return (
    <div className={styles.blank}>
      <div className={styles.blankCard}>
        <BrandLogo variant="logomark" width={56} height={56} />
        <h1>That desk is not in the hub yet</h1>
        <p>The page you opened is not one of the department homes. Head back and pick a live desk.</p>
        <Link className={styles.primary} href="/hub">
          Back to Silverleaf Hub
        </Link>
      </div>
    </div>
  );
}
