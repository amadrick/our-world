/**
 * Opening hours, per weekday, in San Francisco time. A day holds any number of
 * [open, close] intervals ("HH:MM", 24-hour). A close at or before its open
 * runs past midnight into the next day: a bar open 4 PM to 2 AM is
 * ["16:00", "02:00"], a kitchen closing at midnight is ["17:00", "00:00"].
 */

export const TIME_ZONE = "America/Los_Angeles";

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type Interval = [open: string, close: string];

export interface PlaceHours {
  /**
   * "listed": weekly hours from a public listing. "always": open around the
   * clock, per a source. "unknown": no hours could be confirmed; never a guess.
   */
  status: "listed" | "always" | "unknown";
  weekly?: Record<Weekday, Interval[]>;
  /** Where the hours were read. */
  source?: string;
  /** A second listing that agrees. */
  confirmedBy?: string;
  /** When they were checked, as "YYYY-MM-DD". */
  checkedAt?: string;
  /** Seasonal hours, conflicts, or why they're unknown. */
  note?: string;
  /** A source says the place has closed for good. It stays in the guide until Andy decides. */
  closedPermanently?: boolean;
}

const DAY = 24 * 60;
const WEEK = 7 * DAY;

/** Minutes since midnight for "HH:MM". */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** The weekday (0 = Sunday) and minute of the day in San Francisco. */
export function localClock(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Each opening as [start, end) in minutes from Sunday 00:00, merged where one runs into the next. */
function weekSpans(weekly: Record<Weekday, Interval[]>): [number, number][] {
  const spans: [number, number][] = [];
  WEEKDAYS.forEach((day, i) => {
    for (const [open, close] of weekly[day] ?? []) {
      const start = i * DAY + minutesOf(open);
      let end = i * DAY + minutesOf(close);
      if (end <= start) end += DAY;
      spans.push([start, end]);
    }
  });
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push([...span]);
  }
  return merged;
}

export type OpenState =
  | { kind: "open"; /** Minutes until it closes. */ closesIn: number; closesAt: { day: number; minutes: number } }
  | { kind: "always" }
  | { kind: "closed"; /** Minutes until it opens, or null if no opening is listed. */ opensIn: number | null; opensAt: { day: number; minutes: number } | null }
  | { kind: "unknown" };

/** Open right now, when it closes or opens next, from a place's hours and the time in San Francisco. */
export function openState(hours: PlaceHours | undefined, now: Date): OpenState {
  if (!hours || hours.closedPermanently) return { kind: "unknown" };
  if (hours.status === "always") return { kind: "always" };
  if (hours.status !== "listed" || !hours.weekly) return { kind: "unknown" };
  const { day, minutes } = localClock(now);
  const at = day * DAY + minutes;
  const spans = weekSpans(hours.weekly);
  if (spans.length === 0) return { kind: "closed", opensIn: null, opensAt: null };
  // Look at last week, this week, and next, so Saturday night runs into Sunday and Sunday into Monday.
  const around = [-WEEK, 0, WEEK].flatMap((shift) => spans.map(([s, e]): [number, number] => [s + shift, e + shift]));
  const current = around.find(([s, e]) => s <= at && at < e);
  const clock = (t: number) => {
    const m = ((t % WEEK) + WEEK) % WEEK;
    return { day: Math.floor(m / DAY), minutes: m % DAY };
  };
  if (current) {
    // Open all week without a break.
    if (current[1] - current[0] >= WEEK) return { kind: "always" };
    return { kind: "open", closesIn: current[1] - at, closesAt: clock(current[1]) };
  }
  const next = around.filter(([s]) => s > at).sort((a, b) => a[0] - b[0])[0];
  return next ? { kind: "closed", opensIn: next[0] - at, opensAt: clock(next[0]) } : { kind: "closed", opensIn: null, opensAt: null };
}

/** "10 PM", "7:30 AM", "midnight", "noon". */
export function formatClock(minutes: number): string {
  if (minutes === 0) return "midnight";
  if (minutes === 12 * 60) return "noon";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** When it opens, relative to today: "7 AM", "tomorrow 7 AM", "Tue 7 AM". */
function whenNext(at: { day: number; minutes: number }, now: Date): string {
  const today = localClock(now).day;
  const ahead = (at.day - today + 7) % 7;
  const time = formatClock(at.minutes);
  if (ahead === 0) return time;
  if (ahead === 1) return `tomorrow ${time}`;
  return `${DAY_NAMES[at.day]} ${time}`;
}

/** Soon enough before closing that a place ranks below the other open ones. */
export const CLOSING_SOON_MIN = 45;

/** The one quiet line for a sheet or page: "Open now · closes 10 PM", "Closed · opens 7 AM", "Hours unknown". */
export function hoursLine(state: OpenState, now: Date): string {
  switch (state.kind) {
    case "always":
      return "Open 24 hours";
    case "open":
      return `${state.closesIn <= CLOSING_SOON_MIN ? "Closing soon" : "Open now"} · closes ${formatClock(state.closesAt.minutes)}`;
    case "closed":
      return state.opensAt ? `Closed · opens ${whenNext(state.opensAt, now)}` : "Closed";
    default:
      return "Hours unknown";
  }
}

/** For a card, where the name already sits above: "Open · closes 10 PM", "Opens tomorrow 7 AM", or nothing when unknown. */
export function shortHoursLine(state: OpenState, now: Date): string | null {
  switch (state.kind) {
    case "always":
      return "Open 24 hours";
    case "open":
      return `Open · closes ${formatClock(state.closesAt.minutes)}`;
    case "closed":
      return state.opensAt ? `Opens ${whenNext(state.opensAt, now)}` : "Closed";
    default:
      return null;
  }
}
