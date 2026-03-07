#!/usr/bin/env bash
# Installs the websource Claude Code skill to ~/.claude/skills/websource/SKILL.md
# Usage: bash scripts/install-skill.sh

set -euo pipefail

SKILL_SRC="$(cd "$(dirname "$0")/.." && pwd)/skills/websource/SKILL.md"
SKILL_DST="$HOME/.claude/skills/websource/SKILL.md"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$(dirname "$SKILL_DST")"
cp "$SKILL_SRC" "$SKILL_DST"

# Cross-platform sed in-place replacement
if [[ "$(uname)" == "Darwin" ]]; then
  sed -i '' "s|/path/to/websource|$PROJECT_DIR|" "$SKILL_DST"
else
  sed -i "s|/path/to/websource|$PROJECT_DIR|" "$SKILL_DST"
fi

echo "Skill installed to $SKILL_DST"
echo "PROJECT_DIR set to: $PROJECT_DIR"
