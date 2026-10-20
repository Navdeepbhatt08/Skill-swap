import { useState } from "react";
import { Plus, X } from "lucide-react";

export default function AddSkillModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const submit = () => name.trim() && onAdd(name.trim());

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
        <button
          className="primary-button full-button"
          disabled={!name.trim()}
          onClick={submit}
        >
          Add to profile 
        </button>
      </div>
    </div>
  );
}
