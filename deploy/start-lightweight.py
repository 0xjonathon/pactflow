"""Configure from verified public chain evidence; never print secrets."""
import json
from pathlib import Path

shared = Path('/opt/pactflow/shared')
release = (shared / 'release').read_text().strip()
record = json.loads((shared / 'protocol.json').read_text())
if record['chainId'] != 10143 or record['protocolVersion'] != 2:
    raise SystemExit('Monad testnet V2 evidence required')
compose = dict(line.split('=', 1) for line in (shared / 'compose.env').read_text().splitlines() if '=' in line)
env = {
    'NODE_ENV': 'production',
    'API_PORT': '3001',
    'PACTFLOW_LIGHTWEIGHT': 'true',
    'PACTFLOW_INDEXER_MODE': 'rpc',
    'INDEXER_START_BLOCK': str(record['deploymentBlock']),
    'DATABASE_URL': f"postgres://pactflow:{compose['POSTGRES_PASSWORD']}@postgres:5432/pactflow",
    'REDIS_URL': 'redis://redis:6379',
    'WEB_ORIGIN': 'https://pactflow-lovat.vercel.app',
    'MONAD_TESTNET_RPC_URL': 'https://testnet-rpc.monad.xyz',
    'NEXT_PUBLIC_PACT_FACTORY_V2_ADDRESS': record['PactFactoryV2'],
    'NEXT_PUBLIC_REPUTATION_REGISTRY_V2_ADDRESS': record['ReputationRegistryV2'],
    'NEXT_PUBLIC_VERIFIER_REGISTRY_V2_ADDRESS': record['VerifierRegistryV2'],
    'NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS': record['SettlementToken'],
    'NEXT_PUBLIC_VERIFIER_ADDRESS': record['Verifier'],
    'VERIFIER_PRIVATE_KEY': (shared / 'verifier.key').read_text().strip(),
}
file = shared / 'runtime.env'
file.write_text(''.join(f'{k}={v}\n' for k, v in env.items()))
file.chmod(0o600)
compose['PACTFLOW_RELEASE'] = release
file = shared / 'compose.env'
file.write_text(''.join(f'{k}={v}\n' for k, v in compose.items()))
file.chmod(0o600)
print('Runtime configured for Monad testnet; secrets retained only on server.')
