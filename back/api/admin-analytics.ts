import type { AdminAnalytics } from "../../shared/analytics.ts";
const day = 86400000;
/** Un foyer et ses animaux, tels que les indicateurs les lisent. */
export interface Household {
  createdAt: string;
  zone: string;
  channel: string;
  animals: {
    profileCompleteAt: string | null;
    reminderCreatedAt: string;
    scheduledReminder: boolean;
    interactions: string[];
  }[];
}
/** Indicateurs d'activation et de rétention des foyers de l'installation. */
export function analytics(
  query: URLSearchParams,
  installation: () => Household[] = () => [],
): AdminAnalytics {
  const asOf = new Date().toISOString(),
    now = Date.parse(asOf);
  const households = installation();
  function metrics(rows: Household[]) {
    const between = (value: string | null, start: number, end: number) =>
      !!value && Date.parse(value) >= start && Date.parse(value) < end;
    const eligible = rows.filter(
      (h) => now - Date.parse(h.createdAt) >= 7 * day,
    );
    const activated = eligible.filter((h) =>
      h.animals.some(
        (a) =>
          between(
            a.profileCompleteAt,
            Date.parse(h.createdAt),
            Date.parse(h.createdAt) + 7 * day,
          ) &&
          between(
            a.reminderCreatedAt,
            Date.parse(h.createdAt),
            Date.parse(h.createdAt) + 7 * day,
          ),
      ),
    );
    const animals = rows.flatMap((h) => h.animals),
      active = animals.filter(
        (a) =>
          a.scheduledReminder &&
          a.interactions.some((t) => between(t, now - 30 * day, now + 1)),
      );
    return {
      activation: { count: activated.length, total: eligible.length },
      active: { count: active.length, total: animals.length },
      retention: [30, 90, 180].map((start) => {
        const mature = rows.filter(
          (h) => now - Date.parse(h.createdAt) >= (start + 30) * day,
        );
        return {
          total: mature.length,
          count: mature.filter((h) =>
            h.animals.some((a) =>
              a.interactions.some((t) =>
                between(
                  t,
                  Date.parse(h.createdAt) + start * day,
                  Date.parse(h.createdAt) + (start + 30) * day,
                ),
              ),
            ),
          ).length,
        };
      }),
    };
  }
  const zone = query.get("zone"),
    channel = query.get("channel"),
    filtered = households.filter(
      (h) => (!zone || zone === h.zone) && (!channel || channel === h.channel),
    );
  return {
    available: households.length > 0,
    asOf,
    zones: [...new Set(households.map((h) => h.zone))].sort(),
    channels: [...new Set(households.map((h) => h.channel))].sort(),
    ...metrics(filtered),
    cohorts: [...new Set(filtered.map((h) => h.createdAt.slice(0, 7)))]
      .sort()
      .reverse()
      .map((month) => {
        const rows = filtered.filter((h) => h.createdAt.startsWith(month));
        return { month, households: rows.length, ...metrics(rows) };
      }),
  };
}
