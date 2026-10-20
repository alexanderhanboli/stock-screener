# Hengyuan static frontend integration

The static React app can be built for a subdirectory and embedded in another site. This integration contains only frontend customizations; it does not include the parent website, broker/holdings data, hosting identity, credentials, or trading actions.

All customizations are optional. With no new variables, the original branding, English navigation, same-origin data URLs, and standalone behavior remain unchanged. `VITE_BASE_PATH` already supports subdirectory deployment; no new routing base mechanism is needed.

## Example build

In `frontend/`, install the committed npm lock with `npm ci`, then build:

```sh
VITE_STATIC_SITE=true \
VITE_BASE_PATH=/screener/ \
VITE_STATIC_SITE_NAME='衡远 · 股票研究' \
VITE_STATIC_REPO_URL=https://github.com/alexanderhanboli/stock-screener \
VITE_STATIC_LOCALE=zh-CN \
VITE_STATIC_DATA_URL=https://xang1234.github.io/stock-screener/static-data/ \
VITE_STATIC_EMBED_PARENT_ORIGIN=https://research.example.com \
VITE_STATIC_DATA_NOTICE='数据：xang1234 上游每日公开快照。截止日期见市场状态；非实时报价。筛选评级为规则标签。AI聊天、实时扫描和后台回测未启用。' \
npm run build
```

Replace `https://research.example.com` with the embedding site's exact origin (no trailing slash or path), or omit it for a standalone app. These build-time variables are public and must never contain secrets. `VITE_STATIC_LOCALE=zh-CN` translates the static navigation/read-only badge, not the complete application.

`VITE_STATIC_DATA_URL` points to a directory containing `manifest.json`. Generation-specific paths remain under that root. Omit it to keep `${BASE_URL}static-data/`. A remote source must allow browser CORS, and the host's Content Security Policy must permit its origin in `connect-src`. Normal browser fetch credentials remain same-origin; Site cookies and account authorization are not forwarded to the public source. The manifest and market labels retain their actual publication/freshness dates; this does not start a scan or a new background updater.

## Parent route synchronization

An embedded app sends this message initially and after its path or query changes:

```js
{ type: 'hengyuan-screener-route', route: '/scan?market=HK' }
```

The target is only `VITE_STATIC_EMBED_PARENT_ORIGIN`; no wildcard is used. An unset/invalid target or a top-level app sends nothing. The parent must validate both `event.origin` and `event.source === frame.contentWindow` before using the route. Host the app under the parent origin if using a same-origin iframe, and initialize its hash route, for example `/screener/#/scan?market=HK`.

The parent navigation, iframe container, access policy, CSP, Worker, and deployment stay in the parent Site repository. This fork does not contain them.
