import { BookOpen, Plus, Trash2, User, Code, Palette, Megaphone, Briefcase, Sparkles, Zap } from "lucide-react";

export default function SkillCard({ skill, onRequest, onDelete, onEdit }) {
  const ownerName = skill.owner?.name || null;

  const getCategoryIcon = (category) => {
    const icons = {
      'Development': Code,
      'Design': Palette,
      'Communication': Megaphone,
      'Business': Briefcase,
      'Creative': Sparkles,
      'Other': Zap,
    };
    const Icon = icons[category] || BookOpen;
    return <Icon size={20} />;
  };

  return (
    <article className={`skill-card ${skill.color}`}>
      <div className="skill-icon">
        {getCategoryIcon(skill.category)}
      </div>
      <span className="skill-category">{skill.category}</span>
      <h4>{skill.name}</h4>
      {skill.description && <p className="text-sm text-[var(--muted)]">{skill.description}</p>}
      {skill.tags?.length > 0 && <div className="flex flex-wrap gap-1">{skill.tags.map((tag) => <span className="skill-category" key={tag}>#{tag}</span>)}</div>}
      {ownerName && (
        <div className="skill-owner">
          <User size={12} />
          <span>{ownerName}</span>
        </div>
      )}
      <div className="skill-meta">
        <span>{skill.level}</span>
        <span>{skill.learners} learning</span>
      </div>
      {onDelete ? (
        <div className="flex gap-2">
          {onEdit && <button className="skill-action" onClick={() => onEdit(skill)}>Edit</button>}
          <button className="skill-action skill-action--delete" onClick={() => onDelete(skill)}>
            Delete skill <Trash2 size={14} />
          </button>
        </div>
      ) : ownerName ? (
        <button
          className="skill-action"
          onClick={() => onRequest(skill.name, skill._id || skill.id, skill.owner)}
        >
          Request exchange <Plus size={14} />
        </button>
      ) : (
        <button className="skill-action skill-action--disabled" disabled>
          No owner assigned
        </button>
      )}
    </article>
  );
}
