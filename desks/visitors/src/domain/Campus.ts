import { ValidationError } from "./errors";

export const CAMPUS_NAMES = [
  "Usa River",
  "Arusha Modern",
  "Kijenge",
  "Ilboru",
  "Boma",
] as const;

export type CampusName = (typeof CAMPUS_NAMES)[number];

export const CAMPUS_ACCENTS: Record<CampusName, string> = {
  "Usa River": "#167a37",
  "Arusha Modern": "#002368",
  Kijenge: "#6b3fa0",
  Ilboru: "#c45c00",
  Boma: "#007a7a",
};

export const CAMPUS_GRADIENTS: Record<CampusName, string> = {
  "Usa River": "linear-gradient(135deg, #0d5c2e, #167a37 55%, #4caf50)",
  "Arusha Modern": "linear-gradient(135deg, #001a4d, #002368 55%, #003a8c)",
  Kijenge: "linear-gradient(135deg, #4a2578, #6b3fa0 55%, #9b59d9)",
  Ilboru: "linear-gradient(135deg, #8a3d00, #c45c00 55%, #e07b1a)",
  Boma: "linear-gradient(135deg, #004d4d, #007a7a 55%, #00a3a3)",
};

export class Campus {
  private constructor(readonly name: CampusName) {}

  static readonly all = CAMPUS_NAMES.map((name) => new Campus(name));
  static readonly default = Campus.parse(CAMPUS_NAMES[0]);

  static parse(value: string | null | undefined): Campus {
    const normalized = value === "Arusha Town" ? "Arusha Modern" : value;
    const name = CAMPUS_NAMES.find((campus) => campus === normalized);
    if (!name) {
      throw new ValidationError("Choose a Silverleaf campus.");
    }
    return new Campus(name);
  }

  static tryParse(value: string | null | undefined): Campus | null {
    try {
      return Campus.parse(value);
    } catch {
      return null;
    }
  }

  get slug(): string {
    return this.name.toLowerCase().replace(/\s+/g, "-");
  }

  get accent(): string {
    return CAMPUS_ACCENTS[this.name];
  }

  get gradient(): string {
    return CAMPUS_GRADIENTS[this.name];
  }

  toString(): string {
    return this.name;
  }
}
