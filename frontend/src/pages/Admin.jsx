import { useEffect, useState } from "react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { getAdminSummary } from "../services/api";

export default function Admin({ user }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (user.role === "admin") {
      getAdminSummary().then(setSummary).catch(() => setSummary(null));
    }
  }, [user.role]);

  if (user.role !== "admin") {
    return (
      <section className="single-panel">
        <h3>Admin access required</h3>
        <p>Your account does not have moderator permissions.</p>
      </section>
    );
  }

  const metrics = summary
    ? [
        [summary.users, "Total students"],
        [summary.skills, "Skills listed"],
        [summary.activeMatches, "Active matches"],
        [summary.reports, "Open reports"],
      ]
    : [
        ["...", "Total students"],
        ["...", "Skills listed"],
        ["...", "Active matches"],
        ["...", "Open reports"],
      ];

  return (
    <section className="admin-grid">
      <div className="admin-banner">
        <ShieldCheck size={30} />
        <div>
          <span className="eyebrow">Moderator workspace</span>
          <h2>Keep the community thoughtful.</h2>
          <p>
            Review reports, support healthy exchanges, and make space for every
            learner.
          </p>
        </div>
      </div>
      {metrics.map(([value, label]) => (
        <div className="metric-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <small>Updated just now</small>
        </div>
      ))}
      <div className="single-panel report-panel">
        <div className="section-top">
          <div>
            <span className="eyebrow">Needs attention</span>
            <h3>Open reports</h3>
          </div>
          <span className="pill danger-pill">{summary?.reports ?? "..."} open</span>
        </div>
        {[
          "Profile reported for misleading information",
          "Skill description needs review",
          "Repeated connection requests",
        ].map((report, index) => (
          <div className="report-row" key={report}>
            <span className="report-number">0{index + 1}</span>
            <strong>{report}</strong>
            <button className="text-button">
              Review <ChevronRight size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
