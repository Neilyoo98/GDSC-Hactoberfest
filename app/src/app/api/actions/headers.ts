// app/src/app/api/actions/headers.ts    OWNER: P4
// Shared Solana Actions headers (CORS + X-Action-Version + X-Blockchain-Ids for devnet).
// Lives outside route.ts because Next.js only allows route handler exports there.
import { createActionHeaders } from "@solana/actions";

export const ACTIONS_HEADERS = createActionHeaders({ chainId: "devnet", actionVersion: "2.4" });

/** Absolute base URL for Blink links and icons: the cloudflared tunnel when set (PUBLIC_BASE_URL). */
export const baseUrl = (req: Request) => (process.env.PUBLIC_BASE_URL || new URL(req.url).origin).replace(/\/$/, "");
