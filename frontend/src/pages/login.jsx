import React, { useState } from "react";
import api from "../services/api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/login", { username, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("username", res.data.username);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err?.response?.data?.detail || "Login failed. Please try again.");
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h2 className="login-title">Welcome Back</h2>
            <p className="login-subtitle">Sign in to continue to Dream House Builder</p>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="input-label">Username</label>
              <input
                className="input-field"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="input-label">Password</label>
              <input
                className="input-field"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="error-message">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <button
              className="login-button"
              type="submit"
            >
              Sign In
            </button>

            <div className="signup-link">
              Don't have an account?{" "}
              <a href="/register">
                Sign up
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
