#!/bin/bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
web="${1:-$root/dist/public}"
native="${2:-$root/ios/App/App/public}"
if [[ ! -f "$web/index.html" || ! -f "$web/build-info.json" ]]; then
  echo 'error: Missing current web build. Run pnpm ios:prepare before building in Xcode.' >&2
  exit 1
fi
find "$web" -type f -print0 | while IFS= read -r -d '' file; do
  relative="${file#"$web"/}"
  if ! cmp -s "$file" "$native/$relative"; then
    echo "error: Stale native asset: $relative. Run pnpm ios:prepare." >&2
    exit 1
  fi
done
echo 'Native asset parity passed.'
