# Replacement Parts dashboard

Replaces the manually-maintained Smartsheet for the Replacement Parts section.
Sage X3 fields populate automatically; the team fills only the non-Sage columns;
calculated columns (delay, balance, …) are derived. One row per Sage PO line.

## Architecture

```
 DATACENTER              WINDOWS VM (CAS-PT-WSPRODAPPS)          HETZNER VPS
┌────
└──────────┘                            ──────┐  read-only  ┌───────────────────────────┐  outbound  ┌──────────────────┐
│ Sage X3  │◄──SELECT────│ sync_worker.py            │──WireGuard─►│ Postgres (mirror)│
│ SQLServer│  Fortinet   │  (every 15 min)           │  10.77.0.1  │ FastAPI + dash   │
│192.168…  │   VPN       └───────────────────────────┘            └──────────────────┘                                  ▲
   never exposed to cloud                          company IP allowlist + Entra ID SSO
```

**Security model:** the cloud has NO network path to Sage. The VM pushes a
read-only mirror outward over WireGuard. Sage is touched only by a read-only
SQL login. Worst case if the cloud is breached = a copy of some PO data.

- Split tunnel confirmed (default route via Ethernet0); WireGuard + Fortinet
  verified to coexist on the VM.
- WireGuard subnet `10.77.0.0/24` (avoids the LAN `10.0.1.0/24` and VPN `172.20.180.x`).

## Layout

```
db/schema.sql          Postgres schema: parts table (3 zones) + parts_dashboard view + sync_runs
sync/sync_worker.py    runs on the VM: Sage SELECT -> Postgres UPSERT (keyed on poh_num+poh_line)
sync/find_sample_po.py one-off: pull a real test-folder PO to validate the mapping
sync/.env.example      config template (Sage + Postgres connection strings)
backend/               FastAPI dashboard API + Entra ID SSO   (next)
```

## Column zones (see db/schema.sql for the full map)

- **🟢 Sage (auto):** PO, PO date, Code, Item, Qty, Value, supplier, received qty, expected receipt.
- **🔵 Computed:** Today, Balance (ordered−received), Delay, Ready.
- **🟡 Team-filled:** Status, Priority, Tank, dates, Drawings, Dest type, Shipping, Tracking.
  The sync UPSERT never writes these.

## App design — robust, not a static page

This is a real application, not a hand-written HTML file. Target stack:

- **Backend:** FastAPI — typed Pydantic models, input validation, structured logging, `/health` + sync-status endpoints, proper error handling.
- **Frontend:** a framework (React or Vue) with a real table UI — sort/filter/inline-edit the team-filled columns, read-only Sage columns visually distinct.
- **Auth:** Entra ID SSO (app registration) — token validated server-side; restrict to a tenant security group.
- **Data:** Postgres with **migrations** (Alembic), not ad-hoc DDL. `updated_by` + `updated_at` on user edits.
- **Ops:** run under systemd (or Docker), HTTPS via Let's Encrypt, behind the company IP allowlist. Back up the user-edited columns (the Sage mirror can always be re-synced; manual entries cannot).
- **Quality:** tests on the sync upsert and the API; the upsert must never overwrite user columns.

## Status / open items

- [x] Network path validated (split tunnel + dual VPN)
- [x] Sage PO tables mapped (PORDER / PORDERQ / PORDERP)
- [x] Postgres schema + sync worker skeleton
- [ ] Run `find_sample_po.py` → validate mapping on real test-folder data
- [x] Filter rule decided: a **custom checkbox on the PO header** (`Z…` flag on PORDER)
- [x] Custom field created: `PORDER.ZRPP_0` (tinyint, local menu 1 = No/Yes) → filter is `h.ZRPP_0 = 2`
- [x] Added `ZRPP` to PO screen (`POH1`, block 6), validated screen + window — live in `GESPOH` as a Sim/Não field
- [x] **Proven end-to-end**: ticked PO `0010026POH/000013` reads back `ZRPP_0 = 2`; filter `h.ZRPP_0 = 2` selects exactly it
- [ ] Set `SAGE_RP_FILTER=h.ZRPP_0 = 2` in the VM `.env` when the sync goes live
- [x] **Read half validated** (dryrun_sage.py): real flagged POs return correct item/qty/value; join grain clean (no POPSEQ fix needed)
- [ ] **Description (H):** NOT `ORDREF_0` (came back blank) — likely a manual sheet field or another Sage field. TBD.
- [ ] **DEST (O):** likely from line site `LINSTOFCY_0` (e.g. `00200`); sheet shows country (PT/UK/USA) → needs a site→country lookup.
- [ ] Phase 2: OF (MWO, `WIPNUM_0`?) and PC (REQ, `VCRNUMORI_0`?) joins
- [x] Hetzner VPS `CAS-CLOUD-05` (Ubuntu 24.04): Postgres up, schema loaded, roles `rpp_sync`/`rpp_app`
- [x] WireGuard tunnel live: VM `10.77.0.2` ↔ Hetzner `10.77.0.1`; coexists with Fortinet (split tunnel)
- [x] Postgres bound to tunnel IP only (`10.77.0.1`), `rpp_sync` allowed from `10.77.0.2/32`
- [x] **FULL PIPELINE PROVEN**: Sage → VM → WireGuard → Postgres; 3 flagged PO lines landed in `parts`
- [x] Sync automated: one-shot `sync_worker.py` + Windows Task Scheduler every 15 min (as SYSTEM), config in `.env`, logs to `sync.log` + `sync_runs`
- [x] Git repo on GitHub (private): `PedroNPinheiro/RPP`; Hetzner pulls via read-only deploy key
- [x] **Backend live on Hetzner**: FastAPI returns real data — `/api/parts`, `/api/sync-status`, `/health` verified
- [ ] Frontend: framework table UI (read-only Sage cols + editable team cols, sort/filter, sync banner)
- [ ] Production pass: systemd service (non-root user), reverse proxy, HTTPS, Entra ID SSO, IP allowlist
- [ ] Data formatting: trim Sage blanks (`' '`), tidy NUMERIC display (`1.0000…`, `0E-13`) in the UI
- [ ] Production: read-only Sage login, rotate credentials, switch schema to prod folder
```
