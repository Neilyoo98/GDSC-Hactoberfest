// OWNER: P1 (Blockchain). Ask before editing.
// Kept: public promise markets on Solana devnet.
// Built and deployed in Solana Playground; see program/README.md.
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

// Playground rewrites this on the first build.
declare_id!("11111111111111111111111111111111");

pub const MIN_STAKE: u64 = 1_000_000; // 1 tUSDC (6 decimals)
pub const MAX_STAKE: u64 = 100_000_000; // 100 tUSDC
pub const GATE_BPS: u16 = 7_000; // AI proposes only at confidence >= 0.70

// Sides, verdicts and outcomes share one encoding.
pub const NONE: u8 = 0;
pub const KEPT: u8 = 1;
pub const BROKEN: u8 = 2;
pub const VOID: u8 = 3; // "unclear" when it comes from the AI, "void" from the council

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
        council: [Pubkey; 3],
        challenge_window: i64,
        bond: u64,
    ) -> Result<()> {
        require!(challenge_window > 0, KeptError::BadWindow);
        let c = &mut ctx.accounts.config;
        c.admin = ctx.accounts.admin.key();
        c.resolver = resolver;
        c.council = council;
        c.mint = ctx.accounts.mint.key();
        c.challenge_window = challenge_window;
        c.bond = bond;
        c.market_count = 0;
        c.bump = ctx.bumps.config;
        Ok(())
    }

    /// Switch the demo window (30 s) and production window (24 h), or rotate keys.
    /// There is deliberately no instruction that moves funds for the admin.
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        resolver: Pubkey,
        council: [Pubkey; 3],
        challenge_window: i64,
    ) -> Result<()> {
        require!(challenge_window > 0, KeptError::BadWindow);
        let c = &mut ctx.accounts.config;
        c.resolver = resolver;
        c.council = council;
        c.challenge_window = challenge_window;
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

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
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
    /// Kept/Broken at >= 0.70 starts the challenge window; anything else goes to the council.
    pub fn propose_outcome(
        ctx: Context<ProposeOutcome>,
        verdict: u8,
        confidence_bps: u16,
        summary: String,
        sources: Vec<String>,
        evidence_hash: [u8; 32],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
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
        m.status = if verdict != VOID && confidence_bps >= GATE_BPS {
            Status::Proposed
        } else {
            Status::Council
        };
        Ok(())
    }

    /// Anyone with a stake can put up the bond while the window is open.
    pub fn challenge(ctx: Context<Challenge>) -> Result<()> {
        let window = ctx.accounts.config.challenge_window;
        let bond = ctx.accounts.config.bond;
        let m = &mut ctx.accounts.market;
        require!(m.status == Status::Proposed, KeptError::NotProposed);
        let now = Clock::get()?.unix_timestamp;
        require!(now < m.proposed_at.checked_add(window).ok_or(KeptError::Overflow)?, KeptError::WindowClosed);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            bond,
        )?;

        m.challenger = ctx.accounts.user.key();
        m.challenge_bond = bond;
        m.status = Status::Challenged;
        Ok(())
    }

    /// 2 matching votes out of 3 decide Kept, Broken or Void.
    /// Three different votes also end as Void, so a market can never get stuck.
    pub fn council_vote(ctx: Context<CouncilVote>, outcome: u8) -> Result<()> {
        require!(outcome == KEPT || outcome == BROKEN || outcome == VOID, KeptError::BadSide);
        let seat = ctx
            .accounts
            .config
            .council
            .iter()
            .position(|k| *k == ctx.accounts.member.key())
            .ok_or(KeptError::NotCouncil)?;

        let m = &mut ctx.accounts.market;
        require!(m.status == Status::Challenged || m.status == Status::Council, KeptError::NotInReview);
        require!(m.votes[seat] == NONE, KeptError::AlreadyVoted);
        m.votes[seat] = outcome;

        let count = |o: u8| m.votes.iter().filter(|v| **v == o).count();
        let decided = if count(outcome) >= 2 {
            Some(outcome)
        } else if m.votes.iter().all(|v| *v != NONE) {
            Some(VOID)
        } else {
            None
        };

        if let Some(result) = decided {
            if m.status == Status::Challenged {
                if result != m.proposed {
                    m.bond_refund_due = true;
                } else {
                    m.forfeited_bonds = m.forfeited_bonds.checked_add(m.challenge_bond).ok_or(KeptError::Overflow)?;
                }
            }
            m.final_outcome = result;
            m.status = if result == VOID { Status::Void } else { Status::Finalized };
        }
        Ok(())
    }

    /// Anyone can finalize an unchallenged proposal once the window has passed.
    pub fn finalize(ctx: Context<Finalize>) -> Result<()> {
        let window = ctx.accounts.config.challenge_window;
        let m = &mut ctx.accounts.market;
        require!(m.status == Status::Proposed, KeptError::NotProposed);
        let now = Clock::get()?.unix_timestamp;
        require!(now >= m.proposed_at.checked_add(window).ok_or(KeptError::Overflow)?, KeptError::WindowOpen);
        m.final_outcome = m.proposed;
        m.status = Status::Finalized;
        Ok(())
    }

    /// Winners get their share of the pool; Void refunds stakes;
    /// the challenger also gets the bond back if the council changed the result.
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

        if amount > 0 {
            let config_key = m.config;
            let id_bytes = m.id.to_le_bytes();
            let seeds: &[&[u8]] = &[b"market", config_key.as_ref(), id_bytes.as_ref(), &[m.bump]];
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.user_token.to_account_info(),
                        authority: ctx.accounts.market.to_account_info(),
                    },
                    &[seeds],
                ),
                amount,
            )?;
        }
        Ok(())
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
    let share = (p.amount as u128)
        .checked_mul(pool)
        .ok_or(KeptError::Overflow)?
        / winners as u128;
    u64::try_from(share).map_err(|_| error!(KeptError::Overflow))
}

// ---------------------------------------------------------------- accounts

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Status {
    Open,
    Proposed,
    Challenged,
    Council,
    Finalized,
    Void,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub resolver: Pubkey,
    pub council: [Pubkey; 3],
    pub mint: Pubkey,
    pub challenge_window: i64, // seconds
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
    pub votes: [u8; 3],
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
pub struct CouncilVote<'info> {
    pub member: Signer<'info>,
    #[account(seeds = [b"config", config.admin.as_ref()], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = config,
              seeds = [b"market", config.key().as_ref(), market.id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
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
    #[msg("Stake must be between 1 and 100 tUSDC")]
    StakeOutOfRange,
    #[msg("Side or outcome must be Kept (1), Broken (2) or Void/Unclear (3)")]
    BadSide,
    #[msg("Confidence must be 0-10000 basis points")]
    BadConfidence,
    #[msg("Only the configured resolver can propose")]
    NotResolver,
    #[msg("Only council members can vote")]
    NotCouncil,
    #[msg("This council seat has already voted")]
    AlreadyVoted,
    #[msg("Market is not waiting for a council decision")]
    NotInReview,
    #[msg("Market has no open proposal")]
    NotProposed,
    #[msg("Challenge window is still open")]
    WindowOpen,
    #[msg("Challenge window has closed")]
    WindowClosed,
    #[msg("Challenge window must be positive")]
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
            votes: [0; 3],
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
    fn create_market_fits_in_one_transaction() {
        // args at max length + 8 accounts + 2 signatures + header must stay under 1232 bytes
        let args = 8 + (4 + MAX_PROMISER) + (4 + MAX_PROMISE_TEXT) + (4 + MAX_CRITERIA) + (4 + MAX_SOURCE_URL) + 32 + 8;
        let total = 1 + 2 * 64 + 3 + 1 + 9 * 32 + 32 + 1 + 1 + 8 + 2 + args;
        assert!(total < 1232, "create_market tx would be {total} bytes");
    }
}
