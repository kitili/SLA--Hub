import { randomUUID } from "crypto";
import { Campus } from "./Campus";
import { NotFoundError, ValidationError } from "./errors";
import { PhoneNumber } from "./PhoneNumber";
import type { VisitRecord, VisitSource } from "./types";
import { VisitPurpose } from "./VisitPurpose";

export type { VisitRecord, VisitSource } from "./types";

export type SignInInput = {
  name: string;
  phone: string;
  purpose: string;
  host: string;
  campus: string;
  photo?: string | null;
  source?: VisitSource;
  signedInAt?: Date;
};

export class Visit {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly phone: PhoneNumber,
    readonly purpose: VisitPurpose,
    readonly host: string,
    readonly campus: Campus,
    readonly date: string,
    readonly photo: string | null,
    readonly source: VisitSource,
    readonly signedInAt: Date,
    readonly signedOutAt: Date | null,
  ) {}

  static todayKey(at = new Date()): string {
    return at.toISOString().slice(0, 10);
  }

  static signIn(input: SignInInput): Visit {
    const name = input.name.trim();
    const host = input.host.trim();
    if (name.length < 2) {
      throw new ValidationError("Full name is required.");
    }
    if (host.length < 2) {
      throw new ValidationError("Person or office visiting is required.");
    }

    const signedInAt = input.signedInAt ?? new Date();
    const source = input.source === "self" ? "self" : "desk";
    const photo =
      input.photo?.startsWith("/api/photos/") || input.photo?.startsWith("data:image/")
        ? input.photo
        : null;

    return new Visit(
      `v_${randomUUID()}`,
      name,
      PhoneNumber.fromInput(input.phone),
      VisitPurpose.parse(input.purpose),
      host,
      Campus.parse(input.campus),
      Visit.todayKey(signedInAt),
      photo,
      source,
      signedInAt,
      null,
    );
  }

  static fromRecord(record: VisitRecord): Visit {
    return new Visit(
      record.id,
      record.name,
      PhoneNumber.fromInput(record.phone),
      VisitPurpose.parse(record.purpose),
      record.host,
      Campus.parse(record.campus),
      record.date,
      record.photo,
      record.source === "self" ? "self" : "desk",
      new Date(record.signedInAt),
      record.signedOutAt ? new Date(record.signedOutAt) : null,
    );
  }

  get isOnSite(): boolean {
    return this.signedOutAt === null;
  }

  initials(): string {
    return this.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("");
  }

  withPhoto(photoPath: string): Visit {
    return new Visit(
      this.id,
      this.name,
      this.phone,
      this.purpose,
      this.host,
      this.campus,
      this.date,
      photoPath,
      this.source,
      this.signedInAt,
      this.signedOutAt,
    );
  }

  signOut(at = new Date()): Visit {
    if (!this.isOnSite) {
      throw new ValidationError(`${this.name} is already signed out.`);
    }
    return new Visit(
      this.id,
      this.name,
      this.phone,
      this.purpose,
      this.host,
      this.campus,
      this.date,
      this.photo,
      this.source,
      this.signedInAt,
      at,
    );
  }

  toRecord(): VisitRecord {
    return {
      id: this.id,
      name: this.name,
      phone: this.phone.toString(),
      purpose: this.purpose.toString(),
      host: this.host,
      campus: this.campus.toString(),
      date: this.date,
      photo: this.photo,
      source: this.source,
      signedInAt: this.signedInAt.toISOString(),
      signedOutAt: this.signedOutAt?.toISOString() ?? null,
    };
  }
}

export function requireVisit(visit: Visit | null, id: string): Visit {
  if (!visit) {
    throw new NotFoundError(`Visit ${id} was not found.`);
  }
  return visit;
}
