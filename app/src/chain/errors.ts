// app/src/chain/errors.ts    OWNER: P4
// The relay returns only the start of a failed simulation ("custom program error: 0x1770"), which cuts
// off the "Error Code: StakeOutOfRange" log line. Map the code back to its IDL name so hooks.ts can
// show a friendly message.
import idl from "../shared/idl/kept.json";

const NAMES = new Map<number, string>(idl.errors.map((e) => [e.code, e.name]));

/** Appends the program error name when `msg` only carries the hex code. */
export function withProgramErrorName(msg: string): string {
  const hex = msg.match(/custom program error: (0x[0-9a-f]+)/i)?.[1];
  if (!hex) return msg;
  const code = parseInt(hex, 16);
  // 0x0 comes from the System Program: an `init` account (e.g. the Position) already exists.
  const name = code === 0 ? "already in use" : NAMES.get(code);
  return name ? `${msg} ${name}` : msg;
}
