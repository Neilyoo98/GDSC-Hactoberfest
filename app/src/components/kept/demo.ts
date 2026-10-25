// OWNER: P3. UI-only fixtures; replace with P4 hooks at integration.
export const markets = [
  {
    id: 1,
    promiser: 'Maryland Transit',
    handle: 'maryland-transit',
    quote: 'We will introduce ten new electric buses by December 31, 2026.',
    deadline: '2026-12-31',
    kept: 75,
    broken: 25,
    status: 'Open',
    category: 'Transport',
  },
  {
    id: 2,
    promiser: 'College Park Council',
    handle: 'college-park-council',
    quote:
      'We will complete the protected cycle lane on College Avenue by September 30, 2026.',
    deadline: '2026-09-30',
    kept: 25,
    broken: 75,
    status: 'Proposed',
    category: 'Local government',
  },
  {
    id: 3,
    promiser: 'Campus Sustainability',
    handle: 'campus-sustainability',
    quote:
      'We will install solar panels on the library roof by August 31, 2026.',
    deadline: '2026-08-31',
    kept: 60,
    broken: 40,
    status: 'Finalized',
    category: 'Climate',
  },
  {
    id: 4,
    promiser: 'College Park Council',
    handle: 'college-park-council',
    quote: 'We will open the new community garden by October 1, 2026.',
    deadline: '2026-10-01',
    kept: 45,
    broken: 55,
    status: 'Council',
    category: 'Community',
  },
];
export type DemoMarket = (typeof markets)[number];
