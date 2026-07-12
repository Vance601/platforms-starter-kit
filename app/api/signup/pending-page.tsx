export default function PendingPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", padding: 24 }}>
      <div style={{ background: "#1a1a1a", padding: 48, borderRadius: 12, textAlign: "center", maxWidth: 440, width: "100%" }}>
        <h1 style={{ color: "#fff", fontSize: 22, marginBottom: 10 }}>Access pending</h1>
        <p style={{ color: "#999", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Your account is signed in, but it is not yet linked to an organization.
          Access is granted by invitation. If you were expecting access, please
          contact your administrator to be added.
        </p>
        <a
          href="/api/auth/signout"
          style={{ color: "#7ab7ff", fontSize: 14, textDecoration: "none" }}
        >
          Sign out
        </a>
      </div>
    </div>
  );
}
