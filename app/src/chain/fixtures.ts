// app/src/chain/fixtures.ts    OWNER: P4
import type { MarketView } from "@/shared/types";

// types.ts has no named Proposal type; derive it from MarketView.
type Proposal = NonNullable<MarketView["proposal"]>;

const now = () => Math.floor(Date.now() / 1000);

const base = (id: number, o: Partial<MarketView>): MarketView => ({
  id,
  pubkey: `MockMarket${id}`,
  creator: "MockCreator",
  promiser: "@GovExample",
  promiseText: "We will finish repaving Route 1 between College Park and Hyattsville by June 1, 2027.",
  criteria: "Kept if the state DOT page shows complete by the deadline. Broken if not. Source: DOT.",
  sourceUrl: "https://x.com/GovExample/status/1",
  sourceHash: "9f2c".padEnd(64, "a"),
  deadline: now() + 86400 * 2,
  totals: { kept: 710, broken: 290 },
  status: "open",
  proposal: null,
  challenger: null,
  votes: [null, null, null],
  final: null,
  forfeitedBonds: 0,
  ...o,
});

const proposal = (verdict: Proposal["verdict"]): Proposal => ({
  verdict,
  confidence: 0.86,
  summary: "As of the deadline the DOT page lists the project as 60% complete.",
  sources: ["https://dot.example.gov/route1"],
  proposedAt: now() - 10,
  windowEndsAt: now() + 20,
});

// One market per status so P3 can render every state.
export const FIXTURES: MarketView[] = [
  base(0, {}), // open
  base(1, { deadline: now() - 60, status: "proposed", proposal: proposal("broken") }),
  base(2, {
    deadline: now() - 60, status: "challenged", proposal: proposal("kept"),
    challenger: "MockChallenger", votes: ["broken", null, null],
  }),
  base(3, { deadline: now() - 60, status: "council", proposal: proposal("unclear") }),
  base(4, { // the CLAUDE.md worked example: 10 × 100 ÷ 25 = 40
    deadline: now() - 3600, status: "finalized", final: "broken",
    totals: { kept: 75, broken: 25 }, proposal: proposal("broken"),
  }),
  base(5, { deadline: now() - 3600, status: "void", final: "void", totals: { kept: 5, broken: 0 } }),
];
