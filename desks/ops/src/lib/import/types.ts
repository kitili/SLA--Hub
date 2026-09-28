export type ImportRowOutcome<T> =
  | { row: number; status: "valid"; data: T; action: "create" | "update"; matchedId?: string }
  | { row: number; status: "error"; errors: string[]; raw: Record<string, string> };

export type ImportPreview<T> = {
  headerErrors: string[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  createCount: number;
  updateCount: number;
  warnings: string[];
  rows: ImportRowOutcome<T>[];
};

export type ImportCommitResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};
