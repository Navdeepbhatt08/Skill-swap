import { useEffect, useState } from "react";
import { CalendarClock, Check, X } from "lucide-react";
import { createReview, createSession, getConnections, getSessions, updateSessionStatus } from "../services/api";

function formatDate(value) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function Schedule({ currentUserId, initialUserId, initialSkill = "" }) {
  const [connections, setConnections] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState({ recipientId: "", skill: "", title: "", description: "", startAt: "", endAt: "" });
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });

  const load = () => Promise.all([getConnections(), getSessions()]).then(([users, nextSessions]) => {
    setConnections(users);
    setSessions(nextSessions);
    setForm((current) => ({
      ...current,
      recipientId: initialUserId || current.recipientId || users[0]?.id || "",
      skill: current.skill || initialSkill,
    }));
  }).catch((err) => setError(err.message));

  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    try {
      const session = await createSession(form);
      setSessions((current) => [...current, session].sort((a, b) => new Date(a.startAt) - new Date(b.startAt)));
      setForm((current) => ({ ...current, skill: "", startAt: "", endAt: "" }));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  const update = async (id, status) => {
    try {
      const updated = await updateSessionStatus(id, status);
      setSessions((current) => current.map((session) => session.id === id ? updated : session));
    } catch (err) {
      setError(err.message);
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    try {
      const review = await createReview(reviewing.id, reviewForm.rating, reviewForm.comment);
      setSessions((current) => current.map((session) => (
        session.id === reviewing.id
          ? { ...session, reviewed: true, reviews: [...(session.reviews || []), review] }
          : session
      )));
      setReviewing(null);
      setReviewForm({ rating: 5, comment: "" });
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="single-panel schedule-panel">
      <div className="section-top"><div><span className="eyebrow">Learning together</span><h3>Schedule a session</h3></div></div>
      <form className="schedule-form" onSubmit={submit}>
        <label>Connection<select required value={form.recipientId} onChange={(e) => setForm({ ...form, recipientId: e.target.value })}><option value="">Select a connection</option>{connections.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
        <label>Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Session title" /></label>
        <label>Skill<input required value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })} placeholder="e.g. JavaScript" /></label>
        <label className="schedule-description">Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} placeholder="What will you cover?" /></label>
        <label>Starts<input required type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></label>
        <label>Ends<input required type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></label>
        <button className="primary-button" type="submit"><CalendarClock size={16} /> Request session</button>
      </form>
      {error && <p className="form-error">{error}</p>}
      <div className="session-list">
        {sessions.length === 0 ? <p className="empty-state">No sessions scheduled yet.</p> : sessions.map((session) => {
          const incoming = String(session.recipient) === String(currentUserId);
          return <article className="session-card" key={session.id}>
            <div><strong>{session.skill}</strong><p>{incoming ? `From ${session.requesterName}` : `With ${session.recipientName}`}</p><time>{formatDate(session.startAt)} - {new Date(session.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
            <span className={`status ${session.status.toLowerCase()}`}>{session.status}</span>
            {session.reviews?.length > 0 && (
              <div className="session-ratings" aria-label="Session ratings">
                {session.reviews.map((review) => (
                  <span className="session-rating" key={review.id}>
                    <span className="review-stars" aria-hidden="true">
                      {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                    </span>
                    <span>{review.rating}/5 by {review.reviewerName}</span>
                  </span>
                ))}
              </div>
            )}
            {session.status === "Pending" && incoming && <div className="request-actions"><button className="btn-accept" onClick={() => update(session.id, "Accepted")}><Check size={14} /> Accept</button><button className="btn-decline" onClick={() => update(session.id, "Declined")}><X size={14} /> Decline</button></div>}
            {session.status === "Accepted" && <button className="outline-button" onClick={() => update(session.id, "Completed")}>Mark completed</button>}
            {session.status === "Completed" && !session.reviewed && (
              <button className="outline-button" onClick={() => setReviewing(session)}>Rate exchange</button>
            )}
          </article>;
        })}
      </div>
      {reviewing && (
        <form className="review-form" onSubmit={submitReview}>
          <div className="section-top">
            <div><span className="eyebrow">Build trust</span><h3>How was this exchange?</h3></div>
            <button type="button" className="text-button" onClick={() => setReviewing(null)}>Cancel</button>
          </div>
          <label>Rating
            <select value={reviewForm.rating} onChange={(event) => setReviewForm({ ...reviewForm, rating: Number(event.target.value) })}>
              {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{"★".repeat(rating)} ({rating}/5)</option>)}
            </select>
          </label>
          <label>Review
            <textarea maxLength={500} value={reviewForm.comment} onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })} placeholder="Share a helpful note about the session" />
          </label>
          <button className="primary-button" type="submit">Submit review</button>
        </form>
      )}
    </section>
  );
}
