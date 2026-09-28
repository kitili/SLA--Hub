import { getTranslations } from "next-intl/server";

import { getBioProfile } from "@/lib/db/queries/bio";
import { listAllMemberDocuments } from "@/lib/db/queries/bio-documents";
import { getMemberById, listCampuses } from "@/lib/db/queries/admin";
import { Link } from "@/i18n/navigation";
import AdminToggle from "@/components/admin/AdminToggle";
import CampusSelect from "@/components/admin/CampusSelect";
import MemberOnboardingProgress from "@/components/admin/MemberOnboardingProgress";
import MemberPolicySignatures from "@/components/admin/MemberPolicySignatures";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function docTypeLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  if (raw === "Curriculum Vitae") return "CV / Résumé";
  if (raw === "Qualification Certificate") return "Qualification Certificate";
  if (raw.startsWith("QualDoc:")) {
    const n = parseInt(raw.slice("QualDoc:".length), 10);
    return `Qualification #${n + 1} Certificate`;
  }
  return raw;
}

function val(v: string | null | undefined): string {
  return v?.trim() || "—";
}

function yesNo(v: boolean | null | undefined): string {
  if (v == null) return "—";
  return v ? "Yes" : "No";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        marginTop: "2rem",
        marginBottom: "0.5rem",
        paddingBottom: "0.35rem",
        borderBottom: "2px solid #e9ecef",
        fontSize: "1.05rem",
        fontWeight: 700,
        color: "#343a40",
      }}
    >
      {children}
    </h2>
  );
}

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ locale: string; memberId: string }>;
}) {
  const { locale, memberId } = await params;
  const t = await getTranslations("admin.memberDetail");

  const [bio, documents, member, campuses] = await Promise.all([
    getBioProfile(memberId),
    listAllMemberDocuments(memberId),
    getMemberById(memberId),
    listCampuses(),
  ]);

  const fullName = bio
    ? [bio.profile.firstName, bio.profile.middleName, bio.profile.surname]
        .filter(Boolean)
        .join(" ")
    : member?.fullName ?? "";

  return (
    <>
      <Link href="/admin/members" className={styles.detailBack}>
        {t("backToMembers")}
      </Link>

      <div className={styles.pageHeader}>
        <h1 style={{ fontSize: "1.4rem" }}>{fullName || t("heading")}</h1>
      </div>

      {/* ── Onboarding progress (read-only) ── */}
      {member && (
        <MemberOnboardingProgress
          member={{ id: memberId, fullName: member.fullName }}
          locale={locale}
        />
      )}

      {member && (
        <MemberPolicySignatures memberId={memberId} locale={locale} />
      )}

      {/* ── Admin controls ── */}
      {member && (
        <AdminToggle memberId={memberId} initialIsAdmin={member.isAdmin} />
      )}

      {member && (
        <div className={styles.campusAssignBlock}>
          <h2>{t("campusHeading")}</h2>
          <p className={styles.muted}>{t("campusHelp")}</p>
          <CampusSelect
            memberId={memberId}
            currentCampus={member.campus ?? null}
            campuses={campuses.map((c) => ({ id: c.id, name: c.name }))}
          />
        </div>
      )}

      {/* ── PDF download ── */}
      {bio && (
        <p style={{ marginTop: "1rem" }}>
          <a className={styles.bioDownload} href={`/api/admin/members/${memberId}/bio-pdf`}>
            ↓ {t("downloadPdf")}
          </a>
        </p>
      )}

      {!bio ? (
        <p className={styles.muted} style={{ marginTop: "1.5rem" }}>
          {t("noBio")}
        </p>
      ) : (
        <>
          {/* ═══════════════════════════════════════════════════════════
              SECTION 1 — Personal Information
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeading>Personal Information</SectionHeading>
          <dl className={styles.detailMeta}>
            <Row label="Surname" value={val(bio.profile.surname)} />
            <Row label="First Name" value={val(bio.profile.firstName)} />
            <Row label="Middle Name" value={val(bio.profile.middleName)} />
            <Row label="Other Names" value={val(bio.profile.otherNames)} />
            <Row label="Maiden Name" value={val(bio.profile.maidenName)} />
            <Row label="Gender" value={val(bio.profile.gender)} />
            <Row label="Marital Status" value={val(bio.profile.maritalStatus)} />
            <Row label="Date of Birth" value={val(bio.profile.dateOfBirth)} />
            <Row label="Place of Birth" value={val(bio.profile.placeOfBirth)} />
            <Row label="Nationality" value={val(bio.profile.nationality)} />
            <Row label="Disabilities" value={yesNo(bio.profile.hasDisabilities)} />
            {bio.profile.hasDisabilities && (
              <Row label="Disability Details" value={val(bio.profile.disabilitiesDetails)} />
            )}
          </dl>

          {/* ═══════════════════════════════════════════════════════════
              SECTION 2 — Contact
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeading>Contact Details</SectionHeading>
          <dl className={styles.detailMeta}>
            <Row label="Email" value={val(bio.profile.email)} />
            <Row label="Mobile Phone" value={val(bio.profile.mobilePhone)} />
            <Row label="Home Phone" value={val(bio.profile.homePhone)} />
            <Row label="Residential Address" value={val(bio.profile.residentialAddress)} />
          </dl>

          {/* ═══════════════════════════════════════════════════════════
              SECTION 3 — Identification
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeading>Identification Documents</SectionHeading>
          <dl className={styles.detailMeta}>
            <Row label="National ID No." value={val(bio.profile.identificationNo)} />
            <Row label="ID Place of Issue" value={val(bio.profile.idPlaceOfIssue)} />
            <Row label="ID Expiry Date" value={val(bio.profile.idExpiryDate)} />
            <Row label="Driving Permit No." value={val(bio.profile.drivingPermitNo)} />
            <Row label="Driving Issue Place" value={val(bio.profile.drivingPlaceOfIssue)} />
            <Row label="Driving Expiry" value={val(bio.profile.drivingExpiryDate)} />
            <Row label="NSSF No." value={val(bio.profile.nssfNo)} />
            <Row label="TIN No." value={val(bio.profile.tinNo)} />
            <Row label="NHIF No." value={val(bio.profile.nhifNo)} />
          </dl>

          {/* ═══════════════════════════════════════════════════════════
              SECTION 4 — Employment & Banking
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeading>Employment &amp; Banking</SectionHeading>
          <dl className={styles.detailMeta}>
            <Row label="Position" value={val(bio.profile.position)} />
            <Row label="Work Station" value={val(bio.profile.workStation)} />
            <Row label="Campus" value={val(member?.campus)} />
            <Row label="Bank Name" value={val(bio.profile.bankName)} />
            <Row label="Account Name" value={val(bio.profile.accountName)} />
            <Row label="Account Number" value={val(bio.profile.accountNumber)} />
            <Row label="Mobile Money No." value={val(bio.profile.mobileMoneyNumber)} />
          </dl>

          {/* ═══════════════════════════════════════════════════════════
              SECTION 5 — Family
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeading>Family</SectionHeading>

          {/* Spouse */}
          {bio.spouse ? (
            <>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0.75rem 0 0.25rem", color: "#495057" }}>
                Spouse
              </h3>
              <dl className={styles.detailMeta}>
                <Row label="Full Name" value={val(bio.spouse.fullName)} />
                <Row label="Phone" value={val(bio.spouse.phone)} />
                <Row label="Occupation" value={val(bio.spouse.occupation)} />
                <Row label="Employer" value={val(bio.spouse.employer)} />
              </dl>
            </>
          ) : (
            <p className={styles.muted} style={{ fontSize: "0.875rem" }}>No spouse recorded.</p>
          )}

          {/* Children */}
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0.75rem 0 0.25rem", color: "#495057" }}>
            Children
          </h3>
          {bio.children.length === 0 ? (
            <p className={styles.muted} style={{ fontSize: "0.875rem" }}>None recorded.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Full Names</th>
                    <th>DOB</th>
                    <th>Gender</th>
                    <th>School / Employer</th>
                    <th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {bio.children.map((c) => (
                    <tr key={c.id}>
                      <td>{val(c.fullNames)}</td>
                      <td>{val(c.dateOfBirth)}</td>
                      <td>{val(c.gender)}</td>
                      <td>{val(c.schoolEmployer)}</td>
                      <td>{val(c.contactNumber)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Family Contacts */}
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0.75rem 0 0.25rem", color: "#495057" }}>
            Family Contacts
          </h3>
          {bio.familyContacts.length === 0 ? (
            <p className={styles.muted} style={{ fontSize: "0.875rem" }}>None recorded.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Relationship</th>
                    <th>Full Name</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Occupation</th>
                  </tr>
                </thead>
                <tbody>
                  {bio.familyContacts.map((fc) => (
                    <tr key={fc.id}>
                      <td>{val(fc.relationship)}</td>
                      <td>{val(fc.fullName)}</td>
                      <td>{val(fc.phone)}</td>
                      <td>{val(fc.address)}</td>
                      <td>{val(fc.occupation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              SECTION 6 — Emergency Contacts
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeading>Emergency Contacts</SectionHeading>
          {bio.emergencyContacts.length === 0 ? (
            <p className={styles.muted}>None recorded.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Relationship</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {bio.emergencyContacts.map((ec) => (
                    <tr key={ec.id}>
                      <td>{val(ec.fullName)}</td>
                      <td>{val(ec.relationship)}</td>
                      <td>{val(ec.phone)}</td>
                      <td>{val(ec.address)}</td>
                      <td>{val(ec.priority)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              SECTION 7 — Relatives Employed at SLA
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeading>Relatives Employed at Silverleaf</SectionHeading>
          {bio.relativesEmployed.length === 0 ? (
            <p className={styles.muted}>None declared.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Relationship</th>
                    <th>Position</th>
                    <th>Work Station</th>
                  </tr>
                </thead>
                <tbody>
                  {bio.relativesEmployed.map((r) => (
                    <tr key={r.id}>
                      <td>{val(r.fullName)}</td>
                      <td>{val(r.relationship)}</td>
                      <td>{val(r.position)}</td>
                      <td>{val(r.workStation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              SECTION 8 — Academic & Professional Qualifications
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeading>{t("qualifications.heading")}</SectionHeading>
          {bio.qualifications.length === 0 ? (
            <p className={styles.muted}>{t("qualifications.empty")}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t("qualifications.level")}</th>
                    <th>{t("qualifications.qualification")}</th>
                    <th>{t("qualifications.institution")}</th>
                    <th>{t("qualifications.yearObtained")}</th>
                  </tr>
                </thead>
                <tbody>
                  {bio.qualifications.map((q) => (
                    <tr key={q.id}>
                      <td>{val(q.level)}</td>
                      <td>{val(q.qualification)}</td>
                      <td>{val(q.institution)}</td>
                      <td>{q.yearObtained ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              SECTION 9 — Employment History
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeading>Employment History</SectionHeading>
          {bio.employmentHistory.length === 0 ? (
            <p className={styles.muted}>No employment history recorded.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Employer</th>
                    <th>Position</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Reason for Leaving</th>
                  </tr>
                </thead>
                <tbody>
                  {bio.employmentHistory.map((eh) => (
                    <tr key={eh.id}>
                      <td>{val(eh.employer)}</td>
                      <td>{val(eh.position)}</td>
                      <td>{val(eh.dateFrom)}</td>
                      <td>{eh.dateTo ? val(eh.dateTo) : "Present"}</td>
                      <td>{val(eh.leavingReason)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              SECTION 10 — References
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeading>References</SectionHeading>
          {bio.references.length === 0 ? (
            <p className={styles.muted}>No references recorded.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Full Name</th>
                    <th>Relationship</th>
                    <th>Organization</th>
                    <th>Phone</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {bio.references.map((ref) => (
                    <tr key={ref.id}>
                      <td>{ref.referenceOrder ?? "—"}</td>
                      <td>{val(ref.fullName)}</td>
                      <td>{val(ref.relationship)}</td>
                      <td>{val(ref.organization)}</td>
                      <td>{val(ref.phone)}</td>
                      <td>{val(ref.email)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              SECTION 11 — Legal & Conduct
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeading>Legal &amp; Conduct</SectionHeading>
          <dl className={styles.detailMeta}>
            <Row label="Arrest Record" value={yesNo(bio.profile.arrestRecord)} />
            {bio.profile.arrestRecord && (
              <Row label="Arrest Details" value={val(bio.profile.arrestDetails)} />
            )}
            <Row label="Misconduct Record" value={yesNo(bio.profile.misconductRecord)} />
            {bio.profile.misconductRecord && (
              <Row label="Misconduct Details" value={val(bio.profile.misconductDetails)} />
            )}
          </dl>

          {/* ═══════════════════════════════════════════════════════════
              SECTION 12 — Uploaded Documents
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeading>{t("documents.heading")}</SectionHeading>
          {documents.length === 0 ? (
            <p className={styles.muted}>{t("documents.empty")}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id}>
                      <td style={{ wordBreak: "break-all" }}>{d.originalName ?? "file"}</td>
                      <td className={styles.muted} style={{ fontSize: "0.8rem" }}>
                        {docTypeLabel(d.documentType)}
                      </td>
                      <td className={styles.muted}>{formatSize(d.fileSizeBytes)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <a
                          className={styles.bioDownload}
                          href={`/api/bio/documents/${d.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ marginRight: "0.75rem" }}
                        >
                          View
                        </a>
                        <a
                          className={styles.bioDownload}
                          href={`/api/bio/documents/${d.id}`}
                          download={d.originalName ?? undefined}
                        >
                          ↓ Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Certification footer */}
          {(bio.profile.certificationName || bio.profile.certificationDate) && (
            <p
              style={{
                marginTop: "2rem",
                padding: "0.75rem 1rem",
                background: "#f8f9fa",
                borderRadius: 6,
                fontSize: "0.875rem",
                color: "#495057",
              }}
            >
              <strong>Declared by:</strong> {val(bio.profile.certificationName)}
              {bio.profile.certificationDate && (
                <> &mdash; {bio.profile.certificationDate}</>
              )}
            </p>
          )}
        </>
      )}
    </>
  );
}
