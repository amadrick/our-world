import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Loads .env.local into process.env (without overriding real env vars), like Next does. */
export function loadEnvLocal(root = process.cwd()) {
  const file = path.join(root, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}
