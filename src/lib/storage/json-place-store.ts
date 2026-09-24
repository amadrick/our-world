import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Place, PlaceInput } from "@/lib/places/types";
import { PlaceNotFoundError, type PlaceStore } from "./place-store";

interface PlacesFile {
  places: Place[];
}

export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "place"
  );
}

export class JsonPlaceStore implements PlaceStore {
  // Serializes writes so two quick saves can't clobber each other.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async list(): Promise<Place[]> {
    return (await this.read()).places;
  }

  async get(id: string): Promise<Place | null> {
    return (await this.list()).find((p) => p.id === id) ?? null;
  }

  create(input: PlaceInput): Promise<Place> {
    return this.mutate((data) => {
      const taken = new Set(data.places.map((p) => p.id));
      const base = slugify(input.name);
      let id = base;
      for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
      const place: Place = { ...input, id, createdAt: new Date().toISOString() };
      data.places.push(place);
      return place;
    });
  }

  update(id: string, input: PlaceInput): Promise<Place> {
    return this.mutate((data) => {
      const index = data.places.findIndex((p) => p.id === id);
      if (index === -1) throw new PlaceNotFoundError(id);
      const existing = data.places[index];
      const place: Place = {
        ...input,
        id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      data.places[index] = place;
      return place;
    });
  }

  remove(id: string): Promise<void> {
    return this.mutate((data) => {
      const index = data.places.findIndex((p) => p.id === id);
      if (index === -1) throw new PlaceNotFoundError(id);
      data.places.splice(index, 1);
    });
  }

  private async read(): Promise<PlacesFile> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<PlacesFile>;
      return { places: Array.isArray(parsed.places) ? parsed.places : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { places: [] };
      }
      throw error;
    }
  }

  private mutate<T>(change: (data: PlacesFile) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const data = await this.read();
      const result = change(data);
      await this.write(data);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async write(data: PlacesFile): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await rename(tmp, this.filePath);
  }
}
