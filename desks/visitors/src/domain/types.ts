export type VisitSource = "desk" | "self";

export type VisitRecord = {
  id: string;
  name: string;
  phone: string;
  purpose: string;
  host: string;
  campus: string;
  date: string;
  photo: string | null;
  source: VisitSource;
  signedInAt: string;
  signedOutAt: string | null;
};
