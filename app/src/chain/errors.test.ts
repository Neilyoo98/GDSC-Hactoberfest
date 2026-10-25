// app/src/chain/errors.test.ts    OWNER: P4
import { describe, it, expect } from "vitest";
import idl from "../shared/idl/kept.json";
import { withProgramErrorName } from "./errors";

// What /api/relay actually returns (captured on devnet), truncated before the logs.
const relayMsg = (hex: string) =>
  `Simulation failed. \nMessage: Transaction simulation failed: Error processing Instruction 0: custom program error: ${hex}. \nLogs: \n[\n  "Program GYupVps`;

describe("withProgramErrorName", () => {
  it("names program errors from the IDL codes", () => {
    for (const e of idl.errors)
      expect(withProgramErrorName(relayMsg("0x" + e.code.toString(16)))).toContain(e.name);
  });

  it("0x1770 is the first program error (NotOpen)", () => {
    expect(withProgramErrorName(relayMsg("0x1770"))).toMatch(/NotOpen$/);
  });

  it("0x0 (System Program init) reads as already in use", () => {
    expect(withProgramErrorName(relayMsg("0x0"))).toMatch(/already in use$/);
  });

  it("leaves other messages alone", () => {
    expect(withProgramErrorName("User rejected the request.")).toBe("User rejected the request.");
    expect(withProgramErrorName(relayMsg("0xffff"))).toBe(relayMsg("0xffff"));
  });
});
