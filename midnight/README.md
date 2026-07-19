# esense Midnight Receipt Pilot

This directory contains an isolated Compact contract for the esense job receipt format.

## Privacy boundary

Only a 32-byte commitment may be registered. The contract must never receive a customer name, address, job identifier, measurement, photograph, report, file name, or esense user identifier.

The current esense receipt is local and server-signed. The private package
manifest is encrypted in the application database, while its verification
response explicitly reports:

- `midnight.status = not_submitted`
- `cardano.status = not_anchored`

Those fields must not change until a transaction is confirmed and independently queryable.

## Contract behavior

- `registerReceipt` adds a commitment under the private esense issuer authority.
- `revokeReceipt` marks an existing commitment as revoked.
- `assertValidReceipt` proves that a commitment is registered and not revoked.

The issuer secret remains private client state. It is not stored in the contract or in this repository.

## Build

The Cardano server uses the official Compact installer and compiler. Compile without deploying:

```bash
cd midnight/pilot
compact compile --skip-zk ../receipt-registry.compact contracts/managed/receipt-registry
```

Remove `--skip-zk` when the full local DApp harness is ready and proving-key generation is required:

```bash
cd midnight/pilot
compact compile +0.31.1 ../receipt-registry.compact contracts/managed/receipt-registry
```

A full pinned compile with Compact compiler `0.31.1` generates:

- `compiler/contract-info.json`
- `contract/index.js`
- `contract/index.d.ts`
- `zkir/*.zkir` and `zkir/*.bzkir`
- `keys/*.prover` and `keys/*.verifier`

The generated `pilot/contracts/managed/` directory is intentionally ignored.
Generate it before running the TypeScript checks from a fresh checkout:

```bash
cd midnight/pilot
yarn install --frozen-lockfile
yarn compile
yarn typecheck
yarn test
```

The pilot requires Node.js 22 or later and the official Compact compiler.

## Promotion gates

Do not connect this contract to production esense until all of these are true:

1. Three representative completed jobs produce stable local receipts.
2. A technician or customer confirms that independent verification is useful.
3. A dedicated Midnight test wallet is created outside production secrets.
4. The wallet is funded only with Preprod faucet tokens and has test DUST.
5. Registration, verification, revocation, restart recovery, and privacy tests pass.
6. The public verifier can confirm the transaction through an independent Preprod indexer.

No mainnet funds, NIGHT purchase, token, or Cardano transaction is required for this pilot.

## Current official runtime reference

The July 2026 Midnight example uses Compact language version `0.23`, Node.js 22
or later, and a local proof server on port `6300`. The proof server receives
private DApp state and must therefore remain local to the DApp or on a machine
controlled by the operator over an encrypted channel.

The current official DApp example pins proof server image `8.0.3`. Recheck the
official example before installation instead of silently following the
floating `latest` tag.

Primary references:

- https://docs.midnight.network/guides/run-proof-server
- https://docs.midnight.network/examples/dapps/bboard

Community skill collections such as `midskills.sevryn.xyz` may be used as
checklists for Compact, wallet, provider, testing, deployment and security
work. They are not a dependency and never override the official documentation
or local security review.
