import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from '../../common/models';
import { StoreService } from '../../common/store.service';
import { SpacesService } from '../spaces/spaces.service';
import { GuestsService } from '../guests/guests.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly store: StoreService,
    private readonly spacesService: SpacesService,
    private readonly guestsService: GuestsService,
  ) {}

  private assertAdmin(user: AuthUser) {
    if (user.role !== 'admin' && user.role !== 'operator') {
      throw new ForbiddenException('Dostep tylko dla administratora');
    }
  }

  overview(user: AuthUser) {
    this.assertAdmin(user);
    const db = this.store.snapshot;
    const totalSpaces = db.spaces.length;
    const blockedSpaces = db.spaces.filter((item) => item.isBlocked).length;
    const activeGuests = db.guests.filter((item) => item.status === 'active').length;
    const todayReservations = db.reservations.filter((item) => {
      const itemDate = new Date(item.startsAt);
      const now = new Date();
      return itemDate.getDate() === now.getDate()
        && itemDate.getMonth() === now.getMonth()
        && itemDate.getFullYear() === now.getFullYear();
    }).length;

    return {
      tenant: db.tenants[0],
      metrics: [
        { label: 'Miejsca', value: totalSpaces, accent: 'neutral' },
        { label: 'Rezerwacje dzis', value: todayReservations, accent: 'emerald' },
        { label: 'Aktywni goscie', value: activeGuests, accent: 'blue' },
        { label: 'Zablokowane miejsca', value: blockedSpaces, accent: 'amber' },
      ],
      recentReservations: db.reservations
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6)
        .map((item) => ({
          ...item,
          userName: db.users.find((userItem) => userItem.id === item.userId)?.fullName ?? 'Nieznany',
          spaceCode: db.spaces.find((spaceItem) => spaceItem.id === item.spaceId)?.code ?? '—',
        })),
      recentAudit: db.auditLogs
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8)
        .map((item) => ({
          ...item,
          actorName: db.users.find((userItem) => userItem.id === item.actorId)?.fullName ?? 'Nieznany',
        })),
    };
  }

  spaces(user: AuthUser) {
    this.assertAdmin(user);
    return this.spacesService.adminList(user);
  }

  reservations(user: AuthUser) {
    this.assertAdmin(user);
    const db = this.store.snapshot;

    return db.reservations
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((item) => ({
        ...item,
        userName: db.users.find((entry) => entry.id === item.userId)?.fullName ?? 'Nieznany',
        vehiclePlate: db.vehicles.find((entry) => entry.id === item.vehicleId)?.plate ?? '—',
        spaceCode: db.spaces.find((entry) => entry.id === item.spaceId)?.code ?? '—',
      }));
  }

  guests(user: AuthUser) {
    this.assertAdmin(user);
    return this.guestsService.adminList(user).map((item) => ({
      ...item,
      hostName: this.store.snapshot.users.find((userItem) => userItem.id === item.hostId)?.fullName ?? 'Nieznany',
    }));
  }
}
