"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
      <div style={{ background: "#1a1a1a", padding: "48px", borderRadius: "12px", textAlign: "center", maxWidth: "400px", width: "90%" }}>
        <h1 style={{ color: "white", marginBottom: "8px", fontSize: "24px" }}>Dugger's Ops</h1>
        <p style={{ color: "#888", marginBottom: "32px", fontSize: "14px" }}>Sign in to continue</p>
        <button
          onClick={() => signIn("github", { callbackUrl: "/" })}
          style={{
            background: "#fff",
            color: "#000",
            border: "none",
            padding: "12px 24px",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer",
            width: "100%"
          }}
        >
          Sign in with GitHub
        </button>
      </div>
    </div>
  );
}