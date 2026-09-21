import { Plus } from "lucide-react";

export default function Profile({ user, onRequest }) {
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
          <button className="outline-button">Edit profile</button>
        </div>
        <div className="profile-section">
          <span className="eyebrow">About</span>
          <p>
            Curious builder and lifelong learner. I love turning messy problems
            into simple, useful products.
          </p>
        </div>
        <div className="profile-section">
          <span className="eyebrow">I can teach</span>
          <div className="profile-tags">
                {user.teaches.map((skill) => (
              <span className="profile-tag" key={skill}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="single-panel want-panel">
        <span className="eyebrow">I want to learn</span>
        <h3>What is next?</h3>
            {user.learns.map((skill) => (
          <div className="want-row" key={skill}>
            <span>{skill}</span>
            <button className="circle-button" onClick={() => onRequest(skill)}>
              <Plus size={15} />
            </button>
          </div>
        ))}
        <button className="text-button add-learning">
          + Add a learning goal
        </button>
      </div>
    </section>
  );
}
