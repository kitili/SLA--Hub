"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Condition = "new" | "good" | "fair" | "damaged" | "faulty" | "retired";

type ActiveAllocation = {
  allocatedAt: Date;
  expectedReturnAt: Date | null;
  purpose: string | null;
  allocatedToPersonName: string | null;
  allocatedToUser: { name: string } | null;
  allocatedToDepartment: { name: string } | null;
  allocatedToLocation: { name: string } | null;
} | null;

export function ToolDetailActions({
  toolId,
  activeAllocation,
  canManage,
}: {
  toolId: string;
  activeAllocation: ActiveAllocation;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [condition, setCondition] = useState<Condition>("good");
  const [note, setNote] = useState("");
  const [confirmingReturn, setConfirmingReturn] = useState(false);

  async function post(url: string, body: unknown) {
    setPending(true);
    setError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Card>
        <h2 className="mb-3 text-sm font-medium text-black/60">Record condition</h2>
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="condition">Condition</Label>
            <Select id="condition" value={condition} onChange={(e) => setCondition(e.target.value as Condition)}>
              <option value="new">New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="damaged">Damaged</option>
              <option value="faulty">Faulty</option>
              <option value="retired">Retired</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button
            disabled={pending}
            onClick={async () => {
              const ok = await post(`/api/tools/${toolId}/condition`, { condition, note: note || undefined });
              if (ok) setNote("");
            }}
          >
            Save condition
          </Button>
        </div>
      </Card>

      {canManage && activeAllocation && (
        <Card>
          <h2 className="mb-3 text-sm font-medium text-black/60">Allocation</h2>

          {!confirmingReturn ? (
            <Button variant="secondary" disabled={pending} onClick={() => setConfirmingReturn(true)}>
              Return device
            </Button>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-black/70">Confirm this device is being returned:</p>
              <dl className="grid grid-cols-2 gap-2 rounded-md bg-gray-light/60 p-3">
                <dt className="text-black/50">Borrower</dt>
                <dd>
                  {activeAllocation.allocatedToPersonName ??
                    activeAllocation.allocatedToUser?.name ??
                    activeAllocation.allocatedToDepartment?.name ??
                    activeAllocation.allocatedToLocation?.name ??
                    "—"}
                </dd>
                <dt className="text-black/50">Taken on</dt>
                <dd>{activeAllocation.allocatedAt.toLocaleDateString()}</dd>
                <dt className="text-black/50">Expected return</dt>
                <dd>{activeAllocation.expectedReturnAt?.toLocaleDateString() ?? "—"}</dd>
                {activeAllocation.purpose && (
                  <>
                    <dt className="text-black/50">Purpose</dt>
                    <dd>{activeAllocation.purpose}</dd>
                  </>
                )}
              </dl>
              <div className="flex gap-2">
                <Button
                  disabled={pending}
                  onClick={async () => {
                    const ok = await post(`/api/tools/${toolId}/return`, {});
                    if (ok) setConfirmingReturn(false);
                  }}
                >
                  {pending ? "Returning…" : "Confirm return"}
                </Button>
                <Button variant="ghost" disabled={pending} onClick={() => setConfirmingReturn(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
