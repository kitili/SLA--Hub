export type FarmSectionId =
  | "plots"
  | "schedule"
  | "expenses"
  | "harvests"
  | "walkthroughs"
  | "inputs";

export type FarmSection = {
  id: FarmSectionId;
  name: string;
  href: string;
};

/** Page-level farm nav — same pattern as FacilitiesSubnav / KitchenSubnav. */
export const FARM_SECTIONS: FarmSection[] = [
  { id: "plots", name: "Plots & crops", href: "/admin/farm/plots" },
  { id: "schedule", name: "Schedule", href: "/admin/farm/schedule" },
  { id: "expenses", name: "Expenses & budget", href: "/admin/farm/expenses" },
  { id: "harvests", name: "Harvests", href: "/admin/farm/harvests" },
  { id: "walkthroughs", name: "Walkthroughs", href: "/admin/farm/walkthroughs" },
  { id: "inputs", name: "Inputs", href: "/admin/farm/inputs" },
];
