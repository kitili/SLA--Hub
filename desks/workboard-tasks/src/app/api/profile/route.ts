import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Log in first" }, { status: 401 });

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const jobTitle = String(form.get("jobTitle") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();
  const file = form.get("picture");

  let avatarUrl = user.avatarUrl;
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Picture must be an image" }, { status: 400 });
    }
    if (file.size > 2_000_000) {
      return NextResponse.json({ error: "Picture must be under 2 MB" }, { status: 400 });
    }
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const dir = path.join(process.cwd(), "public", "avatars");
    await mkdir(dir, { recursive: true });
    const filename = `${user.id}.${ext}`;
    await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
    avatarUrl = `/avatars/${filename}`;
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      name: name || user.name,
      jobTitle: jobTitle || null,
      bio: bio || null,
      avatarUrl,
    },
  });

  return NextResponse.json({ ok: true });
}
