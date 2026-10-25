#!/usr/bin/env bash
# OWNER: P1. Build the program with the Anchor CLI (Linux / WSL).
# Assembles a standard Anchor workspace in ~/kept-ws from this folder, so the
# repo keeps a flat layout and Windows never runs the build output.
#   bash program/build.sh            # build + IDL
#   bash program/build.sh test       # also run the Rust unit tests
set -euo pipefail
export PATH="$HOME/kept-tools/bin:$HOME/kept-tools/solana-release/bin:$HOME/.cargo/bin:$PATH"

SRC="$(cd "$(dirname "$0")" && pwd)"
WS="$HOME/kept-ws"
mkdir -p "$WS/programs/kept/src"
cp "$SRC/src/lib.rs" "$WS/programs/kept/src/lib.rs"

cat > "$WS/Anchor.toml" <<'TOML'
[features]
resolution = true
skip-lint = false

[programs.devnet]
kept = "11111111111111111111111111111111"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"
TOML

cat > "$WS/Cargo.toml" <<'TOML'
[workspace]
members = ["programs/*"]
resolver = "2"

[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1
TOML

cat > "$WS/programs/kept/Cargo.toml" <<'TOML'
[package]
name = "kept"
version = "0.1.0"
edition = "2021"
rust-version = "1.79"   # pick deps the Solana toolchain (cargo 1.84) can build

[lib]
crate-type = ["cdylib", "lib"]
name = "kept"

[features]
default = []
cpi = ["no-entrypoint"]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]

[dependencies]
anchor-lang = "0.31.1"
anchor-spl = "0.31.1"
TOML

mkdir -p "$WS/.cargo"
cat > "$WS/.cargo/config.toml" <<'TOML'
[resolver]
incompatible-rust-versions = "fallback"
TOML

cd "$WS"
# Resolve dependencies with the newer host cargo, honouring rust-version.
if [ ! -f Cargo.lock ]; then
  cargo generate-lockfile
  # blake3 >= 1.8 pulls digest 0.11 (edition 2024), which cargo 1.84 can't parse.
  cargo update -p blake3 --precise 1.5.5
fi

# Keep the program ID stable across builds: the keypair lives outside target/.
mkdir -p "$HOME/.config/kept" target/deploy
if [ ! -f "$HOME/.config/kept/kept-keypair.json" ]; then
  solana-keygen new --no-bip39-passphrase --silent -o "$HOME/.config/kept/kept-keypair.json"
fi
cp "$HOME/.config/kept/kept-keypair.json" target/deploy/kept-keypair.json
anchor keys sync >/dev/null

anchor build
if [ "${1:-}" = "test" ]; then
  cargo test --manifest-path programs/kept/Cargo.toml --lib
fi

echo "program id: $(solana address -k target/deploy/kept-keypair.json)"
ls -l target/deploy/kept.so target/idl/kept.json target/types/kept.ts
