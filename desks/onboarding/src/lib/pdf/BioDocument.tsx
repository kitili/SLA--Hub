/**
 * Bio-data PDF document (admin export).
 *
 * Renders a member's full bio profile — every section captured by the bio form,
 * including the sensitive financial / identification / legal fields — into a
 * print-ready PDF. Built with `@react-pdf/renderer` so it runs server-side in a
 * Node route handler with no headless browser. Uses the built-in Helvetica
 * family only (no font registration / network fetch).
 *
 * This is a pure presentation component: it receives an already-loaded
 * {@link BioReadResult} and never touches the DB or auth — the calling route
 * handler owns fetching and the admin gate.
 */
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { BioReadResult } from "@/lib/db/queries/bio";

const BRAND = "#002368"; // electric-blue
const INK = "#14233B";
const MUTED = "#4F555F";
const BORDER = "#D9DEE6";
const SENSITIVE = "#FFF8E1";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: INK,
    lineHeight: 1.4,
  },
  header: {
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    paddingBottom: 8,
  },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: BRAND },
  subtitle: { fontSize: 10, color: MUTED, marginTop: 2 },
  meta: { fontSize: 8, color: MUTED, marginTop: 4 },
  section: { marginTop: 14 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 3,
  },
  sectionTitleSensitive: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    marginBottom: 6,
    backgroundColor: SENSITIVE,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  row: { flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", paddingRight: 10, marginBottom: 5 },
  fieldFull: { width: "100%", paddingRight: 10, marginBottom: 5 },
  label: { fontSize: 7.5, color: MUTED, textTransform: "uppercase" },
  value: { fontSize: 9.5, color: INK },
  empty: { fontSize: 9, color: MUTED, fontStyle: "italic" },
  // table-ish blocks for repeating rows
  card: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 3,
    padding: 6,
    marginBottom: 6,
  },
  cardTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 7,
    color: MUTED,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 4,
  },
});

/* ---------------------------------------------------------------- */
/* Formatting helpers                                                */
/* ---------------------------------------------------------------- */

function fmt(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function fmtBool(value: boolean | null): string {
  if (value === null || value === undefined) return "—";
  return value ? "Yes" : "No";
}

/** Dates come back as strings (date columns) or Date (timestamptz). */
function fmtDate(value: string | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fullName(p: BioReadResult["profile"]): string {
  const parts = [p.firstName, p.middleName, p.surname].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

/* ---------------------------------------------------------------- */
/* Small presentational pieces                                       */
/* ---------------------------------------------------------------- */

function Field({
  label,
  value,
  full,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <View style={full ? styles.fieldFull : styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function Section({
  title,
  sensitive,
  children,
}: {
  title: string;
  sensitive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={sensitive ? styles.sectionTitleSensitive : styles.sectionTitle}>
        {title}
        {sensitive ? "  (confidential)" : ""}
      </Text>
      {children}
    </View>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

/* ---------------------------------------------------------------- */
/* Document                                                          */
/* ---------------------------------------------------------------- */

export interface BioDocumentProps {
  bio: BioReadResult;
  /** ISO string — when the PDF was generated (passed in; no Date.now here). */
  generatedAt: string;
}

export function BioDocument({ bio, generatedAt }: BioDocumentProps) {
  const p = bio.profile;
  const name = fullName(p);

  return (
    <Document
      title={`Bio — ${name}`}
      author="Silverleaf Onboarding Hub"
      subject="Staff bio-data record"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.subtitle}>
            {fmt(p.position)}
            {p.workStation ? ` · ${p.workStation}` : ""}
          </Text>
          <Text style={styles.meta}>
            Staff bio-data record · Silverleaf Onboarding Hub · Generated{" "}
            {fmtDate(generatedAt)}
          </Text>
        </View>

        {/* Personal */}
        <Section title="Personal details">
          <View style={styles.row}>
            <Field label="Surname" value={fmt(p.surname)} />
            <Field label="First name" value={fmt(p.firstName)} />
            <Field label="Middle name" value={fmt(p.middleName)} />
            <Field label="Other names" value={fmt(p.otherNames)} />
            <Field label="Maiden name" value={fmt(p.maidenName)} />
            <Field label="Gender" value={fmt(p.gender)} />
            <Field label="Marital status" value={fmt(p.maritalStatus)} />
            <Field label="Date of birth" value={fmtDate(p.dateOfBirth)} />
            <Field label="Place of birth" value={fmt(p.placeOfBirth)} />
            <Field label="Nationality" value={fmt(p.nationality)} />
            <Field label="Has disabilities" value={fmtBool(p.hasDisabilities)} />
            {p.disabilitiesDetails ? (
              <Field
                label="Disability details"
                value={fmt(p.disabilitiesDetails)}
                full
              />
            ) : null}
          </View>
        </Section>

        {/* Contact */}
        <Section title="Contact">
          <View style={styles.row}>
            <Field label="Mobile phone" value={fmt(p.mobilePhone)} />
            <Field label="Home phone" value={fmt(p.homePhone)} />
            <Field label="Email" value={fmt(p.email)} />
            <Field
              label="Residential address"
              value={fmt(p.residentialAddress)}
              full
            />
          </View>
        </Section>

        {/* Identification — confidential */}
        <Section title="Identification" sensitive>
          <View style={styles.row}>
            <Field label="ID / passport no." value={fmt(p.identificationNo)} />
            <Field label="ID place of issue" value={fmt(p.idPlaceOfIssue)} />
            <Field label="ID expiry" value={fmtDate(p.idExpiryDate)} />
            <Field label="Driving permit no." value={fmt(p.drivingPermitNo)} />
            <Field
              label="Permit place of issue"
              value={fmt(p.drivingPlaceOfIssue)}
            />
            <Field label="Permit expiry" value={fmtDate(p.drivingExpiryDate)} />
            <Field label="NSSF no." value={fmt(p.nssfNo)} />
            <Field label="TIN no." value={fmt(p.tinNo)} />
            <Field label="NHIF no." value={fmt(p.nhifNo)} />
          </View>
        </Section>

        {/* Banking — confidential */}
        <Section title="Banking & payment" sensitive>
          <View style={styles.row}>
            <Field label="Bank name" value={fmt(p.bankName)} />
            <Field label="Account name" value={fmt(p.accountName)} />
            <Field label="Account number" value={fmt(p.accountNumber)} />
            <Field
              label="Mobile money number"
              value={fmt(p.mobileMoneyNumber)}
            />
          </View>
        </Section>

        {/* Spouse */}
        <Section title="Spouse">
          {bio.spouse ? (
            <View style={styles.row}>
              <Field label="Full name" value={fmt(bio.spouse.fullName)} />
              <Field label="Phone" value={fmt(bio.spouse.phone)} />
              <Field label="Occupation" value={fmt(bio.spouse.occupation)} />
              <Field label="Employer" value={fmt(bio.spouse.employer)} />
            </View>
          ) : (
            <EmptyNote text="No spouse recorded." />
          )}
        </Section>

        {/* Children */}
        <Section title={`Children (${bio.children.length})`}>
          {bio.children.length ? (
            bio.children.map((c) => (
              <View key={c.id} style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>{fmt(c.fullNames)}</Text>
                <View style={styles.row}>
                  <Field label="Date of birth" value={fmtDate(c.dateOfBirth)} />
                  <Field label="Gender" value={fmt(c.gender)} />
                  <Field label="School / employer" value={fmt(c.schoolEmployer)} />
                  <Field label="Contact" value={fmt(c.contactNumber)} />
                </View>
              </View>
            ))
          ) : (
            <EmptyNote text="No children recorded." />
          )}
        </Section>

        {/* Family contacts */}
        <Section title={`Family contacts (${bio.familyContacts.length})`}>
          {bio.familyContacts.length ? (
            bio.familyContacts.map((c) => (
              <View key={c.id} style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>
                  {fmt(c.fullName)} · {fmt(c.relationship)}
                </Text>
                <View style={styles.row}>
                  <Field label="Phone" value={fmt(c.phone)} />
                  <Field label="Occupation" value={fmt(c.occupation)} />
                  <Field label="Address" value={fmt(c.address)} full />
                </View>
              </View>
            ))
          ) : (
            <EmptyNote text="No family contacts recorded." />
          )}
        </Section>

        {/* Emergency contacts */}
        <Section title={`Emergency contacts (${bio.emergencyContacts.length})`}>
          {bio.emergencyContacts.length ? (
            bio.emergencyContacts.map((c) => (
              <View key={c.id} style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>
                  {fmt(c.fullName)}
                  {c.priority ? ` · ${c.priority}` : ""}
                </Text>
                <View style={styles.row}>
                  <Field label="Relationship" value={fmt(c.relationship)} />
                  <Field label="Phone" value={fmt(c.phone)} />
                  <Field label="Address" value={fmt(c.address)} full />
                </View>
              </View>
            ))
          ) : (
            <EmptyNote text="No emergency contacts recorded." />
          )}
        </Section>

        {/* Relatives employed (nepotism disclosure) */}
        <Section
          title={`Relatives employed at Silverleaf (${bio.relativesEmployed.length})`}
        >
          {bio.relativesEmployed.length ? (
            bio.relativesEmployed.map((c) => (
              <View key={c.id} style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>
                  {fmt(c.fullName)} · {fmt(c.relationship)}
                </Text>
                <View style={styles.row}>
                  <Field label="Position" value={fmt(c.position)} />
                  <Field label="Work station" value={fmt(c.workStation)} />
                </View>
              </View>
            ))
          ) : (
            <EmptyNote text="None disclosed." />
          )}
        </Section>

        {/* Qualifications */}
        <Section title={`Qualifications (${bio.qualifications.length})`}>
          {bio.qualifications.length ? (
            bio.qualifications.map((q) => (
              <View key={q.id} style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>
                  {fmt(q.qualification)}
                  {q.level ? ` (${q.level})` : ""}
                </Text>
                <View style={styles.row}>
                  <Field label="Institution" value={fmt(q.institution)} />
                  <Field label="Year obtained" value={fmt(q.yearObtained)} />
                </View>
              </View>
            ))
          ) : (
            <EmptyNote text="No qualifications recorded." />
          )}
        </Section>

        {/* Employment history */}
        <Section title={`Employment history (${bio.employmentHistory.length})`}>
          {bio.employmentHistory.length ? (
            bio.employmentHistory.map((e) => (
              <View key={e.id} style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>
                  {fmt(e.position)} · {fmt(e.employer)}
                </Text>
                <View style={styles.row}>
                  <Field label="From" value={fmtDate(e.dateFrom)} />
                  <Field
                    label="To"
                    value={e.dateTo ? fmtDate(e.dateTo) : "Present"}
                  />
                  <Field
                    label="Reason for leaving"
                    value={fmt(e.leavingReason)}
                    full
                  />
                </View>
              </View>
            ))
          ) : (
            <EmptyNote text="No employment history recorded." />
          )}
        </Section>

        {/* References */}
        <Section title={`References (${bio.references.length})`}>
          {bio.references.length ? (
            bio.references
              .slice()
              .sort((a, b) => (a.referenceOrder ?? 0) - (b.referenceOrder ?? 0))
              .map((r) => (
                <View key={r.id} style={styles.card} wrap={false}>
                  <Text style={styles.cardTitle}>
                    {fmt(r.fullName)}
                    {r.relationship ? ` · ${r.relationship}` : ""}
                  </Text>
                  <View style={styles.row}>
                    <Field label="Organization" value={fmt(r.organization)} />
                    <Field label="Phone" value={fmt(r.phone)} />
                    <Field label="Email" value={fmt(r.email)} />
                  </View>
                </View>
              ))
          ) : (
            <EmptyNote text="No references recorded." />
          )}
        </Section>

        {/* Legal & conduct — confidential */}
        <Section title="Legal & conduct" sensitive>
          <View style={styles.row}>
            <Field label="Arrest record" value={fmtBool(p.arrestRecord)} />
            <Field
              label="Misconduct record"
              value={fmtBool(p.misconductRecord)}
            />
            {p.arrestDetails ? (
              <Field label="Arrest details" value={fmt(p.arrestDetails)} full />
            ) : null}
            {p.misconductDetails ? (
              <Field
                label="Misconduct details"
                value={fmt(p.misconductDetails)}
                full
              />
            ) : null}
          </View>
        </Section>

        {/* Declaration & consent */}
        <Section title="Declaration & consent">
          <View style={styles.row}>
            <Field label="Certified by" value={fmt(p.certificationName)} />
            <Field
              label="Certification date"
              value={fmtDate(p.certificationDate)}
            />
            <Field
              label="GDPR consent given"
              value={p.consentGivenAt ? fmtDate(p.consentGivenAt) : "—"}
            />
            <Field label="Consent version" value={fmt(p.consentVersion)} />
            <Field label="Submitted" value={fmtDate(p.submittedAt)} />
            <Field label="Last updated" value={fmtDate(p.updatedAt)} />
          </View>
        </Section>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Confidential — Silverleaf staff bio-data</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
