export type Accent = 'neutral' | 'emerald' | 'blue' | 'amber';

const API_BASE = '/api';

export interface AdminMetric {
  label: string;
  value: number | string;
  accent: Accent;
}

export interface AdminOverview {
  tenant: { id: string; name: string; slug: string };
  metrics: AdminMetric[];
  recentReservations: Array<{
    id: string;
    spaceCode: string;
    userName: string;
    startsAt: string;
    endsAt: string;
    status: string;
  }>;
  recentAudit: Array<{
    id: string;
    action: string;
    actorName: string;
    createdAt: string;
  }>;
}

export interface AdminSpace {
  id: string;
  code: string;
  zone: string;
  level: string;
  type: string;
  ownerName: string | null;
  isReservable: boolean;
  isBlocked: boolean;
  notes?: string;
  currentShareWindow?: { startsAt: string; endsAt: string } | null;
}

export interface AdminReservation {
  id: string;
  userName: string;
  vehiclePlate: string;
  spaceCode: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

export interface AdminGuest {
  id: string;
  guestName: string;
  plate: string;
  hostName: string;
  validFrom: string;
  validTo: string;
  status: string;
  qrCode: string;
}

export interface AdminReports {
  tenant: { id: string; name: string; slug: string } | null;
  kpis: Array<{ label: string; value: string | number; helper: string }>;
  monthlyBars: Array<{ label: string; value: number }>;
  actions: string[];
}

function getToken() {
  return localStorage.getItem('ideapark_admin_token');
}

function buildHeaders(): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function createMockOverview(): AdminOverview {
  return {
    tenant: { id: 'tenant_idea', name: 'Osiedle IDEA', slug: 'osiedle-idea' },
    metrics: [
      { label: 'Miejsca', value: 5, accent: 'neutral' },
      { label: 'Rezerwacje dzis', value: 1, accent: 'emerald' },
      { label: 'Aktywni goscie', value: 1, accent: 'blue' },
      { label: 'Zablokowane miejsca', value: 1, accent: 'amber' },
    ],
    recentReservations: [
      {
        id: 'r1',
        userName: 'Jan Nowak',
        spaceCode: 'P1-021',
        startsAt: new Date(Date.now() + 2 * 3600000).toISOString(),
        endsAt: new Date(Date.now() + 4 * 3600000).toISOString(),
        status: 'upcoming',
      },
    ],
    recentAudit: [
      {
        id: 'a1',
        action: 'share.created',
        actorName: 'Anna Kowalska',
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function createMockSpaces(): AdminSpace[] {
  return [
    { id: 's1', code: 'P1-014', zone: 'Poziom -1', level: '-1', type: 'private', ownerName: 'Anna Kowalska', isReservable: false, isBlocked: false, notes: 'Slup po lewej stronie' },
    { id: 's2', code: 'P1-021', zone: 'Poziom -1', level: '-1', type: 'shared', ownerName: null, isReservable: true, isBlocked: false, notes: 'Blisko windy A' },
    { id: 's3', code: 'P1-033', zone: 'Poziom -1', level: '-1', type: 'guest', ownerName: null, isReservable: true, isBlocked: false, notes: 'Goscinne 24/7' },
    { id: 's4', code: 'P2-012', zone: 'Poziom -2', level: '-2', type: 'guest', ownerName: null, isReservable: true, isBlocked: false, notes: 'Szerokie miejsce' },
    { id: 's5', code: 'P2-099', zone: 'Poziom -2', level: '-2', type: 'shared', ownerName: null, isReservable: false, isBlocked: true, notes: 'Tymczasowo zablokowane' },
  ];
}

function createMockReservations(): AdminReservation[] {
  return [
    { id: 'r1', userName: 'Jan Nowak', vehiclePlate: 'WX9912N', spaceCode: 'P1-021', startsAt: new Date(Date.now() + 2 * 3600000).toISOString(), endsAt: new Date(Date.now() + 4 * 3600000).toISOString(), status: 'upcoming' },
    { id: 'r2', userName: 'Jan Nowak', vehiclePlate: 'WX9912N', spaceCode: 'P1-021', startsAt: new Date(Date.now() - 5 * 3600000).toISOString(), endsAt: new Date(Date.now() - 3 * 3600000).toISOString(), status: 'completed' },
  ];
}

function createMockGuests(): AdminGuest[] {
  return [
    { id: 'g1', guestName: 'Piotr Lis', plate: 'WPR9090K', hostName: 'Anna Kowalska', validFrom: new Date(Date.now() + 2 * 3600000).toISOString(), validTo: new Date(Date.now() + 8 * 3600000).toISOString(), status: 'active', qrCode: 'IDP-GUEST-PIOTR-9090' },
  ];
}

function createMockReports(): AdminReports {
  return {
    tenant: { id: 'tenant_idea', name: 'Osiedle IDEA', slug: 'osiedle-idea' },
    kpis: [
      { label: 'Wykorzystanie zasobu', value: '14%', helper: 'Szacowane na bazie rezerwacji demo' },
      { label: 'Poziom udostepnien', value: '20%', helper: 'Udzial miejsc z aktywnym share flow' },
      { label: 'Goscie w systemie', value: 1, helper: 'Aktywne i historyczne przepustki' },
      { label: 'Najbardziej obciazzona strefa', value: 'Poziom -1', helper: 'Wedlug liczby miejsc i rezerwacji' },
    ],
    monthlyBars: [
      { label: 'Sty', value: 28 },
      { label: 'Lut', value: 31 },
      { label: 'Mar', value: 36 },
      { label: 'Kwi', value: 42 },
      { label: 'Maj', value: 49 },
      { label: 'Cze', value: 58 },
    ],
    actions: [
      'Rozszerzyc pilotaz na kolejne klatki',
      'Dodac polityke rezerwacji cyklicznych',
      'Uruchomic automatyczne blokady dla konfliktow',
    ],
  };
}

async function apiRequest<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, { headers: buildHeaders() });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('ideapark_admin_token');
        window.location.href = '/login';
        return fallback;
      }
      return fallback;
    }
    return response.json() as Promise<T>;
  } catch {
    return fallback;
  }
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error('Nie udalo sie zalogowac');
  }

  return response.json() as Promise<{ accessToken: string; user: { fullName: string; role: string } }>;
}

export function storeSession(accessToken: string, userName: string) {
  localStorage.setItem('ideapark_admin_token', accessToken);
  localStorage.setItem('ideapark_admin_user', userName);
}

export function clearSession() {
  localStorage.removeItem('ideapark_admin_token');
  localStorage.removeItem('ideapark_admin_user');
}

export function readSessionUser() {
  return localStorage.getItem('ideapark_admin_user');
}

export async function getOverview() {
  return apiRequest<AdminOverview>('/admin/overview', createMockOverview());
}

export async function getSpaces() {
  return apiRequest<AdminSpace[]>('/admin/spaces', createMockSpaces());
}

export async function getReservations() {
  return apiRequest<AdminReservation[]>('/admin/reservations', createMockReservations());
}

export async function getGuests() {
  return apiRequest<AdminGuest[]>('/admin/guests', createMockGuests());
}

export async function getReports() {
  return apiRequest<AdminReports>('/reports/summary', createMockReports());
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
