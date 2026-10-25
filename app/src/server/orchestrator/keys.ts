import 'server-only';

import { Keypair } from '@solana/web3.js';
import { ServiceError } from '../errors';

export function keypairFromEnv(name: 'FEE_PAYER_SECRET' | 'RESOLVER_SECRET') {
  const value = process.env[name];
  if (!value) {
    throw new ServiceError(
      `Server configuration is missing ${name}.`,
      'server_configuration',
      503,
    );
  }
  try {
    const bytes: unknown = JSON.parse(value);
    if (
      !Array.isArray(bytes) ||
      bytes.length !== 64 ||
      bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
    ) throw new Error('Invalid secret key format');
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  } catch {
    throw new ServiceError(
      `Server configuration ${name} is invalid.`,
      'server_configuration',
      503,
    );
  }
}
