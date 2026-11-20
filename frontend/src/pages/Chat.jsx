import { useEffect, useMemo, useRef, useState } from "react";
import { FileUp, Link2, MessageCircle, Search, Send, ShieldCheck, X } from "lucide-react";
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
  const [contactSearch, setContactSearch] = useState("");
  const [connected, setConnected] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const endRef = useRef(null);
  const socketRef = useRef(null);

  const filteredConnections = useMemo(() => {
    const normalized = contactSearch.trim().toLowerCase();
    return connections.filter((user) => !normalized || `${user.name} ${user.department}`.toLowerCase().includes(normalized));
  }, [connections, contactSearch]);

  useEffect(() => {
    const socket = io(socketUrl, {
      auth: { token: localStorage.getItem("skillswap_token") },
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      setConnected(true);
      setError("");
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => {
      setConnected(false);
      setError(err.message);
    });
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
    setLoadingMessages(true);
    getMessages(selected.id).then((next) => {
      if (active) {
        setMessages(next);
        socketRef.current?.emit("chat:read", selected.id);
      }
    }).catch((err) => active && setError(err.message))
      .finally(() => active && setLoadingMessages(false));
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

  const initials = (user) => user?.avatar || user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
  const formatMessageTime = (date) => new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const messageDay = (date) => new Date(date).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

  return (
    <section className="single-panel chat-layout">
      <aside className="chat-people">
        <div className="chat-sidebar-heading">
          <div>
            <span className="eyebrow">Your network</span>
            <h3>Messages</h3>
          </div>
          <span className="chat-count">{connections.length}</span>
        </div>
        <div className="chat-search">
          <Search size={16} aria-hidden="true" />
          <input value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" />
        </div>
        <div className="chat-people-list">
          {connections.length === 0 ? (
            <div className="chat-empty-sidebar">
              <span className="chat-empty-icon"><MessageCircle size={20} /></span>
              <strong>No conversations yet</strong>
              <p>Accept an exchange request to start chatting.</p>
            </div>
          ) : filteredConnections.length === 0 ? (
            <p className="chat-no-results">No conversations match your search.</p>
          ) : filteredConnections.map((user) => (
            <button key={user.id} className={`chat-person ${selected?.id === user.id ? "active" : ""}`} onClick={() => setSelected(user)}>
              <span className="chat-person-avatar avatar avatar-peach">{initials(user)}<i className="chat-online-dot" /></span>
              <span className="chat-person-copy">
                <strong>{user.name}</strong>
                <small>{user.exchangeSkills?.join(", ") || user.department || "SkillSwap learner"}</small>
              </span>
              {selected?.id === user.id && <span className="chat-active-indicator" />}
            </button>
          ))}
        </div>
        <div className="chat-sidebar-footer"><ShieldCheck size={14} /> Private student-to-student chat</div>
      </aside>
      <div className="chat-window">
        {selected ? (
          <>
            <header className="chat-header">
              <div className="chat-header-identity">
                <span className="chat-header-avatar avatar avatar-mint">{initials(selected)}<i className="chat-online-dot" /></span>
                <div>
                  <strong>{selected.name}</strong>
                  <span>{selected.exchangeSkills?.join(", ") || selected.department || "SkillSwap learner"} <b>·</b> <em>{connected ? "Online" : "Connecting..."}</em></span>
                </div>
              </div>
              <span className="chat-header-context">{selected.exchangeSkills?.join(" · ") || "Skill exchange"}</span>
            </header>
            <div className="chat-messages">
              <div className="chat-welcome">
                <strong>Your conversation with {selected.name}</strong>
                <p>Messages and shared resources stay between the two of you.</p>
              </div>
              {loadingMessages ? <div className="chat-loading"><span /><span /><span /></div> : messages.length === 0 ? (
                <div className="chat-no-messages"><p>No messages yet</p><span>Say hello and start your learning exchange.</span></div>
              ) : messages.map((message, index) => {
                const mine = String(message.from) === String(currentUserId);
                const showDay = index === 0 || messageDay(messages[index - 1].createdAt) !== messageDay(message.createdAt);
                return (
                  <div key={message.id}>
                    {showDay && <div className="chat-day-divider"><span>{messageDay(message.createdAt)}</span></div>}
                    <div className={`chat-message-row ${mine ? "mine" : ""}`}>
                      <div className={`chat-bubble ${mine ? "mine" : ""}`}>
                        {message.text && <span className="chat-message-text">{message.text}</span>}
                        {message.resource?.url && (
                          <a className="chat-resource" href={resourceUrl(message.resource.url)} target="_blank" rel="noreferrer">
                            <span>
                              <strong>{message.resource.label || "Shared resource"}</strong>
                              <small>{message.resource.kind === "file" ? "Shared file" : message.resource.url}</small>
                            </span>
                          </a>
                        )}
                        <small className="chat-message-time">{formatMessageTime(message.createdAt)} {mine && "· You"}</small>
                      </div>
                    </div>
                  </div>
                );
              })}
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
              <input value={text} onChange={(event) => setText(event.target.value)} placeholder={uploading ? "Uploading resource..." : `Message ${selected.name}...`} maxLength={2000} aria-label="Message" disabled={uploading} />
              <span className="chat-character-count">{text.length}/2000</span>
              <button className="primary-button chat-send-button" type="submit" disabled={uploading || (!text.trim() && !resource.url.trim())}><Send size={16} /> Send</button>
            </form>
          </>
        ) : <div className="chat-no-selection"><span className="chat-no-selection-icon"><MessageCircle size={30} /></span><h3>Select a conversation</h3><p>Choose a connected learner to view your exchange.</p></div>}
        {error && <p className="form-error">{error}</p>}
      </div>
    </section>
  );
}
