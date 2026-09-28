import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { Visit, VisitRecord } from "@/domain/Visit";
import { VisitQuery, VisitRepository } from "./VisitRepository";

class WriteLock {
  private chain = Promise.resolve();

  run<T>(work: () => Promise<T>): Promise<T> {
    const next = this.chain.then(work, work);
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

export class FileVisitRepository implements VisitRepository {
  private readonly lock = new WriteLock();

  constructor(private readonly filePath: string) {}

  async all(): Promise<Visit[]> {
    return this.read();
  }

  async findById(id: string): Promise<Visit | null> {
    const visits = await this.read();
    return visits.find((visit) => visit.id === id) ?? null;
  }

  async query(filters: VisitQuery): Promise<Visit[]> {
    const visits = await this.read();
    return visits.filter((visit) => {
      if (filters.campus && visit.campus.toString() !== filters.campus) return false;
      if (filters.date && visit.date !== filters.date) return false;
      if (filters.onSiteOnly && !visit.isOnSite) return false;
      return true;
    });
  }

  async save(visit: Visit): Promise<void> {
    await this.lock.run(async () => {
      const visits = await this.read();
      const index = visits.findIndex((item) => item.id === visit.id);
      if (index >= 0) {
        visits[index] = visit;
      } else {
        visits.push(visit);
      }
      await this.write(visits);
    });
  }

  private async read(): Promise<Visit[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const records = JSON.parse(raw) as VisitRecord[];
      return records.map((record) => Visit.fromRecord(record));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private async write(visits: Visit[]): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const payload = JSON.stringify(
      visits.map((visit) => visit.toRecord()),
      null,
      2,
    );
    await writeFile(this.filePath, payload, "utf8");
  }
}
