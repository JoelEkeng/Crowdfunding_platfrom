# FundChain security review

## Scope and methodology

This review covers the Solidity sources, Foundry configuration, unit and fuzz tests, stateful invariants, and deployment scripts in `packages/contracts`. It is an internal engineering review supported by automated tests, not an independent professional audit.

## Threat model

Creators and supporters are untrusted. Transactions may be reordered, token calls may revert or attempt callbacks, and indexers may observe blocks later removed by a chain reorganization. The deployment operator is trusted to choose conventional reviewed ERC-20 contracts. There is no owner or post-deployment administrator.

## Findings

### Medium — remediated

1. Campaign metadata and reward tiers were unbounded. Creation now limits tier count and metadata byte lengths.
2. Campaign duration accepted any future deadline. Creation now enforces a duration from one hour through 365 days.

### Low — remediated

3. `Campaign.pledged` represented gross funding before refunds but outstanding funding after refunds. Gross `pledged` is now immutable after the deadline and `refunded` separately records completed refunds, making liabilities and historical progress auditable.
4. No deployment scripts or chain validation existed. Separate local and configurable deployment scripts now validate chain IDs and print deployment details.
5. Stateful financial invariants were not tested. A handler now exercises repeated pledges, settlement, late pledges, and unauthorized claims.

### Informational / accepted

- Goals and pledge amounts are raw token base units. The contract does not call `decimals()` or normalize values.
- `SafeERC20` handles missing/false return values but cannot make arbitrary token economics safe.
- Direct token transfers are not campaign pledges and cannot be recovered.
- Metadata and reward fulfillment remain off-chain trust concerns.
- Timestamp manipulation within normal consensus bounds remains possible; the minimum duration reduces sensitivity but does not eliminate it.
- Indexers must use event block hashes, process removed logs, and wait for chain-appropriate confirmations.

## Supported token policy

Only fixed-supply or predictably minted, non-rebasing ERC-20 contracts with stable transfer semantics should be allowlisted. Tokens must not charge transfer fees, silently burn on transfer, depend on receiver callbacks, or alter balances asynchronously. Pausable, denylisted, upgradeable, or otherwise centrally mutable tokens require explicit risk acceptance because they may freeze claims. Malicious `balanceOf`, `transfer`, or `transferFrom` implementations can cause denial of service. Token bytecode and governance must be reviewed before deployment.

## Financial properties

- Gross campaign pledges equal the sum of current supporter liabilities plus completed refunds for failed campaigns.
- `refunded <= pledged` always.
- A supporter refund is bounded by and clears that supporter's recorded pledge.
- A successful creator payment occurs once, only after the deadline, and only to the creator.
- Successful settlement and refunds are mutually exclusive.
- Failed token calls revert the complete transaction, including accounting changes.
- No account has privileged access to escrow.

These properties are covered by unit, fuzz, and stateful invariant tests. Automated tests are evidence, not proof of absence of vulnerabilities.
