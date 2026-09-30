#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
target="$repo_root/packages/contracts/lib/forge-std"
if [ -f "$target/src/Test.sol" ]; then
  exit 0
fi

archive=$(mktemp)
trap 'rm -f "$archive"' EXIT HUP INT TERM
mkdir -p "$target"
curl -fL "https://github.com/foundry-rs/forge-std/archive/6764d4a42fcdff8e9f6999ab94fb74c1752a0445.tar.gz" -o "$archive"
tar -xzf "$archive" -C "$target" --strip-components=1
