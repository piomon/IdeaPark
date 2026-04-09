export type UserRole = 'resident' | 'admin' | 'operator';
export type SpaceType = 'private' | 'guest' | 'shared';
export type ReservationStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
export type GuestStatus = 'active' | 'used' | 'expired';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export interface User {
  id: string;
  tenantId: string;
  role: UserRole;
  fullName: string;
  email: string;
  password: string;
  apartmentNumber: string;
  phone: string;
  ownedSpaceIds: string[];
  vehicleIds: string[];
}

export interface Vehicle {
  id: string;
  userId: string;
  plate: string;
  label: string;
  color: string;
}

export interface ParkingSpace {
  id: string;
  tenantId: string;
  code: string;
  zone: string;
  level: string;
  type: SpaceType;
  ownerId?: string | null;
  isBlocked: boolean;
  notes?: string;
}

export interface ShareWindow {
  id: string;
  tenantId: string;
  spaceId: string;
  ownerId: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

export interface Reservation {
  id: string;
  tenantId: string;
  spaceId: string;
  userId: string;
  vehicleId: string;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  createdAt: string;
}

export interface GuestPass {
  id: string;
  tenantId: string;
  hostId: string;
  guestName: string;
  plate: string;
  validFrom: string;
  validTo: string;
  qrCode: string;
  status: GuestStatus;
  createdAt: string;
}

export interface GateEvent {
  id: string;
  tenantId: string;
  actorId: string;
  gateName: string;
  openedAt: string;
  status: 'opened' | 'failed';
}

export interface AuditLog {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AppDatabase {
  tenants: Tenant[];
  users: User[];
  vehicles: Vehicle[];
  spaces: ParkingSpace[];
  shareWindows: ShareWindow[];
  reservations: Reservation[];
  guests: GuestPass[];
  gateEvents: GateEvent[];
  auditLogs: AuditLog[];
}

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: UserRole;
}
