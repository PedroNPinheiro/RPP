import { useState } from "react";

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export function Login({ error }: { error?: boolean }) {
  const [hasLogo, setHasLogo] = useState(true);
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          {hasLogo ? (
            <img src="/logo.png" alt="CASCO" onError={() => setHasLogo(false)} />
          ) : (
            <span className="brand-mark login-mark">RP</span>
          )}
        </div>

        <h1 className="login-title">Replacement Parts</h1>
        <p className="login-sub">Sign in with your company account to continue.</p>

        {error && (
          <div className="login-error">Sign-in was cancelled or failed. Please try again.</div>
        )}

        <a className="ms-btn" href="/auth/login">
          <MicrosoftLogo />
          <span>Sign in with Microsoft</span>
        </a>

        <div className="login-foot">
          <span className="dot" /> Live from Sage X3
        </div>
      </div>
    </div>
  );
}
