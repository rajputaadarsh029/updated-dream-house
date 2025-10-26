import React from "react";

export default function Room({ name, size }) {
  return (
    <div className="p-3 border rounded-lg bg-white shadow">
      <h3 className="font-bold">{name}</h3>
      <p>Size: {size} sq ft</p>
    </div>
  );
}
