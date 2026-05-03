import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config/env.js";
import type { PublicEvent } from "../x402/types.js";

export interface EventRepository {
  add(event: Omit<PublicEvent, "event_id">): Promise<PublicEvent>;
  list(limit?: number): PublicEvent[];
}

export class EventStore implements EventRepository {
  private readonly events: PublicEvent[] = [];

  public constructor(private readonly config: AppConfig) {}

  public async add(event: Omit<PublicEvent, "event_id">): Promise<PublicEvent> {
    const nextEvent: PublicEvent = { ...event, event_id: `evt_${randomUUID()}` };
    this.events.unshift(nextEvent);
    await mkdir(this.config.runtimeDir, { recursive: true });
    await appendFile(path.join(this.config.runtimeDir, "events.jsonl"), `${JSON.stringify(nextEvent)}\n`, "utf8");
    return nextEvent;
  }

  public list(limit = this.config.eventFeedLimit): PublicEvent[] {
    return this.events.slice(0, limit);
  }
}
