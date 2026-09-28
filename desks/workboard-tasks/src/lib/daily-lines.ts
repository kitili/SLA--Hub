export const DAILY_LINES = [
  { slot: 1, label: "Priority", hint: "First priority for today" },
  { slot: 2, label: "Priority", hint: "Second priority for today" },
  { slot: 3, label: "Priority", hint: "Third priority for today" },
  {
    slot: 4,
    label: "Challenge",
    hint: "A challenge that may get in the way of today’s priorities",
  },
  {
    slot: 5,
    label: "Progress recap",
    hint: "A recap of how yesterday’s priorities went",
  },
] as const;

export function dailyLineLabel(slot: number) {
  return DAILY_LINES.find((line) => line.slot === slot)?.label ?? `Line ${slot}`;
}
