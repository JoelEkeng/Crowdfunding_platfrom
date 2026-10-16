# FundChain contracts

## Architecture

`Crowdfunding` is a non-upgradeable ERC-20 escrow with no owner, administrator, fee recipient, arbitrary withdrawal, or campaign mutation path. Campaign IDs increase monotonically. Creator, trusted token, goal, deadline, metadata, and reward tiers are immutable after creation.

The constructor receives a fixed token allowlist that cannot be changed. Deployments must include only reviewed conventional ERC-20 contracts. See [`SECURITY.md`](SECURITY.md) for the threat model, findings, token policy, and tested properties.

## Lifecycle and timestamp semantics

- Campaign durations must be between one hour and 365 days at creation.
- Pledges are accepted only while `block.timestamp < deadline`.
- At `block.timestamp == deadline`, pledging is closed and the outcome is final.
- At or after the deadline, gross `pledged >= goal` is successful; otherwise it is failed.
- Reaching the goal early never permits an early creator claim.
- Successful funds can be claimed once and only by the creator.
- Failed pledges can be refunded once per supporter; `refunded` tracks aggregate completed refunds without rewriting gross funding history.

Deadlines are Unix timestamps in seconds. Block producers can influence timestamps slightly. Applications should not present second-level precision as guaranteed.

## Units and reward tiers

Goals, tier minimums, pledges, and refunds use the selected token's smallest raw unit. The contract does not normalize token decimals. For a six-decimal token, one token is represented as `1_000_000`; clients must read token metadata and convert display values consistently.

Reward tier ID `0` means no tier. Other IDs are one-based, ordered by strictly increasing minimum contribution, and apply to an individual pledge. Perks are informational and are not fulfilled on-chain.

Creation limits are:

- 20 reward tiers
- 100 title bytes
- 2,000 description bytes
- 500 image URI bytes
- 500 perk bytes per tier

## Development

From `packages/contracts`:

```sh
forge fmt --check
forge build
forge test
forge test --match-path test/Crowdfunding.invariant.t.sol
```

Dependencies are pinned Git submodules: OpenZeppelin Contracts `v5.4.0` and forge-std `v1.9.7`.

## Local deployment

Start Anvil in one terminal:

```sh
anvil
```

Copy `.env.example` to an untracked `.env`, set `DEPLOYER_PRIVATE_KEY` to an Anvil development key, then run from `packages/contracts`:

```sh
set -a; source ../../.env; set +a
forge script script/DeployLocal.s.sol:DeployLocal --rpc-url http://127.0.0.1:8545 --broadcast
```

`DeployLocal` refuses non-Anvil chain ID `31337`, deploys a test-only mock token, mints development supply to the deployer, and deploys FundChain with that token.

## Future Ethereum testnet deployment

1. Select a reviewed testnet ERC-20 or deploy `MockERC20` only for testnet development when no suitable token exists. Never present the mock as production collateral.
2. Set `RPC_URL`, `EXPECTED_CHAIN_ID`, `TOKEN_ADDRESS`, and `DEPLOYER_PRIVATE_KEY` in an untracked `.env`. The generic script has no hardcoded account or network and aborts if the connected chain differs from `EXPECTED_CHAIN_ID`.
3. Simulate before broadcasting:

```sh
set -a; source ../../.env; set +a
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL"
```

4. Review the printed chain ID, deployer, and trusted token, then broadcast explicitly:

```sh
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
```

The script prints the chain ID, deployer, token, and resulting contract address. No deployment has been performed by this repository phase.

## Explorer verification

After a testnet deployment, export the deployed address and encode the immutable allowlist constructor argument:

```sh
export CROWDFUNDING_ADDRESS=0x...
export CONSTRUCTOR_ARGS=$(cast abi-encode "constructor(address[])" "[$TOKEN_ADDRESS]")
forge verify-contract "$CROWDFUNDING_ADDRESS" src/Crowdfunding.sol:Crowdfunding \
  --chain "$EXPECTED_CHAIN_ID" \
  --constructor-args "$CONSTRUCTOR_ARGS" \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --watch
```

Use the explorer/API appropriate for the selected chain if it is not Etherscan-compatible. Verification does not constitute an audit.

## Known limitations

- Only the conservative token behaviors documented in `SECURITY.md` are supported.
- Campaigns cannot be canceled or edited.
- Direct token transfers are not recoverable or attributed to campaigns.
- Off-chain metadata can become unavailable or change at its target URI.
- Reward fulfillment is not enforced on-chain.
- Indexers must handle chain reorganizations and wait for confirmations before treating events as final.
- The implementation has automated tests but has not received an independent professional audit or formal verification.
