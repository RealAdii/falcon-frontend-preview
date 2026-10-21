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

The repository also includes a GitHub Actions fallback at `.github/workflows/falcon-telegram-watcher.yml`. It runs every 5 minutes, stores the last seen record in the repository, and keeps the Telegram credentials in GitHub Secrets. The first manual run completed successfully.
