import { NextRequest, NextResponse } from "next/server";
import { sendSubscriptionReminders } from "@/lib/reports/subscription-reminders";
import { sendToolReminders } from "@/lib/reports/tool-reminders";
import { runOneToFivesCron } from "@/lib/one-to-fives";

// Daily reminders plus the 1–5s / Thursday pulse close. 06:31 UTC is 09:31 Nairobi,
// one minute after the 9:30 a.m. submission deadline, so missed rows are marked
// without anyone checking the board.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [subscriptions, toolReminders, oneToFives] = await Promise.all([
    sendSubscriptionReminders(),
    sendToolReminders(),
    runOneToFivesCron(),
  ]);
  return NextResponse.json({ ok: true, subscriptions, toolReminders, oneToFives });
}
