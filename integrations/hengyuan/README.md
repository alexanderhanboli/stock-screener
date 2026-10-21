# Private three-market scanner integration

This fork's default daily/weekly matrix contains US, HK and CN. The optional static UI restriction is `VITE_STATIC_MARKETS=US,HK,CN`; upstream defaults remain unchanged when unset. Broker supplements are opt-in with `VITE_BROKER_REFRESH=true` and require a same-origin private server and local worker. GitHub Pages alone cannot execute broker MCP calls.

The full-market filters, charts and scores still use the dated daily dataset. `Load latest daily snapshot` revalidates that published dataset; it does not launch a fresh exchange-wide scan. The broker button supplements the first 50 instruments on the current results page in a separate table. It does not replace screening inputs, remove original availability warnings, or recalculate Minervini/CANSLIM/VCP scores. Current static data publication may have older underlying fundamentals; the generation date is not every field's reporting date.

## Deploy the server

Wire `screenerRoute(request, env)` from `screener-route.mjs` to `/api/screener/*` in an owner-private Sites Worker with a `DB` D1 binding. It creates its two queue tables idempotently. Keep the private Site gateway enabled; agent/result routes require service authentication and reject visitor identities. User requests must be same origin. Never expose this route module on a public unauthenticated host.

Jobs are market scoped, bounded to 50 unique symbols, expire after 15 minutes, and accept only the claimed symbol set. Published broker fields are an explicit allowlist; accounts, orders, positions and arbitrary provider output are excluded. No broker credentials belong in source, GitHub Actions, or the browser.

## Local on-demand worker

`refresh_worker.py` polls the private job queue every 8 seconds; it performs broker reads only after a user requests a job. Run it under your existing process supervisor:

```
python3 refresh_worker.py --url https://YOUR-PRIVATE-SITE --token-file /existing/protected/site-token --gateway-command '["python3","/path/broker_gateway.py","--investment-root","/path/to/your/existing/local/mcp-installation"]'
```

The token file is an existing private Site service credential supplied outside this repository. The gateway integrates the Hengyuan installation's existing Robinhood HTTP MCP transport (macOS Keychain) and `persona_chat.futu_mcp_client`; it does not create a login or extend trade permissions. Other installations can supply a compatible gateway command: one JSON request on stdin, one normalized JSON result on stdout. These private results are not published to GitHub.

Robinhood: `get_equity_fundamentals`, `get_scanner_filter_specs`, `preview_scan` only. Ownership ratios are multiplied by 100, including zero values. Provider-reported institutional ownership above 100% is retained, rather than rejecting an entire batch; it is a reported holdings statistic, not a probability. The ownership reporting period and precise quote timestamp are not returned by this scanner and remain unknown. Short-interest shares are not provided by these reads and remain missing.

Futu: `futu_market_snapshot` only, batches of at most eight. HK uses HKD, CN uses CNY; `update_time` retains the market timezone. `pe_ttm_ratio` is used. A-share quotes require the user's existing market entitlement; no subscription is purchased. An authorization failure is shown as unavailable, never substituted with zero or called a successful live quote. Beijing `.BJ` instruments remain screenable from daily data but this local Futu wrapper does not support them.

The Mac, network, OpenD and existing Robinhood authorization must be available for on-demand supplements. Static full-market filtering continues while the local service is offline. This does not establish 24/7 cloud-native broker access.

## Verify

```
node --test integrations/hengyuan/screener-route.test.mjs
cd frontend
npm run test:run -- src/static/BrokerRefreshPanel.test.jsx src/static/dataClient.test.js src/static/StaticMarketContext.test.jsx src/static/StaticLayout.test.jsx
```

## Rule-based selection explanations

Click a stock row/ticker to open the Chinese selection explanation. No LLM, broker or explanation endpoint is called: the panel reuses the same `evaluateExpression`/`evaluateCondition` functions as filtering, showing required conditions, AND/OR group outcomes, actual field values and the current ranking criterion. Ranking is not presented as a passed filter or a buy recommendation. Rows without chart data still open explanations; the chart icon and dialog chart button retain chart access.

Original per-model scores, trend/growth/pattern observations, failed trend/readiness checks, event risk and field-availability gaps are rendered from the already loaded daily snapshot. Missing values are not zero, comparable-period growth is not relabelled quarterly growth, local turnover currencies are retained, and no scoring contribution or missing-field score penalty is inferred. The daily date is shown separately from unknown financial reporting dates and broker supplements. This feature does not recompute scores or claim predictive probabilities.


## Independent original-score pipeline

Two separately built interfaces are hosted under `/screener-original/` (unmodified
upstream UI, upstream published dataset) and `/screener/` (this fork's UI and its
own published dataset). The latter uses the same original scoring implementation,
not a different fast score. `VITE_OWN_PIPELINE=true` exposes the independent
request queue and `VITE_STATIC_DATA_URL=/api/screener/own-data/` reads only this
fork's GitHub Pages data. It never silently substitutes upstream results.

The initial weekly reference and two-year price releases are public upstream
baselines copied with manifest SHA256 verification. Later daily/weekly jobs use
`GITHUB_DATA_REPOSITORY=${{ github.repository }}` to read and publish this fork's
own release assets. Underlying fundamental reporting dates remain unchanged until
the actual provider refresh succeeds. Options analytics is disabled for this
three-market stock workflow; original stock scores are retained.

The local worker accepts one full three-market request at a time. It refreshes
SPY/IVV benchmark histories through two fixed Robinhood market getters, publishes
only public OHLCV to this fork's data release, then dispatches `static-site.yml`
on `main`. The importer rejects synthetic bars and only imports complete series
whose last real bar matches the official close date. Whole benchmark series are
replaced to avoid splicing adjustment conventions. Robinhood split-adjusted data
is explicitly identified and may differ from Yahoo dividend-adjusted history.
The original benchmark resolver can use IVV when SPY is stale; no freshness guard
is disabled. A rejected benchmark does not become a fake current score.

The Mac is needed to submit broker-backed requests. After dispatch, GitHub computes
in the background. A run can take tens of minutes to hours. The queue reports
producer completion separately from publisher completion; reloading only reads
published data. Existing scheduled daily and weekly workflows are retained.
`pipeline_gateway.py` requires the existing local `gh` login; broker credentials
stay in Keychain. No account records, positions, or credentials are uploaded.

Deployment: copy the route module into the private Site, route `/api/screener/*`,
install all four Python files (`refresh_worker.py`, `broker_gateway.py`,
`pipeline_gateway.py`, `import_benchmark.py`) beside each other for reproducibility
(the importer executes in GitHub, the other three execute locally). Build upstream
from a pinned source commit with base `/screener-original/`; preserve that commit
in the Site's `screener-sources.json` alongside this fork's build commit. The
parent `site-shell.js` supplies the two-mode switch with distinct iframe paths.
