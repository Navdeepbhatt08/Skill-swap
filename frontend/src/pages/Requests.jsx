export default function Requests({ requests }) {
  return (
    <section className="single-panel">
      <div className="section-top">
        <div>
          <span className="eyebrow">Your activity</span>
          <h3>Requests & exchanges</h3>
        </div>
        <span className="pill">{requests.length} total</span>
      </div>
      <div className="request-table">
        <div className="table-head">
          <span>Skill</span>
          <span>Person</span>
          <span>Type</span>
          <span>Status</span>
          <span>Date</span>
        </div>
        {requests.map((request) => (
          <div className="table-row" key={request._id || request.id}>
            <strong>{request.skill}</strong>
            <span>{request.from}</span>
            <span>{request.type}</span>
            <span className={`status ${request.status.toLowerCase()}`}>
              {request.status}
            </span>
            <span>{request.date}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
