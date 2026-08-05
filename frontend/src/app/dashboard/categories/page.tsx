"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data } = await api.getCategories();
      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRuleChange = async (categoryId: string, field: string, value: any) => {
    // Optimistic update
    setCategories((cats) =>
      cats.map((c) => {
        if (c.id === categoryId) {
          const rules = c.category_rules[0] || { action: 'notify', notify_telegram: false };
          return {
            ...c,
            category_rules: [{ ...rules, [field]: value }],
          };
        }
        return c;
      })
    );

    try {
      const cat = categories.find(c => c.id === categoryId);
      const rules = cat.category_rules[0] || { action: 'notify', notify_telegram: false };
      
      await api.updateCategoryRule(categoryId, {
        action: field === 'action' ? value : rules.action,
        notifyTelegram: field === 'notify_telegram' ? value : rules.notify_telegram,
        autoReplyTemplate: rules.auto_reply_template,
      });
    } catch (err) {
      console.error("Failed to update rule:", err);
      // Revert on error by reloading
      loadCategories();
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    
    try {
      await api.deleteCategory(categoryId);
      setCategories(cats => cats.filter(c => c.id !== categoryId));
    } catch (err: any) {
      alert(err.message || "Failed to delete category");
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
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Categories & Rules</h1>
          <p className="page-description">Manage how the AI handles different types of emails</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Action</th>
                <th>Telegram Alert</th>
                <th>Template</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const rules = cat.category_rules?.[0] || { action: 'notify', notify_telegram: false, auto_reply_template: null };
                
                return (
                  <tr key={cat.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                        <div 
                          className="category-dot" 
                          style={{ backgroundColor: cat.color || "var(--accent)" }} 
                        />
                        <div>
                          <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                            {cat.name}
                            {cat.is_system && (
                              <span className="badge badge-neutral" style={{ marginLeft: "var(--space-sm)", fontSize: "10px" }}>System</span>
                            )}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: 2 }}>
                            {cat.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select 
                        className="select"
                        value={rules.action}
                        onChange={(e) => handleRuleChange(cat.id, 'action', e.target.value)}
                        style={{ width: "130px" }}
                      >
                        <option value="reply">Reply</option>
                        <option value="ignore">Ignore</option>
                        <option value="notify">Notify</option>
                        <option value="categorize">Categorize</option>
                      </select>
                    </td>
                    <td>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={rules.notify_telegram}
                          onChange={(e) => handleRuleChange(cat.id, 'notify_telegram', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </td>
                    <td>
                      {rules.action === 'reply' ? (
                        <button className="btn btn-ghost btn-sm">Edit Template</button>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>N/A</span>
                      )}
                    </td>
                    <td>
                      {!cat.is_system && (
                        <button 
                          className="btn btn-ghost btn-sm"
                          style={{ color: "var(--error)" }}
                          onClick={() => handleDelete(cat.id)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
