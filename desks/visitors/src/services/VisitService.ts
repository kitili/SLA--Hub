import { Campus } from "@/domain/Campus";
import { requireVisit, SignInInput, Visit, VisitRecord } from "@/domain/Visit";
import { VisitQuery, VisitRepository } from "@/repositories/VisitRepository";
import { PhotoStorage } from "./PhotoStorage";

export type VisitStats = {
  total: number;
  onSite: number;
  selfCheckIns: number;
  deskCheckIns: number;
};

export class VisitService {
  constructor(
    private readonly visits: VisitRepository,
    private readonly photos: PhotoStorage,
  ) {}

  async signIn(input: SignInInput): Promise<VisitRecord> {
    let visit = Visit.signIn({ ...input, photo: null });
    if (input.photo?.startsWith("data:image/")) {
      const photoPath = await this.photos.save(visit.id, input.photo);
      visit = visit.withPhoto(photoPath);
    }
    await this.visits.save(visit);
    return visit.toRecord();
  }

  async signOut(id: string): Promise<VisitRecord> {
    const visit = requireVisit(await this.visits.findById(id), id);
    const signedOut = visit.signOut();
    await this.visits.save(signedOut);
    return signedOut.toRecord();
  }

  async list(filters: VisitQuery): Promise<VisitRecord[]> {
    if (filters.campus) {
      Campus.parse(filters.campus);
    }
    const visits = await this.visits.query(filters);
    return visits
      .sort((a, b) => b.signedInAt.getTime() - a.signedInAt.getTime())
      .map((visit) => visit.toRecord());
  }

  async stats(date: string, campus?: string): Promise<VisitStats> {
    const records = await this.list({ date, campus });
    return {
      total: records.length,
      onSite: records.filter((record) => !record.signedOutAt).length,
      selfCheckIns: records.filter((record) => record.source === "self").length,
      deskCheckIns: records.filter((record) => record.source === "desk").length,
    };
  }
}
