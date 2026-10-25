// OWNER: P1 (Blockchain). Runs in Solana Playground (Test tab) or any harness that
// provides the same globals: `pg`, `anchor`, `web3`, `BN`, `assert`, describe/it/before.
//
// These tests use their own Config (seeded by the test wallet as admin) and their
// own test mint, so they never touch the config the app uses.
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";

const T = 1_000_000; // 1 tUSDC in base units
const KEPT = 1, BROKEN = 2, VOID = 3;
const WINDOW = 5; // challenge window, seconds (demo uses 30, production 24 h)
const VOTE_WINDOW = 10; // public vote window, seconds
const BOND = 10 * T;

const program = pg.program;
const conn = pg.connection;
const admin = pg.wallet.keypair;

const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const now = async () => (await conn.getBlockTime(await conn.getSlot())) ?? Math.floor(Date.now() / 1000);

// Wait on the chain clock, not wall time: busy RPCs (429 retries) make fixed sleeps flaky.
async function waitUntil(ts: number) {
  while ((await now()) <= ts) await sleep(2);
}
const fetchMarket = (market: web3.PublicKey) => program.account.market.fetch(market);
const waitPastDeadline = async (market: web3.PublicKey) => waitUntil((await fetchMarket(market)).deadline.toNumber());
const waitPastWindow = async (market: web3.PublicKey) =>
  waitUntil((await fetchMarket(market)).proposedAt.toNumber() + WINDOW);
const waitPastVote = async (market: web3.PublicKey) => waitUntil((await fetchMarket(market)).voteEndsAt.toNumber());

const pda = (seeds: (Buffer | Uint8Array)[]) =>
  web3.PublicKey.findProgramAddressSync(seeds, program.programId)[0];
const u64 = (n: number | BN) => new BN(n).toArrayLike(Buffer, "le", 8);

const configPda = pda([Buffer.from("config"), admin.publicKey.toBuffer()]);
const marketPda = (id: BN) => pda([Buffer.from("market"), configPda.toBuffer(), u64(id)]);
const vaultPda = (market: web3.PublicKey) => pda([Buffer.from("vault"), market.toBuffer()]);
const positionPda = (market: web3.PublicKey, user: web3.PublicKey) =>
  pda([Buffer.from("position"), market.toBuffer(), user.toBuffer()]);
const votePda = (market: web3.PublicKey, voter: web3.PublicKey) =>
  pda([Buffer.from("vote"), market.toBuffer(), voter.toBuffer()]);

// Users only sign; the test wallet pays rent and fees (same as the server fee payer).
// dave never stakes: he shows that anyone can vote.
const [alice, bob, carol, dave] = Array.from({ length: 4 }, () => web3.Keypair.generate());
const tokenOf: Record<string, web3.PublicKey> = {};
let mint: web3.PublicKey;

const tok = (u: web3.Keypair) => tokenOf[u.publicKey.toBase58()];
const balance = async (u: web3.Keypair) => Number((await getAccount(conn, tok(u))).amount);

// code = null accepts any failure (e.g. a system-program error with no Anchor code).
async function expectError(p: Promise<unknown>, code: string | null) {
  try {
    await p;
  } catch (e: any) {
    const got = e?.error?.errorCode?.code ?? String(e);
    if (code) assert(got.includes(code), `expected ${code}, got ${got}`);
    return;
  }
  assert.fail(`expected ${code}, but it succeeded`);
}

async function createMarket(deadlineIn: number) {
  const id = (await program.account.config.fetch(configPda)).marketCount as BN;
  const market = marketPda(id);
  await program.methods
    .createMarket(
      "@ExampleGov",
      "We will finish repaving Route 1 by June 1.",
      "Kept if the state DOT page shows complete by the deadline.",
      "https://x.com/ExampleGov/status/1",
      Array.from(Buffer.alloc(32, 7)),
      new BN((await now()) + deadlineIn),
    )
    .accounts({ creator: alice.publicKey, payer: admin.publicKey, config: configPda, market, vault: vaultPda(market), mint })
    .signers([alice])
    .rpc();
  return market;
}

const stake = (market: web3.PublicKey, user: web3.Keypair, side: number, amount: number) =>
  program.methods
    .placeStake(side, new BN(amount))
    .accounts({
      user: user.publicKey, payer: admin.publicKey, config: configPda, market,
      position: positionPda(market, user.publicKey), userToken: tok(user), vault: vaultPda(market),
    })
    .signers([user])
    .rpc();

const propose = (market: web3.PublicKey, verdict: number, bps: number, signer = admin) =>
  program.methods
    .proposeOutcome(verdict, bps, "Per the DOT page the project was 60% complete.", ["https://dot.example.gov/route1"], Array.from(Buffer.alloc(32, 1)))
    .accounts({ resolver: signer.publicKey, config: configPda, market })
    .signers(signer === admin ? [] : [signer])
    .rpc();

const challenge = (market: web3.PublicKey, user: web3.Keypair) =>
  program.methods
    .challenge()
    .accounts({
      user: user.publicKey, config: configPda, market,
      position: positionPda(market, user.publicKey), userToken: tok(user), vault: vaultPda(market),
    })
    .signers([user])
    .rpc();

const castVote = (market: web3.PublicKey, voter: web3.Keypair, choice: number, amount: number) =>
  program.methods
    .castVote(choice, new BN(amount))
    .accounts({
      voter: voter.publicKey, payer: admin.publicKey, config: configPda, market,
      vote: votePda(market, voter.publicKey), voterToken: tok(voter), vault: vaultPda(market),
    })
    .signers([voter])
    .rpc();

const finalize = (market: web3.PublicKey) =>
  program.methods.finalize().accounts({ config: configPda, market }).rpc();

const claim = (market: web3.PublicKey, user: web3.Keypair) =>
  program.methods
    .claim()
    .accounts({
      user: user.publicKey, config: configPda, market,
      position: positionPda(market, user.publicKey), userToken: tok(user), vault: vaultPda(market),
    })
    .signers([user])
    .rpc();

const claimVote = (market: web3.PublicKey, voter: web3.Keypair) =>
  program.methods
    .claimVote()
    .accounts({
      voter: voter.publicKey, config: configPda, market,
      vote: votePda(market, voter.publicKey), voterToken: tok(voter), vault: vaultPda(market),
    })
    .signers([voter])
    .rpc();

// Balance change of `user` caused by `fn`.
async function gain(user: web3.Keypair, fn: () => Promise<unknown>) {
  const before = await balance(user);
  await fn();
  return (await balance(user)) - before;
}

describe("kept", () => {
  before(async () => {
    if (await conn.getAccountInfo(configPda)) {
      // Re-run: the config (and its mint) already exist. The test wallet is still
      // the mint authority, so we can keep minting test tokens.
      mint = (await program.account.config.fetch(configPda)).mint;
      await program.methods
        .updateConfig(admin.publicKey, new BN(WINDOW), new BN(VOTE_WINDOW))
        .accounts({ admin: admin.publicKey, config: configPda })
        .rpc();
    } else {
      mint = await createMint(conn, admin, admin.publicKey, null, 6);
      await program.methods
        .initializeConfig(admin.publicKey, new BN(WINDOW), new BN(VOTE_WINDOW), new BN(BOND))
        .accounts({ admin: admin.publicKey, config: configPda, mint })
        .rpc();
    }
    for (const u of [alice, bob, carol, dave]) {
      const ata = await getOrCreateAssociatedTokenAccount(conn, admin, mint, u.publicKey);
      tokenOf[u.publicKey.toBase58()] = ata.address;
      await mintTo(conn, admin, mint, ata.address, admin, 300 * T);
    }
  });

  it("worked example: 10 on Broken out of 100 (25 Broken) pays 40", async () => {
    const market = await createMarket(30);
    await stake(market, alice, BROKEN, 10 * T);
    await stake(market, bob, BROKEN, 15 * T);
    await stake(market, carol, KEPT, 75 * T);

    const m = await fetchMarket(market);
    assert.equal(m.totalBroken.toNumber(), 25 * T);
    assert.equal(m.totalKept.toNumber(), 75 * T);

    await expectError(propose(market, BROKEN, 8600), "BeforeDeadline");
    await waitPastDeadline(market);
    await propose(market, BROKEN, 8600);
    await expectError(finalize(market), "WindowOpen");
    await waitPastWindow(market);
    await finalize(market);

    assert.equal(await gain(alice, () => claim(market, alice)), 40 * T);
    assert.equal(await gain(bob, () => claim(market, bob)), 60 * T);
    assert.equal(await gain(carol, () => claim(market, carol)), 0);
    await expectError(claim(market, alice), "AlreadyClaimed");
  });

  it("rejects bad stakes, bad votes and a non-resolver proposal", async () => {
    const market = await createMarket(60);
    await expectError(stake(market, alice, KEPT, 101 * T), "StakeOutOfRange");
    await expectError(stake(market, alice, KEPT, 0), "StakeOutOfRange");
    await expectError(stake(market, alice, 4, 5 * T), "BadSide");
    await stake(market, alice, KEPT, 5 * T);
    await expectError(stake(market, alice, KEPT, 5 * T), null); // one stake per person: Position already exists
    await expectError(castVote(market, dave, KEPT, 5 * T), "NotVoting"); // no vote before a challenge/unsure AI
    await expectError(propose(market, KEPT, 9000, bob), "NotResolver");
  });

  it("unsure AI → public vote: anyone votes, most tUSDC wins, losing voters pay winners", async () => {
    const market = await createMarket(25);
    await stake(market, alice, KEPT, 20 * T);
    await stake(market, bob, BROKEN, 20 * T);
    await waitPastDeadline(market);
    await propose(market, KEPT, 6500); // below 0.70 → no proposal, straight to a vote
    assert.deepEqual((await fetchMarket(market)).status, { voting: {} });

    await expectError(castVote(market, dave, BROKEN, 101 * T), "StakeOutOfRange");
    await castVote(market, dave, BROKEN, 20 * T); // dave never staked
    await castVote(market, carol, BROKEN, 5 * T);
    await castVote(market, alice, KEPT, 10 * T);
    await expectError(castVote(market, dave, BROKEN, 5 * T), null); // one vote per wallet
    await expectError(finalize(market), "VoteOpen");

    await waitPastVote(market);
    await expectError(castVote(market, bob, BROKEN, 5 * T), "VoteClosed");
    await finalize(market);
    const m = await fetchMarket(market);
    assert.deepEqual(m.status, { finalized: {} });
    assert.equal(m.finalOutcome, BROKEN); // 25 Broken vs 10 Kept

    // Vote pool 35: Broken voters split it by lock size.
    assert.equal(await gain(dave, () => claimVote(market, dave)), 28 * T); // 20 × 35 ÷ 25
    assert.equal(await gain(carol, () => claimVote(market, carol)), 7 * T); // 5 × 35 ÷ 25
    assert.equal(await gain(alice, () => claimVote(market, alice)), 0);
    // Stakers are paid on the vote's outcome.
    assert.equal(await gain(bob, () => claim(market, bob)), 40 * T);
    await expectError(claimVote(market, dave), "AlreadyClaimed");
  });

  it("challenge → vote overturns the AI → challenger gets the bond back", async () => {
    const market = await createMarket(25);
    await stake(market, alice, KEPT, 20 * T);
    await stake(market, bob, BROKEN, 20 * T);
    await waitPastDeadline(market);
    await propose(market, KEPT, 9000);

    await expectError(challenge(market, dave), "AccountNotInitialized"); // only stakers can challenge
    assert.equal(await gain(bob, () => challenge(market, bob)), -BOND);
    assert.deepEqual((await fetchMarket(market)).status, { voting: {} });

    await castVote(market, dave, BROKEN, 15 * T);
    await castVote(market, alice, KEPT, 10 * T);
    await waitPastVote(market);
    await finalize(market);
    const m = await fetchMarket(market);
    assert.equal(m.finalOutcome, BROKEN);
    assert.equal(m.bondRefundDue, true);

    assert.equal(await gain(bob, () => claim(market, bob)), 40 * T + BOND); // 20 × 40 ÷ 20, plus the bond
    assert.equal(await gain(dave, () => claimVote(market, dave)), 25 * T); // 15 × 25 ÷ 15
  });

  it("tie vote → Void: stakers and voters are refunded", async () => {
    const market = await createMarket(25);
    await stake(market, alice, KEPT, 30 * T);
    await stake(market, bob, BROKEN, 10 * T);
    await waitPastDeadline(market);
    await propose(market, VOID, 9000); // the AI says "unclear"
    await castVote(market, carol, KEPT, 10 * T);
    await castVote(market, dave, BROKEN, 10 * T);
    await waitPastVote(market);
    await finalize(market);
    const m = await fetchMarket(market);
    assert.deepEqual(m.status, { void: {} });
    assert.equal(m.voteRefund, true);

    assert.equal(await gain(alice, () => claim(market, alice)), 30 * T);
    assert.equal(await gain(carol, () => claimVote(market, carol)), 10 * T);
    assert.equal(await gain(dave, () => claimVote(market, dave)), 10 * T);
  });

  it("challenge after the window is rejected", async () => {
    const market = await createMarket(25);
    await stake(market, bob, BROKEN, 5 * T);
    await waitPastDeadline(market);
    await propose(market, KEPT, 9000);
    await waitPastWindow(market);
    await expectError(challenge(market, bob), "WindowClosed");
  });
});
