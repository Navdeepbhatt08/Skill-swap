import { useState } from "react";
import { Plus, X } from "lucide-react";

export default function AddSkillModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const submit = () => name.trim() && category && onAdd(name.trim(), category);

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
