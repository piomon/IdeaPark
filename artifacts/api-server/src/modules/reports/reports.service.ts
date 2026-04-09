import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../common/models';
import { StoreService } from '../../common/store.service';

@Injectable()
export class ReportsService {
  constructor(private readonly store: StoreService) {}

  summary(user: AuthUser) {
    const db = this.store.snapshot;
    const totalSpaces = db.spaces.length;
    const sharedWindows = db.shareWindows.length;
    const reservations = db.reservations.length;
    const guests = db.guests.length;
    const utilizationRate = totalSpaces > 0 ? Math.min(100, Math.round((reservations / totalSpaces) * 34)) : 0;
    const sharingRate = totalSpaces > 0 ? Math.round((sharedWindows / totalSpaces) * 100) : 0;

    const zones = db.spaces.reduce<Record<string, number>>((acc, item) => {
      acc[item.zone] = (acc[item.zone] ?? 0) + 1;
      return acc;
    }, {});

    const busiestZone = Object.entries(zones).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Brak danych';

    return {
      tenant: db.tenants.find((item) => item.id === user.tenantId) ?? null,
      kpis: [
        {
          label: 'Wykorzystanie zasobu',
          value: `${utilizationRate}%`,
          helper: 'Szacowane na bazie rezerwacji demo',
        },
        {
          label: 'Poziom udostepnien',
          value: `${sharingRate}%`,
          helper: 'Udzial miejsc z aktywnym share flow',
        },
        {
          label: 'Goscie w systemie',
          value: guests,
          helper: 'Aktywne i historyczne przepustki',
        },
        {
          label: 'Najbardziej obciazzona strefa',
          value: busiestZone,
          helper: 'Wedlug liczby miejsc i rezerwacji',
        },
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
}
