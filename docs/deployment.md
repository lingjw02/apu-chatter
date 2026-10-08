# Deployment operations

Selected host: Cloudflare Pages, free plan, existing Supabase backend. No paid upgrades.

1. Authenticate locally: `npx wrangler login` (browser OAuth). Never paste tokens into chat.
2. Build: `npm run build`. `.env` supplies public Supabase client values only.
3. Create the free Pages project named apu-chatter, production branch main, then deploy dist with Wrangler. Discover current flags with `npx wrangler pages project create --help` and `npx wrangler pages deploy --help`.
4. Set Supabase Site URL to the actual HTTPS deployment URL, add its `/auth/callback**` and `/reset-password` redirects, retaining localhost for development. Use the minimal hosted config.
5. Verify deep links, registration/reset email, invites, two-user chat, removal privacy, media quotas and server-only secrets on the deployed URL before inviting testers.

OpenRouter: add its key through Supabase Edge Function secrets, not `.env` VITE variables or browser code. A tested free-model allowlist and no paid fallback are required before enabling AI.

SMTP: no provider is currently configured. Brevo offers a free 300-email/day tier; sender verification and SMTP account activation are required. Sender/provider credentials must be entered locally or in Supabase's dashboard; never in project source. Confirm non-team delivery before public onboarding. See https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan and https://supabase.com/docs/guides/auth/auth-smtp.

Current status (2026-09-24): preview deployed at https://apu-chatter.pages.dev. Production Auth site URL and callback/reset redirects are configured; localhost redirects remain. HTTPS route checks and two-browser real sign-in, cross-browser messaging and avatar upload/removal passed. SMTP setup and full audio/release gates remain incomplete. Deploy further verified builds with `npx wrangler pages deploy dist --project-name apu-chatter --branch main`.

## Pilot usage checks

Run before inviting testers and daily during an active pilot:

```powershell
npx supabase db query --linked --file scripts/usage-snapshot.sql --output json
```

This is an operator-only read-only transaction. It reports aggregates, not chat
text, profile names, storage paths or secrets. It does not create a public RPC.
It includes reserved/deleted media until physical cleanup is confirmed, matching
the app's quota accounting. Storage metadata is an estimate, not a billing total.

| Measure | Investigate at | Enforced limit / action |
| --- | --- | --- |
| Database size | 400 MiB | Free plan database quota is 500 MB; inspect growth before read-only mode |
| Group media, deployment total | 400 MiB | App refuses reservations above 500 MiB |
| Largest group's media | 80 MiB | App refuses reservations above 100 MiB per group |
| Avatar reservations/assets | 16 MiB | App refuses reservations above 20 MiB |
| Board JSON | 51 MiB | App refuses writes above 64 MiB total JSON |
| Missing Storage size metadata | Any object | Investigate incomplete accounting |
| Pending cleanup | Persistent across two 15-minute cycles | Inspect worker HTTP results and Storage deletion errors |

The database warning is an operational buffer, not an application-enforced
database cap. Supabase's [database-size documentation](https://supabase.com/docs/guides/platform/database-size)
explains that database and disk usage differ. Do not infer free quota headroom
from app tables alone.

Also open the Supabase organization **Usage** dashboard and check Storage,
egress, Realtime messages/peak connections and Edge Function invocations against
the current plan allowances. Those billing measures are deliberately marked
**not measured** in the SQL report. Check OpenRouter usage and Cloudflare TURN
usage separately once relay is configured. At 80% of an allowance, investigate
growth and stop expanding the pilot; do not upgrade or delete users' memories
automatically. No billing monitor or recurring automation is configured by this
script. Egress/Realtime dashboard review is still an open release gate.

Snapshot at 2026-09-27 07:23 UTC: database 16,264,339 bytes; group media and board
JSON zero; one 1,625-byte avatar pending cleanup, created at 07:20 UTC (less than
one cleanup interval old). All four `chatter-*` cron jobs were active and their
latest database dispatch runs succeeded. A successful pg_cron dispatch alone
does not prove the asynchronous Edge Function succeeded.

## Deletion and backup retention

Temporary chat closure deletes its message rows from the live database; it does
not promise deletion of screenshots or provider recovery copies. There is no
app-managed scheduled database export/backup implementation in this repository.

On 2026-09-27, the authenticated command below returned `backups: null`,
`physical_backup_data: {}`, `pitr_enabled: false`, and `walg_enabled: true`:

```powershell
npx supabase backups list --project-ref ynnzfygliidbwgvpkxjl --output json
```

Thus no restorable backup was exposed to this operator, and PITR was disabled.
**This does not prove zero provider-side retention.** The API did not expose an
internal-copy retention period. The precise provider retention disclosure remains
unverified and must be confirmed with Supabase before promising a deletion window.

Supabase documents daily backup access/retention for paid plans and recommends
manual exports for free projects. Database backups do not include Storage file
contents. See [Database Backups](https://supabase.com/docs/guides/platform/backups).
No paid backup service has been enabled. If exports are introduced, define their
retention and exclude ephemeral private message bodies before the first export;
update the product disclosure and verify restoration/deletion behavior.

## TURN setup status — 2026-09-27

The authenticated Wrangler OAuth session returned HTTP 403 / code 10000 for
`GET /accounts/{account_id}/calls/turn_keys`. Pages deployment access does not
establish TURN-management access. No key or billing subscription was created.
The [official list endpoint](https://developers.cloudflare.com/api/resources/calls/subresources/turn/methods/list/)
requires Calls Read or Calls Write permission.

An ignored `.env.turn` template is prepared with `CLOUDFLARE_TURN_KEY_ID` and
`CLOUDFLARE_TURN_API_TOKEN`. The user has been asked to save the TURN-specific
credentials locally. After that, configure Supabase Edge secrets and run a
relay-only call check. Do not ship the long-lived token in frontend variables.
The existing `voice-ice` endpoint currently falls back to STUN when unconfigured;
that is not proof of connectivity across restrictive networks.

For scheduled-worker health, run `npx supabase db query --linked --file scripts/scheduled-worker-snapshot.sql --output json`. This reports six-hour HTTP status counts, bounded failure categories and latest worker-shaped responses alongside cron dispatches; it does not print response bodies or request headers. Investigate repeated 5xx responses or growing cleanup queues even when cron reports success. The 2026-09-28 audit found one recovered cleanup-batch 503, with later HTTP 200 and empty queues.

## OpenRouter model configuration — 2026-09-29

The user-selected model is `qwen/qwen3.8-27b:free`. Both the supplied API key and
model are configured as Supabase Edge secrets; no frontend key is used. The
`group-ai`, `weekly-ai` and `find-song` functions now read the configured model
through an explicit free-only allowlist. The user approved `openrouter/free` as the fallback, configured through
`OPENROUTER_FALLBACK_MODEL`. Temporary network/provider errors and HTTP
404/429/500/502/503/504 can try that free router once. Authentication and billing
errors are not retried through another model. Neither path uses paid models. The live catalog listed the
selected Qwen model with zero prompt/completion prices. Authentication succeeded;
initial completion requests returned HTTP 429 with an upstream rate-limit notice.
Song search reports that condition without inventing tracks or enabling paid
providers. Rotate any key pasted into chat and replace it in the ignored local
`.env.openrouter`, then apply with `supabase secrets set --env-file .env.openrouter`.
