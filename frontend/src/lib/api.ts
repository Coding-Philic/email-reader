
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

async function getAuthHeaders(): Promise<Record<string, string>> {
  // We dynamically import to avoid SSR issues
  const { createClient } = await import('./supabase/client');
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  getProfile: () => apiRequest<{ data: any }>('/auth/profile'),
  connectGmail: (tokens: { access_token: string, refresh_token: string, expiry_date?: string, scopes?: string[] }) => 
    apiRequest('/auth/gmail/connect', { method: 'POST', body: JSON.stringify(tokens) }),
  disconnectGmail: () => apiRequest('/auth/disconnect', { method: 'POST' }),
  startGmailWatch: () => apiRequest<{ message: string }>('/auth/gmail/watch', { method: 'POST' }),

  // Analytics
  getDashboardStats: (period: string = 'today') =>
    apiRequest<{ data: any }>(`/analytics/dashboard?period=${period}`),
  getEmailVolume: (period: string = 'week') =>
    apiRequest<{ data: any }>(`/analytics/volume?period=${period}`),
  getTopSenders: (limit: number = 10) =>
    apiRequest<{ data: any }>(`/analytics/top-senders?limit=${limit}`),

  // Categories
  getCategories: () => apiRequest<{ data: any[] }>('/categories'),
  updateCategoryRule: (id: string, rule: any) =>
    apiRequest(`/categories/${id}/rule`, {
      method: 'PUT',
      body: JSON.stringify(rule),
    }),
  updateCategoryOrder: (orderedIds: string[]) =>
    apiRequest('/categories/order', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    }),
  deleteCategory: (id: string) =>
    apiRequest(`/categories/${id}`, { method: 'DELETE' }),

  // Preferences
  getPreferences: () => apiRequest<{ data: any }>('/preferences'),
  updatePreferences: (updates: any) =>
    apiRequest('/preferences', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  generateTelegramCode: () =>
    apiRequest<{ data: { code: string } }>('/preferences/telegram/code', {
      method: 'POST',
    }),
  disconnectTelegram: () =>
    apiRequest('/preferences/telegram', { method: 'DELETE' }),
};
