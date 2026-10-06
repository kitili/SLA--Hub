export type KpiMetric = {
  label: string;
  value: string;
  hint?: string;
};

export type PulsePoint = {
  day: string;
  label: string;
  hub: number;
  work: number;
};

export type HourBeat = {
  hour: number;
  label: string;
  count: number;
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
  spark?: number[];
};

export type WorkplaceKpis = {
  generatedAt: string;
  people: number;
  totalSystems: number;
  signIns24h: number;
  departments: DepartmentKpi[];
};
