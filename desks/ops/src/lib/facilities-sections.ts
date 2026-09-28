export type FacilitiesSectionId =
  | "issues"
  | "checklist"
  | "generator"
  | "houses"
  | "power"
  | "cctv"
  | "classrooms"
  | "sops";

export type FacilitiesSectionStatus = "live" | "skeleton";

export type FacilitiesSection = {
  id: FacilitiesSectionId;
  name: string;
  href: string;
  blurb: string;
  status: FacilitiesSectionStatus;
  sheetTab: string;
};

/** Sub-hub for the Facilities module — mapped to Usa River master sheet tabs. */
export const FACILITIES_SECTIONS: FacilitiesSection[] = [
  {
    id: "issues",
    name: "R&M Issues",
    href: "/ops/facilities/issues",
    blurb: "Sheet tab: 3. Facilities R&M — tickets from reported to resolved.",
    status: "live",
    sheetTab: "3. Facilities R&M ",
  },
  {
    id: "checklist",
    name: "Weekly Checklist",
    href: "/ops/facilities/checklist",
    blurb: "Sheet tab: 1. Checklist — weekly walkthrough scores (matrix view).",
    status: "live",
    sheetTab: "1. Checklist ",
  },
  {
    id: "generator",
    name: "Generator Log",
    href: "/ops/facilities/generator",
    blurb: "Sheet tab: 2. Generator Checklist — daily inspection scores.",
    status: "live",
    sheetTab: "2. Generator Checklist",
  },
  {
    id: "houses",
    name: "Staff Housing",
    href: "/ops/facilities/houses",
    blurb: "Sheet tab: Houses Accommodation — Available / Taken tracker.",
    status: "live",
    sheetTab: "Houses Accomodation",
  },
  {
    id: "power",
    name: "Power Usage",
    href: "/ops/facilities/power",
    blurb: "Sheet tab: Power Usage — receiving units, spent, balance.",
    status: "live",
    sheetTab: "Power Usage",
  },
  {
    id: "cctv",
    name: "CCTV",
    href: "/ops/facilities/cctv",
    blurb: "Sheet tab: CCTV — camera inventory by location.",
    status: "live",
    sheetTab: "CCTV",
  },
  {
    id: "classrooms",
    name: "Classroom Inventory",
    href: "/ops/facilities/classrooms",
    blurb: "Sheet tab: Classrooms facility Report — furniture & equipment.",
    status: "live",
    sheetTab: "Classrooms facility Report",
  },
  {
    id: "sops",
    name: "SOPs",
    href: "/ops/facilities/sops",
    blurb: "Sheet tab: Facilities SOPs — role cadence procedures.",
    status: "live",
    sheetTab: "Facilities SOPs",
  },
];

export function getFacilitiesSection(id: FacilitiesSectionId): FacilitiesSection | undefined {
  return FACILITIES_SECTIONS.find((s) => s.id === id);
}
