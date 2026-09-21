import { getTranslations } from "next-intl/server";

import { contentRepo, policySignaturesRepo } from "@/lib/db/repositories";
import { resolveLocalized } from "@/lib/i18n-content";
import type { Locale } from "@/i18n/routing";
import { itemRequiresPolicySignature } from "@/lib/policy-briefings";
import { isDeclarationSection } from "@/lib/section-declarations";
import styles from "./admin.module.css";

interface Props {
  memberId: string;
  locale: string;
}

export default async function MemberPolicySignatures({
  memberId,
  locale,
}: Props) {
  const t = await getTranslations("admin.memberDetail.policySignatures");
  const tree = await contentRepo.getSectionsWithItems();
  const policySection = tree.find((s) => isDeclarationSection(s.id));
  if (!policySection) return null;

  const itemIds = policySection.items
    .filter((it) => itemRequiresPolicySignature(it.id, policySection.id))
    .map((it) => it.id);
  if (itemIds.length === 0) return null;

  const signatures = await policySignaturesRepo.listSignaturesForMemberItems(
    memberId,
    itemIds,
  );
  const byItem = new Map(signatures.map((s) => [s.itemId, s]));

  return (
    <section
      className={styles.memberProgressPanel}
      aria-labelledby="member-policy-sigs-heading"
      style={{ marginTop: "1.25rem" }}
    >
      <h2 id="member-policy-sigs-heading">{t("heading")}</h2>
      <p className={styles.muted}>{t("readOnly")}</p>
      <ul className={styles.memberProgressList}>
        {policySection.items
          .filter((it) => itemRequiresPolicySignature(it.id, policySection.id))
          .map((item) => {
            const title =
              resolveLocalized(item, "title", locale as Locale) ?? item.id;
            const sig = byItem.get(item.id);
            return (
              <li key={item.id}>
                <div className={styles.memberProgressRow}>
                  <span>{title}</span>
                  {sig ? (
                    <span className={styles.formSuccess} style={{ fontSize: "0.82rem" }}>
                      {t("signed", {
                        name: sig.signedName,
                        when: new Date(sig.signedAt).toLocaleString(),
                      })}
                    </span>
                  ) : (
                    <span className={styles.muted} style={{ fontSize: "0.82rem" }}>
                      {t("notSigned")}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
