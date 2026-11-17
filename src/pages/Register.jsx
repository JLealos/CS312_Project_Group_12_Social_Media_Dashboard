import { useState } from "react";

function Register({ onRegister, onSwitchToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      await onRegister(name, email, password);
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
        <h1>Create an account</h1>
        <p>Set up your SocialHub dashboard.</p>

        {error && <div className="auth-error">{error}</div>}

        <label>Full Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          required
        />

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
          placeholder="At least 8 characters"
          minLength="8"
          required
        />

        <button className="auth-submit" disabled={loading}>
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <div className="auth-switch">
          Already have an account?{" "}
          <button type="button" onClick={onSwitchToLogin}>
            Sign in
          </button>
        </div>
      </form>
    </div>
  );
}

export default Register;