import { useEffect, useRef, useState } from "react";
import type {
  AdminAnalytics as Analytics,
  Ratio,
} from "../../../../shared/analytics.ts";
import { request } from "../../shared/services/api.ts";
import AdminDisclosure from "./AdminDisclosure.tsx";
import AdminIconButton from "./AdminIconButton.tsx";
import { errorMessage } from "../../shared/types.ts";
import { indicatorColumns } from "./config.ts";

export default function AdminAnalytics() {
  const [cohortSort, setCohortSort] = useState<"none" | "asc" | "desc">("none");
  const [source, setSource] = useState("installation"),
    [zone, setZone] = useState(""),
    [channel, setChannel] = useState("");
  const [result, setResult] = useState<{
      key: string;
      data?: Analytics;
      error?: string;
    } | null>(null),
    [retry, setRetry] = useState(0);
  const query = new URLSearchParams({ source, zone, channel }).toString(),
    key = query + retry;
  useEffect(() => {
    const controller = new AbortController();
    request<Analytics>(`/admin/analytics?${query}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, data });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setResult({ key, error: errorMessage(e) });
      });
    return () => controller.abort();
  }, [query, key]);
  // Pendant le chargement de nouveaux filtres, les derniers chiffres restent affichés :
  // la page ne se vide pas et les pourcentages s’animent vers leur nouvelle valeur.
  const data = result?.data,
    updating = result?.key !== key;
  const ratio = (v: Ratio) => (v.total ? `${v.count} / ${v.total}` : "—");
  const values = data
    ? [data.activation, data.active, ...data.retention]
    : Array.from({ length: 5 }, () => ({ count: 0, total: 0 }));
  const percents = values.map((v) =>
    v.total ? (v.count / v.total) * 100 : null,
  );
  return (
    <div className="admin-pilotage">
      <AdminDisclosure
        label="Démonstration locale"
        className="admin-demo-disclosure"
      >
        <label className="admin-demo-source">
          Source des indicateurs
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setZone("");
              setChannel("");
            }}
          >
            <option value="installation">Données de l’installation</option>
            <option value="maquette">Données de démonstration</option>
          </select>
        </label>
        <p>
          Le jeu d’exemples est indépendant des comptes réels et permet de
          parcourir les indicateurs de la maquette.
        </p>
      </AdminDisclosure>
      <section
        className={
          "admin-panel admin-analytics" + (updating ? " updating" : "")
        }
        aria-busy={updating}
      >
        <div className="admin-section-title">
          <h2>Activation et fidélisation</h2>
          <span className="admin-badge">
            {source === "maquette"
              ? "Données de démonstration"
              : "Données de l’installation"}
          </span>
        </div>
        {!updating && result?.error ? (
          <div role="alert" className="admin-error">
            {result.error}
            <button
              className="button outline"
              onClick={() => setRetry((n) => n + 1)}
            >
              Réessayer
            </button>
          </div>
        ) : !data ? (
          <p role="status">Chargement des indicateurs…</p>
        ) : (
          <p className="admin-analytics-description">
            {!data.available
              ? "Aucun foyer n’est encore inscrit. Ouvrez « Démonstration locale » pour consulter les exemples de la maquette."
              : source === "maquette"
                ? `Photographie au ${new Date(data.asOf).toLocaleDateString("fr-FR")}. Les chiffres ci-dessous proviennent d’un jeu d’exemples, indépendant des comptes du tableau de bord.`
                : `Photographie au ${new Date(data.asOf).toLocaleDateString("fr-FR")} des comptes de cette installation. L’activité est mesurée depuis la mise en place du suivi : les carnets plus anciens comptent à partir de cette date.`}
          </p>
        )}
        <div className="admin-toolbar admin-metric-filters">
          <label>
            Zone
            <select value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">Toutes les zones</option>
              {data?.zones.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Origine
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="">Toutes les origines</option>
              {data?.channels.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <div
          className="admin-metric-grid"
          style={indicatorColumns(values.length)}
        >
          {[
            "Activation sous 7 jours",
            "Animaux activement suivis",
            "Rétention J30",
            "Rétention M3",
            "Rétention M6",
          ].map((label, i) => (
            <article className="admin-metric-card" key={label}>
              <span>{label}</span>
              <strong>
                <AnimatedPercent value={percents[i]} />
              </strong>
              {/* Jauge décorative : la valeur est déjà lue dans le pourcentage. */}
              <span className="admin-metric-bar" aria-hidden="true">
                <span style={{ width: `${percents[i] ?? 0}%` }} />
              </span>
              <small>
                {data?.available
                  ? `${ratio(values[i])}${values[i].total ? "" : " · aucune cohorte éligible"}`
                  : "Mesure non disponible"}
              </small>
            </article>
          ))}
        </div>
        <AdminDisclosure
          className="admin-definitions"
          label="Comprendre les indicateurs et les périodes"
        >
          <ul>
            <li>
              Activation : au moins un animal avec profil complété et rappel
              créé dans les 7 jours suivant l’inscription. Seuls les foyers
              inscrits depuis au moins 7 jours entrent dans le dénominateur.
            </li>
            <li>
              Animal activement suivi : rappel programmé et interaction avec son
              dossier dans les 30 derniers jours.
            </li>
            <li>
              Rétention : interaction pendant J30–J59, J90–J119 (M3) ou
              J180–J209 (M6). La fenêtre entière doit être terminée.
            </li>
            <li>
              Chaque ratio indique le numérateur et le dénominateur. « — »
              indique une absence de mesure ou de cohorte éligible, pas un taux
              nul.
            </li>
          </ul>
        </AdminDisclosure>
        <h3>Par mois d’inscription</h3>
        <div
          className="admin-table-panel admin-table-scroll"
          role="region"
          aria-label="Cohortes par mois"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                {["Cohorte", "Foyers", "Activation J7", "J30", "M3", "M6"].map(
                  (t) => (
                    <th
                      scope="col"
                      key={t}
                      aria-sort={
                        t === "Cohorte"
                          ? cohortSort === "none"
                            ? "none"
                            : cohortSort === "asc"
                              ? "ascending"
                              : "descending"
                          : undefined
                      }
                    >
                      {t === "Cohorte" ? (
                        <span className="admin-sort-heading">
                          {t}
                          <AdminIconButton
                            icon={
                              cohortSort === "none"
                                ? "sort"
                                : cohortSort === "asc"
                                  ? "up"
                                  : "down"
                            }
                            label={`Cohorte : ${cohortSort === "none" ? "trier par ordre croissant" : cohortSort === "asc" ? "trier par ordre décroissant" : "rétablir l’ordre normal"}`}
                            onClick={() =>
                              setCohortSort((v) =>
                                v === "none"
                                  ? "asc"
                                  : v === "asc"
                                    ? "desc"
                                    : "none",
                              )
                            }
                          />
                        </span>
                      ) : (
                        t
                      )}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data?.cohorts
                .slice()
                .sort((a, b) =>
                  cohortSort === "asc"
                    ? a.month.localeCompare(b.month)
                    : b.month.localeCompare(a.month),
                )
                ?.map((c) => (
                  <tr key={c.month}>
                    <th scope="row">{c.month}</th>
                    <td>{c.households}</td>
                    <td>{ratio(c.activation)}</td>
                    {c.retention.map((r, i) => (
                      <td key={i}>{ratio(r)}</td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
          {data && !data.cohorts.length && (
            <p className="admin-empty">
              {data.available
                ? "Aucune cohorte pour ces filtres."
                : "Aucune cohorte mesurée pour le moment."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Pourcentage qui défile de l’ancienne à la nouvelle valeur (600 ms).
 * Les lecteurs d’écran lisent directement la valeur finale ; pas d’animation en mouvement réduit.
 */
function AnimatedPercent({ value }: { value: number | null }) {
  const [shown, setShown] = useState<number | null>(null);
  // Valeur affichée à l’image précédente : point de départ de la prochaine animation.
  const current = useRef(0);
  const animated =
    value !== null && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (!animated || value === null) {
      current.current = value ?? 0;
      return;
    }
    const start = current.current,
      began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / 600),
        eased = 1 - (1 - progress) ** 3;
      current.current = start + (value - start) * eased;
      setShown(current.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, animated]);
  const format = (v: number | null) =>
    v === null ? "—" : `${Math.round(v)} %`;
  return (
    <>
      <span aria-hidden="true">{format(animated ? (shown ?? 0) : value)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
