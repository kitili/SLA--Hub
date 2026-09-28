import type { SupabaseClient } from "@supabase/supabase-js";

export const DRIVER_EMAIL_DOMAIN = "silverleaf.co.tz";

export type ProvisionDriverInput = {
  driverId: string;
  driverName: string;
  email?: string | null;
  /**
   * string — set this password (create or update)
   * undefined — generate a temp password when creating; leave existing users unchanged
   * null — never set/reset password (link-only; fails if Auth user missing)
   */
  password?: string | null;
  emailDomain?: string;
  /** Default true. When false and Auth user missing, return an error. */
  createIfMissing?: boolean;
};

export type ProvisionDriverResult = {
  driver_id: string;
  driver_name: string;
  email: string;
  user_id: string;
  action: "created" | "linked_existing" | "updated_link";
  /** Present only when this call set/generated a password — show once to ops. */
  temporary_password: string | null;
  error?: string;
};

function slugPart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.+/g, ".");
}

/** e.g. "John Doe" → john.doe@silverleaf.co.tz */
export function suggestDriverEmail(
  name: string,
  domain = DRIVER_EMAIL_DOMAIN,
): string {
  const slug = slugPart(name.trim()) || "driver";
  return `${slug}@${domain}`;
}

export function generateTempPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

export async function findAuthUserByEmail(
  service: SupabaseClient,
  email: string,
): Promise<{ id: string; email?: string } | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return { id: hit.id, email: hit.email };
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * Resolve a unique @domain email. If the suggested address is taken by another
 * user already linked to a different driver, append .2, .3, …
 */
export async function uniqueDriverEmail(
  service: SupabaseClient,
  preferred: string,
  forDriverId: string,
): Promise<string> {
  const at = preferred.lastIndexOf("@");
  if (at < 1) throw new Error("Invalid email");
  const local = preferred.slice(0, at);
  const domain = preferred.slice(at + 1);

  for (let n = 0; n < 50; n++) {
    const candidate =
      n === 0 ? preferred : `${local}.${n + 1}@${domain}`.toLowerCase();
    const existing = await findAuthUserByEmail(service, candidate);
    if (!existing) return candidate;

    const { data: profile } = await service
      .from("profiles")
      .select("driver_id")
      .eq("id", existing.id)
      .maybeSingle();

    const linked =
      typeof profile?.driver_id === "string" ? profile.driver_id : null;
    if (!linked || linked === forDriverId) return candidate;
  }

  throw new Error(`Could not allocate a free email near ${preferred}`);
}

async function linkProfileToDriver(
  service: SupabaseClient,
  userId: string,
  driverId: string,
  fullName: string,
) {
  await service.from("profiles").update({ driver_id: null }).eq("driver_id", driverId);

  const { error } = await service.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      role: "matron",
      driver_id: driverId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    const missingCol = /driver_id/i.test(error.message);
    throw new Error(
      missingCol
        ? `${error.message} — run supabase/migrate_driver_profile_link.sql`
        : error.message,
    );
  }
}

/**
 * Create (or reuse) an Auth user, set role=matron, link profiles.driver_id.
 * Returns a temporary_password only when this call created the user or reset one.
 */
export async function provisionDriverLogin(
  service: SupabaseClient,
  input: ProvisionDriverInput,
): Promise<ProvisionDriverResult> {
  const domain = (input.emailDomain ?? DRIVER_EMAIL_DOMAIN).trim().toLowerCase();
  const preferred = (
    input.email?.trim() || suggestDriverEmail(input.driverName, domain)
  ).toLowerCase();
  const createIfMissing = input.createIfMissing !== false;

  if (!preferred.includes("@") || !preferred.endsWith(`@${domain}`)) {
    return {
      driver_id: input.driverId,
      driver_name: input.driverName,
      email: preferred,
      user_id: "",
      action: "linked_existing",
      temporary_password: null,
      error: `Email must be @${domain}`,
    };
  }

  const email = await uniqueDriverEmail(service, preferred, input.driverId);
  const existing = await findAuthUserByEmail(service, email);

  if (existing) {
    // undefined → leave password; string → set; null → leave
    const passwordArg = input.password;
    const shouldSetPassword = typeof passwordArg === "string";
    const password = shouldSetPassword ? passwordArg.trim() : null;
    if (shouldSetPassword && !password) {
      return {
        driver_id: input.driverId,
        driver_name: input.driverName,
        email,
        user_id: existing.id,
        action: "updated_link",
        temporary_password: null,
        error: "Password cannot be empty",
      };
    }

    const { error } = await service.auth.admin.updateUserById(existing.id, {
      ...(password ? { password } : {}),
      email_confirm: true,
      user_metadata: {
        full_name: input.driverName,
        role: "matron",
      },
    });
    if (error) throw new Error(error.message);

    await linkProfileToDriver(
      service,
      existing.id,
      input.driverId,
      input.driverName,
    );

    return {
      driver_id: input.driverId,
      driver_name: input.driverName,
      email,
      user_id: existing.id,
      action: "updated_link",
      temporary_password: password,
    };
  }

  if (!createIfMissing || input.password === null) {
    return {
      driver_id: input.driverId,
      driver_name: input.driverName,
      email,
      user_id: "",
      action: "linked_existing",
      temporary_password: null,
      error: `No Auth user for ${email}. Create the login first, or use generate/shared password mode.`,
    };
  }

  const temporary =
    typeof input.password === "string" && input.password.trim()
      ? input.password.trim()
      : generateTempPassword();

  const { data, error } = await service.auth.admin.createUser({
    email,
    password: temporary,
    email_confirm: true,
    user_metadata: {
      full_name: input.driverName,
      role: "matron",
    },
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "Could not create Auth user");
  }

  await linkProfileToDriver(
    service,
    data.user.id,
    input.driverId,
    input.driverName,
  );

  return {
    driver_id: input.driverId,
    driver_name: input.driverName,
    email,
    user_id: data.user.id,
    action: "created",
    temporary_password: temporary,
  };
}

export type DriverLoginLink = {
  driver_id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
};

/** Map fleet driver_id → linked Auth profile (if any). */
export async function listDriverLoginLinks(
  service: SupabaseClient,
): Promise<DriverLoginLink[]> {
  const { data, error } = await service
    .from("profiles")
    .select("id, full_name, driver_id")
    .not("driver_id", "is", null);

  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter(
    (r): r is { id: string; full_name: string | null; driver_id: string } =>
      typeof r.driver_id === "string",
  );
  if (rows.length === 0) return [];

  const emailByUserId = new Map<string, string>();
  for (let page = 1; page <= 25; page++) {
    const { data: list, error: listErr } = await service.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listErr) throw new Error(listErr.message);
    for (const u of list.users) {
      if (u.email) emailByUserId.set(u.id, u.email);
    }
    if (list.users.length < 200) break;
  }

  return rows.map((row) => ({
    driver_id: row.driver_id,
    user_id: row.id,
    email: emailByUserId.get(row.id) ?? null,
    full_name: row.full_name,
  }));
}
