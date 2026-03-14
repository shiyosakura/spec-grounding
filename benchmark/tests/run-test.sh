#!/bin/bash
set -e
case "${1:-spec}" in
  spec)     PORT=3097 ;;
  vibe)     PORT=3098 ;;
  baseline) PORT=3099 ;;
  *)        echo "Usage: $0 {spec|vibe|baseline}"; exit 1 ;;
esac
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "BASE_URL=http://localhost:$PORT" > "$DIR/.env.test"
cd "$DIR"
npx vitest run --reporter=verbose
