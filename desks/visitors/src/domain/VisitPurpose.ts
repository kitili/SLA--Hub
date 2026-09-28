import { ValidationError } from "./errors";

export const VISIT_PURPOSES = [
  "Parent meeting",
  "Prospective family tour",
  "Delivery / vendor",
  "Maintenance / contractor",
  "Interview",
  "Other",
] as const;

export type VisitPurposeName = (typeof VISIT_PURPOSES)[number];

export class VisitPurpose {
  private constructor(readonly name: VisitPurposeName) {}

  static parse(value: string | null | undefined): VisitPurpose {
    const name = VISIT_PURPOSES.find((purpose) => purpose === value);
    if (!name) {
      throw new ValidationError("Select a purpose of visit.");
    }
    return new VisitPurpose(name);
  }

  toString(): string {
    return this.name;
  }
}
