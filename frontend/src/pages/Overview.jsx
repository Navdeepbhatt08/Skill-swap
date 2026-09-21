import { BookOpen, ChevronRight, Sparkles } from "lucide-react";
import SkillCard from "../components/SkillCard";

export default function Overview({ skills, requests, onRequest, setPage }) {
  return (
    <>
      <section className="hero-grid">
        <div className="hero-card">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-content">
            <span className="hero-kicker">YOUR LEARNING LOOP</span>
            <h2>
              Give a little.
              <br />
              <span>Learn a lot.</span>
            </h2>
            <p>
              Share your skills, meet curious people, and build something better
              together.
            </p>
            <button
              className="dark-button"
              onClick={() => setPage("Discover skills")}
            >
              Explore the community <ChevronRight size={16} />
            </button>
          </div>
          <div className="hero-stat">
            <strong>64</strong>
            <span>
              active exchanges
              <br />
              this month
            </span>
          </div>
        </div>
        <div className="match-card">
          <div className="section-top">
            <div>
              <span className="eyebrow">A good match</span>
              <h3>Made for your goals</h3>
            </div>
            <Sparkles size={20} className="sparkle" />
          </div>
          <div className="match-person">
            <div className="avatar avatar-mint">MC</div>
            <div>
              <strong>Maya Chen</strong>
              <span>
                Can teach <b>UI / UX Design</b>
              </span>
              <span>
                Wants to learn <b>Public Speaking</b>
              </span>
            </div>
            <button
              className="circle-button"
              onClick={() => onRequest("UI / UX Design", "Exchange")}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            className="text-button"
            onClick={() => setPage("My connections")}
          >
            See all matches <ChevronRight size={15} />
          </button>
        </div>
      </section>
      <section className="content-grid">
        <div className="panel">
          <div className="section-top">
            <div>
              <span className="eyebrow">Browse the library</span>
              <h3>Popular skills</h3>
            </div>
            <button
              className="text-button"
              onClick={() => setPage("Discover skills")}
            >
              View all <ChevronRight size={15} />
            </button>
          </div>
          <div className="skill-grid">
            {skills.slice(0, 4).map((skill) => (
              <SkillCard key={skill.id} skill={skill} onRequest={onRequest} />
            ))}
          </div>
        </div>
        <div className="panel activity-panel">
          <div className="section-top">
            <div>
              <span className="eyebrow">Keep the loop going</span>
              <h3>Recent requests</h3>
            </div>
            <button
              className="circle-button pale"
              onClick={() => setPage("Requests")}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {requests.slice(0, 3).map((request) => (
            <div className="activity-row" key={request.id}>
              <div className="activity-icon">
                <BookOpen size={15} />
              </div>
              <div>
                <strong>{request.skill}</strong>
                <span>
                  {request.type} request from {request.from}
                </span>
              </div>
              <small>{request.date}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
