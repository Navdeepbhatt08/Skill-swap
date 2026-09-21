import { useState } from "react";
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { login, register, saveSession } from "../services/api";

export default function Login({ onLogin, onClose }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", department: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setError(""); setLoading(true);
    try {
      const result = mode === "login" ? await login(form.email, form.password) : await register(form);
      saveSession(result); onLogin(result.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return <main className={onClose ? "auth-screen auth-overlay" : "auth-screen"}><section className="auth-card">
    {onClose && <button className="modal-close" onClick={onClose} aria-label="Close login">×</button>}
    <div className="brand auth-brand"><span className="brand-mark"><Sparkles size={16} /></span><span>skill<span className="brand-accent">swap</span></span></div>
    <span className="eyebrow">THE CAMPUS CIRCLE</span>
    <h1>Learn together.<br /><em>Grow further.</em></h1>
    <p className="auth-copy">A simple place to exchange the skills you have for the ones you want next.</p>
    <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button></div>
    <form onSubmit={submit}>
      {mode === "register" && <input name="name" value={form.name} onChange={update} placeholder="Full name" required />}
      <input name="email" type="email" value={form.email} onChange={update} placeholder="College email" required />
      <input name="password" type="password" minLength="6" value={form.password} onChange={update} placeholder="Password" required />
      {mode === "register" && <input name="department" value={form.department} onChange={update} placeholder="Department" />}
      {error && <p className="auth-error">{error}</p>}
      <button className="primary-button auth-submit" disabled={loading}>{loading ? "Connecting..." : mode === "login" ? "Enter SkillSwap" : "Create my profile"} <ArrowRight size={17} /></button>
    </form>
    {mode === "login" && <p className="demo-login"><LockKeyhole size={14} /> Demo: aarav@skillswap.app / demo1234</p>}
  </section></main>;
}