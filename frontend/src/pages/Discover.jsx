import { Filter, Search } from "lucide-react";
import SkillCard from "../components/SkillCard";

export default function Discover({ skills, query, setQuery, onRequest }) {
  return (
    <section className="single-panel">
      <div className="search-row">
        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search skills, categories..."
          />
        </div>
        <button className="filter-button">
          <Filter size={16} /> Filters
        </button>
      </div>
      <div className="discover-grid">
        {skills.map((skill) => (
          <SkillCard key={skill._id || skill.id} skill={skill} onRequest={onRequest} />
        ))}
      </div>
      {skills.length === 0 && (
        <div className="empty-state">No skills found. Try another search.</div>
      )}
    </section>
  );
}
