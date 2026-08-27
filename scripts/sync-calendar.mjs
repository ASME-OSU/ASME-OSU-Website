import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ical from "node-ical";

const CALENDAR_ID = "c93730cdacb567b0f010d1367080e3028ec5c7657d9713b675ac9e5c437b9fba@group.calendar.google.com";
const TIME_ZONE = "America/New_York";
const ICAL_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`;
const EMBED_URL = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(CALENDAR_ID)}&ctz=${encodeURIComponent(TIME_ZONE)}`;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "data", "calendar-events.json");

function text(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "val" in value) return String(value.val || "");
  return String(value);
}

function iso(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function serializeInstance(instance, base) {
  const event = instance.isOverride ? instance.event : base;
  const start = new Date(instance.start);
  const uid = text(event.uid);
  return {
    id: `${uid}::${start.toISOString()}`,
    title: text(instance.summary || event.summary) || "Untitled Event",
    start: start.toISOString(),
    end: iso(instance.end),
    allDay: Boolean(instance.isFullDay),
    location: text(event.location),
    description: instance.isRecurring && !instance.isOverride ? "" : text(event.description),
    url: EMBED_URL,
    updated: iso(event.lastmodified || event.dtstamp)
  };
}

async function main() {
  const parsed = await ical.async.fromURL(ICAL_URL);
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 400 * 24 * 60 * 60 * 1000);
  const events = [];

  for (const component of Object.values(parsed)) {
    if (!component || component.type !== "VEVENT" || component.recurrenceid) continue;
    if (text(component.status).toUpperCase() === "CANCELLED") continue;
    const base = {
      uid: component.uid,
      summary: component.summary,
      location: component.location,
      description: component.description,
      lastmodified: component.lastmodified,
      dtstamp: component.dtstamp,
      status: component.status
    };
    const instances = ical.expandRecurringEvent(component, {
      from,
      to,
      includeOverrides: true,
      excludeExdates: true,
      expandOngoing: true
    });
    for (const instance of instances) {
      if (text(instance.event.status).toUpperCase() === "CANCELLED") continue;
      events.push(serializeInstance(instance, base));
    }
  }

  const uniqueEvents = Array.from(new Map(events.map((event) => [event.id, event])).values())
    .sort((a, b) => a.start.localeCompare(b.start));
  const next = {
    generatedAt: new Date().toISOString(),
    calendarName: "ASME Public",
    timeZone: TIME_ZONE,
    sourceUrl: EMBED_URL,
    events: uniqueEvents
  };

  try {
    const previous = JSON.parse(await fs.readFile(OUTPUT, "utf8"));
    if (JSON.stringify(previous.events) === JSON.stringify(next.events)) {
      console.log(`Calendar is unchanged (${uniqueEvents.length} upcoming events).`);
      return;
    }
  } catch (error) {
    if (error.code !== "ENOENT") console.warn(`Existing calendar feed could not be read: ${error.message}`);
  }

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Wrote ${uniqueEvents.length} upcoming events to data/calendar-events.json.`);
}

await main();
