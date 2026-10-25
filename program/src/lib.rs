// OWNER: P1 (Blockchain). Ask before editing.
// Kept: public promise markets on Solana devnet.
// Built with program/build.sh and deployed to devnet; see program/README.md.
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

// Program keypair: ~/.config/kept/kept-keypair.json in WSL (see program/build.sh).
declare_id!("GYupVpsMEY12UGgS1gUdabq4UvmbR6PvbmUewQbw7gap");

pub const MIN_STAKE: u64 = 1_000_000; // 1 tUSDC (6 decimals); also the minimum vote lock
pub const MAX_STAKE: u64 = 100_000_000; // 100 tUSDC; also the maximum vote lock
pub const GATE_BPS: u16 = 7_000; // AI proposes only at confidence >= 0.70

// Sides, verdicts and outcomes share one encoding.
pub const NONE: u8 = 0;
pub const KEPT: u8 = 1;
pub const BROKEN: u8 = 2;
pub const VOID: u8 = 3; // "unclear" when it comes from the AI, "void" as a final outcome

pub const MAX_PROMISER: usize = 40;
pub const MAX_PROMISE_TEXT: usize = 240;
pub const MAX_CRITERIA: usize = 160;
pub const MAX_SOURCE_URL: usize = 120;
pub const MAX_SUMMARY: usize = 280;
pub const MAX_SOURCES: usize = 3;
pub const MAX_SOURCE_LEN: usize = 120;

#[program]
pub mod kept {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        resolver: Pubkey,
        challenge_window: i64,
        vote_window: i64,
        bond: u64,
    ) -> Result<()> {
        require!(challenge_window > 0 && vote_window > 0, KeptError::BadWindow);
        let c = &mut ctx.accounts.config;
        c.admin = ctx.accounts.admin.key();
        c.resolver = resolver;
        c.mint = ctx.accounts.mint.key();
        c.challenge_window = challenge_window;
        c.vote_window = vote_window;
        c.bond = bond;
        c.market_count = 0;
        c.bump = ctx.bumps.config;
        Ok(())
    }

    /// Switch the demo windows (30 s) and production windows (24 h), or rotate the resolver.
    /// There is deliberately no instruction that moves funds for the admin.
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        resolver: Pubkey,
        challenge_window: i64,
        vote_window: i64,
    ) -> Result<()> {
        require!(challenge_window > 0 && vote_window > 0, KeptError::BadWindow);
        let c = &mut ctx.accounts.config;
        c.resolver = resolver;
        c.challenge_window = challenge_window;
        c.vote_window = vote_window;
        Ok(())
    }

    pub fn create_market(
        ctx: Context<CreateMarket>,
        promiser: String,
        promise_text: String,
        criteria: String,
        source_url: String,
        source_hash: [u8; 32],
        deadline: i64,
    ) -> Result<()> {
        require!(deadline > Clock::get()?.unix_timestamp, KeptError::DeadlineInPast);
        require!(!promiser.is_empty() && promiser.len() <= MAX_PROMISER, KeptError::TextTooLong);
        require!(!promise_text.is_empty() && promise_text.len() <= MAX_PROMISE_TEXT, KeptError::TextTooLong);
        require!(criteria.len() <= MAX_CRITERIA, KeptError::TextTooLong);
        require!(!source_url.is_empty() && source_url.len() <= MAX_SOURCE_URL, KeptError::TextTooLong);

        let config = &mut ctx.accounts.config;
        let m = &mut ctx.accounts.market;
        m.config = config.key();
        m.id = config.market_count;
        m.creator = ctx.accounts.creator.key();
        m.promiser = promiser;
        m.promise_text = promise_text;
        m.criteria = criteria;
        m.source_url = source_url;
        m.source_hash = source_hash;
        m.deadline = deadline;
        m.status = Status::Open;
        m.challenger = Pubkey::default();
        m.bump = ctx.bumps.market;
        m.vault_bump = ctx.bumps.vault;

        config.market_count = config.market_count.checked_add(1).ok_or(KeptError::Overflow)?;
        Ok(())
    }

    /// One stake per person per market (the Position account is `init`).
    pub fn place_stake(ctx: Context<PlaceStake>, side: u8, amount: u64) -> Result<()> {
        let m = &mut ctx.accounts.market;
        require!(m.status == Status::Open, KeptError::NotOpen);
        require!(Clock::get()?.unix_timestamp < m.deadline, KeptError::PastDeadline);
        require!((MIN_STAKE..=MAX_STAKE).contains(&amount), KeptError::StakeOutOfRange);
        require!(side == KEPT || side == BROKEN, KeptError::BadSide);

        transfer_in(
            &ctx.accounts.token_program,
            &ctx.accounts.user_token,
            &ctx.accounts.vault,
            &ctx.accounts.user,
            amount,
        )?;

        if side == KEPT {
            m.total_kept = m.total_kept.checked_add(amount).ok_or(KeptError::Overflow)?;
        } else {
            m.total_broken = m.total_broken.checked_add(amount).ok_or(KeptError::Overflow)?;
        }

        let p = &mut ctx.accounts.position;
        p.market = m.key();
        p.owner = ctx.accounts.user.key();
        p.side = side;
        p.amount = amount;
        p.claimed = false;
        p.bump = ctx.bumps.position;
        Ok(())
    }

    /// Called by the AI resolver key after the deadline.
    /// Kept/Broken at >= 0.70 starts the challenge window; anything else opens a public vote.
    pub fn propose_outcome(
        ctx: Context<ProposeOutcome>,
        verdict: u8,
        confidence_bps: u16,
        summary: String,
        sources: Vec<String>,
        evidence_hash: [u8; 32],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let vote_window = ctx.accounts.config.vote_window;
        let m = &mut ctx.accounts.market;
        require!(m.status == Status::Open, KeptError::NotOpen);
        require!(now >= m.deadline, KeptError::BeforeDeadline);
        require!(verdict == KEPT || verdict == BROKEN || verdict == VOID, KeptError::BadSide);
        require!(confidence_bps <= 10_000, KeptError::BadConfidence);
        require!(summary.len() <= MAX_SUMMARY, KeptError::TextTooLong);
        require!(sources.len() <= MAX_SOURCES, KeptError::TextTooLong);
        require!(sources.iter().all(|s| s.len() <= MAX_SOURCE_LEN), KeptError::TextTooLong);

        m.proposed = verdict;
        m.confidence_bps = confidence_bps;
        m.summary = summary;
        m.sources = sources;
        m.evidence_hash = evidence_hash;
        m.proposed_at = now;
        if verdict != VOID && confidence_bps >= GATE_BPS {
            m.status = Status::Proposed;
        } else {
            m.status = Status::Voting;
            m.vote_ends_at = now.checked_add(vote_window).ok_or(KeptError::Overflow)?;
        }
        Ok(())
    }

    /// Anyone with a stake can put up the bond while the window is open.
    /// A challenge opens a public vote.
    pub fn challenge(ctx: Context<Challenge>) -> Result<()> {
        let window = ctx.accounts.config.challenge_window;
        let vote_window = ctx.accounts.config.vote_window;
        let bond = ctx.accounts.config.bond;
        let now = Clock::get()?.unix_timestamp;
        let m = &mut ctx.accounts.market;
        require!(m.status == Status::Proposed, KeptError::NotProposed);
        require!(now < m.proposed_at.checked_add(window).ok_or(KeptError::Overflow)?, KeptError::WindowClosed);

        transfer_in(
            &ctx.accounts.token_program,
            &ctx.accounts.user_token,
            &ctx.accounts.vault,
            &ctx.accounts.user,
            bond,
        )?;

        m.challenger = ctx.accounts.user.key();
        m.challenge_bond = bond;
        m.status = Status::Voting;
        m.vote_ends_at = now.checked_add(vote_window).ok_or(KeptError::Overflow)?;
        Ok(())
    }

    /// Anyone can vote once per market by locking 1-100 tUSDC on Kept, Broken or Void.
    /// The outcome with the most locked tUSDC wins; its voters split the whole vote pool.
    pub fn cast_vote(ctx: Context<CastVote>, choice: u8, amount: u64) -> Result<()> {
        require!(choice == KEPT || choice == BROKEN || choice == VOID, KeptError::BadSide);
        require!((MIN_STAKE..=MAX_STAKE).contains(&amount), KeptError::StakeOutOfRange);
        let m = &mut ctx.accounts.market;
        require!(m.status == Status::Voting, KeptError::NotVoting);
        require!(Clock::get()?.unix_timestamp < m.vote_ends_at, KeptError::VoteClosed);

        transfer_in(
            &ctx.accounts.token_program,
            &ctx.accounts.voter_token,
            &ctx.accounts.vault,
            &ctx.accounts.voter,
            amount,
        )?;

        let tally = match choice {
            KEPT => &mut m.vote_kept,
            BROKEN => &mut m.vote_broken,
            _ => &mut m.vote_void,
        };
        *tally = tally.checked_add(amount).ok_or(KeptError::Overflow)?;

        let v = &mut ctx.accounts.vote;
        v.market = m.key();
        v.voter = ctx.accounts.voter.key();
        v.choice = choice;
        v.amount = amount;
        v.claimed = false;
        v.bump = ctx.bumps.vote;
        Ok(())
    }

    /// Anyone can finalize:
    /// - an unchallenged proposal once the challenge window has passed, or
    /// - a vote once the vote window has passed (most locked tUSDC wins; tie or no votes → Void).
    pub fn finalize(ctx: Context<Finalize>) -> Result<()> {
        let window = ctx.accounts.config.challenge_window;
        let now = Clock::get()?.unix_timestamp;
        let m = &mut ctx.accounts.market;
        match m.status {
            Status::Proposed => {
                require!(now >= m.proposed_at.checked_add(window).ok_or(KeptError::Overflow)?, KeptError::WindowOpen);
                m.final_outcome = m.proposed;
                m.status = Status::Finalized;
            }
            Status::Voting => {
                require!(now >= m.vote_ends_at, KeptError::VoteOpen);
                let result = vote_result(m);
                if result == NONE {
                    m.vote_refund = true; // tie or no votes: every voter gets their lock back
                }
                let outcome = if result == NONE { VOID } else { result };
                if m.challenger != Pubkey::default() {
                    if outcome != m.proposed {
                        m.bond_refund_due = true;
                    } else {
                        m.forfeited_bonds = m.forfeited_bonds.checked_add(m.challenge_bond).ok_or(KeptError::Overflow)?;
                    }
                }
                m.final_outcome = outcome;
                m.status = if outcome == VOID { Status::Void } else { Status::Finalized };
            }
            _ => return err!(KeptError::NotFinalizable),
        }
        Ok(())
    }

    /// Stakers: winners get their share of the pool; Void refunds stakes;
    /// the challenger also gets the bond back if the vote overturned the AI.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let m = &ctx.accounts.market;
        require!(m.status == Status::Finalized || m.status == Status::Void, KeptError::NotFinal);
        let p = &mut ctx.accounts.position;
        require!(!p.claimed, KeptError::AlreadyClaimed);

        let mut amount = payout(m, p)?;
        if m.bond_refund_due && m.challenger == p.owner {
            amount = amount.checked_add(m.challenge_bond).ok_or(KeptError::Overflow)?;
        }
        p.claimed = true;
        transfer_out(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.user_token, &ctx.accounts.market, amount)
    }

    /// Voters: the winning outcome's voters split the whole vote pool; losers get 0;
    /// a tie or empty vote refunds every voter.
    pub fn claim_vote(ctx: Context<ClaimVote>) -> Result<()> {
        let m = &ctx.accounts.market;
        require!(m.status == Status::Finalized || m.status == Status::Void, KeptError::NotFinal);
        let v = &mut ctx.accounts.vote;
        require!(!v.claimed, KeptError::AlreadyClaimed);
        let amount = vote_payout(m, v)?;
        v.claimed = true;
        transfer_out(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.voter_token, &ctx.accounts.market, amount)
    }
}

fn transfer_in<'info>(
    token_program: &Program<'info, Token>,
    from: &Account<'info, TokenAccount>,
    vault: &Account<'info, TokenAccount>,
    authority: &Signer<'info>,
    amount: u64,
) -> Result<()> {
    token::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer { from: from.to_account_info(), to: vault.to_account_info(), authority: authority.to_account_info() },
        ),
        amount,
    )
}

fn transfer_out<'info>(
    token_program: &Program<'info, Token>,
    vault: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    market: &Account<'info, Market>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let id_bytes = market.id.to_le_bytes();
    let seeds: &[&[u8]] = &[b"market", market.config.as_ref(), id_bytes.as_ref(), &[market.bump]];
    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer { from: vault.to_account_info(), to: to.to_account_info(), authority: market.to_account_info() },
            &[seeds],
        ),
        amount,
    )
}

/// The outcome with the most locked tUSDC, or NONE on a tie or when nobody voted.
pub fn vote_result(m: &Market) -> u8 {
    let tallies = [(KEPT, m.vote_kept), (BROKEN, m.vote_broken), (VOID, m.vote_void)];
    let max = tallies.iter().map(|t| t.1).max().unwrap_or(0);
    let leaders: Vec<u8> = tallies.iter().filter(|t| t.1 == max).map(|t| t.0).collect();
    if max == 0 || leaders.len() > 1 {
        NONE
    } else {
        leaders[0]
    }
}

/// stake × (total staked + forfeited bonds) ÷ winning side, rounded down.
/// Void, or nobody on the winning side, refunds the stake.
pub fn payout(m: &Market, p: &Position) -> Result<u64> {
    let winners = match m.final_outcome {
        KEPT => m.total_kept,
        BROKEN => m.total_broken,
        _ => 0,
    };
    if m.status == Status::Void || winners == 0 {
        return Ok(p.amount);
    }
    if p.side != m.final_outcome {
        return Ok(0);
    }
    let pool = (m.total_kept as u128)
        .checked_add(m.total_broken as u128)
        .and_then(|v| v.checked_add(m.forfeited_bonds as u128))
        .ok_or(KeptError::Overflow)?;
    share(p.amount, pool, winners)
}

/// lock × (all votes) ÷ votes on the final outcome, rounded down.
/// A tie or empty vote refunds the lock.
pub fn vote_payout(m: &Market, v: &Vote) -> Result<u64> {
    if m.vote_refund {
        return Ok(v.amount);
    }
    if v.choice != m.final_outcome {
        return Ok(0);
    }
    let winners = match m.final_outcome {
        KEPT => m.vote_kept,
        BROKEN => m.vote_broken,
        _ => m.vote_void,
    };
    let pool = (m.vote_kept as u128)
        .checked_add(m.vote_broken as u128)
        .and_then(|x| x.checked_add(m.vote_void as u128))
        .ok_or(KeptError::Overflow)?;
    share(v.amount, pool, winners)
}

fn share(amount: u64, pool: u128, winners: u64) -> Result<u64> {
    let out = (amount as u128).checked_mul(pool).ok_or(KeptError::Overflow)? / winners as u128;
    u64::try_from(out).map_err(|_| error!(KeptError::Overflow))
}

// ---------------------------------------------------------------- accounts

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Status {
    Open,
    Proposed,
    Voting, // challenged, or the AI was unsure: public tUSDC-weighted vote
    Finalized,
    Void,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub resolver: Pubkey,
    pub mint: Pubkey,
    pub challenge_window: i64, // seconds
    pub vote_window: i64,      // seconds
    pub bond: u64,             // base units
    pub market_count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub config: Pubkey,
    pub id: u64,
    pub creator: Pubkey,
    #[max_len(40)]
    pub promiser: String,
    #[max_len(240)]
    pub promise_text: String,
    #[max_len(160)]
    pub criteria: String,
    #[max_len(120)]
    pub source_url: String,
    pub source_hash: [u8; 32],
    pub deadline: i64,
    pub total_kept: u64,
    pub total_broken: u64,
    pub status: Status,
    pub proposed: u8,
    pub confidence_bps: u16,
    #[max_len(280)]
    pub summary: String,
    #[max_len(3, 120)]
    pub sources: Vec<String>,
    pub evidence_hash: [u8; 32],
    pub proposed_at: i64,
    pub challenger: Pubkey, // Pubkey::default() = none
    pub challenge_bond: u64,
    pub vote_ends_at: i64,
    pub vote_kept: u64,
    pub vote_broken: u64,
    pub vote_void: u64,
    pub vote_refund: bool,
    pub final_outcome: u8,
    pub forfeited_bonds: u64,
    pub bond_refund_due: bool,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub side: u8,
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Vote {
    pub market: Pubkey,
    pub voter: Pubkey,
    pub choice: u8,
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

// ---------------------------------------------------------------- contexts

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE,
              seeds = [b"config", admin.key().as_ref()], bump)]
    pub config: Account<'info, Config>,
    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,
    #[account(mut, has_one = admin, seeds = [b"config", admin.key().as_ref()], bump = config.bump)]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
pub struct CreateMarket<'info> {
    pub creator: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [b"config", config.admin.as_ref()], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(init, payer = payer, space = 8 + Market::INIT_SPACE,
              seeds = [b"market", config.key().as_ref(), config.market_count.to_le_bytes().as_ref()], bump)]
    pub market: Account<'info, Market>,
    #[account(init, payer = payer, token::mint = mint, token::authority = market,
              seeds = [b"vault", market.key().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(address = config.mint)]
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceStake<'info> {
    pub user: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"config", config.admin.as_ref()], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = config,
              seeds = [b"market", config.key().as_ref(), market.id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(init, payer = payer, space = 8 + Position::INIT_SPACE,
              seeds = [b"position", market.key().as_ref(), user.key().as_ref()], bump)]
    pub position: Account<'info, Position>,
    #[account(mut, token::mint = config.mint, token::authority = user)]
    pub user_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump = market.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProposeOutcome<'info> {
    pub resolver: Signer<'info>,
    #[account(seeds = [b"config", config.admin.as_ref()], bump = config.bump,
              constraint = config.resolver == resolver.key() @ KeptError::NotResolver)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = config,
              seeds = [b"market", config.key().as_ref(), market.id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct Challenge<'info> {
    pub user: Signer<'info>,
    #[account(seeds = [b"config", config.admin.as_ref()], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = config,
              seeds = [b"market", config.key().as_ref(), market.id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    // Only people who staked can challenge: this account must exist.
    #[account(seeds = [b"position", market.key().as_ref(), user.key().as_ref()], bump = position.bump)]
    pub position: Account<'info, Position>,
    #[account(mut, token::mint = config.mint, token::authority = user)]
    pub user_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump = market.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    pub voter: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"config", config.admin.as_ref()], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = config,
              seeds = [b"market", config.key().as_ref(), market.id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    // One vote per wallet per market.
    #[account(init, payer = payer, space = 8 + Vote::INIT_SPACE,
              seeds = [b"vote", market.key().as_ref(), voter.key().as_ref()], bump)]
    pub vote: Account<'info, Vote>,
    #[account(mut, token::mint = config.mint, token::authority = voter)]
    pub voter_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump = market.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Finalize<'info> {
    #[account(seeds = [b"config", config.admin.as_ref()], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = config,
              seeds = [b"market", config.key().as_ref(), market.id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    pub user: Signer<'info>,
    #[account(seeds = [b"config", config.admin.as_ref()], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(has_one = config,
              seeds = [b"market", config.key().as_ref(), market.id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [b"position", market.key().as_ref(), user.key().as_ref()], bump = position.bump)]
    pub position: Account<'info, Position>,
    #[account(mut, token::mint = config.mint, token::authority = user)]
    pub user_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump = market.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimVote<'info> {
    pub voter: Signer<'info>,
    #[account(seeds = [b"config", config.admin.as_ref()], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(has_one = config,
              seeds = [b"market", config.key().as_ref(), market.id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [b"vote", market.key().as_ref(), voter.key().as_ref()], bump = vote.bump)]
    pub vote: Account<'info, Vote>,
    #[account(mut, token::mint = config.mint, token::authority = voter)]
    pub voter_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump = market.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

// ---------------------------------------------------------------- errors

#[error_code]
pub enum KeptError {
    #[msg("Market is not open")]
    NotOpen,
    #[msg("Deadline has passed")]
    PastDeadline,
    #[msg("Deadline has not passed yet")]
    BeforeDeadline,
    #[msg("Deadline must be in the future")]
    DeadlineInPast,
    #[msg("Amount must be between 1 and 100 tUSDC")]
    StakeOutOfRange,
    #[msg("Side or outcome must be Kept (1), Broken (2) or Void/Unclear (3)")]
    BadSide,
    #[msg("Confidence must be 0-10000 basis points")]
    BadConfidence,
    #[msg("Only the configured resolver can propose")]
    NotResolver,
    #[msg("Market is not in a public vote")]
    NotVoting,
    #[msg("Voting has closed")]
    VoteClosed,
    #[msg("Voting is still open")]
    VoteOpen,
    #[msg("Market has no open proposal")]
    NotProposed,
    #[msg("Nothing to finalize yet")]
    NotFinalizable,
    #[msg("Challenge window is still open")]
    WindowOpen,
    #[msg("Challenge window has closed")]
    WindowClosed,
    #[msg("Windows must be positive")]
    BadWindow,
    #[msg("Market is not settled yet")]
    NotFinal,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Text is empty or too long")]
    TextTooLong,
    #[msg("Arithmetic overflow")]
    Overflow,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn market(kept: u64, broken: u64, final_outcome: u8, status: Status) -> Market {
        Market {
            config: Pubkey::default(),
            id: 0,
            creator: Pubkey::default(),
            promiser: String::new(),
            promise_text: String::new(),
            criteria: String::new(),
            source_url: String::new(),
            source_hash: [0; 32],
            deadline: 0,
            total_kept: kept,
            total_broken: broken,
            status,
            proposed: final_outcome,
            confidence_bps: 0,
            summary: String::new(),
            sources: vec![],
            evidence_hash: [0; 32],
            proposed_at: 0,
            challenger: Pubkey::default(),
            challenge_bond: 0,
            vote_ends_at: 0,
            vote_kept: 0,
            vote_broken: 0,
            vote_void: 0,
            vote_refund: false,
            final_outcome,
            forfeited_bonds: 0,
            bond_refund_due: false,
            bump: 0,
            vault_bump: 0,
        }
    }

    fn position(side: u8, amount: u64) -> Position {
        Position { market: Pubkey::default(), owner: Pubkey::default(), side, amount, claimed: false, bump: 0 }
    }

    fn vote(choice: u8, amount: u64) -> Vote {
        Vote { market: Pubkey::default(), voter: Pubkey::default(), choice, amount, claimed: false, bump: 0 }
    }

    const T: u64 = 1_000_000; // 1 tUSDC

    #[test]
    fn worked_example_pays_40() {
        // 10 on Broken, 100 total, 25 on Broken → 40
        let m = market(75 * T, 25 * T, BROKEN, Status::Finalized);
        assert_eq!(payout(&m, &position(BROKEN, 10 * T)).unwrap(), 40 * T);
        assert_eq!(payout(&m, &position(BROKEN, 15 * T)).unwrap(), 60 * T);
        assert_eq!(payout(&m, &position(KEPT, 75 * T)).unwrap(), 0);
    }

    #[test]
    fn forfeited_bond_goes_to_winners() {
        let mut m = market(20 * T, 20 * T, KEPT, Status::Finalized);
        m.forfeited_bonds = 10 * T;
        assert_eq!(payout(&m, &position(KEPT, 20 * T)).unwrap(), 50 * T);
    }

    #[test]
    fn void_and_empty_winning_side_refund() {
        let v = market(30 * T, 10 * T, VOID, Status::Void);
        assert_eq!(payout(&v, &position(KEPT, 30 * T)).unwrap(), 30 * T);
        let empty = market(0, 40 * T, KEPT, Status::Finalized);
        assert_eq!(payout(&empty, &position(BROKEN, 40 * T)).unwrap(), 40 * T);
    }

    #[test]
    fn most_locked_tusdc_wins_the_vote() {
        let mut m = market(0, 0, NONE, Status::Voting);
        m.vote_kept = 30 * T;
        m.vote_broken = 50 * T;
        m.vote_void = 5 * T;
        assert_eq!(vote_result(&m), BROKEN);
        m.vote_kept = 50 * T;
        assert_eq!(vote_result(&m), NONE, "a tie decides nothing");
        let empty = market(0, 0, NONE, Status::Voting);
        assert_eq!(vote_result(&empty), NONE, "no votes decides nothing");
    }

    #[test]
    fn losing_voters_pay_winning_voters() {
        // Broken wins 50 vs 30 + 5: Broken voters split all 85
        let mut m = market(0, 0, BROKEN, Status::Finalized);
        m.vote_kept = 30 * T;
        m.vote_broken = 50 * T;
        m.vote_void = 5 * T;
        assert_eq!(vote_payout(&m, &vote(BROKEN, 20 * T)).unwrap(), 34 * T); // 20 × 85 ÷ 50
        assert_eq!(vote_payout(&m, &vote(BROKEN, 30 * T)).unwrap(), 51 * T);
        assert_eq!(vote_payout(&m, &vote(KEPT, 30 * T)).unwrap(), 0);
        assert_eq!(vote_payout(&m, &vote(VOID, 5 * T)).unwrap(), 0);
    }

    #[test]
    fn void_vote_win_pays_void_voters_and_tie_refunds() {
        let mut m = market(0, 0, VOID, Status::Void);
        m.vote_kept = 10 * T;
        m.vote_void = 30 * T;
        assert_eq!(vote_payout(&m, &vote(VOID, 30 * T)).unwrap(), 40 * T);
        assert_eq!(vote_payout(&m, &vote(KEPT, 10 * T)).unwrap(), 0);
        let mut tie = market(0, 0, VOID, Status::Void);
        tie.vote_kept = 20 * T;
        tie.vote_broken = 20 * T;
        tie.vote_refund = true;
        assert_eq!(vote_payout(&tie, &vote(KEPT, 20 * T)).unwrap(), 20 * T);
    }

    #[test]
    fn create_market_fits_in_one_transaction() {
        // args at max length + 8 accounts + 2 signatures + header must stay under 1232 bytes
        let args = 8 + (4 + MAX_PROMISER) + (4 + MAX_PROMISE_TEXT) + (4 + MAX_CRITERIA) + (4 + MAX_SOURCE_URL) + 32 + 8;
        let total = 1 + 2 * 64 + 3 + 1 + 9 * 32 + 32 + 1 + 1 + 8 + 2 + args;
        assert!(total < 1232, "create_market tx would be {total} bytes");
    }
}
