"use client";

/**
 * StaffRegistration — full-screen overlay for staff sign-in (onboarding parity).
 *
 * Staff: work email + ed-admin Staff ID. HR admins in HR_ADMIN_EMAILS: email +
 * admin password. Verified server-side in `signInMemberAction`.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { brand } from "@/lib/brand";
import styles from "./StaffRegistration.module.css";

export interface StaffRegistrationResult {
  ok: boolean;
  error?:
    | "not-registered"
    | "inactive"
    | "invalid-input"
    | "admin-password-required"
    | "admin-password-invalid"
    | "directory-unavailable"
    | "failed";
}

export interface StaffRegistrationProps {
  onSubmit: (input: {
    email: string;
    staffId?: string;
    adminPassword?: string;
  }) => Promise<StaffRegistrationResult>;
  /** Normalized emails that use admin password sign-in (from HR_ADMIN_EMAILS). */
  adminEmails?: string[];
  dbOnline?: boolean;
}

export default function StaffRegistration({
  onSubmit,
  adminEmails = [],
  dbOnline = true,
}: StaffRegistrationProps) {
  const t = useTranslations("member");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [staffId, setStaffId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [forceAdminMode, setForceAdminMode] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const normalizedEmail = email.trim().toLowerCase();
  const isAdminMode =
    forceAdminMode || adminEmails.includes(normalizedEmail);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await onSubmit(
        isAdminMode ? { email, adminPassword } : { email, staffId },
      );
      if (result.ok) {
        router.refresh();
        return;
      }

      switch (result.error) {
        case "not-registered":
          setError(t("register.notRegistered"));
          break;
        case "inactive":
          setError(t("register.inactive"));
          break;
        case "invalid-input":
          setError(t("register.invalidInput"));
          break;
        case "admin-password-required":
          setForceAdminMode(true);
          setError(t("register.adminPasswordRequired"));
          break;
        case "admin-password-invalid":
          setForceAdminMode(true);
          setError(t("register.adminPasswordInvalid"));
          break;
        case "directory-unavailable":
          setError(t("register.directoryUnavailable"));
          break;
        default:
          setError(t("register.failed"));
      }
    } catch {
      setError(t("register.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.staffRegistrationOverlay}>
      <div className={styles.staffRegistrationCard}>
        <Image
          src={brand.logos.logomarkElectricBlue}
          alt={brand.shortName}
          width={48}
          height={48}
          className={styles.regLogo}
        />
        <h1>{t("register.welcome")}</h1>
        <p className={styles.regSub}>
          {isAdminMode ? t("register.adminSubtitle") : t("register.subtitle")}
        </p>

        {!dbOnline && (
          <p className={styles.regOffline}>{t("register.offline")}</p>
        )}

        <form onSubmit={handleSubmit} className={styles.regForm}>
          <label>
            {t("register.emailLabel")}
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setForceAdminMode(false);
              }}
              required
              placeholder={t("register.emailPlaceholder")}
              autoFocus
            />
          </label>

          {isAdminMode ? (
            <label>
              {t("register.adminPasswordLabel")}
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder={t("register.adminPasswordPlaceholder")}
                autoComplete="current-password"
                required
              />
            </label>
          ) : (
            <label>
              {t("register.idLabel")}{" "}
              <span className={styles.optional}>{t("register.idHint")}</span>
              <input
                type="text"
                inputMode="numeric"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder={t("register.idPlaceholder")}
                required
              />
            </label>
          )}

          {error && <p className={styles.regError}>{error}</p>}

          <button
            type="submit"
            className={styles.regSubmit}
            disabled={!hydrated || submitting}
          >
            {!hydrated || submitting
              ? t("register.submitting")
              : t("register.continue")}
          </button>
        </form>
      </div>
    </div>
  );
}
