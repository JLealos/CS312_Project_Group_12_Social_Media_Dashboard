# Phase 1 platform evaluation and integration plan

Evaluated November 15, 2026 using official X documentation. Phase 1 continues to use seeded local data. The technical target for a first Phase 2 adapter is **X API v2**, conditional on the team's access and budget decision. This is a planning choice, not a claim of approved developer access or a working integration. Instagram/Facebook remain sample-only until separately evaluated.

## Authorization and publishing

Use OAuth 2.0 Authorization Code with PKCE for an owner-authorized connection. Request tweet.read and users.read for reads, add tweet.write only for explicitly authorized publishing, and offline.access if refresh tokens are needed. Express would handle the callback, validate state and PKCE, and store provider credentials separately from app login sessions. Client secrets and provider tokens must never reach React account JSON. The [official authorization guide](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code) documents these scopes and the refresh-token requirement.

The [official create-post sample](https://github.com/xdevplatform/samples/blob/main/python/posts/create_post.py) uses POST /2/tweets with user-context authorization. App login does not grant provider publishing permission. Our current 2200-character draft limit is a local composer limit, not a promise that X will accept the text; a real adapter must enforce the provider's then-current content limits before sending.

## Available metrics and feed scope

The [official metrics reference](https://docs.x.com/x-api/fundamentals/metrics) documents public likes, reposts, replies, quotes, and impressions. Private metrics require user context and owned content; non-public/organic/promoted metrics have a 30-day post-age restriction. Treat unavailable fields as unavailable, not zero. Our daily sample engagements are synthetic and are not verified provider analytics. A real adapter needs an explicit definition for any aggregate and must avoid double-counting cumulative snapshots.

The initial adapter scope should be owned posts and supported mentions/replies, plus verified metrics. The sample message and notification activity types do not imply live DM or universal notification access. Those require separate endpoint/permission evaluation; defer them if access cannot be demonstrated.

## Access and cost gate

The [official pricing guide](https://docs.x.com/x-api/getting-started/pricing) describes prepaid pay-per-use credits, endpoint-dependent charges, and spending limits. Do not assume free access or buy credits automatically. The team must confirm developer-app access and acceptable spend in the console before implementation. No developer account, paid credits, provider credentials, or live API call was configured during this work.

## Scope decision and Phase 2 prerequisites

For Phase 1, demonstrate accounts, feeds, drafts, and analytics using clearly labeled sample data. Save future publication intent only. No OAuth implementation or worker is added by this evaluation.

For Phase 2, confirm access/budget and account ownership first. Then add an owner-scoped X adapter, migrations for provider identifiers/protected token storage, deduplication, and explicit disconnect/reconnect behavior. Only implement publication after authorization, content limits, timezone handling, retry/failure records, and duplicate-send prevention are tested. If access or budget is unavailable, retain the seeded demonstration and record the reduced scope with the team/instructor rather than claiming live delivery.
