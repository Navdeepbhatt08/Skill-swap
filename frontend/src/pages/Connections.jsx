import { ChevronRight } from "lucide-react";

export default function Connections({ users, onRequest }) {
  return (
    <section className="single-panel">
      <div className="section-top">
        <div>
          <span className="eyebrow">People like you</span>
          <h3>Potential connections</h3>
        </div>
      </div>
      <div className="people-grid">
        {users.map((user) => (
          <article className="person-card" key={user.id}>
            <div className="person-top">
              <div className="avatar avatar-peach">{user.avatar}</div>
              <span className={user.available ? "online" : "offline"}>
                {user.available ? "Available" : "Away"}
              </span>
            </div>
            <h4>{user.name}</h4>
            <p>{user.role}</p>
            <div className="tag-row">
              {user.teaches.map((skill) => (
                <span className="tag teach" key={skill}>
                  Teaches {skill}
                </span>
              ))}
              {user.learns.map((skill) => (
                <span className="tag learn" key={skill}>
                  Learns {skill}
                </span>
              ))}
            </div>
            <button
              className="outline-button"
              onClick={() => onRequest(user.teaches[0], "Exchange")}
            >
              Start an exchange <ChevronRight size={15} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
