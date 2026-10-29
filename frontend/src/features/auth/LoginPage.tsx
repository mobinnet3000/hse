import { ShieldCheck, Lock, User, ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ApiRequestError } from "../../services/api";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "ورود ناموفق بود. دوباره تلاش کنید.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <div className="auth-logo-badge">
          <ShieldCheck size={36} className="auth-logo-icon" />
        </div>
        <h1>ورود به HSE Guard</h1>
        <p className="muted">سامانه هوشمند پایش و مدیریت ایمنی، بهداشت و محیط‌زیست</p>

        <div className="form-group">
          <label htmlFor="username">
            <span className="form-label-icon"><User size={14} /></span>
            نام کاربری
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            placeholder="مثال: admin"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">
            <span className="form-label-icon"><Lock size={14} /></span>
            رمز عبور
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="auth-submit-btn" disabled={submitting}>
          {submitting ? "در حال ورود…" : "ورود"}
          {!submitting && <ArrowLeft size={16} />}
        </button>
      </form>
    </div>
  );
}
