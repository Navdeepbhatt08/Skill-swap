import { useState } from "react";
import { Bell, Check, X, Clock, ArrowUpRight, ArrowDownLeft, MessageCircle, CalendarClock } from "lucide-react";

// Inline SVG for Gmail brand icon
function GmailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 6.5C2 5.67 2.67 5 3.5 5h17c.83 0 1.5.67 1.5 1.5v11c0 .83-.67 1.5-1.5 1.5h-17C2.67 19 2 18.33 2 17.5v-11z" fill="#fff" stroke="#e5e7eb" strokeWidth="1"/>
      <path d="M2 7l10 7 10-7" stroke="#EA4335" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M2 7l10 7" stroke="#EA4335" strokeWidth="1.5"/>
      <path d="M22 7l-10 7" stroke="#EA4335" strokeWidth="1.5"/>
    </svg>
  );
}

function ContactCard({ label, email, userId, onOpenChat }) {
  // Generate initials from the name label
  const initials = label
    ? label.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const hasAnyContact = email || userId;

  return (
    <div className="contact-card">
      {/* Header — user identity */}
      <div className="contact-card__header">
        <div className="contact-card__avatar">{initials}</div>
        <div className="contact-card__identity">
          <span className="contact-card__name">{label}</span>
          <span className="contact-card__badge">🔓 Connection unlocked</span>
        </div>
      </div>

      {/* Divider */}
      <div className="contact-card__divider" />

      {/* Contact options */}
      <p className="contact-card__prompt">Reach out via:</p>
      <div className="contact-options">
        {/* Gmail option */}
        <a
          href={email ? `mailto:${email}` : undefined}
          className={`contact-option contact-option--gmail${!email ? " contact-option--disabled" : ""}`}
          onClick={!email ? (e) => e.preventDefault() : undefined}
        >
          <div className="contact-option__icon contact-option__icon--gmail">
            <GmailIcon />
          </div>
          <div className="contact-option__body">
            <span className="contact-option__label">Gmail</span>
            <span className="contact-option__value">{email || "Not provided"}</span>
          </div>
          {email && <span className="contact-option__arrow">→</span>}
        </a>

        {/* Chat option */}
        <button
          type="button"
          className={`contact-option contact-option--chat${!userId ? " contact-option--disabled" : ""}`}
          onClick={() => userId && onOpenChat(userId)}
          disabled={!userId}
        >
          <div className="contact-option__icon contact-option__icon--chat">
            <MessageCircle size={20} aria-hidden="true" />
          </div>
          <div className="contact-option__body">
            <span className="contact-option__label">Chat</span>
            <span className="contact-option__value">{userId ? "Start a conversation" : "Not available"}</span>
          </div>
          {userId && <span className="contact-option__arrow">→</span>}
        </button>
      </div>

      {!hasAnyContact && (
        <p className="contact-card__no-info">
          This user hasn't added contact details yet.
        </p>
      )}
    </div>
  );
}


export default function Requests({
  requests,
  currentUserId,
  onAction,
  onOpenChat,
  onOpenSchedule,
  notificationCount = 0,
}) {
  const [loading, setLoading] = useState({});

  const incoming = requests.filter(
    (r) => String(r.toId) === String(currentUserId)
  );
  const outgoing = requests.filter(
    (r) => String(r.fromId) === String(currentUserId)
  );

  const handleAction = async (requestId, status) => {
    setLoading((l) => ({ ...l, [requestId]: status }));
    try {
      await onAction(requestId, status);
    } finally {
      setLoading((l) => ({ ...l, [requestId]: null }));
    }
  };

  const statusClass = (status) =>
    ({
      Pending: "pending",
      Accepted: "accepted",
      Declined: "declined",
      Cancelled: "declined",
    }[status] || "pending");

  return (
    <section className="single-panel requests-panel">
      {notificationCount > 0 && (
        <div className="request-notification" role="status">
          <Bell size={16} />
          <span>
            You have {notificationCount} new {notificationCount === 1 ? "notification" : "notifications"}:
            {" "}new messages or scheduled sessions.
          </span>
        </div>
      )}
      {/* ── Incoming Requests ────────────────────────── */}
      <div className="requests-section">
        <div className="section-top">
          <div>
            <span className="eyebrow">Received</span>
            <h3>
              <ArrowDownLeft size={18} style={{ display: "inline", marginRight: 6 }} />
              Incoming Requests
            </h3>
          </div>
          <span className="pill">{incoming.length} received</span>
        </div>

        {incoming.length === 0 ? (
          <div className="empty-state">No incoming requests yet.</div>
        ) : (
          <div className="request-list">
            {incoming.map((r) => (
              <div key={r.id} className={`request-card request-card--incoming status-${statusClass(r.status)}`}>
                <div className="request-card__header">
                  <div className="request-card__meta">
                    <strong className="request-skill">{r.skill}</strong>
                    <span className="request-type-badge">{r.type}</span>
                  </div>
                  <span className={`status ${statusClass(r.status)}`}>{r.status}</span>
                </div>

                <div className="request-card__body">
                  <span className="request-from">
                    From: <strong>{r.from}</strong>
                  </span>
                  {r.message && <p className="request-message">"{r.message}"</p>}
                  {r.counterProposal?.note && <p className="request-message">Counter-proposal: "{r.counterProposal.note}"</p>}
                  {r.history?.length > 1 && <small className="request-date">History: {r.history.map((item) => item.status).join(" → ")}</small>}
                  <span className="request-date">
                    <Clock size={12} /> {r.date}
                  </span>
                </div>

                {r.status === "Pending" && (
                  <div className="request-actions">
                    <button
                      className="btn-accept"
                      disabled={!!loading[r.id]}
                      onClick={() => handleAction(r.id, "Accepted")}
                    >
                      <Check size={14} />
                      {loading[r.id] === "Accepted" ? "Accepting…" : "Accept"}
                    </button>
                    <button
                      className="btn-decline"
                      disabled={!!loading[r.id]}
                      onClick={() => handleAction(r.id, "Declined")}
                    >
                      <X size={14} />
                      {loading[r.id] === "Declined" ? "Declining…" : "Decline"}
                    </button>
                  </div>
                )}

                {r.status === "Accepted" && (
                  <>
                    <ContactCard label={r.from} email={r.fromEmail} userId={r.fromId} onOpenChat={onOpenChat} />
                    <div className="accepted-tools">
                      <button className="primary-button" onClick={() => onOpenChat(r.fromId)}>
                        <MessageCircle size={15} /> Chat with {r.from}
                      </button>
                      <button className="outline-button" onClick={() => onOpenSchedule(r.fromId, r.skill)}>
                        <CalendarClock size={15} /> Schedule session
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Outgoing Requests ────────────────────────── */}
      <div className="requests-section">
        <div className="section-top">
          <div>
            <span className="eyebrow">Sent</span>
            <h3>
              <ArrowUpRight size={18} style={{ display: "inline", marginRight: 6 }} />
              My Sent Requests
            </h3>
          </div>
          <span className="pill">{outgoing.length} sent</span>
        </div>

        {outgoing.length === 0 ? (
          <div className="empty-state">You haven't sent any requests yet.</div>
        ) : (
          <div className="request-list">
            {outgoing.map((r) => (
              <div key={r.id} className={`request-card request-card--outgoing status-${statusClass(r.status)}`}>
                <div className="request-card__header">
                  <div className="request-card__meta">
                    <strong className="request-skill">{r.skill}</strong>
                    <span className="request-type-badge">{r.type}</span>
                  </div>
                  <span className={`status ${statusClass(r.status)}`}>{r.status}</span>
                </div>

                <div className="request-card__body">
                  <span className="request-from">
                    To: <strong>{r.to}</strong>
                  </span>
                  <span className="request-date">
                    <Clock size={12} /> {r.date}
                  </span>
                </div>

                {r.status === "Accepted" && (
                  <>
                    <ContactCard label={r.to} email={r.toEmail} userId={r.toId} onOpenChat={onOpenChat} />
                    <div className="accepted-tools">
                      <button className="primary-button" onClick={() => onOpenChat(r.toId)}>
                        <MessageCircle size={15} /> Chat with {r.to}
                      </button>
                      <button className="outline-button" onClick={() => onOpenSchedule(r.toId, r.skill)}>
                        <CalendarClock size={15} /> Schedule session
                      </button>
                    </div>
                  </>
                )}

                {r.status === "Pending" && (
                  <div className="request-actions">
                    <button className="btn-decline" disabled={!!loading[r.id]} onClick={() => handleAction(r.id, "Cancelled")}>
                      <X size={14} /> {loading[r.id] === "Cancelled" ? "Cancelling…" : "Cancel request"}
                    </button>
                  </div>
                )}

                {r.status === "Declined" && (
                  <div className="declined-note">
                    Your request was declined. Try reaching out to someone else!
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
