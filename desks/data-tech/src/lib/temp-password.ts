import { randomInt } from "crypto";

// Avoids visually ambiguous characters (0/O, 1/l/I) since this is meant to be read off an
// email and typed in by hand at least once.
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const LENGTH = 14;

export function generateTempPassword() {
  let password = "";
  for (let i = 0; i < LENGTH; i++) {
    password += CHARSET[randomInt(CHARSET.length)];
  }
  return password;
}
