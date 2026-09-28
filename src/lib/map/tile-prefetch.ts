import type { Map as MapLibreMap } from "maplibre-gl";

import { tileKey, type TileAddress, type TileSourceRange } from "./route-tiles";

/*
 * MapLibre has no public way to load tiles for somewhere the camera isn't yet.
 * Each source's tile manager keeps an out-of-view cache, though, and takes a
 * tile from it before it would load one: so a tile loaded through the source
 * and put there is on screen the frame the camera reaches it. A tile still
 * loading goes into the cache too, so if the camera gets there first the map
 * takes that same load over instead of starting another. These are MapLibre
 * 6 internals, looked up and checked before use; without them nothing is
 * prefetched and the map loads tiles as it always has.
 */

interface TileId {
  key: string;
  overscaleFactor(): number;
}
interface Tile {
  tileID: TileId;
  state: string;
  aborted?: boolean;
}
interface TileManager {
  _source: TileSourceRange & {
    type: string;
    loadTile(tile: Tile): Promise<unknown>;
    abortTile?(tile: Tile): unknown;
    unloadTile?(tile: Tile): unknown;
  };
  _inViewTiles: { getTileById(key: string): Tile | undefined; getAllTiles(): Tile[] };
  _outOfViewCache: {
    has(id: TileId): boolean;
    get(id: TileId): Tile | null;
    add(id: TileId, tile: Tile): unknown;
    remove(id: TileId, tile?: Tile): unknown;
  };
}
type TileIdConstructor = new (overscaledZ: number, wrap: number, z: number, x: number, y: number) => TileId;
type TileConstructor = new (id: TileId, size: number) => Tile;

function tileManager(map: MapLibreMap, sourceId: string): TileManager | null {
  const tm = (map as unknown as { style?: { tileManagers?: Record<string, Partial<TileManager>> } }).style?.tileManagers?.[
    sourceId
  ];
  const ok =
    tm?._source?.type === "vector" &&
    typeof tm._source.loadTile === "function" &&
    typeof tm._inViewTiles?.getTileById === "function" &&
    typeof tm._inViewTiles.getAllTiles === "function" &&
    typeof tm._outOfViewCache?.has === "function" &&
    typeof tm._outOfViewCache.get === "function" &&
    typeof tm._outOfViewCache.add === "function" &&
    typeof tm._outOfViewCache.remove === "function";
  return ok ? (tm as TileManager) : null;
}

/** Drops a tile loaded ahead from the cache (which unloads it), if it's still there. */
function evict(tm: TileManager, id: TileId, tile: Tile) {
  if (tm._outOfViewCache.get(id) === tile) tm._outOfViewCache.remove(id, tile);
}

export interface TilePrefetcher {
  /** The source's tile range, once the map has drawn a tile of it. */
  range(): TileSourceRange | null;
  /** Loads these tiles (most useful first) and drops loads still waiting that aren't among them. */
  want(tiles: TileAddress[]): void;
}

/** A few at a time, so the tiles the camera needs right now never queue behind them. */
const CONCURRENCY = 3;

export function createTilePrefetcher(map: MapLibreMap, sourceId: string): TilePrefetcher {
  let queue: TileAddress[] = [];
  const inFlight = new Map<string, { id: TileId; tile: Tile }>();

  const kinds = (tm: TileManager) => {
    const sample = tm._inViewTiles.getAllTiles()[0];
    if (!sample) return null;
    return {
      Tile: sample.constructor as TileConstructor,
      TileId: sample.tileID.constructor as TileIdConstructor,
    };
  };

  const pump = () => {
    const tm = tileManager(map, sourceId);
    const make = tm && kinds(tm);
    if (!tm || !make) return;
    while (inFlight.size < CONCURRENCY && queue.length) {
      const address = queue.shift()!;
      const key = tileKey(address);
      const id = new make.TileId(address.overscaledZ, 0, address.z, address.x, address.y);
      if (tm._inViewTiles.getTileById(id.key) || tm._outOfViewCache.has(id)) continue;
      const tile = new make.Tile(id, tm._source.tileSize * id.overscaleFactor());
      tm._outOfViewCache.add(id, tile);
      inFlight.set(key, { id, tile });
      tm._source
        .loadTile(tile)
        .catch(() => {
          tile.state = "errored";
          evict(tm, id, tile);
        })
        .finally(() => {
          inFlight.delete(key);
          // Taken over by the map mid-load: nothing else tells it the tile is in.
          if (tm._inViewTiles.getTileById(id.key) === tile) map.triggerRepaint();
          pump();
        });
    }
  };

  return {
    range() {
      const source = tileManager(map, sourceId)?._source;
      return source ? { minzoom: source.minzoom, maxzoom: source.maxzoom, tileSize: source.tileSize } : null;
    },
    want(tiles) {
      const tm = tileManager(map, sourceId);
      const keys = new Set(tiles.map(tileKey));
      for (const [key, { id, tile }] of inFlight) {
        if (keys.has(key) || !tm || tm._inViewTiles.getTileById(id.key) === tile) continue;
        tile.aborted = true;
        Promise.resolve(tm._source.abortTile?.(tile)).catch(() => {});
        evict(tm, id, tile);
        inFlight.delete(key);
      }
      queue = tiles.filter((t) => !inFlight.has(tileKey(t)));
      pump();
    },
  };
}
