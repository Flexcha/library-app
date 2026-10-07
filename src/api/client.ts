const API_BASE = '/api/v1';

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details: any[];

  constructor(message: string, code = 'ERROR', statusCode = 500, details: any[] = []) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

let isRefreshingToken = false;
let tokenRefreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  tokenRefreshSubscribers.push(cb);
}

function onTokenRefreshed(token: string) {
  tokenRefreshSubscribers.forEach((cb) => cb(token));
  tokenRefreshSubscribers = [];
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 Automatic Token Refresh
  if (res.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      if (!isRefreshingToken) {
        isRefreshingToken = true;
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshBody = await refreshRes.json();
            const newAccess = refreshBody.data.accessToken;
            const newRefresh = refreshBody.data.refreshToken;
            localStorage.setItem('accessToken', newAccess);
            localStorage.setItem('refreshToken', newRefresh);
            isRefreshingToken = false;
            onTokenRefreshed(newAccess);
          } else {
            isRefreshingToken = false;
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
          }
        } catch {
          isRefreshingToken = false;
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }

      const retryToken = await new Promise<string>((resolve) => {
        subscribeTokenRefresh((newToken) => resolve(newToken));
      });

      if (retryToken) {
        headers['Authorization'] = `Bearer ${retryToken}`;
        res = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers,
        });
      }
    }
  }

  if (res.status === 204) {
    return null as any;
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = body.error || {};
    throw new ApiError(
      error.message || 'Something went wrong',
      error.code || 'UNKNOWN_ERROR',
      res.status,
      error.details || []
    );
  }

  return body.data as T;
}


function cleanQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const clean: Record<string, string> = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      clean[k] = String(v);
    }
  });
  const q = new URLSearchParams(clean).toString();
  return q ? `?${q}` : '';
}

export const api = {
  // Auth
  register: (data: any) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => request<{ accessToken: string; refreshToken: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  refresh: (refreshToken: string) => request('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  logout: (refreshToken?: string) => request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  me: () => request('/auth/me'),

  // Users
  getUsers: (params?: Record<string, any>) => request(`/users${cleanQuery(params)}`),
  getUser: (id: number) => request(`/users/${id}`),
  createUser: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: number, data: any) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateUserStatus: (id: number, status: string) => request(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateUserRole: (id: number, role: string) => request(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  deleteUser: (id: number) => request(`/users/${id}`, { method: 'DELETE' }),

  // Books & Catalog
  getBooks: (params?: Record<string, any>) => request(`/books${cleanQuery(params)}`),
  getBook: (id: number) => request(`/books/${id}`),
  createBook: (data: any) => request('/books', { method: 'POST', body: JSON.stringify(data) }),
  updateBook: (id: number, data: any) => request(`/books/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBook: (id: number) => request(`/books/${id}`, { method: 'DELETE' }),

  // Book Copies
  getBookCopies: (bookId: number) => request(`/books/${bookId}/copies`),
  addBookCopy: (bookId: number, data: any) => request(`/books/${bookId}/copies`, { method: 'POST', body: JSON.stringify(data) }),
  updateCopyStatus: (copyId: number, status: string) => request(`/copies/${copyId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Authors, Categories, Publishers
  getAuthors: () => request('/authors'),
  createAuthor: (data: any) => request('/authors', { method: 'POST', body: JSON.stringify(data) }),
  getCategories: () => request('/categories'),
  createCategory: (data: any) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: number, data: any) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: number) => request(`/categories/${id}`, { method: 'DELETE' }),
  getPublishers: () => request('/publishers'),
  createPublisher: (data: any) => request('/publishers', { method: 'POST', body: JSON.stringify(data) }),

  // Circulation
  checkout: (data: { memberId: number; bookCopyId: number }) => request('/loans', { method: 'POST', body: JSON.stringify(data) }),
  returnLoan: (loanId: number) => request(`/loans/${loanId}/return`, { method: 'PATCH' }),
  updateLoanStatus: (loanId: number, status: string) => request(`/loans/${loanId}/${status === 'RETURNED' ? 'return' : 'status'}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  renewLoan: (loanId: number) => request(`/loans/${loanId}/renew`, { method: 'POST' }),
  getLoans: (params?: Record<string, any>) => request(`/loans${cleanQuery(params)}`),
  reportLost: (loanId: number, data?: { type?: string; fineAmount?: number }) =>
    request(`/loans/${loanId}/lost`, { method: 'POST', body: JSON.stringify(data || {}) }),

  // Reservations
  createReservation: (bookId: number) => request('/reservations', { method: 'POST', body: JSON.stringify({ bookId }) }),
  getReservations: (params?: Record<string, any>) => request(`/reservations${cleanQuery(params)}`),
  cancelReservation: (id: number) => request(`/reservations/${id}/cancel`, { method: 'PATCH' }),
  updateReservationStatus: (id: number, status: string) => request(`/reservations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Fines
  getFines: (params?: Record<string, any>) => request(`/fines${cleanQuery(params)}`),
  payFine: (id: number) => request(`/fines/${id}/pay`, { method: 'PATCH' }),
  waiveFine: (id: number, reason?: string) => request(`/fines/${id}/waive`, { method: 'PATCH', body: JSON.stringify({ reason }) }),

  // Notifications
  getNotifications: (unreadOnly = false) => request(`/notifications?unreadOnly=${unreadOnly}`),
  markNotificationRead: (id: number) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PATCH' }),

  // Reports
  getDashboardSummary: () => request('/reports/dashboard-summary'),
  getOverdueReport: () => request('/reports/overdue'),
  getMostBorrowedReport: (period = '30d') => request(`/reports/most-borrowed?period=${period}`),
  getInventorySummary: () => request('/reports/inventory-summary'),
};
