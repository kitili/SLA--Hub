import path from "path";
import { SqliteVisitRepository } from "@/repositories/SqliteVisitRepository";
import { PhotoStorage } from "@/services/PhotoStorage";
import { VisitService } from "@/services/VisitService";

const globalForApp = globalThis as typeof globalThis & {
  visitService?: VisitService;
  photoStorage?: PhotoStorage;
};

export function getPhotoStorage(): PhotoStorage {
  if (!globalForApp.photoStorage) {
    globalForApp.photoStorage = new PhotoStorage(
      path.join(process.cwd(), "data", "photos"),
    );
  }
  return globalForApp.photoStorage;
}

export function getVisitService(): VisitService {
  if (!globalForApp.visitService) {
    globalForApp.visitService = new VisitService(
      new SqliteVisitRepository(),
      getPhotoStorage(),
    );
  }
  return globalForApp.visitService;
}
