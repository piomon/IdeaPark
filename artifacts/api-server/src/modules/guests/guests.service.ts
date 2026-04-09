import { Injectable } from '@nestjs/common';
import { AuthUser, GuestPass } from '../../common/models';
import { StoreService } from '../../common/store.service';
import { nowIso, uid } from '../../common/utils';

@Injectable()
export class GuestsService {
  constructor(private readonly store: StoreService) {}

  create(
    user: AuthUser,
    payload: { guestName: string; plate: string; validFrom: string; validTo: string },
  ) {
    const guest: GuestPass = {
      id: uid('guest'),
      tenantId: user.tenantId,
      hostId: user.id,
      guestName: payload.guestName,
      plate: payload.plate.toUpperCase(),
      validFrom: payload.validFrom,
      validTo: payload.validTo,
      qrCode: `IDP-${payload.plate.toUpperCase().replaceAll(' ', '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      status: 'active',
      createdAt: nowIso(),
    };

    this.store.update((draft) => {
      draft.guests.unshift(guest);
      draft.auditLogs.unshift({
        id: uid('audit'),
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'guest.created',
        details: {
          guestName: payload.guestName,
          plate: payload.plate,
          validFrom: payload.validFrom,
          validTo: payload.validTo,
        },
        createdAt: nowIso(),
      });
      return draft;
    });

    return guest;
  }

  mine(user: AuthUser) {
    const db = this.store.snapshot;
    return db.guests
      .filter((item) => item.hostId === user.id)
      .sort((a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime());
  }

  adminList(user: AuthUser) {
    return this.store.snapshot.guests
      .filter((item) => item.tenantId === user.tenantId)
      .sort((a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime());
  }
}
