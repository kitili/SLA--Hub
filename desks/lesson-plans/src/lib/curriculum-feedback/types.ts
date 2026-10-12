export type SeriesKey = "strengths" | "gaps" | "usability" | "relevance" | "confidence" | "impact";

export type Series = { key: SeriesKey; label: string; color: string; hex: string };

export type FeedbackRow = {
  id: string;
  when: string;
  whenMs: number;
  teacher: string;
  campus: string;
  role: string;
  tool: string;
  ref: string;
  strengths: number | null;
  gaps: number | null;
  usability: number | null;
  strengths_c: string;
  gaps_c: string;
  usability_c: string;
  overall_c: string;
  topic: string;
  pd_date: string;
  facilitator: string;
  relevance: number | null;
  confidence: number | null;
  impact: number | null;
  relevance_c: string;
  confidence_c: string;
  impact_c: string;
  applied: string;
  support_c: string;
};

export type RawCurriculum = {
  id: string;
  submitted_at: string | null;
  server_received_at: string | null;
  teacher_name: string;
  campus: string;
  role: string;
  tool_type: string;
  tool_ref: string;
  strengths_rating: string | number | null;
  strengths_comment: string;
  gaps_rating: string | number | null;
  gaps_comment: string;
  usability_rating: string | number | null;
  usability_comment: string;
  overall_comment: string;
};

export type RawPd = {
  id: string;
  submitted_at: string | null;
  server_received_at: string | null;
  teacher_name: string;
  campus: string;
  role: string;
  pd_topic: string;
  pd_date: string;
  pd_facilitator: string;
  relevance_rating: string | number | null;
  relevance_comment: string;
  confidence_rating: string | number | null;
  confidence_comment: string;
  impact_rating: string | number | null;
  impact_comment: string;
  applied_status: string;
  support_needed: string;
};
