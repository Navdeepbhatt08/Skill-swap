import { useEffect, useState } from "react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import {
  getAdminSummary,
  getAdminUsers,
  getAllUsers,
  getAllSkills,
  adminAddUser,
  adminUpdateUser,
  adminDeleteUser,
  adminAddSkill,
  adminUpdateSkill,
  adminDeleteSkill,
} from "../services/api";

export default function Admin({ user }) {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [skillRecords, setSkillRecords] = useState([]);
  const [detailView, setDetailView] = useState("students");
  const [detailModal, setDetailModal] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailNotice, setDetailNotice] = useState("");

  const loadAdminDetails = () => {
    setDetailLoading(true);
    setDetailError("");

    getAdminUsers()
      .then(setUsers)
      .catch(() =>
        getAllUsers()
          .then(setUsers)
          .catch(() => setUsers([])),
      )
      .finally(() => setDetailLoading(false));

    getAllSkills()
      .then(setSkillRecords)
      .catch((error) => {
        setSkillRecords([]);
        setDetailError(error?.message || "Could not load admin details.");
      });
  };

  useEffect(() => {
    if (user?.role === "admin") {
      getAdminSummary().then(setSummary).catch(() => setSummary(null));
      loadAdminDetails();
    }
  }, [user?.role]);

  if (user?.role !== "admin") {
    return (
      <section className="single-panel">
        <h3>Admin access required</h3>
        <p>Your account does not have moderator permissions.</p>
      </section>
    );
  }

  const metrics = summary
    ? [
        { value: summary.users, label: "Total students", view: "students" },
        { value: summary.skills, label: "Skills listed", view: "skills" },
        { value: summary.activeMatches, label: "Active matches" },
        { value: summary.reports, label: "Open reports" },
      ]
    : [
        { value: "...", label: "Total students", view: "students" },
        { value: "...", label: "Skills listed", view: "skills" },
        { value: "...", label: "Active matches" },
        { value: "...", label: "Open reports" },
      ];
  const allSkills = skillRecords.length > 0
    ? skillRecords
        .filter((skill) => skill.owner)
        .map((skill) => ({
          ...skill,
          id: skill.id || skill._id,
          owner: skill.owner,
        }))
    : users.flatMap((member) =>
        (member.skills || []).map((skill) => ({ ...skill, owner: member })),
      );

  const refreshAfterChange = () => {
    loadAdminDetails();
    getAdminSummary().then(setSummary).catch(() => setSummary(null));
  };

  const handleAddUser = async () => {
    const name = window.prompt("Student name");
    if (!name?.trim()) return;
    const email = window.prompt("Student email");
    if (!email?.trim()) return;
    const password = window.prompt("Temporary password (minimum 6 characters)");
    if (!password || password.length < 6) {
        setDetailNotice("Password must be at least 6 characters.");
        return;
    }
    const department = window.prompt("Department", "Student") || "Student";
    try {
        await adminAddUser({ name: name.trim(), email: email.trim(), password, department });
        setDetailNotice("User added.");
        refreshAfterChange();
    } catch (error) {
        setDetailNotice(error.message);
    }
  };

  const handleEditUser = async (member) => {
    const name = window.prompt("Student name", member.name);
    if (name === null) return;
    const email = window.prompt("Student email", member.email);
    if (email === null) return;
    const department = window.prompt("Department", member.department || "Student");
    if (department === null) return;
    try {
        await adminUpdateUser(member.id, {
          name: name.trim(),
          email: email.trim(),
          department: department.trim(),
        });
        setDetailNotice("User updated.");
        refreshAfterChange();
    } catch (error) {
        setDetailNotice(error.message);
    }
  };

  const handleDeleteUser = async (member) => {
    if (!window.confirm(`Delete ${member.name} and all of their account data?`)) return;
    try {
        await adminDeleteUser(member.id);
        setDetailNotice("User deleted.");
        refreshAfterChange();
    } catch (error) {
        setDetailNotice(error.message);
    }
  };

  const handleAddSkill = async (member = null) => {
    let owner = member;
    if (!owner) {
        const ownerEmail = window.prompt("Enter the owner's student email");
        owner = users.find((item) => item.email?.toLowerCase() === ownerEmail?.trim().toLowerCase());
        if (!owner) {
          setDetailNotice("A matching student was not found.");
          return;
        }
    }
    const name = window.prompt(`Skill name for ${owner.name}`);
    if (!name?.trim()) return;
    const category = window.prompt("Category", "Other") || "Other";
    const level = window.prompt("Level: Beginner, Intermediate, or Advanced", "Beginner") || "Beginner";
    const description = window.prompt("Description", "") || "";
    try {
        await adminAddSkill(owner.id, { name: name.trim(), category, level, description });
        setDetailNotice("Skill added.");
        refreshAfterChange();
    } catch (error) {
        setDetailNotice(error.message);
    }
  };

  const handleEditSkill = async (skill) => {
    const name = window.prompt("Skill name", skill.name);
    if (name === null) return;
    const category = window.prompt("Category", skill.category || "Other");
    if (category === null) return;
    const level = window.prompt("Level: Beginner, Intermediate, or Advanced", skill.level || "Beginner");
    if (level === null) return;
    const description = window.prompt("Description", skill.description || "");
    if (description === null) return;
    try {
        await adminUpdateSkill(skill.id || skill._id, {
          name: name.trim(),
          category: category.trim(),
          level,
          description,
        });
        setDetailNotice("Skill updated.");
        refreshAfterChange();
    } catch (error) {
        setDetailNotice(error.message);
    }
  };

  const handleDeleteSkill = async (skill) => {
    if (!window.confirm(`Delete "${skill.name}"?`)) return;
    try {
        await adminDeleteSkill(skill.id || skill._id);
        setDetailNotice("Skill deleted.");
        refreshAfterChange();
    } catch (error) {
        setDetailNotice(error.message);
    }
  };

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
      {metrics.map(({ value, label, view }) => (
        view ? (
          <button
            className={`metric-card metric-card-button${detailView === view ? " active" : ""}`}
            key={label}
            type="button"
            onClick={() => {
              setDetailView(view);
              setDetailModal(view);
            }}
            aria-pressed={detailView === view}
          >
            <span>{label}</span>
            <strong>{value}</strong>
            <small>Open details <ChevronRight size={13} /></small>
          </button>
        ) : (
          <div className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>Updated just now</small>
          </div>
        )
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
      {detailView === "students" && <div className="single-panel admin-users-panel">
        <div className="section-top">
          <div>
            <span className="eyebrow">Community directory</span>
            <h3>User details and skills</h3>
          </div>
          <span className="pill">{users.length} users</span>
        </div>
        {users.length === 0 ? (
          <p className="admin-empty">No user details available yet.</p>
        ) : (
          <div className="admin-users-list">
            {users.map((member) => (
              <article className="admin-user-row" key={member.id}>
                <div className="admin-user-identity">
                  <strong>{member.name}</strong>
                  <span>{member.email}</span>
                  <small>
                    {member.department} · {member.available ? "Available" : "Unavailable"}
                  </small>
                </div>
                <div className="admin-user-details">
                  <p>{member.bio || "No bio provided."}</p>
                  <small>
                    Teaches: {member.teaches?.join(", ") || "None"} · Learns:{" "}
                    {member.learns?.join(", ") || "None"}
                  </small>
                  <small>
                    Contact: {member.whatsapp || "No WhatsApp number"} · Capacity:{" "}
                    {member.mentorCapacity}
                  </small>
                  <small>
                    Availability:{" "}
                    {member.availability?.length
                      ? member.availability
                          .map((slot) => `${slot.day} ${slot.start}-${slot.end}`)
                          .join(", ")
                      : "Not provided"}
                  </small>
                  <div className="admin-skill-list">
                    {member.skills.length > 0 ? (
                      member.skills.map((skill) => (
                        <span className="admin-skill" key={skill.id}>
                          {skill.name} · {skill.category} · {skill.level}
                          {skill.description ? ` · ${skill.description}` : ""}
                        </span>
                      ))
                    ) : (
                      <span className="admin-no-skills">No skills listed</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>}
      {detailView === "skills" && <div className="single-panel admin-users-panel">
        <div className="section-top">
          <div>
            <span className="eyebrow">Skill directory</span>
            <h3>All listed skills</h3>
          </div>
          <span className="pill">{allSkills.length} skills</span>
        </div>
        {allSkills.length === 0 ? (
          <p className="admin-empty">No skills listed yet.</p>
        ) : (
          <div className="admin-skills-list">
            {allSkills.map((skill) => (
              <article className="admin-skill-row" key={skill.id}>
                <div>
                  <strong>{skill.name}</strong>
                  <small>Owned by {skill.owner.name} · {skill.owner.email}</small>
                </div>
                <div className="admin-skill-details">
                  <span>{skill.category} · {skill.level}</span>
                  <p>{skill.description || "No description provided."}</p>
                  <small>
                    Tags: {skill.tags?.join(", ") || "None"} · Learners: {skill.learners}
                  </small>
                  <small>
                    Availability:{" "}
                    {skill.availability?.length
                      ? skill.availability
                          .map((slot) => `${slot.day} ${slot.start}-${slot.end}`)
                          .join(", ")
                      : "Not provided"}
                  </small>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>}
      {detailModal && (
        <div
          className="interaction-modal-backdrop"
          role="presentation"
          onClick={() => setDetailModal(null)}
        >
          <section
            className="interaction-modal admin-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label={detailModal === "students" ? "Student details" : "Skill details"}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="interaction-modal-close"
              onClick={() => setDetailModal(null)}
              aria-label="Close details"
            >
              <span aria-hidden="true">×</span>
            </button>
            <div className="single-panel">
              <span className="eyebrow">
                {detailModal === "students" ? "Student directory" : "Skill directory"}
              </span>
              <h3>
                {detailModal === "students"
                  ? `All students (${users.length})`
                  : `All skills (${allSkills.length})`}
              </h3>
              <div className="admin-detail-toolbar">
                {detailModal === "students" ? (
                  <button type="button" className="admin-action-primary" onClick={handleAddUser}>
                    + Add student
                  </button>
                ) : (
                  <button type="button" className="admin-action-primary" onClick={() => handleAddSkill()}>
                    + Add skill
                  </button>
                )}
              </div>
              {detailNotice && (
                <div className="admin-detail-notice" role="status">
                  {detailNotice}
                  <button type="button" onClick={() => setDetailNotice("")} aria-label="Dismiss">×</button>
                </div>
              )}
              {detailError && (
                <div className="admin-detail-alert" role="alert">
                  <span>{detailError}</span>
                  <button type="button" onClick={loadAdminDetails}>Retry</button>
                </div>
              )}
              {detailLoading ? (
                <p className="admin-empty">Loading details...</p>
              ) : detailModal === "students" ? (
                <div className="admin-modal-list">
                  {users.map((member) => (
                    <article className="admin-modal-item" key={member.id}>
                      <strong>{member.name}</strong>
                      <span>{member.email} · {member.department}</span>
                      <span>{member.bio || "No bio provided."}</span>
                      <span>
                        Teaches: {member.teaches?.join(", ") || "None"} · Learns:{" "}
                        {member.learns?.join(", ") || "None"}
                      </span>
                      <span>
                        Contact: {member.whatsapp || "Not provided"} ·{" "}
                        {member.available ? "Available" : "Unavailable"}
                      </span>
                      <span>
                        Skills: {member.skills?.map((skill) => `${skill.name} (${skill.level})`).join(", ") || "None"}
                      </span>
                      <div className="admin-record-actions">
                        <button type="button" onClick={() => handleAddSkill(member)}>Add skill</button>
                        <button type="button" onClick={() => handleEditUser(member)}>Edit user</button>
                        <button type="button" className="danger" onClick={() => handleDeleteUser(member)}>Delete user</button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="admin-modal-list">
                  {allSkills.map((skill) => (
                    <article className="admin-modal-item" key={skill.id}>
                      <strong>{skill.name}</strong>
                      <span>Owner: {skill.owner.name} · {skill.owner.email}</span>
                      <span>{skill.category} · {skill.level}</span>
                      <span>{skill.description || "No description provided."}</span>
                      <span>
                        Tags: {skill.tags?.join(", ") || "None"} · Learners: {skill.learners}
                      </span>
                      <div className="admin-record-actions">
                        <button type="button" onClick={() => handleEditSkill(skill)}>Edit skill</button>
                        <button type="button" className="danger" onClick={() => handleDeleteSkill(skill)}>Delete skill</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
