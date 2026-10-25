// OWNER: P1 (Blockchain). Runs in Solana Playground (Test tab). `pg`, `anchor`, `web3`,
// `BN` and `assert` are Playground globals.
//
// These tests use their own Config (seeded by the Playground wallet as admin) and their
// own test mint, so they never touch the config the app uses.
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";

const T = 1_000_000; // 1 tUSDC in base units
const KEPT = 1, BROKEN = 2, VOID = 3;
const WINDOW = 5; // seconds; the demo uses 30 and production 24 h
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
const waitPastDeadline = async (market: web3.PublicKey) =>
  waitUntil((await program.account.market.fetch(market)).deadline.toNumber());
const waitPastWindow = async (market: web3.PublicKey) =>
  waitUntil((await program.account.market.fetch(market)).proposedAt.toNumber() + WINDOW);

const pda = (seeds: (Buffer | Uint8Array)[]) =>
  web3.PublicKey.findProgramAddressSync(seeds, program.programId)[0];
const u64 = (n: number | BN) => new BN(n).toArrayLike(Buffer, "le", 8);

const configPda = pda([Buffer.from("config"), admin.publicKey.toBuffer()]);
const marketPda = (id: BN) => pda([Buffer.from("market"), configPda.toBuffer(), u64(id)]);
const vaultPda = (market: web3.PublicKey) => pda([Buffer.from("vault"), market.toBuffer()]);
const positionPda = (market: web3.PublicKey, user: web3.PublicKey) =>
  pda([Buffer.from("position"), market.toBuffer(), user.toBuffer()]);

// Users only sign; the Playground wallet pays rent and fees (same as the server fee payer).
const [alice, bob, carol, council1, council2] = Array.from({ length: 5 }, () => web3.Keypair.generate());
const tokenOf: Record<string, web3.PublicKey> = {};
let mint: web3.PublicKey;

async function balance(user: web3.Keypair) {
  return Number((await getAccount(conn, tokenOf[user.publicKey.toBase58()])).amount);
}

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
    .accounts({
      creator: alice.publicKey,
      payer: admin.publicKey,
      config: configPda,
      market,
      vault: vaultPda(market),
      mint,
    })
    .signers([alice])
    .rpc();
  return market;
}

async function stake(market: web3.PublicKey, user: web3.Keypair, side: number, amount: number) {
  return program.methods
    .placeStake(side, new BN(amount))
    .accounts({
      user: user.publicKey,
      payer: admin.publicKey,
      config: configPda,
      market,
      position: positionPda(market, user.publicKey),
      userToken: tokenOf[user.publicKey.toBase58()],
      vault: vaultPda(market),
    })
    .signers([user])
    .rpc();
}

async function propose(market: web3.PublicKey, verdict: number, bps: number, signer = admin) {
  return program.methods
    .proposeOutcome(verdict, bps, "Per the DOT page the project was 60% complete.", ["https://dot.example.gov/route1"], Array.from(Buffer.alloc(32, 1)))
    .accounts({ resolver: signer.publicKey, config: configPda, market })
    .signers(signer === admin ? [] : [signer])
    .rpc();
}

async function claim(market: web3.PublicKey, user: web3.Keypair) {
  return program.methods
    .claim()
    .accounts({
      user: user.publicKey,
      config: configPda,
      market,
      position: positionPda(market, user.publicKey),
      userToken: tokenOf[user.publicKey.toBase58()],
      vault: vaultPda(market),
    })
    .signers([user])
    .rpc();
}

describe("kept", () => {
  before(async () => {
    const council = [admin.publicKey, council1.publicKey, council2.publicKey];
    if (await conn.getAccountInfo(configPda)) {
      // Re-run: the config (and its mint) already exist. The Playground wallet is
      // still the mint authority, so we can keep minting test tokens.
      mint = (await program.account.config.fetch(configPda)).mint;
      await program.methods
        .updateConfig(admin.publicKey, council, new BN(WINDOW))
        .accounts({ admin: admin.publicKey, config: configPda })
        .rpc();
    } else {
      mint = await createMint(conn, admin, admin.publicKey, null, 6);
      await program.methods
        .initializeConfig(admin.publicKey, council, new BN(WINDOW), new BN(BOND))
        .accounts({ admin: admin.publicKey, config: configPda, mint })
        .rpc();
    }
    for (const u of [alice, bob, carol]) {
      const ata = await getOrCreateAssociatedTokenAccount(conn, admin, mint, u.publicKey);
      tokenOf[u.publicKey.toBase58()] = ata.address;
      await mintTo(conn, admin, mint, ata.address, admin, 200 * T);
    }
  });

  it("worked example: 10 on Broken out of 100 (25 Broken) pays 40", async () => {
    const market = await createMarket(30);
    await stake(market, alice, BROKEN, 10 * T);
    await stake(market, bob, BROKEN, 15 * T);
    await stake(market, carol, KEPT, 75 * T);

    const m = await program.account.market.fetch(market);
    assert.equal(m.totalBroken.toNumber(), 25 * T);
    assert.equal(m.totalKept.toNumber(), 75 * T);

    await expectError(propose(market, BROKEN, 8600), "BeforeDeadline");
    await waitPastDeadline(market);
    await propose(market, BROKEN, 8600);
    await expectError(
      program.methods.finalize().accounts({ config: configPda, market }).rpc(),
      "WindowOpen",
    );
    await waitPastWindow(market);
    await program.methods.finalize().accounts({ config: configPda, market }).rpc();

    const [a0, b0, c0] = [await balance(alice), await balance(bob), await balance(carol)];
    await claim(market, alice);
    await claim(market, bob);
    await claim(market, carol);
    assert.equal((await balance(alice)) - a0, 40 * T);
    assert.equal((await balance(bob)) - b0, 60 * T);
    assert.equal((await balance(carol)) - c0, 0);

    await expectError(claim(market, alice), "AlreadyClaimed");
  });

  it("rejects bad stakes and a non-resolver proposal", async () => {
    const market = await createMarket(60);
    await expectError(stake(market, alice, KEPT, 101 * T), "StakeOutOfRange");
    await expectError(stake(market, alice, KEPT, 0), "StakeOutOfRange");
    await expectError(stake(market, alice, 4, 5 * T), "BadSide");
    await stake(market, alice, KEPT, 5 * T);
    await expectError(stake(market, alice, KEPT, 5 * T), null); // one stake per person: Position already exists
    await expectError(propose(market, KEPT, 9000, bob), "NotResolver");
  });

  it("low confidence goes to the council, which can void", async () => {
    const market = await createMarket(25);
    await stake(market, alice, KEPT, 20 * T);
    await stake(market, bob, BROKEN, 20 * T);
    await waitPastDeadline(market);
    await propose(market, KEPT, 6500); // below 0.70
    assert.deepEqual((await program.account.market.fetch(market)).status, { council: {} });

    await expectError(
      program.methods.councilVote(VOID).accounts({ member: bob.publicKey, config: configPda, market }).signers([bob]).rpc(),
      "NotCouncil",
    );
    await program.methods.councilVote(VOID).accounts({ member: admin.publicKey, config: configPda, market }).rpc();
    await expectError(
      program.methods.councilVote(VOID).accounts({ member: admin.publicKey, config: configPda, market }).rpc(),
      "AlreadyVoted",
    );
    await program.methods.councilVote(VOID).accounts({ member: council1.publicKey, config: configPda, market }).signers([council1]).rpc();
    assert.deepEqual((await program.account.market.fetch(market)).status, { void: {} });

    const a0 = await balance(alice);
    await claim(market, alice);
    assert.equal((await balance(alice)) - a0, 20 * T); // refund
  });

  it("challenge: council overturns, challenger wins and gets the bond back", async () => {
    const market = await createMarket(25);
    await stake(market, alice, KEPT, 20 * T);
    await stake(market, bob, BROKEN, 20 * T);
    await waitPastDeadline(market);
    await propose(market, KEPT, 9000);

    await expectError(
      program.methods
        .challenge()
        .accounts({ user: carol.publicKey, config: configPda, market, position: positionPda(market, carol.publicKey), userToken: tokenOf[carol.publicKey.toBase58()], vault: vaultPda(market) })
        .signers([carol])
        .rpc(),
      "AccountNotInitialized", // carol never staked
    );

    const b0 = await balance(bob);
    await program.methods
      .challenge()
      .accounts({ user: bob.publicKey, config: configPda, market, position: positionPda(market, bob.publicKey), userToken: tokenOf[bob.publicKey.toBase58()], vault: vaultPda(market) })
      .signers([bob])
      .rpc();
    assert.equal(b0 - (await balance(bob)), BOND);

    await program.methods.councilVote(BROKEN).accounts({ member: council1.publicKey, config: configPda, market }).signers([council1]).rpc();
    await program.methods.councilVote(BROKEN).accounts({ member: council2.publicKey, config: configPda, market }).signers([council2]).rpc();
    const m = await program.account.market.fetch(market);
    assert.equal(m.finalOutcome, BROKEN);
    assert.equal(m.bondRefundDue, true);

    const b1 = await balance(bob);
    await claim(market, bob);
    assert.equal((await balance(bob)) - b1, 40 * T + BOND); // 20 × 40 ÷ 20, plus the bond
  });

  it("challenge after the window is rejected", async () => {
    const market = await createMarket(25);
    await stake(market, bob, BROKEN, 5 * T);
    await waitPastDeadline(market);
    await propose(market, KEPT, 9000);
    await waitPastWindow(market);
    await expectError(
      program.methods
        .challenge()
        .accounts({ user: bob.publicKey, config: configPda, market, position: positionPda(market, bob.publicKey), userToken: tokenOf[bob.publicKey.toBase58()], vault: vaultPda(market) })
        .signers([bob])
        .rpc(),
      "WindowClosed",
    );
  });
});
