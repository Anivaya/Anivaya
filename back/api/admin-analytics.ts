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
/** Jeu d'exemples de admin-dashboard.html, expressément séparé des comptes réels. */
function demoHouseholds(now: number): Household[] {
  const ago = (n: number) => new Date(now - n * day).toISOString();
  return [10, 20, 45, 65, 95, 130, 160, 195, 220, 250, 280, 310].map(
    (age, i) => ({
      createdAt: ago(age),
      zone: i % 2 ? "Lyon" : "Villeurbanne",
      channel: i % 3 ? "Direct" : "Partenaire",
      animals: [
        {
          profileCompleteAt: i % 4 === 0 ? null : ago(age - 2),
          reminderCreatedAt: i % 3 === 0 ? ago(age - 9) : ago(age - 4),
          scheduledReminder: i % 3 !== 0,
          interactions: [
            ago(i % 3 === 0 ? 40 : 5),
            ...[32, 93, 184]
              .filter((n) => age > n && i % 3 !== 0)
              .map((n) => ago(age - n)),
          ],
        },
      ],
    }),
  );
}
/**
 * Indicateurs d'activation et de rétention. `source=maquette` lit le jeu d'exemples ;
 * sinon les foyers réels de l'installation sont fournis par l'administration.
 */
export function analytics(
  query: URLSearchParams,
  installation: () => Household[] = () => [],
): AdminAnalytics {
  const source =
    query.get("source") === "maquette" ? "maquette" : "installation";
  const asOf = new Date().toISOString(),
    now = Date.parse(asOf);
  const households =
    source === "maquette" ? demoHouseholds(now) : installation();
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
    source,
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
