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
        <h1>ورود به HSE Guard</h1>
        <p className="muted">برای ادامه، نام کاربری و رمز عبور خود را وارد کنید.</p>

        <label htmlFor="username">نام کاربری</label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />

        <label htmlFor="password">رمز عبور</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? "در حال ورود…" : "ورود"}
        </button>
      </form>
    </div>
  );
}
