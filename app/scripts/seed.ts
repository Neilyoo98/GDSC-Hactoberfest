// OWNER: P2. Fail explicitly instead of silently implying markets were seeded.
console.error(
  'Market seeding is not implemented yet. No markets were created.',
);
process.exitCode = 1;
export {};
