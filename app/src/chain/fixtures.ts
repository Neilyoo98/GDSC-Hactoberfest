// OWNER: P4. Demo content updated with P3's examples refresh.
import type { MarketView } from '@/shared/types';
type Proposal = NonNullable<MarketView['proposal']>;
const now = () => Math.floor(Date.now() / 1000);
const day = 86_400;
const deadline = (days: number) => now() + days * day;
const dateLabel = (timestamp: number) =>
  new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
type Story = Pick<
  MarketView,
  'promiser' | 'promiseText' | 'criteria' | 'sourceUrl' | 'deadline'
>;
// Fictional examples, with reserved .example source domains and synthetic hashes.
const base = (
  id: number,
  story: Story,
  state: Partial<MarketView> = {},
): MarketView => ({
  id,
  pubkey: `MockMarket${id}`,
  creator: 'MockCreator',
  sourceHash: id.toString(16).padStart(64, '0'),
  totals: { kept: 75, broken: 25 },
  status: 'open',
  proposal: null,
  challenger: null,
  votes: [null, null, null],
  final: null,
  forfeitedBonds: 0,
  ...story,
  ...state,
});
const proposal = (
  verdict: Proposal['verdict'],
  summary: string,
  source: string,
  confidence = 0.86,
): Proposal => ({
  verdict,
  confidence,
  summary,
  sources: [source],
  proposedAt: now() - 10,
  windowEndsAt: now() + 20,
});
const busDate = deadline(45),
  mapsDate = deadline(-2),
  phoneDate = deadline(-4),
  mealsDate = deadline(-7),
  launchDate = deadline(-14),
  festivalDate = deadline(-21);
// Preserve IDs, lifecycle coverage, and the 10 × 100 ÷ 25 = 40 payout example.
export const FIXTURES: MarketView[] = [
  base(0, {
    promiser: 'Maryland Transit',
    promiseText: `Ten new electric buses will be carrying passengers by ${dateLabel(busDate)}.`,
    criteria:
      'Kept if ten new electric buses enter service by the deadline; Broken otherwise. Check the public fleet register.',
    sourceUrl: 'https://transit.example/electric-fleet',
    deadline: busDate,
  }),
  base(
    1,
    {
      promiser: 'OpenAtlas Foundation',
      promiseText: `Our free offline maps will cover every US national park by ${dateLabel(mapsDate)}.`,
      criteria:
        'Kept if all US national parks have downloadable offline maps by the deadline; Broken otherwise. Check the release catalog.',
      sourceUrl: 'https://openatlas.example/park-maps',
      deadline: mapsDate,
    },
    {
      status: 'proposed',
      totals: { kept: 120, broken: 380 },
      proposal: proposal(
        'broken',
        'Demo evidence: the release catalog still lists twelve national parks as coming soon.',
        'https://openatlas.example/releases',
      ),
    },
  ),
  base(
    2,
    {
      promiser: 'Loop Devices',
      promiseText: `Every Loop One owner can buy a replacement battery and repair it at home by ${dateLabel(phoneDate)}.`,
      criteria:
        'Kept if replacement batteries and a home repair guide are publicly available by the deadline; Broken otherwise. Check the parts store.',
      sourceUrl: 'https://loop.example/repair-promise',
      deadline: phoneDate,
    },
    {
      status: 'challenged',
      totals: { kept: 260, broken: 140 },
      proposal: proposal(
        'kept',
        'Demo evidence: batteries and instructions are listed, but a customer challenged whether parts were actually in stock.',
        'https://loop.example/parts',
      ),
      challenger: 'MockChallenger',
      votes: ['broken', null, null],
    },
  ),
  base(
    3,
    {
      promiser: 'Civic Kitchen',
      promiseText: `We will deliver 5,000 free meals from rescued food by ${dateLabel(mealsDate)}.`,
      criteria:
        'Kept if 5,000 rescued-food meals were delivered by the deadline; Broken otherwise. Check delivery logs and partner receipts.',
      sourceUrl: 'https://civickitchen.example/meal-pledge',
      deadline: mealsDate,
    },
    {
      status: 'council',
      totals: { kept: 190, broken: 110 },
      proposal: proposal(
        'unclear',
        'Demo evidence: the team reports 5,200 meals, while partner receipts account for 4,700. The council is reviewing the gap.',
        'https://civickitchen.example/impact',
        0.58,
      ),
    },
  ),
  base(
    4,
    {
      promiser: 'Aurora Launch',
      promiseText: `Our first student-built climate satellite will reach orbit by ${dateLabel(launchDate)}.`,
      criteria:
        'Kept if the student climate satellite reaches orbit by the deadline; Broken otherwise. Check the public launch manifest.',
      sourceUrl: 'https://auroralaunch.example/student-mission',
      deadline: launchDate,
    },
    {
      status: 'finalized',
      final: 'broken',
      totals: { kept: 75, broken: 25 },
      proposal: proposal(
        'broken',
        'Demo evidence: the launch was postponed. The mission manifest shows no flight before the deadline.',
        'https://auroralaunch.example/manifest',
      ),
    },
  ),
  base(
    5,
    {
      promiser: 'Riverlight Festival',
      promiseText: `Every stage at Riverlight will offer live captions by ${dateLabel(festivalDate)}.`,
      criteria:
        'Kept if every festival stage offers live captions by the deadline; Broken otherwise. If the entire event is cancelled, Void.',
      sourceUrl: 'https://riverlight.example/accessibility',
      deadline: festivalDate,
    },
    { status: 'void', final: 'void', totals: { kept: 5, broken: 0 } },
  ),
];
