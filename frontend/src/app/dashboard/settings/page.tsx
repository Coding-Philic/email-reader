"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const { data } = await api.getPreferences();
      setPrefs(data);
    } catch (err) {
      console.error("Failed to load preferences:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: string, value: boolean) => {
    try {
      setPrefs((p: any) => ({ ...p, [key]: value }));
      await api.updatePreferences({ [key]: value });
    } catch (err) {
      console.error("Failed to update preference:", err);
      // Revert on error
      setPrefs((p: any) => ({ ...p, [key]: !value }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.updatePreferences({
        quiet_hours_start: prefs.quiet_hours_start,
        quiet_hours_end: prefs.quiet_hours_end,
        quiet_hours_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        custom_ai_instructions: prefs.custom_ai_instructions,
      });
      alert("Preferences saved successfully!");
    } catch (err) {
      console.error("Failed to save preferences:", err);
      alert("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const generateTelegramCode = async () => {
    try {
      const { data } = await api.generateTelegramCode();
      setTelegramCode(data.code);
    } catch (err) {
      console.error("Failed to generate code:", err);
      alert("Failed to generate verification code");
    }
  };

  const disconnectTelegram = async () => {
    if (!confirm("Are you sure you want to disconnect Telegram?")) return;
    try {
      await api.disconnectTelegram();
      await loadPreferences();
    } catch (err) {
      console.error("Failed to disconnect:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ height: "400px" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage your account and preferences</p>
      </div>

      <div className="grid-2 gap-xl">
        <div className="flex-col gap-xl">
          {/* Custom AI Instructions */}
          <div className="card" style={{ border: "1px solid var(--color-primary-20)", background: "linear-gradient(145deg, var(--bg-card), rgba(124, 58, 237, 0.03))" }}>
            <div className="card-header">
              <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>✨</span> Custom AI Instructions & Rules
              </h2>
              <div className="card-subtitle">
                Teach your AI assistant exactly how to treat specific emails, when to reply, and what tone to use.
              </div>
            </div>
            
            <div className="settings-section" style={{ borderBottom: "none", paddingBottom: 0, marginTop: "var(--space-sm)" }}>
              <div style={{ marginBottom: "var(--space-sm)", fontSize: "0.85rem", color: "var(--text-muted)", background: "var(--bg-secondary)", padding: "var(--space-sm) var(--space-md)", borderRadius: "var(--radius-sm)" }}>
                <b>💡 Examples you can try:</b>
                <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                  <li><i>"If an email is from my professor or college dean, always reply immediately acknowledging receipt and alert me on Telegram."</i></li>
                  <li><i>"Ignore any promotional emails with 'Discount' or 'Offer' in the subject."</i></li>
                  <li><i>"When replying to interview invitations or recruiters, politely state that I am excited and available for morning interviews."</i></li>
                </ul>
              </div>
              <textarea
                className="input"
                rows={5}
                placeholder="Type your custom rules for the AI here..."
                value={prefs?.custom_ai_instructions || ""}
                onChange={(e) => setPrefs({ ...prefs, custom_ai_instructions: e.target.value })}
                style={{ width: "100%", fontFamily: "inherit", fontSize: "0.95rem", lineHeight: "1.5", resize: "vertical", padding: "var(--space-md)" }}
              />
              <button 
                className="btn btn-primary" 
                style={{ marginTop: "var(--space-md)", width: "100%", justifyContent: "center" }}
                disabled={saving}
                onClick={async () => {
                  try {
                    setSaving(true);
                    await api.updatePreferences({ custom_ai_instructions: prefs?.custom_ai_instructions });
                    alert("✨ Custom AI instructions saved! The AI will now follow these rules on all new emails.");
                  } catch (e: any) {
                    alert("❌ Failed to save custom AI instructions: " + (e.message || "Unknown error"));
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Saving Rules..." : "Save Custom AI Instructions"}
              </button>
            </div>
          </div>

          {/* General Settings */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">General Preferences</h2>
            </div>
            
            <div className="settings-section">
              <div className="settings-row">
                <div>
                  <div className="settings-label">Auto-Reply Enabled</div>
                  <div className="settings-description">
                    Allow the AI to automatically send draft replies for approved categories
                  </div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={prefs?.auto_reply_enabled || false}
                    onChange={(e) =>
                      handleToggle("auto_reply_enabled", e.target.checked)
                    }
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Quiet Hours</h2>
              <div className="card-subtitle">Pause Telegram notifications during these hours</div>
            </div>
            
            <form onSubmit={handleSave} className="flex-col gap-md" style={{ marginTop: "var(--space-md)" }}>
              <div className="grid-2">
                <div>
                  <label className="settings-label" style={{ display: "block", marginBottom: "var(--space-xs)" }}>Start Time</label>
                  <input
                    type="time"
                    className="input"
                    value={prefs?.quiet_hours_start || ""}
                    onChange={(e) => setPrefs({ ...prefs, quiet_hours_start: e.target.value })}
                  />
                </div>
                <div>
                  <label className="settings-label" style={{ display: "block", marginBottom: "var(--space-xs)" }}>End Time</label>
                  <input
                    type="time"
                    className="input"
                    value={prefs?.quiet_hours_end || ""}
                    onChange={(e) => setPrefs({ ...prefs, quiet_hours_end: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Quiet Hours"}
              </button>
            </form>
          </div>
        </div>

        <div className="flex-col gap-xl">
          {/* Telegram Integration */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Telegram Integration</h2>
            </div>
            
            <div className="settings-section" style={{ borderBottom: "none" }}>
              {prefs?.telegram_connected ? (
                <div className="flex-col gap-md">
                  <div className="badge badge-success" style={{ alignSelf: "flex-start" }}>
                    Connected
                  </div>
                  <p className="settings-description">
                    Connected as: <strong>@{prefs.telegram_username}</strong>
                  </p>
                  
                  <div className="settings-row" style={{ padding: 0, marginTop: "var(--space-sm)" }}>
                    <div>
                      <div className="settings-label">Enable Notifications</div>
                      <div className="settings-description">Receive alerts for important emails</div>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={prefs?.telegram_enabled || false}
                        onChange={(e) =>
                          handleToggle("telegram_enabled", e.target.checked)
                        }
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <button
                    onClick={disconnectTelegram}
                    className="btn btn-danger"
                    style={{ marginTop: "var(--space-md)" }}
                  >
                    Disconnect Telegram
                  </button>
                </div>
              ) : (
                <div className="flex-col gap-md">
                  <p className="settings-description">
                    Connect your Telegram account to receive instant notifications for job offers, internships, and important emails.
                  </p>
                  
                  {!telegramCode ? (
                    <button
                      onClick={generateTelegramCode}
                      className="btn btn-primary"
                    >
                      Connect Telegram
                    </button>
                  ) : (
                    <div className="flex-col gap-md" style={{ marginTop: "var(--space-sm)" }}>
                      <p className="settings-description">
                        1. Open Telegram and search for <strong>@InReaderBot</strong> (or <a href="https://t.me/InReaderBot" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)", textDecoration: "underline" }}>click here</a>)
                        <br />
                        2. Send the following code to the bot:
                      </p>
                      <div className="verification-code">
                        {telegramCode}
                      </div>
                      <button
                        onClick={loadPreferences}
                        className="btn btn-secondary"
                      >
                        I've sent the code
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Gmail Push Notifications</h2>
            </div>
            <div className="settings-section" style={{ borderBottom: "none", paddingBottom: 0 }}>
              <p className="settings-description" style={{ marginBottom: "var(--space-md)" }}>
                Activate or renew Google Cloud Pub/Sub real-time email processing for your connected Gmail account.
              </p>
              <button 
                className="btn btn-primary" 
                onClick={async () => {
                  try {
                    await api.startGmailWatch();
                    alert("✅ Gmail push notifications activated successfully! You can now receive emails live.");
                  } catch (e: any) {
                    alert("❌ Failed to activate Gmail watch: " + (e.message || "Unknown error"));
                  }
                }}
              >
                Activate & Verify Gmail Push
              </button>
            </div>
          </div>
          
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Danger Zone</h2>
            </div>
            <div className="settings-section" style={{ borderBottom: "none", paddingBottom: 0 }}>
              <p className="settings-description" style={{ marginBottom: "var(--space-md)" }}>
                Disconnect your Gmail account and delete all stored tokens. This will stop the AI from processing your emails.
              </p>
              <button 
                className="btn btn-danger" 
                onClick={async () => {
                  if (confirm("Disconnect Gmail? This cannot be undone.")) {
                    try {
                      await api.disconnectGmail();
                      window.location.href = "/";
                    } catch (e) {
                      alert("Failed to disconnect");
                    }
                  }
                }}
              >
                Disconnect Gmail
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
