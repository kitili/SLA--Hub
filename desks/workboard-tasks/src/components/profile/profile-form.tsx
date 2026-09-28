"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ProfileFormProps = {
  name: string;
  username: string;
  jobTitle: string;
  bio: string;
  avatarUrl: string | null;
};

export function ProfileForm({ name, username, jobTitle, bio, avatarUrl }: ProfileFormProps) {
  const router = useRouter();
  const [preview, setPreview] = useState(avatarUrl);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const initial = (name || username || "?").slice(0, 1).toUpperCase();

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/profile", { method: "POST", body: new FormData(e.currentTarget) });
    const data = (await res.json()) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save your profile");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={save} className="overflow-hidden rounded-3xl border border-[#002368]/10 bg-white shadow-sm">
      <div className="bg-[#002368] px-8 py-10 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ffc952]">Profile</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">{name || username}</h2>
        <p className="mt-1 text-sm text-[#80bfec]">{jobTitle || "Add your role"}</p>
      </div>

      <div className="-mt-10 px-8 pb-8">
        <label className="inline-block cursor-pointer">
          <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#d9ecf9] text-2xl font-semibold text-[#002368] shadow">
            {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : initial}
          </span>
          <input
            name="picture"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPreview(URL.createObjectURL(file));
            }}
          />
          <span className="mt-2 block text-center text-xs font-medium text-[#002368]">Change photo</span>
        </label>

        <div className="mt-6 grid gap-4">
          <label className="block text-sm">
            <span className="font-medium text-[#002368]">Name</span>
            <input name="name" defaultValue={name} className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#002368]">Role</span>
            <input
              name="jobTitle"
              defaultValue={jobTitle}
              placeholder="Teacher, operations, marketing…"
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#002368]">Biodata</span>
            <textarea
              name="bio"
              defaultValue={bio}
              rows={5}
              placeholder="A short note about you and the work you do."
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5"
            />
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="mt-5 rounded-xl bg-[#002368] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
