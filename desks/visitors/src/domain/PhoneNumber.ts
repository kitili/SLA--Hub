import { ValidationError } from "./errors";

const MIN_DIGITS = 9;
const MAX_DIGITS = 15;

export class PhoneNumber {
  private constructor(readonly digits: string) {}

  static digitsOnly(raw: string): string {
    return raw.replace(/\D/g, "").slice(0, MAX_DIGITS);
  }

  static fromInput(raw: string): PhoneNumber {
    const digits = PhoneNumber.digitsOnly(raw);
    if (digits.length < MIN_DIGITS) {
      throw new ValidationError(
        `Phone number must be ${MIN_DIGITS}–${MAX_DIGITS} digits only.`,
      );
    }
    return new PhoneNumber(digits);
  }

  toString(): string {
    return this.digits;
  }

  display(): string {
    if (this.digits.length === 10 && this.digits.startsWith("0")) {
      return `${this.digits.slice(0, 4)} ${this.digits.slice(4, 7)} ${this.digits.slice(7)}`;
    }
    if (this.digits.length === 12 && this.digits.startsWith("255")) {
      return `+${this.digits.slice(0, 3)} ${this.digits.slice(3, 6)} ${this.digits.slice(6, 9)} ${this.digits.slice(9)}`;
    }
    return this.digits;
  }
}
