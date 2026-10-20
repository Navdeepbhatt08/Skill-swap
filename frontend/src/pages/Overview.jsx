import { ArrowRight, Compass, Plus } from "lucide-react";
import SkillCard from "../components/SkillCard";

export default function Overview({ skills = [], onAddSkill, setPage, onRequest }) {
  const featured = skills.slice(0, 3);

  return (
    <div className="overview-container">
      <section className="dashboard-actions-panel">
        <div className="dashboard-actions-copy">
          <span className="eyebrow">Learning Space</span>
          <h2>What would you like to exchange today?</h2>
          <p>Teach a skill you master, or connect with peers to learn something new.</p>
        </div>
        <div className="dashboard-actions">
          <button className="primary-button" onClick={onAddSkill}>
            <Plus size={16} /> Add a skill
          </button>
          <button className="outline-button" onClick={() => setPage("Discover skills")}>
            <Compass size={16} /> Discover skills
          </button>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="overview-featured-section">
          <div className="section-top">
            <div>
              <span className="eyebrow">Community Highlights</span>
              <h3>Popular skills to learn</h3>
            </div>
            <button className="text-button" onClick={() => setPage("Discover skills")}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="discover-grid">
            {featured.map((skill) => (
              <SkillCard key={skill.id} skill={skill} onRequest={onRequest} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
