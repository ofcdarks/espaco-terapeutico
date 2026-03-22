// ============================================================
// API Client — replaces Firebase SDK calls
// Drop this into: frontend/src/lib/api.ts
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || '';

// ── Token management ────────────────────────────────────────

let accessToken: string | null = localStorage.getItem('accessToken');
let refreshToken: string | null = localStorage.getItem('refreshToken');
let onAuthError: (() => void) | null = null;

export function setAuthErrorHandler(handler: () => void) {
  onAuthError = handler;
}

function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export function getAccessToken() {
  return accessToken;
}

export function isLoggedIn() {
  return !!accessToken;
}

// ── Core fetch with auto-refresh ────────────────────────────

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken || !accessToken) return false;

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.Authorization = `Bearer ${accessToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } else {
      onAuthError?.();
      throw new Error('Sessão expirada. Faça login novamente.');
    }
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Erro ${res.status}`);
  }

  return data as T;
}

// ── Auth API ────────────────────────────────────────────────

export interface AuthUser {
  isAdmin?: boolean;
  id: string;
  name: string;
  email: string;
  category: string;
  role?: string;
  phone?: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  async register(name: string, email: string, password: string, category = 'psicologo') {
    const data = await apiFetch<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, category }),
    });
    setTokens(data.accessToken, data.refreshToken);
    return data.user;
  },

  async login(email: string, password: string) {
    const data = await apiFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setTokens(data.accessToken, data.refreshToken);
    return data.user;
  },

  async logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      clearTokens();
    }
  },

  async me() {
    return apiFetch<AuthUser>('/api/auth/me');
  },

  async updateProfile(updates: Partial<AuthUser>) {
    return apiFetch<AuthUser>('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
};

// ── Generic CRUD factory (matches backend pattern) ──────────

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function createCrudApi<T extends { id: string }>(basePath: string) {
  return {
    async list(params?: { search?: string; page?: number; limit?: number }) {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      const qs = query.toString();
      return apiFetch<PaginatedResponse<T>>(`${basePath}${qs ? '?' + qs : ''}`);
    },

    async getById(id: string) {
      return apiFetch<T>(`${basePath}/${id}`);
    },

    async create(data: Omit<T, 'id' | 'ownerId' | 'createdAt'>) {
      return apiFetch<T>(basePath, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async update(id: string, data: Partial<T>) {
      return apiFetch<T>(`${basePath}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async remove(id: string) {
      return apiFetch<void>(`${basePath}/${id}`, { method: 'DELETE' });
    },
  };
}

// ── Entity APIs ─────────────────────────────────────────────

export const patientsApi = createCrudApi<any>('/api/patients');
export const appointmentsApi = createCrudApi<any>('/api/appointments');
export const recordsApi = createCrudApi<any>('/api/records');
export const transactionsApi = createCrudApi<any>('/api/transactions');
export const packagesApi = createCrudApi<any>('/api/packages');
export const documentsApi = createCrudApi<any>('/api/documents');
export const patientGroupsApi = createCrudApi<any>('/api/patient-groups');
export const patientRelationshipsApi = createCrudApi<any>('/api/patient-relationships');

// ── Appointments extras ─────────────────────────────────────

export const appointmentExtras = {
  async getByRange(start: string, end: string) {
    return apiFetch<any[]>(`/api/appointments/range?start=${start}&end=${end}`);
  },
  async getToday() {
    return apiFetch<any[]>('/api/appointments/today');
  },
};

// ── Dashboard ───────────────────────────────────────────────

export const dashboardApi = {
  async getStats() {
    return apiFetch<any>('/api/dashboard/stats');
  },
  async getRevenueChart() {
    return apiFetch<any[]>('/api/dashboard/revenue-chart');
  },
};

// ── AI Analysis ─────────────────────────────────────────────

export const aiApi = {
  async analyzeSession(data: {
    transcription: string;
    patientName: string;
    sessionDuration: number;
    previousNotes?: string;
  }) {
    return apiFetch<any>('/api/ai/analyze-session', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ── Push notifications ──────────────────────────────────────

export const pushApi = {
  async getVapidKey() {
    return apiFetch<{ publicKey: string }>('/api/push/vapid-key');
  },
  async subscribe(subscription: PushSubscription) {
    const json = subscription.toJSON();
    return apiFetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
      }),
    });
  },
  async unsubscribe(endpoint: string) {
    return apiFetch('/api/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint }),
    });
  },
};

// ── P1 FIX: Password reset API ─────────────────────────────
authApi.forgotPassword = async function(email: string) {
  return apiFetch<any>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

authApi.resetPassword = async function(token: string, newPassword: string) {
  return apiFetch<any>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
};

// ── Appointment extras ──────────────────────────────────────
appointmentExtras.checkConflict = async function(date: string, time: string, duration: number, excludeId?: string) {
  const q = new URLSearchParams({ date, time, duration: String(duration) });
  if (excludeId) q.set('excludeId', excludeId);
  return apiFetch<{ hasConflict: boolean; conflictWith: string | null }>(`/api/appointments/check-conflict?${q}`);
};
appointmentExtras.createRecurring = async function(data: any) {
  return apiFetch<any[]>('/api/appointments/recurring', { method: 'POST', body: JSON.stringify(data) });
};
appointmentExtras.conclude = async function(id: string) {
  return apiFetch<{ ok: boolean; transactionCreated: boolean }>(`/api/appointments/${id}/conclude`, { method: 'POST' });
};

// ── Notifications API ───────────────────────────────────────
export const notificationsApi = {
  async list(limit = 20, unreadOnly = false) { return apiFetch<any[]>(`/api/notifications?limit=${limit}&unreadOnly=${unreadOnly}`); },
  async unreadCount() { return apiFetch<{ count: number }>('/api/notifications/unread-count'); },
  async markRead(id: string) { return apiFetch('/api/notifications/' + id + '/read', { method: 'PATCH' }); },
  async markAllRead() { return apiFetch('/api/notifications/read-all', { method: 'POST' }); },
};

// ── WhatsApp API ────────────────────────────────────────────
export const whatsappApi = {
  async getConfig() { return apiFetch<any>('/api/whatsapp/config'); },
  async saveConfig(data: any) { return apiFetch('/api/whatsapp/config', { method: 'POST', body: JSON.stringify(data) }); },
  async send(phone: string, message: string) { return apiFetch('/api/whatsapp/send', { method: 'POST', body: JSON.stringify({ phone, message }) }); },
  async sendReminder(appointmentId: string) { return apiFetch('/api/whatsapp/send-reminder/' + appointmentId, { method: 'POST' }); },
};

// ── LGPD API ────────────────────────────────────────────────
export const lgpdApi = {
  async addConsent(patientId: string, type: string) { return apiFetch('/api/lgpd/consent', { method: 'POST', body: JSON.stringify({ patientId, type }) }); },
  async getConsents(patientId: string) { return apiFetch<any[]>(`/api/lgpd/consent/${patientId}`); },
  async revokeConsent(id: string) { return apiFetch(`/api/lgpd/consent/${id}/revoke`, { method: 'PATCH' }); },
  async exportData(patientId: string) { return apiFetch<any>(`/api/lgpd/export/${patientId}`); },
  async deleteAllData(patientId: string) { return apiFetch(`/api/lgpd/patient/${patientId}`, { method: 'DELETE' }); },
};

// ── Document Templates API ──────────────────────────────────
export const templatesApi = createCrudApi<any>('/api/document-templates');
export const documentGenApi = {
  async generate(data: any) { return apiFetch<any>('/api/documents/generate', { method: 'POST', body: JSON.stringify(data) }); },
  getPrintUrl(id: string) { return `${API_BASE}/api/documents/${id}/print`; },
};

// ── Admin API ───────────────────────────────────────────────
export const adminApi = {
  async stats() { return apiFetch<any>('/api/admin/stats'); },
  async listUsers(page = 1) { return apiFetch<any>(`/api/admin/users?page=${page}&limit=50`); },
  async updateUser(id: string, data: any) { return apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); },
  async deleteUser(id: string) { return apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' }); },
  async listPlans() { return apiFetch<any[]>('/api/admin/plans'); },
  async createPlan(data: any) { return apiFetch('/api/admin/plans', { method: 'POST', body: JSON.stringify(data) }); },
  async updatePlan(id: string, data: any) { return apiFetch(`/api/admin/plans/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); },
  async deletePlan(id: string) { return apiFetch(`/api/admin/plans/${id}`, { method: 'DELETE' }); },
  async assignSubscription(data: any) { return apiFetch('/api/admin/subscriptions', { method: 'POST', body: JSON.stringify(data) }); },
  async getConfig() { return apiFetch<Record<string, string>>('/api/admin/config'); },
  async saveConfig(data: Record<string, string>) { return apiFetch('/api/admin/config', { method: 'PUT', body: JSON.stringify(data) }); },
};

// ── Transcription API ───────────────────────────────────────
export const transcriptionApi = {
  async save(data: { appointmentId?: string; patientId?: string; patientName?: string; transcript: string; duration?: number; provider?: string }) {
    return apiFetch<any>('/api/transcription/save', { method: 'POST', body: JSON.stringify(data) });
  },
  async list(patientId?: string) { return apiFetch<any[]>(`/api/transcription${patientId ? '?patientId=' + patientId : ''}`); },
  async get(id: string) { return apiFetch<any>(`/api/transcription/${id}`); },
  async analyze(id: string) { return apiFetch<any>(`/api/transcription/${id}/analyze`, { method: 'POST' }); },
  async generateReport(id: string) { return apiFetch<any>(`/api/transcription/${id}/report`, { method: 'POST' }); },
  async dowsub(data: { audioUrl?: string; text?: string }) { return apiFetch<any>('/api/transcription/downsub', { method: 'POST', body: JSON.stringify(data) }); },
};

// ── CSV Import/Export API ───────────────────────────────────
export const csvApi = {
  exportPatientsUrl: () => `${API_BASE}/api/csv/export/patients`,
  exportAppointmentsUrl: (start?: string, end?: string) => `${API_BASE}/api/csv/export/appointments${start ? '?start=' + start + '&end=' + end : ''}`,
  exportTransactionsUrl: () => `${API_BASE}/api/csv/export/transactions`,
  async importPatients(csv: string) { return apiFetch<{ ok: boolean; imported: number }>('/api/csv/import/patients', { method: 'POST', body: JSON.stringify({ csv }) }); },
};

// ── Stripe API ──────────────────────────────────────────────
export const stripeApi = {
  async checkout(planId: string) { return apiFetch<{ url: string }>('/api/stripe/checkout', { method: 'POST', body: JSON.stringify({ planId }) }); },
  async portal() { return apiFetch<{ url: string }>('/api/stripe/portal', { method: 'POST' }); },
  async getSubscription() { return apiFetch<any>('/api/stripe/subscription'); },
  async getPlans() { return apiFetch<any[]>('/api/plans'); },
};

// ── Portal API ──────────────────────────────────────────────
export const portalApi = {
  async getLink(patientId: string) { return apiFetch<{ url: string; token: string }>(`/api/portal/link/${patientId}`); },
};

// ── 2FA API ─────────────────────────────────────────────────
export const twofaApi = {
  async setup() { return apiFetch<{ secret: string; qrCode: string }>('/api/auth/2fa/setup', { method: 'POST' }); },
  async verify(token: string) { return apiFetch('/api/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ token }) }); },
  async disable(token: string) { return apiFetch('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ token }) }); },
};

export const contractsApi = createCrudApi<any>('/api/contracts');
export const contractTemplatesApi = createCrudApi<any>('/api/contract-templates');
export const contractExtras = {
  async getDefaults() { return apiFetch<any[]>('/api/contract-templates/defaults'); },
  async generate(data: any) { return apiFetch<any>('/api/contracts/generate', { method: 'POST', body: JSON.stringify(data) }); },
  async sign(id: string, data: { patientName: string; cpf: string }) { return apiFetch('/api/contracts/' + id + '/sign', { method: 'POST', body: JSON.stringify(data) }); },
  async getPublic(id: string) { return apiFetch<any>('/api/contracts/' + id + '/public'); },
  getPrintUrl(id: string) { return `${API_BASE}/api/contracts/${id}/print`; },
};
