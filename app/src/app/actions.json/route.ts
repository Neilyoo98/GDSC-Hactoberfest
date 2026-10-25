// app/src/app/actions.json/route.ts    OWNER: P4
// Blinks discovery: tells dial.to / X that /markets/<id> pages map to the stake Action.
import { ACTIONS_HEADERS } from "../api/actions/headers";

export const GET = () =>
  Response.json(
    { rules: [{ pathPattern: "/markets/*", apiPath: "/api/actions/stake?market=*" }, { pathPattern: "/api/actions/**", apiPath: "/api/actions/**" }] },
    { headers: ACTIONS_HEADERS },
  );
export const OPTIONS = GET;
