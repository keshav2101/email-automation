import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Inject auth token & handle FormData multipart boundary
api.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('hr-auth');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        const token = data?.state?.token;
        if (token) config.headers.Authorization = `Bearer ${token}`;
      } catch {}
    }
  }
  return config;
});

// Handle 401
api.interceptors.response.use(
  (r) => r,
  (error) => {
    return Promise.reject(error);
  }
);

// --- Auth ---
export const authApi = {
  register: (data: { full_name: string; email: string; password: string }) =>
    api.post('/auth/register', data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data).then((r) => r.data),
};

// --- User ---
export const userApi = {
  getMe: () => api.get('/users/me').then((r) => r.data),
  updateMe: (data: object) => api.patch('/users/me', data).then((r) => r.data),
  getSignature: () => api.get('/users/signature').then((r) => r.data),
  saveSignature: (data: object) => api.post('/users/signature', data).then((r) => r.data),
  previewSignature: (data: object) => api.post('/users/signature/preview', data).then((r) => r.data),
};

// --- Candidates ---
export const candidateApi = {
  getProfile: () => api.get('/candidates/profile').then((r) => r.data),
  updateProfile: (data: object) => api.patch('/candidates/profile', data).then((r) => r.data),
  uploadResume: (file: File, label: string) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/candidates/resume/upload?label=${encodeURIComponent(label)}`, form).then((r) => r.data);
  },
  listResumes: () => api.get('/candidates/resumes').then((r) => r.data),
  reparseResume: (resumeId?: number) =>
    api.post('/candidates/profile/reparse', null, { params: { resume_id: resumeId } }).then((r) => r.data),
};

// --- Companies ---
export const companyApi = {
  list: (params?: object) => api.get('/companies/', { params }).then((r) => r.data),
  create: (data: object) => api.post('/companies/', data).then((r) => r.data),
  get: (id: number) => api.get(`/companies/${id}`).then((r) => r.data),
  update: (id: number, data: object) => api.patch(`/companies/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/companies/${id}`).then((r) => r.data),
};

// --- HR Contacts ---
export const contactApi = {
  list: (params?: object) => api.get('/contacts/', { params }).then((r) => r.data),
  create: (data: object) => api.post('/contacts/', data).then((r) => r.data),
  update: (id: number, data: object) => api.patch(`/contacts/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/contacts/${id}`).then((r) => r.data),
};

// --- Research ---
export const researchApi = {
  run: (company_id: number) =>
    api.post('/research/', { company_id }).then((r) => r.data),
  get: (company_id: number) =>
    api.get(`/research/${company_id}`).then((r) => r.data),
};

// --- Email Drafts ---
export const draftApi = {
  generate: (data: object) => api.post('/drafts/generate', data).then((r) => r.data),
  list: (params?: object) => api.get('/drafts/', { params }).then((r) => r.data),
  get: (id: number) => api.get(`/drafts/${id}`).then((r) => r.data),
  update: (id: number, data: object) => api.patch(`/drafts/${id}`, data).then((r) => r.data),
  approve: (id: number) => api.post(`/drafts/${id}/approve`).then((r) => r.data),
  delete: (id: number) => api.delete(`/drafts/${id}`).then((r) => r.data),
};

// --- Gmail ---
export const gmailApi = {
  getAuthUrl: () => api.get('/gmail/auth-url').then((r) => r.data),
  disconnect: () => api.post('/gmail/disconnect').then((r) => r.data),
  pushDraft: (draftId: number) =>
    api.post(`/gmail/drafts/${draftId}/push-to-gmail`).then((r) => r.data),
  send: (draftId: number) =>
    api.post(`/gmail/drafts/${draftId}/send`).then((r) => r.data),
};

// --- Analytics ---
export const analyticsApi = {
  getDashboard: () => api.get('/analytics/dashboard').then((r) => r.data),
};

// --- Campaigns ---
export const campaignApi = {
  list: () => api.get('/campaigns/').then((r) => r.data),
  create: (data: object) => api.post('/campaigns/', data).then((r) => r.data),
  get: (id: number) => api.get(`/campaigns/${id}`).then((r) => r.data),
};

// --- Follow-ups ---
export const followupApi = {
  list: (params?: object) => api.get('/followups/', { params }).then((r) => r.data),
  schedule: (data: object) => api.post('/followups/schedule', data).then((r) => r.data),
  cancel: (id: number) => api.post(`/followups/${id}/cancel`).then((r) => r.data),
};

// --- Jobs ---
export const jobApi = {
  list: (params?: { company_id?: number }) => api.get('/jobs/', { params }).then((r) => r.data),
  create: (data: object) => api.post('/jobs/', data).then((r) => r.data),
  get: (id: number) => api.get(`/jobs/${id}`).then((r) => r.data),
  delete: (id: number) => api.delete(`/jobs/${id}`).then((r) => r.data),
};

// --- Batch Automation ---
export const batchApi = {
  validateSheet: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/batch/validate-sheet', form).then((r) => r.data);
  },
  processBatch: (data: { rows: any[]; skip_duplicates: boolean; skip_invalid: boolean; style?: string }) =>
    api.post('/batch/process', data).then((r) => r.data),
  dispatchBatch: (data: { draft_ids: number[]; delay_seconds?: number; max_daily_limit?: number }) =>
    api.post('/batch/dispatch', data).then((r) => r.data),
  getTemplateUrl: () => `${API_URL}/batch/sample-template`,
};

// --- Data Extractor (Excel / CSV) ---
export const extractorApi = {
  extractData: (file: File, sheetName?: string, maxPreviewRows?: number) => {
    const form = new FormData();
    form.append('file', file);
    const params: Record<string, any> = {};
    if (sheetName) params.sheet_name = sheetName;
    if (maxPreviewRows) params.max_preview_rows = maxPreviewRows;
    return api.post('/extractor/extract', form, { params }).then((r) => r.data);
  },
  importCrm: (data: {
    rows: any[];
    mapping: Record<string, string>;
    create_companies?: boolean;
    create_contacts?: boolean;
    create_jobs?: boolean;
    default_priority?: string;
  }) => api.post('/extractor/import-crm', data).then((r) => r.data),
  exportCleaned: async (rows: any[], format: 'csv' | 'json' = 'csv') => {
    const response = await api.post(`/extractor/export-cleaned?export_format=${format}`, rows, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], {
      type: format === 'json' ? 'application/json' : 'text/csv',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `extracted_data.${format}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

// --- Email Plugin (SMTP / Providers) ---
export const emailPluginApi = {
  getStatus: () => api.get('/email-plugin/status').then((r) => r.data),
  testConnection: (data: {
    provider?: string;
    host?: string;
    port?: number;
    email?: string;
    username?: string;
    password?: string;
    use_tls?: boolean;
  }) => api.post('/email-plugin/test-connection', data).then((r) => r.data),
  connectSmtp: (data: {
    provider: string;
    email: string;
    password?: string;
    from_name?: string;
    custom_host?: string;
    custom_port?: number;
    use_tls?: boolean;
    test_before_saving?: boolean;
  }) => api.post('/email-plugin/connect-smtp', data).then((r) => r.data),
  disconnect: () => api.post('/email-plugin/disconnect').then((r) => r.data),
  sendTestEmail: (toEmail?: string) =>
    api.post('/email-plugin/send-test', { to_email: toEmail }).then((r) => r.data),
};

// --- Bulk Automation Engine ---
export const bulkAutomationApi = {
  start: (data: {
    draft_ids: number[];
    delay_seconds?: number;
    random_jitter?: number;
    daily_limit?: number;
    max_failures?: number;
    dry_run?: boolean;
  }) => api.post('/bulk-automation/start', data).then((r) => r.data),
  getJobStatus: (jobId: string) => api.get(`/bulk-automation/jobs/${jobId}`).then((r) => r.data),
  cancelJob: (jobId: string) => api.post(`/bulk-automation/jobs/${jobId}/cancel`).then((r) => r.data),
  getHistory: () => api.get('/bulk-automation/history').then((r) => r.data),
};

export default api;

