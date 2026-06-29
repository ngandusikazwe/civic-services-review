import { Lock, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import type { Session } from "../types";
import { login } from "../lib/api";

type LoginProps = {
  onLogin: (session: Session) => void;
};

const demoUsers = [
  { label: "Citizen", email: "alice@example.com", password: "password123" },
  { label: "Officer", email: "reviewer@example.com", password: "password123" }
];

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState(demoUsers[0]!.email);
  const [password, setPassword] = useState(demoUsers[0]!.password);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      onLogin(await login(email, password));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">
          <ShieldCheck size={28} />
        </div>
        <h1 id="login-title">Civic Services Review</h1>
        <div className="demo-switcher" aria-label="Demo account">
          {demoUsers.map((demoUser) => (
            <button
              className={email === demoUser.email ? "selected" : ""}
              key={demoUser.email}
              onClick={() => {
                setEmail(demoUser.email);
                setPassword(demoUser.password);
              }}
              type="button"
            >
              {demoUser.label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-action" disabled={loading} type="submit">
            <Lock size={17} />
            {loading ? "Signing in" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
