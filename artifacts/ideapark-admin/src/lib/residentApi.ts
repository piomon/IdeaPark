const API = '/api/resident';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    sessionStorage.setItem('ideapark_token', token);
  } else {
    sessionStorage.removeItem('ideapark_token');
  }
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = sessionStorage.getItem('ideapark_token');
  }
  return authToken;
}

export function clearAuth() {
  authToken = null;
  sessionStorage.removeItem('ideapark_token');
}

async function request(path: string, options?: RequestInit) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (res.status === 401) {
    clearAuth();
    window.dispatchEvent(new CustomEvent('ideapark:unauthorized'));
    throw new Error('Sesja wygasła. Zaloguj się ponownie.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export const residentApi = {
  login: (firstName: string, lastName: string, password: string) =>
    request('/login', { method: 'POST', body: JSON.stringify({ firstName, lastName, password }) }),

  register: (data: {
    firstName: string; lastName: string; password: string; city: string; street: string;
    building: string; apartment: string; spaceCode: string;
    parkingType: string; stage: string; phone: string; plateNumber?: string;
  }) => request('/register', { method: 'POST', body: JSON.stringify(data) }),

  getDemoUsers: () => request('/demo-users'),

  getSharing: () => request('/sharing'),
  getSeeking: () => request('/seeking'),

  addSharing: (from: string, to: string) =>
    request('/sharing', { method: 'POST', body: JSON.stringify({ from, to }) }),

  addSeeking: (from: string, to: string) =>
    request('/seeking', { method: 'POST', body: JSON.stringify({ from, to }) }),

  deleteSharing: (sharingId: string) =>
    request(`/sharing/${sharingId}`, { method: 'DELETE' }),

  editSharing: (sharingId: string, from: string, to: string) =>
    request(`/sharing/${sharingId}`, { method: 'PUT', body: JSON.stringify({ from, to }) }),

  deleteSeeking: (seekingId: string) =>
    request(`/seeking/${seekingId}`, { method: 'DELETE' }),

  editSeeking: (seekingId: string, from: string, to: string) =>
    request(`/seeking/${seekingId}`, { method: 'PUT', body: JSON.stringify({ from, to }) }),

  requestSpace: (sharingId: string) =>
    request(`/sharing/${sharingId}/request`, { method: 'POST', body: JSON.stringify({}) }),

  acceptRequest: (sharingId: string) =>
    request(`/sharing/${sharingId}/accept`, { method: 'POST', body: JSON.stringify({}) }),

  rejectRequest: (sharingId: string) =>
    request(`/sharing/${sharingId}/reject`, { method: 'POST', body: JSON.stringify({}) }),

  addProposal: (seekingId: string) =>
    request(`/seeking/${seekingId}/propose`, { method: 'POST', body: JSON.stringify({}) }),

  acceptProposal: (seekingId: string, proposalId: string) =>
    request(`/seeking/${seekingId}/accept-proposal`, { method: 'POST', body: JSON.stringify({ proposalId }) }),

  rejectProposal: (seekingId: string, proposalId: string) =>
    request(`/seeking/${seekingId}/reject-proposal`, { method: 'POST', body: JSON.stringify({ proposalId }) }),

  getChats: () => request('/chats'),

  getOrCreateChat: (otherUserId: string, spaceCode: string, reservationId: string) =>
    request('/chats', { method: 'POST', body: JSON.stringify({ otherUserId, spaceCode, reservationId }) }),

  sendMessage: (threadId: string, text: string) =>
    request(`/chats/${threadId}/messages`, { method: 'POST', body: JSON.stringify({ text }) }),

  getNotifications: () => request('/notifications'),

  addNotification: (data: { type: string; title: string; body: string; spaceCode?: string; relatedId?: string }) =>
    request('/notifications', { method: 'POST', body: JSON.stringify(data) }),

  markNotificationsRead: () =>
    request('/notifications/read', { method: 'POST' }),

  confirmVacated: (sharingId: string) =>
    request(`/sharing/${sharingId}/confirm-vacated`, { method: 'POST', body: JSON.stringify({}) }),

  getActiveReservations: () => request('/active-reservations'),

  reportVehicle: (sharingId: string) =>
    request(`/sharing/${sharingId}/report-vehicle`, { method: 'POST', body: JSON.stringify({}) }),

  getArchive: () => request('/archive'),
};
