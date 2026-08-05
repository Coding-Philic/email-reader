"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DashboardPage() {
  const [period, setPeriod] = useState("today");
  const [stats, setStats] = useState<any>(null);
  const [volume, setVolume] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsRes, volumeRes] = await Promise.all([
          api.getDashboardStats(period),
          api.getEmailVolume(period === "today" ? "week" : period),
        ]);
        setStats(statsRes.data);
        setVolume(volumeRes.data);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // In a real app we'd setup SSE here, but polling works for this demo
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [period]);

  if (loading && !stats) {
    return (
      <div className="flex-center" style={{ height: "400px" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Overview of your email automation</p>
        </div>
        <div className="period-selector">
          {["today", "week", "month", "year"].map((p) => (
            <button
              key={p}
              className={`period-btn ${period === p ? "active" : ""}`}
              onClick={() => setPeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-5" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="stat-card">
          <div className="stat-label">Total Emails</div>
          <div className="stat-value">{stats?.totalToday || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Replied</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {stats?.totalReplied || 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Notified</div>
          <div className="stat-value" style={{ color: "var(--info)" }}>
            {stats?.totalNotified || 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Categorized</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>
            {stats?.totalCategorized || 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ignored</div>
          <div className="stat-value" style={{ color: "var(--cat-marketing)" }}>
            {stats?.totalIgnored || 0}
          </div>
        </div>
      </div>

      <div className="grid-2 gap-xl">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Email Volume</h2>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volume} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} />
                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Category Breakdown</h2>
          </div>
          <div className="flex-col gap-sm">
            {stats?.categoryBreakdown?.map((cat: any) => (
              <div key={cat.slug} className="category-bar">
                <div
                  className="category-dot"
                  style={{ backgroundColor: cat.color || "var(--accent)" }}
                />
                <div className="category-info">
                  <div className="category-name">{cat.name}</div>
                </div>
                <div className="category-count">{cat.count} emails</div>
              </div>
            ))}
            {(!stats?.categoryBreakdown || stats.categoryBreakdown.length === 0) && (
              <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: "var(--space-xl) 0" }}>
                No category data available yet
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "var(--space-xl)" }}>
        <div className="card-header">
          <h2 className="card-title">Recent Activity</h2>
        </div>
        <div className="flex-col">
          {stats?.recentActions?.map((action: any) => (
            <div key={action.id} className="activity-item">
              <div className={`activity-icon ${action.action_type}`}>
                {action.action_type === "reply" && "↩️"}
                {action.action_type === "ignore" && "🗑️"}
                {action.action_type === "notify" && "🔔"}
                {action.action_type === "categorize" && "📁"}
                {action.action_type === "create_category" && "✨"}
              </div>
              <div className="activity-content">
                <div className="activity-title">
                  {action.action_type === "create_category"
                    ? `Discovered new category: ${action.details?.categoryName}`
                    : action.email?.subject || "Unknown Email"}
                </div>
                <div className="activity-meta">
                  {action.email?.sender_name && `From: ${action.email.sender_name} • `}
                  Status: {action.status} •{" "}
                  {new Date(action.executed_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          {(!stats?.recentActions || stats.recentActions.length === 0) && (
            <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: "var(--space-xl) 0" }}>
              No recent activity
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
