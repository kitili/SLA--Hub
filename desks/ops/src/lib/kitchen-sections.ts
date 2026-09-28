export type KitchenSectionId =
  | "dashboard"
  | "procurement"
  | "compliance"
  | "surveys"
  | "supplies"
  | "equipment"
  | "menu"
  | "waste"
  | "attendance"
  | "nutrition"
  | "daycare"
  | "inventory";

export type KitchenSection = {
  id: KitchenSectionId;
  name: string;
  href: string;
  blurb: string;
  sheetTab: string;
};

/** Sub-hub for Kitchen — mapped to 2026 Kitchens Master Sheet areas. */
export const KITCHEN_SECTIONS: KitchenSection[] = [
  {
    id: "dashboard",
    name: "Top Sheet",
    href: "/ops/kitchen/dashboard",
    blurb: "Leadership KPIs replacing the broken Kitchens Top Sheet tab.",
    sheetTab: "Kitchens Top Sheet",
  },
  {
    id: "procurement",
    name: "Procurement",
    href: "/ops/kitchen",
    blurb: "Campus/month headcount, computed requirements, budget vs purchases.",
    sheetTab: "Usa River / campus month tabs",
  },
  {
    id: "compliance",
    name: "Compliance",
    href: "/ops/kitchen/compliance",
    blurb: "Daily / weekly / monthly kitchen checklists, entered manually here, plus SOP reference.",
    sheetTab: "Daily / Weekly / Monthly Checklists",
  },
  {
    id: "surveys",
    name: "Food quality",
    href: "/ops/kitchen/surveys",
    blurb: "Learner food satisfaction survey responses, entered manually here.",
    sheetTab: "Learner Food Satisfaction Surve",
  },
  {
    id: "supplies",
    name: "Supplies",
    href: "/ops/kitchen/supplies",
    blurb: "Cleaning/consumable supplies — soap, sanitizer, toilet paper — tracked separately from food.",
    sheetTab: "Cleaning items requirements",
  },
  {
    id: "equipment",
    name: "Equipment",
    href: "/ops/kitchen/equipment",
    blurb: "Pots, appliances, furniture — quantity, condition, and maintenance, per campus.",
    sheetTab: "Not in source sheet — new",
  },
  {
    id: "menu",
    name: "Menu",
    href: "/ops/kitchen/menu",
    blurb: "Plan what's actually being cooked, per campus/day/meal — new, not in the source sheet.",
    sheetTab: "Not in source sheet — new",
  },
  {
    id: "waste",
    name: "Waste",
    href: "/ops/kitchen/waste",
    blurb: "Log leftover, spoiled, and prep waste per campus — new, not in the source sheet.",
    sheetTab: "Not in source sheet — new",
  },
  {
    id: "attendance",
    name: "Attendance",
    href: "/ops/kitchen/attendance",
    blurb: "Actual headcount served per meal, per campus — a standalone log, not a Transport pull.",
    sheetTab: "Not in source sheet — new",
  },
  {
    id: "nutrition",
    name: "Nutrition",
    href: "/ops/kitchen/nutrition",
    blurb: "Nutrition facts and allergens per ingredient — global catalog, ready for real entry.",
    sheetTab: "Not in source sheet — new",
  },
  {
    id: "daycare",
    name: "Daycare",
    href: "/ops/kitchen/daycare",
    blurb: "Kid count, menu notes, and monthly cost — a standalone log, not one of the 5 campuses.",
    sheetTab: "Daycare",
  },
  {
    id: "inventory",
    name: "Inventory",
    href: "/ops/kitchen/inventory",
    blurb: "Stock on hand per campus, per ingredient — never built before, ready for real counts.",
    sheetTab: "Not in source sheet — flagged as an unresolved gap in the sheet's own Notes tab",
  },
];
