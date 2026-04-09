import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser, Reservation } from '../../common/models';
import { StoreService } from '../../common/store.service';
import { isWithinRange, nowIso, overlaps, uid } from '../../common/utils';

@Injectable()
export class ReservationsService {
  constructor(private readonly store: StoreService) {}

  create(
    user: AuthUser,
    payload: { spaceId: string; vehicleId: string; startsAt: string; endsAt: string },
  ) {
    const db = this.store.snapshot;

    const vehicle = db.vehicles.find((item) => item.id === payload.vehicleId && item.userId === user.id);
    if (!vehicle) {
      throw new ForbiddenException('Pojazd nie nalezy do Ciebie');
    }

    const space = db.spaces.find((item) => item.id === payload.spaceId && item.tenantId === user.tenantId);
    if (!space) {
      throw new NotFoundException('Nie znaleziono miejsca');
    }

    if (space.isBlocked) {
      throw new BadRequestException('Miejsce jest zablokowane');
    }

    const conflict = db.reservations.find(
      (item) => item.spaceId === payload.spaceId
        && item.status !== 'cancelled'
        && overlaps(item.startsAt, item.endsAt, payload.startsAt, payload.endsAt),
    );

    if (conflict) {
      throw new BadRequestException('Miejsce jest juz zarezerwowane w tym czasie');
    }

    if (space.type === 'private') {
      const isOwner = space.ownerId === user.id;
      if (!isOwner) {
        const shareWindow = db.shareWindows.find(
          (item) => item.spaceId === payload.spaceId
            && isWithinRange(payload.startsAt, payload.endsAt, item.startsAt, item.endsAt),
        );
        if (!shareWindow) {
          throw new ForbiddenException('Brak aktywnego udostepnienia dla tego miejsca w podanym czasie');
        }
      }
    }

    const now = new Date();
    const reservation: Reservation = {
      id: uid('res'),
      tenantId: user.tenantId,
      spaceId: payload.spaceId,
      userId: user.id,
      vehicleId: payload.vehicleId,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      status: new Date(payload.startsAt) > now ? 'upcoming' : 'active',
      createdAt: nowIso(),
    };

    this.store.update((draft) => {
      draft.reservations.unshift(reservation);
      draft.auditLogs.unshift({
        id: uid('audit'),
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'reservation.created',
        details: {
          spaceId: payload.spaceId,
          vehicleId: payload.vehicleId,
          startsAt: payload.startsAt,
          endsAt: payload.endsAt,
        },
        createdAt: nowIso(),
      });
      return draft;
    });

    return reservation;
  }

  mine(user: AuthUser) {
    const db = this.store.snapshot;
    return db.reservations
      .filter((item) => item.userId === user.id)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  cancel(user: AuthUser, id: string) {
    const db = this.store.snapshot;
    const reservation = db.reservations.find((item) => item.id === id);

    if (!reservation) {
      throw new NotFoundException('Nie znaleziono rezerwacji');
    }

    if (user.role === 'resident' && reservation.userId !== user.id) {
      throw new ForbiddenException('Nie mozesz anulowac tej rezerwacji');
    }

    this.store.update((draft) => {
      const res = draft.reservations.find((item) => item.id === id);
      if (res) {
        res.status = 'cancelled';
      }
      draft.auditLogs.unshift({
        id: uid('audit'),
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'reservation.cancelled',
        details: { reservationId: id },
        createdAt: nowIso(),
      });
      return draft;
    });

    return { ok: true };
  }
}
