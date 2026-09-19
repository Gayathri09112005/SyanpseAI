# SynapseAI

**Think together. Verify smarter. Answer with confidence.**

A collaborative multi-LLM reasoning platform. Three models work on every question — one drafts
an answer, one checks the facts, one attacks the logic — and a fourth pass writes the single
answer you read, saying explicitly what was corrected and what is still uncertain.

Models agreeing is not proof. SynapseAI keeps evidence-supported claims, model judgements,
uncertainty and unresolved disagreement visibly separate.

---

## Pipeline

```
Question
  → Answer Generator        (Gemini)        draft, key claims, assumptions, uncertainties
  → Verifier ∥ Reasoning    (Groq ∥ HF)     claim statuses + evidence, logic critique
  → Refinement              (bounded)       applies only justified corrections
  → Synthesis               (Gemini)        one final answer + corrections + open questions
```

The Verifier and Reasoning Agent run in parallel and never see each other's output. The
Generator never sees either. Refinement is capped by `MAX_REFINEMENT_ITERATIONS` and skipped
entirely when neither reviewer raised anything — there are no unbounded agent loops.

**If an agent fails, its result is never invented.** The run continues degraded, the failure is
streamed to the UI, and the gap is disclosed in the final answer's uncertainty list.

## Stack

| | |
|---|---|
| Frontend | Next.js 15 (App Router, JavaScript), React 19, Tailwind, Framer Motion, React Hook Form + Zod, TanStack Query |
| Backend | Node 22, Express, ES modules, MongoDB + Mongoose, REST + Server-Sent Events |
| AI | Gemini (generate + refine + synthesise), Groq (verify), Hugging Face router (reason) |
| Auth | JWT in an HTTP-only cookie, bcrypt, no token in local storage |

## Quick start

```bash
git clone <your-repo> && cd synapseai
npm run install:all               # installs backend and frontend

cp backend/.env.example backend/.env
# set MONGODB_URI, JWT_SECRET, and your provider keys

npm run dev                       # API on :4000, web on :3000
```

Open http://localhost:3000.

Without provider keys the app runs in **mock mode**: the real pipeline executes end to end, but
each agent returns a clearly labelled `[MOCK MODE]` stub instead of a model response. Mock output
is never presented as a real answer. Set `AI_MODE=live` and add keys to use the real providers.

### With Docker

```bash
cp .env.example .env              # set JWT_SECRET and your provider keys
docker compose up --build
```

## Environment

`backend/.env` (see `backend/.env.example`):

| Variable | Notes |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string, or a local `mongodb://` URI |
| `JWT_SECRET` | ≥32 random chars. Refused at boot in production if short or default |
| `FRONTEND_URL` | CORS allowlist. Comma-separate multiple origins |
| `NODE_ENV` | `production` enables `Secure`/`SameSite=None` cookies and hides stack traces |
| `AI_MODE` | `live` or `mock` |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Answer generation, refinement, synthesis |
| `GROQ_API_KEY` / `GROQ_MODEL` | Verification |
| `HUGGINGFACE_API_KEY` / `HUGGINGFACE_MODEL` | Reasoning critique |
| `EVIDENCE_PROVIDER` | `none` or `tavily` |
| `TAVILY_API_KEY` | Required when `EVIDENCE_PROVIDER=tavily` |
| `AI_TIMEOUT_MS`, `AI_MAX_RETRIES`, `AI_MAX_OUTPUT_TOKENS` | Per-call cost and latency limits |
| `MAX_REFINEMENT_ITERATIONS`, `MAX_CONCURRENT_RUNS` | Pipeline ceilings |

Model IDs are configuration, never hardcoded. Swapping a provider means editing one adapter in
`backend/src/services/ai/providers.js` — the orchestration layer is provider-independent.

`frontend/.env` only needs `BACKEND_URL`; it is read server-side for the `/api/v1/*` rewrite, so
the browser only ever talks to its own origin and provider keys never reach the client.

### Getting keys

- **Gemini** — https://aistudio.google.com/apikey
- **Groq** — https://console.groq.com/keys
- **Hugging Face** — https://huggingface.co/settings/tokens (needs Inference Providers access;
  the adapter uses the OpenAI-compatible router at `router.huggingface.co/v1`)
- **MongoDB Atlas** — create a free M0 cluster, add a database user, allow your deploy IP, copy
  the `mongodb+srv://` string into `MONGODB_URI`

## API

```
POST   /api/v1/auth/register        POST   /api/v1/answers
POST   /api/v1/auth/login           GET    /api/v1/answers/:id
POST   /api/v1/auth/logout          GET    /api/v1/answers/:id/stream      (SSE)
GET    /api/v1/auth/me              POST   /api/v1/answers/:id/follow-up
PATCH  /api/v1/auth/preferences     POST   /api/v1/answers/:id/regenerate
DELETE /api/v1/auth/account         POST   /api/v1/answers/:id/cancel

GET    /api/v1/conversations        GET    /api/v1/health
POST   /api/v1/conversations        GET    /api/v1/ready
GET    /api/v1/conversations/:id    GET    /api/v1/providers/status
PATCH  /api/v1/conversations/:id
DELETE /api/v1/conversations/:id
```

`POST /api/v1/answers` returns `202` with a run id; progress arrives on the SSE stream as
`run.started`, `evidence.*`, `agent.started` / `agent.completed` / `agent.failed`,
`refinement.*`, and one terminal `run.completed` / `run.failed` / `run.cancelled`. Events are
buffered per run, so a reconnect replays from `Last-Event-ID` and loses nothing. Secrets, stack
traces and raw chain-of-thought are never streamed.

## Security

- bcrypt (cost 12); identical response for unknown email and wrong password
- JWT in an HTTP-only cookie; `Secure` + `SameSite=None` in production, `Lax` in development
- Every query scoped by the session's user id — a client-supplied id is never trusted
- Helmet, CORS allowlist, tiered rate limits, 256 kB body cap, `express-mongo-sanitize`,
  mongoose `sanitizeFilter`, literal-escaped search regexes
- Markdown is sanitised after highlighting/KaTeX; links are forced to `noopener noreferrer nofollow`
- Production errors are generic; provider messages (which can echo request payloads) never reach the client

## Design

The UI implements the Claude Design project **SynapseAI** (`design/SynapseAI.dc.html`, kept in the
repo as the reference; serve it with `python3 -m http.server 5050 --directory design`).

- Tokens are copied verbatim from the design: `#0E1116` / `#F3F1ED` grounds, `#6FA8FF` / `#1F63C8`
  accent, status colours, glass alphas (`--g1`, `--g2`, `--gf`, `--gin`, `--gac`), radii and the
  two motion curves (`--spring` 420ms, `--ease` 240ms). See `frontend/styles/globals.css`.
- Type: Bricolage Grotesque (display, with its optical-size axis), Source Sans 3 (reading),
  IBM Plex Mono (status, metadata, model IDs).
- Pure liquid glass: transparency, blur, 1px borders, inset edge highlights. **No gradients** —
  CI fails the build if one appears.
- `prefers-reduced-motion` collapses every animation, as the design specifies.

### Where the build differs from the design, and why

| Design | Build | Reason |
|---|---|---|
| Sample content (minimum-wage answer, `claude-sonnet-4.6`, `gpt-5.1`, `gemini-3-pro`) | Real run data and the configured models | The UI reflects actual backend events |
| "SOC 2 Type II · EU data residency", "excluded from provider training", "retention defaults to 30 days", "avg. 11.4s" | Replaced with statements that are true of this build | Not true of this deployment |
| "Continue with SSO", "Forgot password" | Omitted; a "Create an account" button takes the SSO slot | No SSO or email infrastructure exists |
| Sidebar has no rename/delete | Hover ✎ / ✕ on each conversation | Required by the spec |
| Settings modal has no domain or account deletion | Domain pills and a two-step delete row added | Required by the spec |
| Inline claim underlines in the answer text | Not implemented | Needs claim-to-sentence alignment the models do not provide reliably |
| "Design system" and "Responsive" nav pages | Not built as app pages | They document the design; the reference file remains in `design/` |
| Mobile bottom tab bar | Sidebar becomes an overlay below 720px | Deferred |

## Run settings

The workspace controls map directly to the pipeline:

| Control | Effect |
|---|---|
| Style: Concise / Balanced / Exhaustive | Answer length and detail |
| Reasoning depth (1–5: Fast → Exhaustive) | How hard the Verifier and Reasoning Agent look |
| Refinement passes (min–max, 0–8) | At least *min* passes always run; more run up to *max* while reviewers still raise issues. Capped by `MAX_REFINEMENT_ITERATIONS` |
| Evidence retrieval | Lets the Verifier cite retrieved sources; off means claims stay unverified |
| Stream partial answers | Shows the unverified draft while review is in progress |
| Retain transcripts (settings) | Off keeps only the final answer and discards every agent output |

## Testing

```bash
npm test                                    # backend suite, mocked AI, no network
cd backend && npm run test:integration      # hits the REAL provider APIs — costs money
```

The unit/integration suite mocks every provider call. The separate integration mode calls the
real APIs and asserts that each returns schema-valid JSON; individual providers skip themselves
when unconfigured.

> On macOS with Homebrew MongoDB, prefix with `MONGOMS_SYSTEM_BINARY=/opt/homebrew/bin/mongod`
> to reuse the local `mongod` instead of downloading one.

## Deployment (Render)

`render.yaml` is a Render Blueprint that creates both services: `synapseai-api` (Express) and
`synapseai-web` (Next.js). The browser only ever talks to `synapseai-web`; it proxies `/api/v1/*`
to the API, so the session cookie is first-party and no CORS preflight reaches the browser.

1. **MongoDB Atlas.** Create a free M0 cluster, a database user, and under *Network Access* allow
   `0.0.0.0/0` (Render's free tier has no fixed outbound IP). Copy the `mongodb+srv://…` string and
   add a database name before the `?`, e.g. `…mongodb.net/synapseai?retryWrites=true&w=majority`.
2. **Render → New + → Blueprint**, pick the GitHub repo. Render reads `render.yaml` and asks for the
   `sync: false` values: `MONGODB_URI`, the three provider keys, and two URLs you don't know yet —
   enter placeholders for `FRONTEND_URL` and `BACKEND_URL`.
3. After the first deploy, copy each service's URL and set:
   - `synapseai-api` → `FRONTEND_URL = https://synapseai-web-xxxx.onrender.com`
   - `synapseai-web` → `BACKEND_URL = https://synapseai-api-xxxx.onrender.com`
   then **Manual Deploy → Deploy latest commit** on *both*. `BACKEND_URL` is baked in at build
   time, so the web service must rebuild after it changes.
4. Open the web URL, create an account, run a question.

Notes:
- `JWT_SECRET` is generated by Render; production refuses to boot with a short or default secret.
- `TRUST_PROXY=2` makes rate limits per user: one hop for the web service's load balancer, one for
  the API's. With 1, every user would share a single limit.
- Free instances sleep after ~15 minutes idle; the first request afterwards takes ~50 seconds.
- Cookies are `Secure; SameSite=None` in production, which requires HTTPS — Render provides it.

## Layout

```
backend/src/
  config/        env, logger, mongoose connection
  models/        User, Conversation, AiRun
  middleware/    auth, validation, rate limits, error handling
  controllers/   auth, conversations, answers, system
  services/
    ai/          provider adapters, retry/timeout, JSON extraction
    agents/      generator, verifier, reasoner, refiner, synthesizer
    orchestration/  pipeline, run event bus
    evidence/    pluggable retrieval
  validators/    request schemas, agent output schemas
frontend/
  app/           landing, login, register, workspace (?view=compare, ?settings=1)
  components/    nav, controls (switch, sliders), markdown, modal, theme
  features/      landing, auth, workspace (sidebar, composer, agents, answer, compare, settings)
  hooks/         useAuth, useRun (SSE)
```
