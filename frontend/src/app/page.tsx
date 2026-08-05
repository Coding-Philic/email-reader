"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push("/dashboard");
      } else {
        setLoading(false);
      }
    });
  }, [router]);

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="landing-container">
      <nav className="landing-nav">
        <div className="landing-brand">Email Reader AI</div>
        <button
          className="btn btn-primary"
          onClick={() => router.push("/login")}
        >
          Get Started
        </button>
      </nav>

      <section className="landing-hero">
        <h1>
          Your inbox, managed by <span>AI</span>
        </h1>
        <p>
          Stop wasting hours on email. Our AI agent reads, classifies, and
          responds to your emails automatically. Get instant Telegram
          notifications for job offers and important messages. Works with any
          Gmail account -- zero setup required.
        </p>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => router.push("/login")}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          Continue with Google
        </button>
      </section>

      <section className="landing-features">
        <div className="feature-card">
          <div
            className="feature-icon"
            style={{
              backgroundColor: "rgba(124, 58, 237, 0.15)",
              color: "var(--accent)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h3>AI Classification</h3>
          <p>
            Every email is automatically classified into categories like Job
            Offers, Personal, Marketing, and more. New categories are discovered
            dynamically.
          </p>
        </div>

        <div className="feature-card">
          <div
            className="feature-icon"
            style={{
              backgroundColor: "rgba(34, 197, 94, 0.15)",
              color: "var(--success)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <h3>Smart Auto-Reply</h3>
          <p>
            The AI drafts contextual replies for important emails. Review them or
            enable auto-send per category. Your communication style, preserved.
          </p>
        </div>

        <div className="feature-card">
          <div
            className="feature-icon"
            style={{
              backgroundColor: "rgba(59, 130, 246, 0.15)",
              color: "var(--info)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
            </svg>
          </div>
          <h3>Telegram Alerts</h3>
          <p>
            Get instant notifications on Telegram for job offers, internships,
            and critical emails. Connect in seconds with a verification code.
          </p>
        </div>

        <div className="feature-card">
          <div
            className="feature-icon"
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              color: "var(--warning)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </div>
          <h3>Live Dashboard</h3>
          <p>
            Real-time analytics showing email volume, category distribution, and
            agent actions. Track daily, weekly, and yearly trends at a glance.
          </p>
        </div>

        <div className="feature-card">
          <div
            className="feature-icon"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "var(--error)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h3>Enterprise Security</h3>
          <p>
            AES-256 token encryption, Row-Level Security on all data,
            rate limiting, and zero-knowledge architecture. Your data stays
            yours.
          </p>
        </div>

        <div className="feature-card">
          <div
            className="feature-icon"
            style={{
              backgroundColor: "rgba(20, 184, 166, 0.15)",
              color: "var(--cat-transactional)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.36 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </div>
          <h3>Fully Customizable</h3>
          <p>
            Define rules per category: reply, ignore, or notify. Set quiet hours,
            notification frequency, and auto-reply templates. Your inbox, your
            rules.
          </p>
        </div>
      </section>

      <footer className="landing-footer">
        Email Reader AI. Built for productivity.
      </footer>
    </div>
  );
}
