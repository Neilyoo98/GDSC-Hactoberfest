// OWNER: P2. Do not report success until real readiness checks exist.
console.error(
  'Doctor is not implemented yet. Run npm run check and npm run test:e2e for the available app checks; these do not verify devnet readiness.',
);
process.exitCode = 1;
export {};
