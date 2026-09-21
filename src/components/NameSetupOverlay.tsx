"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { brand } from "@/lib/brand";
import { setNameAction } from "@/lib/actions/profile";
import styles from "./StaffRegistration.module.css";

export default function NameSetupOverlay() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await setNameAction(fullName);
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(result.error);
    });
  }

  return (
    <div className={styles.staffRegistrationOverlay}>
      <div className={styles.staffRegistrationCard}>
        <Image
          src={brand.logos.logomarkElectricBlue}
          alt="Silverleaf Academy"
          width={48}
          height={48}
          className={styles.regLogo}
        />
        <h1>Welcome to Silverleaf</h1>
        <p className={styles.regSub}>
          Please enter your full name. It will appear at the top of your dashboard and on your profile throughout the system.
        </p>

        <form onSubmit={handleSubmit} className={styles.regForm}>
          <label>
            Full name
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jane Mwangi"
              autoFocus
              required
              minLength={2}
              maxLength={120}
              disabled={pending}
            />
          </label>

          {error && <p className={styles.regError}>{error}</p>}

          <button
            type="submit"
            className={styles.regSubmit}
            disabled={pending || fullName.trim().length < 2}
          >
            {pending ? "Saving…" : "Continue →"}
          </button>
        </form>
      </div>
    </div>
  );
}
