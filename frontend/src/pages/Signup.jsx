import React, { useState } from "react";
import api from "../services/api";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/register", { username, password });
      alert("Account created! Please login.");
      window.location.href = "/login";
    } catch (err) {
      alert(err?.response?.data?.detail || "Signup failed");
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Signup</h2>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input className="border p-2 w-full" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input className="border p-2 w-full" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="bg-green-600 text-white px-4 py-2 rounded" type="submit">Signup</button>
      </form>
    </div>
  );
}
