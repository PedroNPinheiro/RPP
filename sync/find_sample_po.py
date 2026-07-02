# find_sample_po.py — run on the Windows VM.
# The test folder CASCOQLD doesn't have the production PO we tried, so this
# lists a few real POs that DO exist there, plus one full sample line, so we
# can validate the sync mapping against real data.
import pyodbc

DB_CONN = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=192.168.97.2;DATABASE=x3v12;"
    "UID=CASCO;PWD=s@ge2020;"
)
SCHEMA = "CASCOQLD"

cn = pyodbc.connect(DB_CONN)
cur = cn.cursor()

print("===== 10 most recent POs in the test folder =====")
cur.execute(f"""
    SELECT TOP 10 POHNUM_0, ORDDAT_0, BPSNUM_0, BPRNAM_0, TOTLINAMT_0
    FROM {SCHEMA}.PORDER
    ORDER BY ORDDAT_0 DESC
""")
sample_po = None
for r in cur.fetchall():
    if sample_po is None:
        sample_po = r[0]
    print(f"  {r.POHNUM_0:<22} {str(r.ORDDAT_0)[:10]}  {r.BPSNUM_0:<12} {r.BPRNAM_0}")

print(f"\n===== lines of {sample_po} (joined PORDERQ + PORDERP) =====")
cur.execute(f"""
    SELECT q.POHNUM_0, q.POPLIN_0, q.ITMREF_0, p.ITMDES1_0,
           q.QTYPUU_0, q.RCPQTYPUU_0, q.LINAMT_0, p.NETPRI_0,
           q.EXTRCPDAT_0, q.LINSTOFCY_0
    FROM {SCHEMA}.PORDERQ q
    LEFT JOIN {SCHEMA}.PORDERP p
           ON p.POHNUM_0 = q.POHNUM_0 AND p.POPLIN_0 = q.POPLIN_0
    WHERE q.POHNUM_0 = ?
    ORDER BY q.POPLIN_0
""", sample_po)
for r in cur.fetchall():
    print(f"  line {r.POPLIN_0}: {r.ITMREF_0} | {r.ITMDES1_0} | "
          f"ord={r.QTYPUU_0} rcv={r.RCPQTYPUU_0} val={r.LINAMT_0} "
          f"exp={str(r.EXTRCPDAT_0)[:10]} site={r.LINSTOFCY_0}")

# Does PORDERP ever have >1 row per line? (would multiply rows in the sync)
print("\n===== PORDERP rows-per-line check (POPSEQ) =====")
cur.execute(f"""
    SELECT TOP 5 POHNUM_0, POPLIN_0, COUNT(*) AS n
    FROM {SCHEMA}.PORDERP
    GROUP BY POHNUM_0, POPLIN_0
    HAVING COUNT(*) > 1
""")
dupes = cur.fetchall()
print("  lines with >1 price row:", len(dupes), "(0 = safe to plain-join)")
for r in dupes:
    print(f"   {r.POHNUM_0} line {r.POPLIN_0}: {r.n} rows")

cn.close()
