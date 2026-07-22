# LA Automóveis — Admin Panel

React (Vite) SPA served at `admin.laautomoveis.com.br/admin/`. **This is the real deploy source** — `/etc/easypanel/projects/laautomoveis/laautomoveis-admin/code` is a stale, separate clone on a different branch; don't edit it. No CI/CD, manual deploy:

```
cd /opt/la-admin
docker build --no-cache -t easypanel/laautomoveis/laautomoveis-admin:latest .
docker service update --force laautomoveis_laautomoveis-admin
```

**After every deploy, verify the actual served bundle, not just "converged"** — fetch the live `index.html`, grab its `assets/index-*.js` filename, `curl` that file, and `grep` for a string unique to your change. This project got burned once by an Easypanel placeholder-deploy silently overwriting a different app's source+image (see backend `CLAUDE.md` §3) — cheap insurance against the same class of surprise here.

For the shared backend architecture (tables, loja_id conventions, n8n, Evolution) see **`laautomoveis-backend/code/CLAUDE.md`** — not duplicated here.

## Role/loja visibility model

Three roles: `admin_master` (network-wide, e.g. Felipe/Diana), `gerente` (read-only network-wide-*looking* but actually should be loja-scoped — see below), `vendedor` (own loja, own leads only).

- `src/auth.js` (frontend): `isOwner()` = `admin_master` only. `isManager()` = `admin_master` OR `gerente`.
- Nav items in `Layout.jsx` and routes in `App.jsx` use these two, plus a stricter `AdminMasterOnly` route guard (blocks gerente too, unlike the looser `OwnerOnly` which only blocks vendedor) for pages explicitly restricted to Felipe (`Clientes`, `Contatos perdidos` — confirmed 2026-07-20/21, not a bug).
- **Route guards and nav-item visibility are two separate things that must both be checked** — a real bug existed where `OwnerOnly` (route-level) only blocked `vendedor`, letting `gerente` reach admin_master-only pages by direct URL even though the nav never showed a link to them.
- `GET /api/admin/users` (backing `Equipe.jsx` and the Disparador vendor-column list) is loja-scoped for `gerente` server-side (fixed 2026-07-20 — used to return the entire cross-loja roster to any gerente).
- `GET /api/veiculos/admin/todos` is **deliberately unfiltered** by loja — confirmed decision, the inventory view is meant to be shared/unified across both stores' staff.

## Two parallel API client modules — know which one a page uses

- `src/lib/api.js` — the real client, no mock fallback, consistently `/api/...` prefixed. Used by `Veiculos.jsx`.
- `src/api.js` — older scaffold. Used by `Dashboard.jsx`, `CRM.jsx`, `Agenda.jsx`, `FollowUps.jsx`, `Layout.jsx`. Originally had a silent mock-data fallback on fetch errors (removed for the 4 main pages 2026-07-03, `Layout.jsx`'s background agenda poll deliberately still fails silently since it's just a badge/notification, not a primary data screen).
- A full migration to `lib/api.js` for the remaining pages is a known, deliberately deferred cleanup — not urgent, don't do it unprompted.

## Page-specific notes worth knowing before touching them

- **`Veiculos.jsx`**: single "Publicado no site" checkbox drives `publicar_site1`+`publicar_site2` together (per-site curation UI was built, then explicitly reverted same-day — see backend doc §2). Up/down arrows call `PATCH /:id/mover`, resolving `site` from the logged-in user's own `loja_id` (`getUser()?.loja_id === 2 ? "2" : "1"`) — admin_master defaults to site 1's order column since there's no site-switcher UI. `getUser()?.loja_id` requires the backend's `/login` and `/me` responses to include `loja_id` (added 2026-07-21 — if it's ever missing from those responses again, every loja-aware default in this page silently breaks).
- **CRM Kanban**: manual "Novo Lead" creation resolves `loja_id` server-side the same anti-spoofing way as everything else (see backend doc §2) — don't add a loja selector to this form for non-admin_master users.
- **Disparador**: NOT the same thing as the WhatsApp AI pipeline — it's the reactivation-campaign board (`campanha_reativacao_clientes` table), currently loja-1-only, uses vendors' *personal* WhatsApp numbers via the shared (non-isolated) Evolution service. Vendor columns are fetched dynamically from `/api/admin/users`, not hardcoded — was a real bug (hardcoded to loja-1's 3 vendor names) until 2026-07-20.
- **Password change** (`Layout.jsx`'s "Meu perfil" modal, `POST /api/admin/trocar-senha`): works for any role on their own account — see backend doc §3/§4 for where that endpoint actually lives and its one known code-duplication wart.

## Testing constraint (important, don't try to work around it)

Claude cannot log into this admin panel — typing any password (even the shared default) into the login form, or minting a bypass JWT with the known secret, are both hard-blocked regardless of task authorization. For role-scoped verification (`gerente` vs `vendedor` vs `admin_master` behavior), either: (a) trace it via code + direct DB checks, which is usually sufficient since most bugs here are unconditional (same for every role) rather than role-dependent, or (b) ask the actual user to log in and drive the UI while Claude verifies the resulting DB state.
