import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser, ShareWindow } from '../../common/models';
import { StoreService } from '../../common/store.service';
import { nowIso, uid } from '../../common/utils';

@Injectable()
export class SharesService {
  constructor(private readonly store: StoreService) {}

  create(
    user: AuthUser,
    payload: { spaceId: string; startsAt: string; endsAt: string },
  ) {
    const db = this.store.snapshot;
    const space = db.spaces.find((item) => item.id === payload.spaceId && item.tenantId === user.tenantId);

    if (!space) {
      throw new NotFoundException('Nie znaleziono miejsca');
    }

    if (space.ownerId !== user.id && user.role === 'resident') {
      throw new ForbiddenException('Nie mozesz udostepnic tego miejsca');
    }

    const record: ShareWindow = {
      id: uid('share'),
      tenantId: user.tenantId,
      spaceId: payload.spaceId,
      ownerId: user.id,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      createdAt: nowIso(),
    };

    this.store.update((draft) => {
      draft.shareWindows.unshift(record);
      draft.auditLogs.unshift({
        id: uid('audit'),
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'share.created',
        details: {
          spaceId: payload.spaceId,
          startsAt: payload.startsAt,
          endsAt: payload.endsAt,
        },
        createdAt: nowIso(),
      });
      return draft;
    });

    return record;
  }

  mine(user: AuthUser) {
    const db = this.store.snapshot;

    return db.shareWindows
      .filter((item) => item.ownerId === user.id)
      .map((item) => ({
        ...item,
        space: db.spaces.find((space) => space.id === item.spaceId) ?? null,
      }))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }
}
