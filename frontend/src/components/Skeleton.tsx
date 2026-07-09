/* Lightweight shimmer placeholders shown while the first data load runs. */

export function DashboardSkeleton() {
  return (
    <>
      <div className="tiles">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="tile">
            <div className="tile-main" style={{ width: "100%" }}>
              <span className="skel-bar" style={{ width: 60, height: 10 }} />
              <span className="skel-bar" style={{ width: 90, height: 22, margin: "8px 0 6px" }} />
              <span className="skel-bar" style={{ width: 120, height: 9 }} />
            </div>
            <span className="skel-circle" />
          </div>
        ))}
      </div>

      <div className="skel-toolbar">
        <span className="skel-bar" style={{ width: 300, height: 34, borderRadius: 10 }} />
        <span className="skel-bar" style={{ width: 380, height: 34, borderRadius: 10, marginLeft: "auto" }} />
      </div>

      <div className="table-card">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skel-row">
            <span className="skel-bar" style={{ width: "22%" }} />
            <span className="skel-bar" style={{ width: "10%" }} />
            <span className="skel-bar" style={{ width: "34%" }} />
            <span className="skel-bar" style={{ width: "10%" }} />
            <span className="skel-bar" style={{ width: "14%" }} />
          </div>
        ))}
      </div>
    </>
  );
}
