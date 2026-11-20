import { useState } from "react";
import { Plus, X } from "lucide-react";

export default function AddSkillModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("Beginner");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [availability, setAvailability] = useState("");
  const submit = () => name.trim() && category && onAdd(name.trim(), category, level, {
    description,
    tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    availability: availability ? [{ day: "Flexible", start: availability, end: availability }] : [],
  });

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        <span className="eyebrow">Grow your profile</span>
        <h2>Add a skill</h2>
        <p>What can you teach the community?</p>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && submit()}
          placeholder="e.g. Motion design"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Skill category"
        >
          <option value="">Select a category</option>
          <option value="Development">Development</option>
          <option value="Design">Design</option>
          <option value="Communication">Communication</option>
          <option value="Creative">Creative</option>
          <option value="Business">Business</option>
          <option value="Other">Other</option>
        </select>
        <select value={level} onChange={(event) => setLevel(event.target.value)} aria-label="Skill proficiency">
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </select>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Describe what you can teach" />
        <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tags, comma separated" />
        <input value={availability} onChange={(event) => setAvailability(event.target.value)} placeholder="Availability, e.g. evenings" />
        <button
          className="primary-button full-button"
          disabled={!name.trim() || !category}
          onClick={submit}
        >
          Add to profile 
        </button>
      </div>
    </div>
  );
}
