#!/usr/bin/env bash
# One-step setup for Logos on macOS and Linux.
#
#   ./setup.sh           install everything, then print how to run it
#   ./setup.sh --start   install everything, then run the backend and frontend together
#
# Checks Python and Node.js, creates .venv, installs backend and frontend dependencies, and creates
# .env (offering to save your Anthropic API key). Safe to re-run: finished steps are skipped.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$ROOT/frontend"
ENV_FILE="$ROOT/.env"
KEY_PLACEHOLDER="sk-ant-your-key-here"
START=false
[[ "${1:-}" == "--start" ]] && START=true

step() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
ok() { printf '\033[32m    ok: %s\033[0m\n' "$1"; }
warn() { printf '\033[33m    warning: %s\033[0m\n' "$1"; }
die() { printf '\n\033[31mSetup stopped: %s\033[0m\n' "$1" >&2; exit 1; }

env_value() {
  [[ -f "$ENV_FILE" ]] || return 0
  grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" | head -n1 | sed -E "s/^[^=]*=[[:space:]]*//" || true
}

# ---- 1. prerequisites ----
step "Checking prerequisites"
command -v python3 >/dev/null 2>&1 || die "python3 was not found. On a Mac run: brew install python@3.12 (Homebrew: https://brew.sh)"
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' \
  || die "Python 3.10 or newer is required (found $(python3 --version)). On a Mac run: brew install python@3.12"
ok "$(python3 --version)"

command -v node >/dev/null 2>&1 || die "Node.js was not found. On a Mac run: brew install node"
node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 20 || (a === 20 && b >= 9) ? 0 : 1)' \
  || die "Node.js 20.9 or newer is required (found $(node --version)). On a Mac run: brew upgrade node"
ok "Node.js $(node --version)"

# ---- 2. backend ----
step "Setting up the backend"
if [[ ! -x "$ROOT/.venv/bin/python" ]]; then
  python3 -m venv "$ROOT/.venv" || die "could not create the virtual environment (.venv)"
  ok "created .venv"
else
  ok ".venv already exists"
fi
"$ROOT/.venv/bin/python" -m pip install --quiet --disable-pip-version-check -r "$ROOT/requirements.txt" \
  || die "pip install failed"
ok "backend dependencies installed"

# ---- 3. API key ----
step "Checking .env"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT/.env.example" "$ENV_FILE"
  ok "created .env from .env.example"
fi
KEY="$(env_value ANTHROPIC_API_KEY)"
if [[ -z "$KEY" || "$KEY" == "$KEY_PLACEHOLDER" ]]; then
  if [[ -t 0 ]]; then
    read -r -s -p "    Paste your Anthropic API key (input hidden; press Enter to skip): " NEW_KEY || true
    echo
    if [[ -n "${NEW_KEY:-}" ]]; then
      # Pass the key through the environment so it never appears in the process list.
      LOGOS_KEY="$NEW_KEY" ENV_FILE="$ENV_FILE" "$ROOT/.venv/bin/python" -c '
import os, re
path, key = os.environ["ENV_FILE"], os.environ["LOGOS_KEY"].strip()
text = open(path).read()
line = "ANTHROPIC_API_KEY=" + key
text = re.sub(r"(?m)^\s*ANTHROPIC_API_KEY\s*=.*$", lambda _: line, text) if re.search(r"(?m)^\s*ANTHROPIC_API_KEY\s*=", text) else text + "\n" + line + "\n"
open(path, "w").write(text)
'
      ok "saved the key to .env (this file is git-ignored)"
    else
      warn "no key entered. Edit .env and set ANTHROPIC_API_KEY before running the pipeline."
    fi
  else
    warn "ANTHROPIC_API_KEY is not set. Edit .env and paste your key before running the pipeline."
  fi
else
  ok "ANTHROPIC_API_KEY is set"
fi

# ---- 4. frontend ----
step "Setting up the frontend"
(cd "$FRONTEND" && npm install --no-audit --no-fund) || die "npm install failed"
ok "frontend dependencies installed"

# ---- 5. dataset ----
step "Checking the dataset"
if [[ -d "$ROOT/inbox" && -d "$ROOT/attachments" ]]; then
  ok "inbox/ and attachments/ found"
else
  warn "inbox/ and attachments/ were not found next to loader.py. The Inbox will stay empty until you add them or set DATA_SOURCE in .env."
fi

printf '\n\033[32mSetup complete.\033[0m\n'

# ---- done ----
if $START; then
  step "Starting Logos (press Ctrl+C to stop both servers)"
  cd "$ROOT"
  "$ROOT/.venv/bin/python" -m uvicorn logos.api:app --port 8000 &
  BACKEND_PID=$!
  trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT INT TERM
  (sleep 8; command -v open >/dev/null 2>&1 && open "http://localhost:3000" || true) &
  cd "$FRONTEND" && npm run dev
else
  cat <<'EOF'

To run it, open two Terminal tabs in this folder:

  Tab 1 (backend):   .venv/bin/python -m uvicorn logos.api:app --port 8000
  Tab 2 (frontend):  cd frontend && npm run dev

Then open http://localhost:3000. Or re-run with:  ./setup.sh --start
EOF
fi
