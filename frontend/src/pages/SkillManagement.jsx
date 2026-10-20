import { Plus } from "lucide-react";
import SkillCard from "../components/SkillCard";

export default function SkillManagement({ skills, onAddSkill, onRequest }) {
    return (
        <section className="single-panel">
            <div className="section-top">
                <div>
                    <span className="eyebrow">Your contribution</span>
                    <h3>Skill management</h3>
                </div>
                <button className="primary-button" onClick={onAddSkill}>
                    <Plus size={16} /> Add skill
                </button>
            </div>
            <p className="section-description">
                Add skills you can teach and make them discoverable to other students.
            </p>
            <div className="discover-grid">
                {skills.map((skill) => (
                    <SkillCard key={skill._id || skill.id} skill={skill} onRequest={onRequest} />
                ))}
            </div>
        </section>
    );
}
