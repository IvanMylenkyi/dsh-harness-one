# Compatibility matrix

| Upstream tag/commit | Fork branch | DSH versions tested | Status |
| --- | --- | --- | --- |
| `v0.11.0` / `9483c87809a0d3efac58da4e35aad7a015ca8371` | `feat/i18n-en` | Browser fixture only; live DSH host not installed | Upstream sync merged; web and embedded UI journeys covered by Playwright |

The public fork is `IvanMylenkyi/dsh-harness-one`. `origin` targets that fork;
`local-mirror` preserves the earlier bare local mirror; `upstream` points to
the canonical `chumingjun/dsh-harness-one` repository with push disabled.

The shipped web/embedded UI has English and Simplified Chinese stable-key
locales. Remaining gaps and verification details are tracked in
`UI_STRING_INVENTORY.md`; notably the complete root integration suite requires
a mutually compatible optional DSH peer set and strict generated-bundle scan
currently reports two chunks. No npm package has been published.
