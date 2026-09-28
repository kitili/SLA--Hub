import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  DRIVER_EMAIL_DOMAIN,
  provisionDriverLogin,
} from "@/lib/driver/provision";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/drivers/[id]/link-login
 * Body: { email: string, create?: boolean, password?: string }
 * - create:false (default) — link an existing Auth user only
 * - create:true — create Auth user if missing (password optional; generates temp)
 */
export async function POST(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const { id: driverId } = await context.params;
  if (!driverId) {
    return NextResponse.json({ error: "driver id required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    email?: string;
    create?: boolean;
    password?: string;
  };
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "A valid login email is required" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: driver, error: driverErr } = await supabase
    .from("drivers")
    .select("id, name")
    .eq("id", driverId)
    .maybeSingle();

  if (driverErr || !driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "Server missing service role — cannot look up Auth users" },
      { status: 503 },
    );
  }

  try {
    const result = await provisionDriverLogin(service, {
      driverId: driver.id,
      driverName: driver.name,
      email,
      emailDomain: email.endsWith(`@${DRIVER_EMAIL_DOMAIN}`)
        ? DRIVER_EMAIL_DOMAIN
        : email.split("@")[1],
      createIfMissing: Boolean(body.create),
      password: body.create
        ? body.password?.trim() || undefined
        : null,
    });

    if (result.error) {
      return NextResponse.json(
        {
          error: result.error,
          hint: body.create
            ? undefined
            : "Create the staff login first, or pass { \"create\": true } to provision.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      driver_id: result.driver_id,
      driver_name: result.driver_name,
      user_id: result.user_id,
      email: result.email,
      action: result.action,
      temporary_password: result.temporary_password,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Link failed";
    const missingCol = /driver_id/i.test(message);
    return NextResponse.json(
      {
        error: message,
        ...(missingCol
          ? {
              hint: "Run supabase/migrate_driver_profile_link.sql in the Supabase SQL Editor.",
            }
          : {}),
      },
      { status: missingCol ? 503 : 400 },
    );
  }
}
