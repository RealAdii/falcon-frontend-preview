# Falcon frontend

A complete responsive frontend redesign for falcon.provably.fast, prepared for integration with its existing production backend.

## Run locally

Requires Node.js 20 or newer. No dependency installation is needed.

```sh
npm run dev
```

Open http://localhost:5186. Run `npm run check` to check JavaScript syntax.

## Pages

The frontend includes the challenge homepage, live records, safety model, scoring rules, current record code and patch, research tracks, and discussion handoff. The result board and record patches are served through read-only local proxies to the public evaluator. Discussion accounts and posts remain on the live discussion service. The full agent brief remains at its canonical live URL.

## Handoff

This is a standalone implementation prepared before access to the production repository. `server.mjs` is a local preview server, not a replacement for the production backend. Integrate the static assets and route rendering into the existing frontend pipeline. Preserve the current API, evaluator, discussion service, and submission behavior. No production push or deployment has been made.

The homepage reads `/api/participation/falcon/results`, validates the schema, lane, and scores, then displays live baseline and record values. On service failure, it labels the fallback as an October 19 snapshot and offers Retry. The cost-flight path samples real intermediate records. The falcon and gas counter follow the same value, and the fixed baseline remains visible. The flight runs once with explicit replay and pause controls, respects reduced motion, and pauses offscreen or when the tab is hidden.

Typography follows the live site's Inter and system sans stack with its system monospace stack. Brand colors, mark, favicon, mascot, and partner logos use the live site's assets. The design keeps responsive spacing and readable type on small screens.

## Telegram record watcher

`telegram-watcher.mjs` polls the public Falcon results endpoint and posts one message to a Telegram chat when the verified gas record gets lower. The first run seeds the current record without posting. Set `TELEGRAM_ANNOUNCE_CURRENT=true` if the current record should be posted on first run.

Set these environment variables on the machine that will run the watcher:

```sh
export TELEGRAM_BOT_TOKEN='replace-with-bot-token'
export TELEGRAM_CHAT_ID='replace-with-group-chat-id'
npm run watch:telegram
```

Optional settings are `TELEGRAM_POLL_INTERVAL_MS`, `TELEGRAM_STATE_FILE`, `TELEGRAM_ONCE`, and `TELEGRAM_ANNOUNCE_CURRENT`. The watcher format is:

```text
🏆 NEW FALCON RECORD
contributor · model
26,540,952 gas
45.2% less gas · 21,857,514 gas saved

Open record ↗
```

The repository also includes a manual GitHub Actions fallback at `.github/workflows/falcon-telegram-watcher.yml`. Its automatic schedule is disabled to avoid duplicate announcements. Production polling runs in the Cloudflare Worker every minute.

## Scheduled announcement topics

The Worker in `cloudflare-watcher/` watches the five signature gas benchmarks, accepted STARKS contributions, and ECDSA.fail's evaluator-promoted qubit-Toffoli product record. ECDSA.fail uses topic `142092` in the group supplied by the owner. STARKS retains topic `632`.

ECDSA.fail uses the supplied dance GIF at `assets/ecdsa-record.gif`. Its silent H.264 copy, `assets/ecdsa-record.mp4`, is sent with Telegram's `sendAnimation` method so it loops as an animation. The first ECDSA poll seeds the existing record without announcing historical work. Later polls require a lower official score, the pinned benchmark identity, a matching promotion commit and accepted submission, and consistent qubit/Toffoli metrics. The commit lookup avoids loading the public all-submissions response, which exceeded 30 MB during implementation.

The separate ECDSA Pareto watcher uses the same topic and GIF. Its two objectives are lower qubit count and lower Toffoli count. It considers consistent official metrics from accepted submissions and submissions rejected with the exact reason `score did not improve current best`. Other rejections, pending submissions, missing scores, and inconsistent products are excluded. Accepted product winners participate in dominance checks and remain covered by the product watcher. The additional watcher announces only new, non-dominated score-only rejections, with the heading `NEW ECDSA.FAIL PARETO POINT` and an explanation that the product record is unchanged. A larger product can still be a Pareto advance.

The Pareto watcher seeds historical work silently, treats equal coordinates as reproductions, and sends at most one frontier notice per poll. Pending notices are rechecked against a changed frontier before delivery. Its separate KV checkpoint does not change scalar record state.

`.github/workflows/ecdsa-pareto-feed.yml` refreshes the frontier every five minutes. The checked generator `scripts/update-ecdsa-pareto.mjs` reads official submissions with conditional requests and a bounded streaming JSON reader, then publishes a compact `ecdsa-pareto.json` on the `ecdsa-pareto-feed` branch. The artifact records the generator source commit, source URL, source ETag, SHA-256 of the source response bytes, eligible submission IDs, and frontier points. It is generated from public data, not edited by hand. The source response limit is 128 MiB and the per-submission limit is 1 MiB; malformed or truncated input never replaces the published snapshot.

The Worker checks that compact snapshot every minute, validates its identity and metrics, and refuses snapshots older than 30 minutes. GitHub scheduling can delay the five-minute refresh. The calculation runs outside the Worker because a full-history Cloudflare preview exceeded its resource limit even with streaming. No participant code runs in the generator, and no new paid runtime is required. Product-record detection continues directly against the ECDSA API.

STARKS state version 2 retains every known accepted contribution ID, sends at most three new contributions per poll, and saves progress after each acknowledged message. Legacy state is seeded once without historical backfill because its incomplete delivery history cannot establish which old messages already reached the group. Sends are spaced to respect KV's per-key write limit. Telegram 429 responses defer remaining work until `retry_after` expires. KV and Telegram are separate services: interruption between delivery and checkpointing can still cause a duplicate, so this is not an exactly-once delivery guarantee.

Validate with `npm run check` and `npm run test:watchers`. Tests mock Telegram and never post to the group. `.github/workflows/watcher-checks.yml` runs both commands on pull requests and main.

Deploy from `cloudflare-watcher/` using `npm exec --yes --ignore-scripts --package=wrangler@4.129.0 -- wrangler deploy`. Keep the existing Cloudflare-managed Telegram secrets and KV binding. The public health endpoint does not trigger announcements.
