import { CalendarEvent } from "@/models";
import { AppError, NotFoundError } from "@/utils/AppError";

type Input = { title?: string; start?: Date; end?: Date; allDay?: boolean; variant?: string };

export async function listEvents(userId: string, from?: Date, to?: Date) {
  const filter: Record<string, unknown> = { userId };
  // Keep every event that overlaps the window [from, to].
  if (from) filter.end = { $gte: from };
  if (to) filter.start = { $lte: to };
  const rows = await CalendarEvent.find(filter).sort({ start: 1 }).limit(2000);
  return rows.map((r) => r.toJSON());
}

export async function createEvent(userId: string, data: Required<Pick<Input, "title" | "start" | "end">> & Input) {
  return (await CalendarEvent.create({ ...data, userId })).toJSON();
}

export async function updateEvent(userId: string, id: string, data: Input) {
  const row = await CalendarEvent.findOne({ _id: id, userId });
  if (!row) throw new NotFoundError("Event");
  const start = data.start ?? row.start;
  const end = data.end ?? row.end;
  if (end.getTime() < start.getTime()) throw new AppError(400, "The end must not be before the start.", "INVALID_RANGE");
  row.set(data);
  await row.save();
  return row.toJSON();
}

export async function deleteEvent(userId: string, id: string) {
  const res = await CalendarEvent.deleteOne({ _id: id, userId });
  if (res.deletedCount === 0) throw new NotFoundError("Event");
}
