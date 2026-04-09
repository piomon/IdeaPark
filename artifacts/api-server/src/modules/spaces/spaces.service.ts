import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser, ParkingSpace } from '../../common/models';
import { StoreService } from '../../common/store.service';
import { overlaps } from '../../common/utils';

@Injectable()
export class SpacesService {
  constructor(private readonly store: StoreService) {}

  list(user: AuthUser, from: string, to: string) {
    const fromDate = from ? from : new Date().toISOString();
    const toDate = to ? to : new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

    const db = this.store.snapshot;

    return db.spaces
      .filter((space) => space.tenantId === user.tenantId)
      .map((space) => this.enrichSpace(space, fromDate, toDate, user.id))
      .filter((space) => space.isReservable);
  }

  mine(user: AuthUser) {
    const db = this.store.snapshot;
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

    return db.spaces
      .filter((space) => space.ownerId === user.id)
      .map((space) => ({
        ...this.enrichSpace(space, now, future, user.id),
        shareWindows: db.shareWindows.filter((sw) => sw.spaceId === space.id),
        reservations: db.reservations.filter((r) => r.spaceId === space.id),
      }));
  }

  byId(user: AuthUser, id: string) {
    const db = this.store.snapshot;
    const space = db.spaces.find((item) => item.id === id && item.tenantId === user.tenantId);

    if (!space) {
      throw new NotFoundException('Nie znaleziono miejsca');
    }

    return this.enrichSpace(space, new Date().toISOString(), new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), user.id);
  }

  adminList(user: AuthUser) {
    const db = this.store.snapshot;
    return db.spaces
      .filter((space) => space.tenantId === user.tenantId)
      .map((space) => this.enrichSpace(space, new Date().toISOString(), new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), user.id));
  }

  private enrichSpace(space: ParkingSpace, from: string, to: string, currentUserId: string) {
    const db = this.store.snapshot;
    const owner = db.users.find((item) => item.id === space.ownerId);
    const shareWindow = db.shareWindows.find(
      (item) => item.spaceId === space.id && overlaps(item.startsAt, item.endsAt, from, to),
    );
    const conflictingReservation = db.reservations.find(
      (item) => item.spaceId === space.id
        && item.status !== 'cancelled'
        && overlaps(item.startsAt, item.endsAt, from, to),
    );

    const isSharedByOwner = space.type === 'private'
      ? Boolean(shareWindow)
      : space.type === 'guest' || space.type === 'shared';

    const isReservable = !space.isBlocked
      && !conflictingReservation
      && (isSharedByOwner || owner?.id === currentUserId);

    return {
      ...space,
      ownerName: owner?.fullName ?? null,
      currentShareWindow: shareWindow ?? null,
      conflictingReservation: conflictingReservation ?? null,
      isReservable,
    };
  }
}
