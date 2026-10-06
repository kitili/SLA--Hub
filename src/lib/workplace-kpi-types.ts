export type KpiMetric = {
  label: string;
  value: string;
  hint?: string;
};

export type DepartmentKpi = {
  id: string;
  name: string;
  liveUrl: string;
  people: number;
  lastSeen: string | null;
  headline: string;
  metrics: KpiMetric[];
  note: string;
};

export type WorkplaceKpis = {
  generatedAt: string;
  people: number;
  totalSystems: number;
  signIns24h: number;
  departments: DepartmentKpi[];
};
