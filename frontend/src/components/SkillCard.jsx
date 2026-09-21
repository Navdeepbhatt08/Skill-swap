import { BookOpen, Plus } from "lucide-react";

export default function SkillCard({ skill, onRequest }) {
  return (
    <article className={`skill-card ${skill.color}`}>
      <div className="skill-icon">
        <BookOpen size={20} />
      </div>
      <span className="skill-category">{skill.category}</span>
      <h4>{skill.name}</h4>
      <div className="skill-meta">
        <span>{skill.level}</span>
        <span>{skill.learners} learning</span>
      </div>
      <button className="skill-action" onClick={() => onRequest(skill.name)}>
        Request exchange <Plus size={14} />
      </button>
    </article>
  );
}
