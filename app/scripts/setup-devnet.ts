// OWNER: P2. Fail explicitly instead of silently implying devnet was configured.
console.error(
  'Devnet setup is not implemented yet. The deployed program ID, IDL, and chain client are still required.',
);
process.exitCode = 1;
export {};
