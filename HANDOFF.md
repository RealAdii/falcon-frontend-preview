# Falcon landing page handoff for Omar

This document is written to be pasted directly into an agent task.

## Living document rule

This file is the source of truth for the Falcon landing page handoff. Every agent working on this preview must update it in the same change whenever they:

- Change the landing page structure, copy, styling, animation, or data behavior
- Add or remove an asset
- Change a route, endpoint, fallback, or integration assumption
- Complete a verification step
- Discover a blocker or production repository decision

Each update must add a dated entry to the change log, update the current status when needed, and keep the verification checklist honest. Do not leave implementation decisions only in chat.

## Current status

Last updated: 2026-10-21

The standalone landing page preview is implemented and running at `http://localhost:5186`.

Completed:

- Compact hero composition designed to fit within one desktop viewport
- `Participate` header and hero actions
- `How it works` secondary action
- Live leaderboard directly below the hero
- Current record headline and leaderboard view control
- GitHub profile pictures for contributors
- Percentage gas savings and absolute gas savings
- Accurate OpenAI and Claude product logos
- Gold, silver, and bronze emoji markers beside ranks one, two, and three
- Responsive leaderboard behavior and evaluator failure state
- Omar handoff document prepared for agent use

Pending:

- Confirm the production frontend repository URL
- Create the feature branch and pull request after the repository is confirmed
- Integrate the standalone files into the production frontend
- Verify the landing page against the production asset and route pipeline

## Agent brief

You are integrating the Falcon landing page preview into the production frontend. Preserve the existing backend behavior and route system. Focus on the landing page only.

The landing page should communicate one clear idea: Falcon verification is getting cheaper because people and AI agents are competing in public to improve it.

## Required landing page order

1. Hero section
2. Live leaderboard
3. Three ways to move Falcon forward
4. One brief, start anywhere
5. Closing call to action

The hero must fit within one desktop viewport. The leaderboard begins immediately after the hero and should motivate visitors to participate.

## Current product language

- Header primary action: `Participate`
- Hero secondary action: `How it works`
- Hero headline: `Help make quantum-safe signatures cheap.`
- Closing direction: make the next record feel achievable

Do not reintroduce `Bring your agent` or `Bring your idea`.

## Leaderboard requirements

Build the leaderboard from the existing read-only endpoint:

`/api/participation/falcon/results`

Display the current record plus the next five verified results. Each row should include:

- Rank
- Contributor GitHub profile picture when `github_login` exists
- Contributor name
- Shortened result title
- Gas result
- Percentage of gas saved against the baseline
- Absolute gas saved against the baseline
- Model name
- Crown for first place, silver marker for second, bronze marker for third

Use the current `baseline.score_l2_gas` value for percentage and absolute savings. Do not calculate the percentage from `times_cheaper` alone.

The leaderboard should include:

- A current record headline
- A `Leaderboard` tab state
- An `Improvement history` link to `/record`
- A live update status
- A useful unavailable state when the endpoint fails
- Responsive horizontal scrolling or an equivalent mobile layout

## Model logos

Use accurate product logos:

- GPT models use the OpenAI logo
- Claude models use the Claude product logo
- Do not use the Anthropic company `A` logo for Claude
- Independent or unknown models use a neutral fallback mark

The preview currently references these Simple Icons assets:

- `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/openai.svg`
- `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/claude.svg`

If production policy disallows remote assets, vendor equivalent local SVG assets in the production asset pipeline.

## Visual direction

Use the existing Falcon visual language: dark background, cream text, violet accent, green record state, restrained borders, compact type, and generous alignment.

The leaderboard takes visual inspiration from the Yukon leaderboard pattern:

- Clear segmented view control
- Strong current record metric
- Identity first rows with profile pictures
- Model badges
- Podium markers for the top three ranks
- Green improvement values
- Short descriptive result titles
- Rows that feel like individual entries rather than one dense spreadsheet

Do not copy Yukon branding, data, or unrelated terminology.

## Files in this preview

- `index.html`: landing page structure, CTA labels, hero, leaderboard markup
- `app.js`: flight animation, live record loading, leaderboard loading, formatting, and safe text escaping
- `styles.css`: visual system, compact hero layout, leaderboard styles, responsive states, and reduced motion support
- `HANDOFF.md`: this integration brief
- `telegram-watcher.mjs`: record watcher that posts formatted Telegram updates when a new verified record is lower
- `telegram-bot-avatar.png`: generated Falcon profile image for the Telegram bot

## Telegram record watcher

The standalone repository includes a dependency-free watcher for broadcasting new verified records into a Telegram group. It polls `/api/participation/falcon/results`, seeds the current record on first run without posting, and only announces a later record when its gas score is lower.

Required environment variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Run it with:

```sh
npm run watch:telegram
```

The message format is:

```text
🏆 NEW FALCON RECORD
@contributor · model
26,540,952 gas
45.2% less gas · 21,857,514 gas saved

Open record ↗
```

The watcher stores its last seen record in `.telegram-watcher-state.json`, which is ignored by Git. Set `TELEGRAM_ANNOUNCE_CURRENT=true` to announce the current record on first run.

Activation status: the watcher code is ready but is not currently running. It requires a rotated Telegram bot token, the group chat ID, and an always-on process. The default polling interval is 60 seconds.

## Scope boundaries

Do not redesign the content of these subpages in this task:

- Record
- How it works or Safety
- Scoring
- Research
- Code
- Diff
- Discussions

Preserve their existing route rendering and behavior. Shared stylesheet changes are acceptable only when they are required for the landing page and do not visibly regress those routes.

## Preserve existing behavior

- Keep the existing `/api/participation/falcon/results` proxy and validation behavior.
- Keep the flight animation tied to the live baseline and record values.
- Keep reduced motion support.
- Keep replay and pause controls.
- Keep the fallback snapshot behavior when the evaluator is unavailable.
- Keep the existing brand mark, mascot, partner logos, favicon, and production asset paths.
- Keep native links and keyboard focus states.
- Escape all API supplied text before inserting it into HTML.

## Verification checklist

Run:

```sh
npm run check
npm run dev
```

Verify manually at desktop and mobile widths:

- Hero fits in one desktop viewport without hiding its metrics.
- Leaderboard appears directly after the hero.
- Current record is visually dominant.
- GitHub profile pictures load or fall back cleanly.
- OpenAI and Claude logos are accurate.
- Gas savings show both a percentage and an absolute value.
- Long result titles do not break the row layout.
- Evaluator failure shows a readable unavailable state.
- Keyboard focus is visible.
- Reduced motion disables the flight animation as intended.
- The subpages still render unchanged.

## PR instructions

Create a branch named:

`feat/falcon-landing-leaderboard`

Suggested commit message:

`Add live Falcon leaderboard to landing page`

Suggested PR title:

`Add live Falcon leaderboard and participation CTA`

Suggested PR summary:

Adds a live leaderboard directly below the Falcon hero so visitors can see the current frontier immediately. The leaderboard shows the current record and five verified results with contributor identity, accurate model logos, gas savings percentage, absolute gas savings, and responsive states. The hero is compact enough to fit within one desktop viewport. CTA language is updated to `Participate` and `How it works`.

Subpage content was not redesigned in this pass.

## Preview status

The standalone preview runs at:

`http://localhost:5186`

The standalone preview is now available in the public GitHub repository:

`https://github.com/RealAdii/falcon-frontend-preview`

Omar's agents can use this repository as the implementation reference without collaborator access. The production frontend repository and production pull request are still pending until Omar confirms the target repository.

## Change log

### 2026-10-21

- Added a live leaderboard below the hero using `/api/participation/falcon/results`.
- Added current record gas, contributor identity, result title, model, percentage saved, and absolute gas saved.
- Added GitHub contributor profile pictures with a neutral fallback.
- Added accurate OpenAI and Claude product logo assets. The Claude badge uses the Claude logo, not the Anthropic company logo.
- Replaced the text record badge with rank numbers and high quality medal emojis beside ranks one, two, and three.
- Tuned the hero scale and flight stage so the desktop hero fits in one viewport.
- Reduced the header `Participate` button size.
- Updated the CTA language from `Bring your agent` to `Participate` and from the exploratory link to `How it works`.
- Created this living handoff document for Omar and his agents.
- Packaged the current frontend, assets, and handoff into the GitHub repository above.
- Changed the GitHub repository visibility to public for direct agent access.
- Added the Telegram record watcher with a fixed new-record message format and duplicate protection.
- Added a high-contrast Falcon Telegram bot avatar optimized for a circular profile crop.
- PR creation remains blocked until the production frontend repository URL is confirmed.
