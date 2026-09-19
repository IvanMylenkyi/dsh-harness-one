# Upstream sync

- Canonical upstream: `https://github.com/chumingjun/dsh-harness-one.git`
- `upstream` remote: `https://github.com/chumingjun/dsh-harness-one.git`
- `origin` remote: local fork mirror `T:\DeepSeekHarness\workflow-one-i18n-fork.git`
- Release compatibility tag: `v0.10.0` (`dd907eaba0b1034bb2c11e8ef3e37bc9ca5841d4`)
- Current upstream baseline audited: `main` (`a4f7fe95b0d419d3a87f0105ff018d4e56062ee`)
- Local implementation branch: `feat/i18n-en`

Sync procedure:

1. Fetch upstream tags and `main` into the `upstream` remote.
2. Create a dedicated sync branch from `feat/i18n-en`.
3. Merge or rebase the selected upstream tag; do not auto-publish.
4. Run locale parity/placeholder tests, `check:i18n`, web tests, both web
   builds, and the English/Chinese smoke journeys.
5. Review the translation delta for semantic changes even when keys are stable.
6. Record the tested commit and remaining gaps in `COMPATIBILITY.md`.

The source CJK guard compares the whole first-party tree with
`docs/i18n/CJK_BASELINE.json`; it does not rely on a working-tree diff. Refresh
that baseline only when intentionally accepting an upstream source change:
`node scripts/check-i18n.mjs --write-baseline --baseline-ref <commit>`.
