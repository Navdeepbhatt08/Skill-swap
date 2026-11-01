import { useEffect, useState } from "react";
import { Plus, MessageCircle, Mail, Save, X } from "lucide-react";
import { getReviews, updateMyProfile, saveSession } from "../services/api";
import SkillCard from "../components/SkillCard";

export default function Profile({ user, skills = [], onAddSkill, onRequest, onDeleteSkill }) {
  const [editingContact, setEditingContact] = useState(false);
  const [whatsapp, setWhatsapp] = useState(user.whatsapp || "");
  const [bio, setBio] = useState(user.bio || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [teaches, setTeaches] = useState(user.teaches || []);
  const [learns, setLearns] = useState(user.learns || []);
  const [newLearningGoal, setNewLearningGoal] = useState("");
  const [teachesError, setTeachesError] = useState("");
  const [reviewSummary, setReviewSummary] = useState({ average: 0, count: 0, reviews: [] });

  useEffect(() => {
    getReviews(user.id).then(setReviewSummary).catch(() => setReviewSummary({ average: 0, count: 0, reviews: [] }));
  }, [user.id]);

  const handleSaveContact = async () => {
    setSaving(true);
    try {
      const res = await updateMyProfile({ whatsapp, bio });
      // Persist updated user to session
      const updatedUser = { ...user, whatsapp: res.user.whatsapp };
      saveSession({ token: localStorage.getItem("skillswap_token"), user: updatedUser });
      setSaved(true);
      setEditingContact(false);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const removeTeachingSkill = async (skill) => {
    const previousSkills = teaches;
    const nextSkills = teaches.filter((item) => item !== skill);
    setTeaches(nextSkills);
    setTeachesError("");
    try {
      const res = await updateMyProfile({ teaches: nextSkills });
      const updatedUser = { ...user, ...res.user, teaches: nextSkills };
      saveSession({ token: localStorage.getItem("skillswap_token"), user: updatedUser });
    } catch (error) {
      setTeaches(previousSkills);
      setTeachesError(error.message || "Could not update teaching skills.");
    }
  };

  const addLearningGoal = async () => {
    const goal = newLearningGoal.trim();
    if (!goal || learns.some((item) => item.toLowerCase() === goal.toLowerCase())) return;
    const nextLearns = [...learns, goal];
    setLearns(nextLearns);
    setNewLearningGoal("");
    try {
      await updateMyProfile({ learns: nextLearns });
      saveSession({ token: localStorage.getItem("skillswap_token"), user: { ...user, learns: nextLearns } });
    } catch (error) {
      setLearns(learns);
      setTeachesError(error.message || "Could not update learning goals.");
    }
  };

  const mySkills = skills.filter(
    (skill) => String(skill.owner?.id || skill.owner?._id) === String(user.id),
  );

  return (
    <section className="profile-layout">
      <div className="single-panel profile-main">
        <div className="profile-cover" />
        <div className="profile-identity">
          <div className="avatar avatar-profile">{user.avatar}</div>
          <div>
            <h2>{user.name}</h2>
            <p>{user.department}</p>
          </div>
          <button
            className="outline-button"
            onClick={() => setEditingContact((v) => !v)}
          >
            {editingContact ? "Cancel" : "Edit contact info"}
          </button>
        </div>

        {/* Contact Info Section */}
        <div className="profile-section">
          <span className="eyebrow">Contact Info</span>
          <div className="profile-contact-row">
            <span className="profile-contact-item">
              <Mail size={14} /> {user.email}
            </span>
            {user.whatsapp && !editingContact && (
              <a
                href={`https://wa.me/${user.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-contact-item profile-contact-item--whatsapp"
              >
                <MessageCircle size={14} /> {user.whatsapp}
              </a>
            )}
            {!user.whatsapp && !editingContact && (
              <span className="profile-contact-item profile-contact-item--empty">
                No WhatsApp number set
              </span>
            )}
          </div>

          {editingContact && (
            <div className="profile-contact-edit">
              <label className="profile-contact-label">Bio</label>
              <textarea value={bio} maxLength={500} onChange={(event) => setBio(event.target.value)} placeholder="Tell the community what you enjoy learning or teaching." />
              <label className="profile-contact-label">
                <MessageCircle size={14} /> WhatsApp Number
              </label>
              <div className="profile-contact-input-row">
                <input
                  type="tel"
                  className="profile-contact-input"
                  placeholder="+91 98765 43210"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
                <button
                  className="btn-save-contact"
                  onClick={handleSaveContact}
                  disabled={saving}
                >
                  <Save size={14} />
                  {saving ? "Saving…" : saved ? "Saved!" : "Save"}
                </button>
              </div>
              <p className="profile-contact-hint">
                This will be shared with users whose skill requests you accept.
              </p>
            </div>
          )}
        </div>

        <div className="profile-section">
          <span className="eyebrow">About</span>
          <p>{bio || "Add a short bio to help other learners know what you enjoy teaching."}</p>
        </div>
        <div className="profile-section">
          <div className="section-top">
            <div><span className="eyebrow">Community trust</span><h3>Ratings and reviews</h3></div>
            <strong>{reviewSummary.average ? `${reviewSummary.average}/5` : "New"} <small>({reviewSummary.count})</small></strong>
          </div>
          {reviewSummary.reviews.length === 0 ? (
            <p className="section-description">Complete a session to collect your first review.</p>
          ) : reviewSummary.reviews.map((review) => (
            <article className="review-item" key={review.id}>
              <div><strong>{review.reviewerName}</strong><span className="review-stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></div>
              {review.comment && <p>{review.comment}</p>}
            </article>
          ))}
        </div>
        <div className="profile-section">
          <span className="eyebrow">I can teach</span>
          <div className="profile-tags">
            {teaches.map((skill) => (
              <span className="profile-tag" key={skill}>
                {skill}
                <button
                  type="button"
                  className="profile-tag-remove"
                  aria-label={`Remove ${skill} from skills I can teach`}
                  title={`Remove ${skill}`}
                  onClick={() => removeTeachingSkill(skill)}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
          {teachesError && <p className="form-error">{teachesError}</p>}
        </div>
        <div className="profile-section">
          <div className="section-top">
            <div>
              <span className="eyebrow">My skills</span>
              <h3>Skills I share</h3>
            </div>
            <button className="primary-button" onClick={onAddSkill}>
              <Plus size={16} /> Add skill
            </button>
          </div>
          {mySkills.length > 0 ? (
            <div className="discover-grid">
              {mySkills.map((skill) => (
                <SkillCard
                  key={skill._id || skill.id}
                  skill={skill}
                  onRequest={onRequest}
                  onDelete={onDeleteSkill}
                />
              ))}
            </div>
          ) : (
            <p className="section-description">
              Add a skill you can teach to make it discoverable to other students.
            </p>
          )}
        </div>
      </div>
      <div className="single-panel want-panel">
        <span className="eyebrow">I want to learn</span>
        <h3>What is next?</h3>
        {learns.map((skill) => (
          <div className="want-row" key={skill}>
            <span>{skill}</span>
            <button className="circle-button" onClick={() => onRequest(skill)}>
              <Plus size={15} />
            </button>
          </div>
        ))}
        <div className="learning-goal-form">
          <input value={newLearningGoal} onChange={(event) => setNewLearningGoal(event.target.value)} placeholder="e.g. Python" maxLength={80} aria-label="New learning goal" />
          <button className="text-button add-learning" type="button" onClick={addLearningGoal}>
            + Add a learning goal
          </button>
        </div>
      </div>
    </section>
  );
}
