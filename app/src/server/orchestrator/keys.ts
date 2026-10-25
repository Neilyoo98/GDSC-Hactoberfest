// OWNER: P1 (taken over from P2). Server-held keys and the devnet connection. Never import from the browser.
import 'server-only';
import { Connection, Keypair } from '@solana/web3.js';
import { ServiceError } from '../errors';

const cache = new Map<string, Keypair>();

function load(name: 'FEE_PAYER_SECRET' | 'RESOLVER_SECRET'): Keypair {
  const hit = cache.get(name);
  if (hit) return hit;
  const raw = process.env[name];
  if (!raw)
    throw new ServiceError(
      `${name} is not configured on the server. Run npm run keys and restart the app.`,
      'chain_not_configured',
      503,
    );
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  cache.set(name, kp);
  return kp;
}

/** Pays fees + rent for users; also the tUSDC mint authority and Config admin. */
export const feePayerKey = () => load('FEE_PAYER_SECRET');
/** The only key the program accepts for propose_outcome. */
export const resolverKey = () => load('RESOLVER_SECRET');

let conn: Connection | null = null;
export const serverConnection = () =>
  (conn ??= new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed'));
