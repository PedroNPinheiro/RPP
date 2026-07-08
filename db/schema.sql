-- Replacement Parts dashboard — Postgres schema
-- One row per Sage purchase-order LINE, keyed on (poh_num, poh_line).
--
-- Three zones:
--   [SAGE]     overwritten every sync from Sage X3 (read-only in the UI)
--   [USER]     filled by the RP team in the dashboard — sync NEVER touches these
--   [COMPUTED] derived in the parts_dashboard view (TODAY, DELAY, BALANCE, READY)

CREATE TABLE IF NOT EXISTS parts (
    id               BIGSERIAL PRIMARY KEY,

    -- ---- natural key (from Sage) ----
    poh_num          TEXT NOT NULL,          -- PORDERQ.POHNUM_0   (sheet: PO)
    poh_line         INTEGER NOT NULL,       -- PORDERQ.POPLIN_0
    UNIQUE (poh_num, poh_line),

    -- ---- [SAGE] synced columns ----
    po_date          DATE,                   -- PORDERQ.ORDDAT_0        (PO DATE)
    item_code        TEXT,                   -- PORDERQ.ITMREF_0        (Code)
    item_desc        TEXT,                   -- PORDERP.ITMDES1_0       (Item)
    qty_ordered      NUMERIC,                -- PORDERQ.QTYPUU_0        (QTTY)
    qty_received     NUMERIC,                -- PORDERQ.RCPQTYPUU_0     (-> Balance)
    line_value       NUMERIC,                -- PORDERQ.LINAMT_0        (Value)
    unit_price       NUMERIC,                -- PORDERP.NETPRI_0
    currency         TEXT,                   -- PORDER.CUR_0
    expected_receipt DATE,                   -- PORDERQ.EXTRCPDAT_0     (-> Delay)
    line_site        TEXT,                   -- PORDERQ.LINSTOFCY_0
    receipt_site     TEXT,                   -- PORDER.RCPFCY_0
    supplier_code    TEXT,                   -- PORDER.BPSNUM_0
    supplier_name    TEXT,                   -- PORDER.BPRNAM_0
    order_ref        TEXT,                   -- PORDER.ORDREF_0     (candidate: Description) — CONFIRM
    of_number        TEXT,                   -- phase 2 (OF / MWO)
    pc_number        TEXT,                   -- phase 2 (PC / REQ)
    sage_tracking    TEXT,                   -- PORDER.ZTRKNUM_0    (custom — maybe already the Tracking value)
    sage_delivered   SMALLINT,               -- PORDER.ZPODEL_0     (custom delivered flag)
    synced_at        TIMESTAMPTZ,            -- set every sync

    -- ---- [USER] team-filled columns (sync never writes these) ----
    entregue_war        DATE,                -- Entregue WAR
    sent_to_production  DATE,                -- Sent to Production
    production_closing  DATE,                -- Production Closing Date
    status              TEXT,                -- STATUS (Cheio / Três quartos)
    priority            TEXT,                -- Priority (P1-Critical...)
    tank                TEXT,                -- TANK
    estimated_date      DATE,                -- Estimated
    required_ship       DATE,                -- Required Ship
    eta_pc              DATE,                -- ETA PC
    drawings_required   BOOLEAN,             -- Drawings Required?
    drawings_desc       TEXT,                -- Drawings Desc
    dest_type           TEXT,                -- DEST TYPE (CSS-Stock / CSR-Replacement)
    real_ship_date      DATE,                -- Real Ship Date
    shipping_method     TEXT,                -- Shipping Method
    tracking            TEXT,                -- Tracking
    notes               TEXT,
    updated_by          TEXT,
    updated_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_parts_item     ON parts (item_code);
CREATE INDEX IF NOT EXISTS idx_parts_supplier ON parts (supplier_code);
CREATE INDEX IF NOT EXISTS idx_parts_dest     ON parts (dest_type);

-- Audit trail — one row per changed field on a team edit (who/when/old/new).
-- Written by the API inside the same transaction as the UPDATE.
CREATE TABLE IF NOT EXISTS part_audit (
    id         BIGSERIAL PRIMARY KEY,
    part_id    BIGINT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    poh_num    TEXT NOT NULL,       -- denormalized so history reads standalone
    poh_line   INTEGER NOT NULL,
    field      TEXT NOT NULL,       -- column name from the PartUpdate whitelist
    old_value  TEXT,
    new_value  TEXT,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_part ON part_audit (part_id, changed_at DESC);

-- File attachments on PO lines. Files live on disk (UPLOAD_DIR) under a
-- generated stored_name; this table holds the metadata.
CREATE TABLE IF NOT EXISTS part_attachments (
    id           BIGSERIAL PRIMARY KEY,
    part_id      BIGINT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    poh_num      TEXT NOT NULL,
    poh_line     INTEGER NOT NULL,
    filename     TEXT NOT NULL,          -- original name (shown to users)
    stored_name  TEXT NOT NULL UNIQUE,   -- uuid.ext on disk
    content_type TEXT,
    size_bytes   BIGINT NOT NULL,
    uploaded_by  TEXT NOT NULL,
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attach_part ON part_attachments (part_id);

-- Daily distribution snapshots for the Analytics history charts. One row per
-- (day, dimension, bucket). Rebuilt for "today" whenever analytics is viewed;
-- past days stay frozen, so the line charts accumulate real history over time.
CREATE TABLE IF NOT EXISTS status_snapshot (
    snap_date DATE NOT NULL,
    dimension TEXT NOT NULL,   -- 'status' | 'priority'
    bucket    TEXT NOT NULL,
    count     INTEGER NOT NULL,
    PRIMARY KEY (snap_date, dimension, bucket)
);

-- Sync run log — so we can see freshness / failures on the dashboard.
CREATE TABLE IF NOT EXISTS sync_runs (
    id           BIGSERIAL PRIMARY KEY,
    started_at   TIMESTAMPTZ NOT NULL,
    finished_at  TIMESTAMPTZ,
    rows_upserted INTEGER,
    ok           BOOLEAN,
    error        TEXT
);

-- [COMPUTED] dashboard view — adds TODAY / BALANCE / DELAY / READY on top of the mirror.
CREATE OR REPLACE VIEW parts_dashboard AS
SELECT
    p.*,
    CURRENT_DATE                                       AS today,
    (COALESCE(p.qty_ordered,0) - COALESCE(p.qty_received,0)) AS balance_qty,
    CASE
        WHEN p.qty_received >= p.qty_ordered THEN 0
        WHEN p.expected_receipt IS NULL      THEN NULL
        ELSE (CURRENT_DATE - p.expected_receipt)
    END                                                AS delay_days,
    CASE
        WHEN p.qty_ordered IS NOT NULL
         AND p.qty_received >= p.qty_ordered THEN 'Verde'   -- fully received
        ELSE NULL
    END                                                AS ready
FROM parts p;
