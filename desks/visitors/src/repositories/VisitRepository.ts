import { Visit } from "@/domain/Visit";
import type { VisitSource } from "@/domain/types";

export type VisitQuery = {
  campus?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  onSiteOnly?: boolean;
  signedOutOnly?: boolean;
  source?: VisitSource;
};

export interface VisitRepository {
  all(): Promise<Visit[]>;
  findById(id: string): Promise<Visit | null>;
  query(filters: VisitQuery): Promise<Visit[]>;
  save(visit: Visit): Promise<void>;
}
