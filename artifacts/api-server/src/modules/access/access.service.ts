import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../common/models';
import { StoreService } from '../../common/store.service';
import { nowIso, uid } from '../../common/utils';

@Injectable()
export class AccessService {
  constructor(private readonly store: StoreService) {}

  openGate(user: AuthUser, gateName: string) {
    const event = {
      id: uid('gate'),
      tenantId: user.tenantId,
      actorId: user.id,
      gateName,
      openedAt: nowIso(),
      status: 'opened' as const,
    };

    this.store.update((draft) => {
      draft.gateEvents.unshift(event);
      draft.auditLogs.unshift({
        id: uid('audit'),
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'gate.opened',
        details: { gateName },
        createdAt: nowIso(),
      });
      return draft;
    });

    return {
      success: true,
      message: `Brama "${gateName}" zostala otwarta`,
      event,
    };
  }

  history(user: AuthUser) {
    return this.store.snapshot.gateEvents
      .filter((item) => item.tenantId === user.tenantId)
      .slice(0, 10);
  }
}
