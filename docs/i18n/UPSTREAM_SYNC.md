# Upstream sync

- Canonical upstream: `https://github.com/chumingjun/dsh-harness-one.git`
- `upstream` remote: canonical repository, fetch-only (`push=no_push`)
- GitHub fork / `origin`: `https://github.com/IvanMylenkyi/dsh-harness-one.git`
- `local-mirror`: preserved local bare mirror at `T:\DeepSeekHarness\workflow-one-i18n-fork.git`
- Current upstream baseline: tag `v0.11.0`, commit `9483c87809a0d3efac58da4e35aad7a015ca8371`
- Local implementation branch: `feat/i18n-en`

Sync procedure:

1. Fetch upstream tags and `main` into the fetch-only `upstream` remote.
2. Review the selected upstream range and merge into `feat/i18n-en`, resolving behavior changes deliberately.
3. Run web/unit/browser tests, locale parity, source scan, production build, and strict bundle scan; document known gaps.
4. Push only to the GitHub fork `origin/feat/i18n-en`. Do not push to upstream or publish packages without a separate release decision.

The source CJK guard scans the full working tree against
`docs/i18n/CJK_BASELINE.json`, independent of Git diff state. Refresh the
baseline only when intentionally accepting upstream source changes:
`node scripts/check-i18n.mjs --write-baseline --baseline-ref <commit>`.
