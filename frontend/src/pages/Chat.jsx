import { useEffect, useRef, useState } from "react";
import { FileUp, Link2, MessageCircle, Send, X } from "lucide-react";
import { io } from "socket.io-client";
import { getConnections, getMessages, uploadResource } from "../services/api";

const socketUrl = (import.meta.env.VITE_API_URL || window.location.origin)
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");

function resourceUrl(url) {
  return url?.startsWith("/") ? `${socketUrl}${url}` : url;
}

export default function Chat({ currentUserId, initialUserId }) {
  const [connections, setConnections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [resource, setResource] = useState({ label: "", url: "" });
  const [showResource, setShowResource] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(socketUrl, {
      auth: { token: localStorage.getItem("skillswap_token") },
    });
    socketRef.current = socket;
    socket.on("connect_error", (err) => setError(err.message));
    socket.on("chat:message", (message) => {
      setSelected((currentSelected) => {
        if (
          currentSelected &&
          [String(message.from), String(message.to)].includes(String(currentSelected.id))
        ) {
          setMessages((currentMessages) =>
            currentMessages.some((currentMessage) => String(currentMessage.id) === String(message.id))
              ? currentMessages
              : [...currentMessages, message],
          );
        }
        return currentSelected;
      });
    });

    getConnections().then((users) => {
      setConnections(users);
      setSelected((current) => current || users.find((user) => String(user.id) === String(initialUserId)) || users[0] || null);
    }).catch((err) => setError(err.message));
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [initialUserId]);

  useEffect(() => {
    if (!selected) return undefined;
    setText("");
    setResource({ label: "", url: "" });
    setShowResource(false);
    let active = true;
    getMessages(selected.id).then((next) => {
      if (active) {
        setMessages(next);
        socketRef.current?.emit("chat:read", selected.id);
      }
    }).catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [selected]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = async (event) => {
    event.preventDefault();
    if (!selected || (!text.trim() && !resource.url.trim())) return;
    try {
      socketRef.current?.emit(
        "chat:send",
        {
          toUserId: selected.id,
          text,
          resource: resource.url.trim() ? resource : undefined,
        },
        (result) => {
          if (!result?.ok) {
            setError(result?.message || "Could not send message.");
            return;
          }
          setText("");
          setResource({ label: "", url: "" });
          setShowResource(false);
          setError("");
        },
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const selectFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await uploadResource(file);
      setResource(result.resource);
      setShowResource(true);
    } catch (err) {
      setError(err.message || "Could not upload file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="single-panel chat-layout">
      <aside className="chat-people">
        <div className="section-top"><div><span className="eyebrow">Connected learners</span><h3>Conversations</h3></div></div>
        {connections.length === 0 ? <p className="empty-state">Accept a request to start chatting.</p> : connections.map((user) => (
          <button key={user.id} className={`chat-person ${selected?.id === user.id ? "active" : ""}`} onClick={() => setSelected(user)}>
            <span className="avatar avatar-peach">{user.avatar}</span>
            <span><strong>{user.name}</strong><small>{user.department}</small></span>
          </button>
        ))}
      </aside>
      <div className="chat-window">
        {selected ? (
          <>
            <header className="chat-header"><MessageCircle size={18} /><strong>{selected.name}</strong></header>
            <div className="chat-messages">
              {messages.map((message) => (
                <div key={message.id} className={`chat-bubble ${String(message.from) === String(currentUserId) ? "mine" : ""}`}>
                  {message.text && <span>{message.text}</span>}
                  {message.resource && (
                    <a className="chat-resource" href={resourceUrl(message.resource.url)} target="_blank" rel="noreferrer">
                      {message.resource.kind === "file" ? <FileUp size={15} /> : <Link2 size={15} />}
                      <span>
                        <strong>{message.resource.label}</strong>
                        <small>{message.resource.url}</small>
                      </span>
                    </a>
                  )}
                  <small>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <form className="chat-compose" onSubmit={submit}>
              {showResource && (
                <div className="chat-resource-fields">
                  <input value={resource.label} onChange={(event) => setResource((current) => ({ ...current, label: event.target.value }))} placeholder="Resource title (optional)" maxLength={120} aria-label="Resource title" />
                  {resource.kind === "file" ? (
                    <span className="chat-uploaded-file"><FileUp size={15} /> {resource.fileName}</span>
                  ) : (
                    <input value={resource.url} onChange={(event) => setResource((current) => ({ ...current, url: event.target.value }))} placeholder="Paste a resource link..." type="url" maxLength={2048} aria-label="Resource URL" />
                  )}
                  <button className="icon-button" type="button" onClick={() => { setResource({ label: "", url: "" }); setShowResource(false); }} aria-label="Remove resource"><X size={16} /></button>
                </div>
              )}
              <label className="icon-button" title="Upload a resource file" aria-label="Upload a resource file">
                <FileUp size={17} />
                <input className="visually-hidden" type="file" onChange={selectFile} disabled={uploading} />
              </label>
              <button className={`icon-button ${showResource ? "active" : ""}`} type="button" onClick={() => setShowResource((current) => !current)} aria-label="Share a resource" title="Share a resource"><Link2 size={17} /></button>
              <input value={text} onChange={(event) => setText(event.target.value)} placeholder={uploading ? "Uploading resource..." : "Write a message..."} maxLength={2000} aria-label="Message" disabled={uploading} />
              <button className="primary-button" type="submit" disabled={uploading}><Send size={16} /> Send</button>
            </form>
          </>
        ) : <p className="empty-state">No conversation selected.</p>}
        {error && <p className="form-error">{error}</p>}
      </div>
    </section>
  );
}
