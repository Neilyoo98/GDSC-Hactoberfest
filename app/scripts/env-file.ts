// OWNER: P1. Read/update app/.env.local from scripts without touching other lines.
import fs from "node:fs";

export const ENV_PATH = ".env.local";

export function readEnv(path = ENV_PATH): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(path)) return out;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/** Set KEY=value in place (or append it), keeping comments and every other line. */
export function setEnv(key: string, value: string, path = ENV_PATH): void {
  const text = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  const next = re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.replace(/\n*$/, "\n")}${key}=${value}\n`;
  fs.writeFileSync(path, next);
  process.env[key] = value;
}
