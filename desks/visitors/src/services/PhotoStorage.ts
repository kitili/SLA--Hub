import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { ValidationError } from "@/domain/errors";

const MAX_BYTES = 512 * 1024;

export class PhotoStorage {
  constructor(private readonly directory: string) {}

  async save(visitId: string, dataUrl: string): Promise<string> {
    if (!dataUrl.startsWith("data:image/")) {
      throw new ValidationError("Photo must be a JPEG image.");
    }

    const [, encoded] = dataUrl.split(",", 2);
    if (!encoded) {
      throw new ValidationError("Photo data is invalid.");
    }

    const buffer = Buffer.from(encoded, "base64");
    if (buffer.length > MAX_BYTES) {
      throw new ValidationError("Photo is too large. Try again closer to the camera.");
    }

    await mkdir(this.directory, { recursive: true });
    const filePath = path.join(this.directory, `${visitId}.jpg`);
    await writeFile(filePath, buffer);
    return `/api/photos/${visitId}`;
  }

  async read(visitId: string): Promise<Buffer | null> {
    try {
      return await readFile(path.join(this.directory, `${visitId}.jpg`));
    } catch {
      return null;
    }
  }
}
