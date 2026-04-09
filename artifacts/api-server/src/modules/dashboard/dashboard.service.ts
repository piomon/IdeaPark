import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../common/models';
import { StoreService } from '../../common/store.service';

@Injectable()
export class DashboardService {
  constructor(private readonly store: StoreService) {}

  summary(user: AuthUser) {
    const db = this.store.snapshot;
    const vehicles = db.vehicles.filter((item) => item.userId === user.id);
    const ownedSpaces = db.spaces.filter((item) => item.ownerId === user.id);
    const now = new Date();

    const upcomingReservation = db.reservations
      .filter((item) => item.userId === user.id && new Date(item.endsAt) > now && item.status !== 'cancelled')
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

    const recentActivity = db.auditLogs
      .filter((item) => item.tenantId === user.tenantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        action: item.action,
        createdAt: item.createdAt,
        actor: db.users.find((userItem) => userItem.id === item.actorId)?.fullName ?? 'Nieznany',
        details: item.details,
      }));

    const recommendedSpaces = db.spaces
      .filter((space) => !space.isBlocked)
      .slice(0, 3)
      .map((space) => ({
        id: space.id,
        code: space.code,
        zone: space.zone,
        type: space.type,
        note: space.notes,
      }));

    return {
      headline: `Dzien dobry, ${user.fullName.split(' ')[0]}`,
      stats: [
        { label: 'Moje pojazdy', value: vehicles.length },
        { label: 'Moje miejsca', value: ownedSpaces.length },
        { label: 'Udostepnienia', value: db.shareWindows.filter((item) => item.ownerId === user.id).length },
        { label: 'Rezerwacje', value: db.reservations.filter((item) => item.userId === user.id).length },
      ],
      upcomingReservation,
      recentActivity,
      recommendedSpaces,
      ownedSpaces: ownedSpaces.map((space) => ({
        ...space,
        upcomingShares: db.shareWindows
          .filter((item) => item.spaceId === space.id && new Date(item.endsAt) > now)
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
      })),
      vehicles,
    };
  }
}
