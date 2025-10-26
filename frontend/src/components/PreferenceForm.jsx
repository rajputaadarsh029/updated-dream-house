// src/components/PreferenceForm.jsx
import React, { useState } from "react";
import api from "../services/api";

export default function PreferenceForm({ onGenerated }) {
  const [description, setDescription] = useState("");
  const [mood, setMood] = useState("cozy");
  const [bedrooms, setBedrooms] = useState(2);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api.post("/design", { description, mood, bedrooms });
      if (onGenerated) onGenerated(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to generate layout. Check backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 bg-white rounded shadow">
      <label className="block text-sm font-medium">Description</label>
      <textarea className="border p-2 w-full mb-2" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      <label className="block text-sm font-medium">Mood</label>
      <input className="border p-1 w-full mb-2" value={mood} onChange={(e) => setMood(e.target.value)} />
      <label className="block text-sm font-medium">Bedrooms</label>
      <input type="number" className="border p-1 w-full mb-3" value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value))} />
      <button onClick={generate} className="px-3 py-1 bg-green-600 text-white rounded">{loading ? "Working..." : "Generate Layout"}</button>
    </div>
  );
}
