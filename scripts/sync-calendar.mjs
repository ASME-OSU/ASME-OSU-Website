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

function dateKey(value) {
  if (value?.dateOnly) return iso(value).slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function eventIso(value, allDay) {
  const valueIso = iso(value);
  if (!valueIso || !allDay) return valueIso;
  return `${valueIso.slice(0, 10)}T12:00:00.000Z`;
}

function inWindow(value, from, to) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= from && date <= to;
}

function reconcileMalformedOverrides(component, expanded, from, to) {
  const instances = [...expanded];
  const overrides = Array.from(new Set(Object.values(component.recurrences || {})));

  for (const override of overrides) {
    const alreadyExpanded = instances.some((instance) =>
      instance.isOverride && (
        instance.event === override ||
        (iso(instance.start) === iso(override.start) && text(instance.summary) === text(override.summary))
      )
    );
    if (alreadyExpanded || !inWindow(override.start, from, to)) continue;

    // Google occasionally emits a moved first occurrence with a Unix-epoch
    // RECURRENCE-ID. node-ical cannot associate that override with its series,
    // so the obsolete base occurrence survives and the real event disappears.
    if (inWindow(override.recurrenceid, from, to)) continue;

    const overrideDate = dateKey(override.start);
    const baseIndex = instances.findIndex((instance) =>
      !instance.isOverride && dateKey(instance.start) === overrideDate
    );
    if (baseIndex !== -1) instances.splice(baseIndex, 1);

    if (text(override.status).toUpperCase() !== "CANCELLED") {
      instances.push({
        event: override,
        start: override.start,
        end: override.end,
        summary: override.summary,
        isFullDay: Boolean(override.start?.dateOnly),
        isOverride: true,
        isRecurring: true
      });
    }
  }

  return instances.sort((a, b) => new Date(a.start) - new Date(b.start));
}

function serializeInstance(instance, base) {
  const event = instance.isOverride ? instance.event : base;
  const allDay = Boolean(instance.isFullDay);
  const start = eventIso(instance.start, allDay);
  const uid = text(event.uid);
  return {
    id: `${uid}::${start}`,
    title: text(instance.summary || event.summary) || "Untitled Event",
    start,
    end: eventIso(instance.end, allDay),
    allDay,
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
    const expanded = ical.expandRecurringEvent(component, {
      from,
      to,
      includeOverrides: true,
      excludeExdates: true,
      expandOngoing: true
    });
    const instances = reconcileMalformedOverrides(component, expanded, from, to);
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
