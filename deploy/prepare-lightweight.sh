#!/bin/bash
# Prepare an isolated backend; the caller supplies an immutable Git commit.
set -euo pipefail
release=${1:?Git commit required}
[[ $release =~ ^[0-9a-f]{40}$ ]] || exit 2
systemctl is-active --quiet x-ui
root=/opt/pactflow
checkout="$root/releases/$release"
install -d -m 0755 "$checkout"
install -d -m 0700 "$root/shared"
if [ ! -f "$checkout/package.json" ]; then
  curl --proto '=https' --tlsv1.2 -fsSL "https://codeload.github.com/0xjonathon/pactflow/tar.gz/$release" -o "$root/source.tar.gz"
  tar -xzf "$root/source.tar.gz" --strip-components=1 -C "$checkout"
fi
if [ ! -f "$root/shared/compose.env" ]; then
  python3 - <<'PY'
from pathlib import Path
from secrets import token_hex
p=Path('/opt/pactflow/shared/compose.env')
p.write_text('POSTGRES_PASSWORD='+token_hex(24)+'\nAPI_HOST=pactflow.43.108.33.213.sslip.io\n')
p.chmod(0o600)
PY
fi
cd "$checkout"
docker build -f deploy/Dockerfile.lightweight -t "pactflow-api:$release" . >"$root/build.log" 2>&1
# Generate a dedicated verifier on the server. Never print its private key.
docker run --rm -i --user 0 -v "$root/shared:/secrets" "pactflow-api:$release" node --input-type=module - <<'JS'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
const file='/secrets/verifier.key';
if(!existsSync(file)) writeFileSync(file, generatePrivateKey(), {mode:0o600});
console.log('Verifier address: '+privateKeyToAccount(readFileSync(file,'utf8').trim()).address);
JS
printf '%s\n' "$release" >"$root/shared/release"
systemctl is-active x-ui
docker image inspect "pactflow-api:$release" --format 'API image ready: {{.Id}}'
free -m
