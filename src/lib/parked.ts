import { db, type ParkedTicket, type PendingSaleItem } from "./db";
import { v4 as uuidv4 } from "uuid";

export async function parkTicket(input: { label: string; items: PendingSaleItem[]; total: number }): Promise<ParkedTicket> {
  const t: ParkedTicket = {
    id: uuidv4(),
    label: input.label || "Без метки",
    items: input.items,
    total: input.total,
    created_at: new Date().toISOString(),
  };
  await db.parked.put(t);
  return t;
}

export async function unparkTicket(id: string): Promise<ParkedTicket | null> {
  const t = await db.parked.get(id);
  if (!t) return null;
  await db.parked.delete(id);
  return t;
}

export async function deleteParked(id: string) {
  await db.parked.delete(id);
}
