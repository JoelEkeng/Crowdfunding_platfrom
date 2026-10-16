# Security review summary

This document summarizes internal engineering review and automated testing. It is **not** an independent professional audit and FundChain is not represented as production-ready.

## Contract controls

- No owner, arbitrary withdrawal, proxy, or upgrade path.
- Creator claims require a successful campaign at or after the deadline and are single-use.
- Refunds require a failed campaign at or after the deadline and clear the caller's pledge before transfer.
- `SafeERC20`, exact incoming balance checks, checks-effects-interactions, and `ReentrancyGuard` protect supported token flows.
- Campaign goal, token, creator, deadline, and tiers are immutable.
- Duration, metadata, and tier counts are bounded.

Unsupported tokens include rebasing, fee-on-transfer, callback-dependent, malicious, asynchronously mutating, denylisted, or pausable assets whose behavior can prevent settlement. Allowlisting is immutable but still requires deployment-time review.

## Application controls

- The browser contains no private key and validates chain ID before writes.
- Pending/signature/confirmed/reverted/uncertain transaction states are distinct.
- Discovery data is explicitly indexed; financial actions use contract reads.
- Backend parameters and pagination are bounded; CORS is explicit; public expensive routes are rate-limited.
- RPC/database credentials remain server-side.
- Event uniqueness prevents duplicate accounting.
- Checkpoint and block hash validation detect reorganizations.
- Configuration rejects zero contract addresses and missing essential values.

## Residual risks

- Automated tests cannot prove absence of contract or application vulnerabilities.
- Metadata and perk fulfillment are off-chain.
- RPC providers can censor, lag, or return inconsistent data.
- The index is eventually consistent and may be behind the frontend's receipt.
- In-memory rate limiting is not shared across API replicas.
- Deep chain reorganizations require operator recovery.
- Direct token transfers to the contract are unattributed and unrecoverable.
- The UI formats token quantities using configured metadata; a misconfigured decimal value can mislead display while on-chain base units remain correct.
- Dependencies and deployment infrastructure require ongoing patch review.

## Pre-production requirements

Before any valuable-asset deployment: independent Solidity audit, dependency and infrastructure review, load testing, PostgreSQL backup/restore drill, shared rate limiter, observability alerts, incident runbooks, supported-token governance, and a separate mainnet readiness review with explicit authorization.
