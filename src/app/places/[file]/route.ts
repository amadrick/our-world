import { readFile } from "node:fs/promises";
import path from "node:path";

// Stills in public/places are served statically, but a production build only
// knows the files that existed when it was built. Anything drawn later from
// the admin falls through to here.
export async function GET(_request: Request, ctx: RouteContext<"/places/[file]">) {
  const { file } = await ctx.params;
  if (!/^[a-z0-9-]+\.webp$/.test(file)) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(path.join(process.cwd(), "public", "places", file));
    return new Response(new Uint8Array(body), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
