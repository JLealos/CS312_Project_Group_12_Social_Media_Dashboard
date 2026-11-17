import { useState } from "react";

function Login({ onLogin, onSwitchToRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-logo">S</div>
        <h1>Welcome back</h1>
        <p>Sign in to manage your social media accounts.</p>

        {error && <div className="auth-error">{error}</div>}

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
        />

        <button className="auth-submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div className="auth-switch">
          Don't have an account?{" "}
          <button type="button" onClick={onSwitchToRegister}>
            Create one
          </button>
        </div>
      </form>
    </div>
  );
}

export default Login;