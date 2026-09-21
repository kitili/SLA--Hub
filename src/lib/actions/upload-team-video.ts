"use server";

import { put, del } from "@vercel/blob";

import { getCurrentUser } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/app-settings";

const SINGLE_KEYS = new Set(["team_video_ceo", "team_video_hos", "team_video_hr"]);
const ALL_KEYS = new Set([...SINGLE_KEYS, "team_video_dept"]);

export async function uploadTeamVideoAction(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.isAdmin) return { error: "Unauthorized" };

    const file = formData.get("file") as File | null;
    const settingKey = (formData.get("settingKey") as string | null)?.trim();

    if (!file || !file.size) return { error: "No file provided" };
    if (!settingKey || !ALL_KEYS.has(settingKey)) return { error: "Invalid setting key" };
    if (!file.type.startsWith("video/")) return { error: `File must be a video (got: ${file.type})` };

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) return { error: "Blob storage not configured" };

    if (SINGLE_KEYS.has(settingKey)) {
      const existing = await getSetting(settingKey);
      if (existing?.includes("blob.vercel-storage.com")) {
        await del(existing, { token: blobToken }).catch(() => null);
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() ?? "mp4";
    const { url } = await put(
      `team-videos/${settingKey}-${Date.now()}.${ext}`,
      buffer,
      { access: "private", contentType: file.type, token: blobToken },
    );

    if (SINGLE_KEYS.has(settingKey)) {
      await setSetting(settingKey, url);
    }

    return { url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload-team-video] Unhandled error:", msg);
    return { error: msg };
  }
}
