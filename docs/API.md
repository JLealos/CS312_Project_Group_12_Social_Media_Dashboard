# Phase 1 API contract

Base: `http://localhost:3001/api`. JSON requests use `Content-Type: application/json`. Success: `{ "data": ... }`. Failure: `{ "error": { "message": "..." } }`. Fields use snake_case. IDs are positive integers. List endpoints return arrays, including an empty array when no records exist.

## Routes

| Method | Path | Request / result |
| --- | --- | --- |
| GET | /health | Public; database connectivity and demo mode |
| POST | /auth/register | `{email, password, display_name}`; 201 public user; then log in |
| POST | /auth/login | `{email, password}`; token, expires_at, public user |
| GET | /auth/me | Current public user |
| POST | /auth/logout | Invalidates current token; `{logged_out:true}` |
| GET | /accounts | Owned accounts: id, platform, handle, display_name, connection_status, is_sample |
| GET | /activity | Owned feed; optional account_id and type filters; newest first |
| GET | /metrics | Owned daily snapshots; optional account_id filter; oldest date first |
| GET | /dashboard | accounts, activity_items, saved_posts counts; mode |
| GET | /drafts | All owned saved posts, including scheduled ones; newest updated first |
| GET | /drafts/:id | One owned saved post |
| POST | /drafts | account_id and content required; status and scheduled_at optional; 201 + Location header |
| PATCH | /drafts/:id | Partial update using any draft input fields; 200 updated record |
| DELETE | /drafts/:id | 200 `{id,deleted:true}` |

Except health, registration, and login, all routes require `Authorization: Bearer <token>`. Tokens remain valid through an Express restart, expire in eight hours, and are hashed in the database. Email is normalized to lowercase; password is 12-128 characters; display_name is 1-100 characters. Duplicate email returns 409. Malformed login fields (including a password outside the 12-128 character bound) return 400. Well-formed credentials that do not match, or a missing/expired token, return 401. The reserved demo email also returns 409 on registration.

Draft input:

```json
{"account_id":1,"content":"Meet us at the trail cleanup!","status":"draft","scheduled_at":null}
```

Use an ID returned by `/accounts`; don't hard-code the example ID. `content` is trimmed and must contain 1-2200 characters. `status` accepts `draft` (default) or `scheduled`. Creating a scheduled record or explicitly updating its status/scheduled_at requires a future timezone-qualified ISO timestamp, e.g. a browser-generated `new Date(selectedDate).toISOString()`. `scheduled_at` can be null for drafts. Unknown body fields, malformed JSON, invalid IDs, and invalid input return 400. Bodies over 32 KB return 413. Missing or other users' draft IDs return 404. Server errors return 500 with no internal database details. There is no PUT route.

Example saved post response (IDs and timestamps vary):

```json
{"data":{"id":4,"account_id":1,"content":"Meet us at the trail cleanup!","status":"draft","scheduled_at":null,"is_sample":false,"created_at":"2026-11-16T01:00:00.000Z","updated_at":"2026-11-16T01:00:00.000Z"}}
```

Activity fields: id, account_id, platform, handle, type, actor, content, occurred_at, is_sample. Types: post, comment, message, notification. Metrics fields: id, account_id, snapshot_date, followers, impressions, engagements, is_sample, platform, handle. snapshot_date is a YYYY-MM-DD string, not a timestamp. Metrics are daily sample counts; no live statistics or inferred audience demographics are supplied.

## Minimal React connection

```js
const API = 'http://localhost:3001/api';
async function api(path, { token, body, ...options } = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error.message);
  return payload.data;
}
const session = await api('/auth/login', {
  method: 'POST',
  body: { email: 'demo@example.com', password: 'DemoDashboard312!' },
});
const accounts = await api('/accounts', { token: session.token });
const draft = await api('/drafts', {
  method: 'POST', token: session.token,
  body: { account_id: accounts[0].id, content: 'My saved draft' },
});
// Reload this list when a screen mounts or after a successful mutation.
const drafts = await api('/drafts', { token: session.token });
```

Keep the token in React state for a session or sessionStorage for reload continuity in this local demo; clear it on logout/401. Demo token storage is not a production security design. Render content as text (never raw HTML). Show sample/demo labels on account, feed, and analytics screens. A browser refresh loads drafts by GET; there is no localStorage draft persistence requirement. Display scheduled_at in the viewer's timezone and clearly say publication is not active.

## PowerShell demonstration

```powershell
$base = 'http://localhost:3001/api'
Invoke-RestMethod "$base/health"
$session = Invoke-RestMethod "$base/auth/login" -Method Post -ContentType 'application/json' -Body (@{email='demo@example.com';password='DemoDashboard312!'} | ConvertTo-Json)
$headers = @{Authorization="Bearer $($session.data.token)"}
$accounts = Invoke-RestMethod "$base/accounts" -Headers $headers
$draft = Invoke-RestMethod "$base/drafts" -Method Post -Headers $headers -ContentType 'application/json' -Body (@{account_id=$accounts.data[0].id;content='Saved from PowerShell'} | ConvertTo-Json)
Invoke-RestMethod "$base/drafts/$($draft.data.id)" -Headers $headers
# Stop and restart Express, then repeat the GET with the same headers.
Invoke-RestMethod "$base/drafts/$($draft.data.id)" -Method Patch -Headers $headers -ContentType 'application/json' -Body '{"content":"Updated from PowerShell"}'
Invoke-RestMethod "$base/drafts/$($draft.data.id)" -Method Delete -Headers $headers
```

## Screen-to-API mapping

| React widget/action | Source and interpretation |
| --- | --- |
| Account cards | GET /accounts; render the returned count (currently 3 sample accounts) rather than hard-coding the mockup's 2 |
| Feed / recent activity | GET /activity; newest first; slice for a dashboard preview |
| Saved posts count | GET /dashboard saved_posts includes both drafts and scheduled records |
| Scheduled-only count | GET /drafts, filter status === 'scheduled'; do not label saved_posts as scheduled |
| Next planned post | GET /drafts, filter scheduled records with future scheduled_at and choose the earliest; show an empty state if none |
| Follower chart | GET /metrics; group by account_id and plot followers against snapshot_date; these are snapshots, not values to sum across days |
| Impressions / engagement | GET /metrics impressions and engagements; use selected accounts and explicit date range; do not relabel impressions as unique Reach |
| Last 7 sample days | Anchor to the latest snapshot_date in the dataset (November 15, 2026), not today's date; label the sample date range |
| Top posts / audience / unique reach | No data or endpoint supplied; show unavailable for Phase 1 |
| Connect / disconnect | No mutation endpoint supplied; disable or label as a future integration action |

Content-only PATCH requests can edit overdue scheduled records. Schedule/status changes still require a future time when the resulting status is scheduled. Concurrent partial edits lock the row before merging: omitted fields retain the latest saved values. Unknown fields and null characters are rejected; IDs accept positive integer JSON numbers or decimal strings, never arrays.
