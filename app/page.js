"use client";

import { useState } from "react";

const BRIGHT_COLORS = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#00c7be", "#0a84ff", "#5856d6", "#ff2d55"];

export default function Home() {
  const [color] = useState(() => BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)]);

  return (
    <main
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        fontSize: "4rem",
        fontWeight: "bold",
        color,
      }}
    >
      HELLO WORLD
    </main>
  );
}
