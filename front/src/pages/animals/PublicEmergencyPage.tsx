import { useEffect, useState } from "react";
import type { EmergencySnapshot } from "../../../../shared/models.ts";
import Icon from "../../shared/ui/Icon.tsx";
import Portrait from "./components/AnimalPortrait.tsx";
export default function PublicEmergencyPage({ token }: { token: string }) {
  const [data, setData] = useState<EmergencySnapshot | null>(null),
    [state, setState] = useState("loading"),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/emergency/" + encodeURIComponent(token), {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          setState(
            response.status === 410
              ? "disabled"
              : response.status === 404
                ? "unavailable"
                : "error",
          );
          return;
        }
        setData((await response.json()) as EmergencySnapshot);
        setState("active");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [token, retry]);
  const contact = data?.contact || "",
    email = contact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0],
    phone = contact.match(/(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}/)?.[0];
  return (
    <div className="public-emergency">
      <div className="public-shell">
        <a
          className="back public-back"
          href="#espace"
          aria-label="Retour à mon espace"
        >
          <Icon name="back" />
        </a>
        <main className="public-card">
          <header className="public-card-top">
            <a href="#accueil">
              <img src="/images/logo.png" alt="Anivaya" />
            </a>
            <span className="state-toggle">
              <span className={"state-dot " + state} />
              {
                {
                  loading: "Chargement…",
                  active: "Active",
                  disabled: "Désactivée",
                  unavailable: "Indisponible",
                  error: "Indisponible",
                }[state]
              }
            </span>
          </header>
          <div aria-live="polite">
            {state === "loading" ? (
              <p className="public-unavailable" role="status">
                Chargement de la fiche…
              </p>
            ) : data && state === "active" ? (
              <>
                <div className="public-hero">
                  {(data.photo || data.style) && (
                    <Portrait
                      pet={{
                        name: data.name,
                        photo: data.photo,
                        style: data.style,
                      }}
                    />
                  )}
                  <span className="public-status">Fiche d’urgence</span>
                  <h1>{data.name}</h1>
                  <p className="muted">
                    {data.species}
                    {data.details ? " · " + data.details : ""}
                  </p>
                </div>
                <p className="public-note">
                  Vous avez retrouvé cet animal ? Les informations ci-dessous
                  ont été choisies par son propriétaire pour vous aider à
                  prendre contact.
                </p>
                {data.notes && (
                  <section>
                    <h2>Consignes utiles</h2>
                    <p className="muted emergency-notes">{data.notes}</p>
                  </section>
                )}
                {data.contact || data.vet ? (
                  <section>
                    <h2>Contacts partagés</h2>
                    {data.contact && (
                      <div className="public-contact">
                        <h3>Contact principal</h3>
                        <p className="muted">{data.contact}</p>
                        {phone ? (
                          <a
                            className="button"
                            href={"tel:" + phone.replace(/[ .-]/g, "")}
                          >
                            Appeler le contact
                          </a>
                        ) : email ? (
                          <a className="button" href={"mailto:" + email}>
                            Contacter par e-mail
                          </a>
                        ) : null}
                      </div>
                    )}
                    {data.vet && (
                      <div className="public-contact">
                        <h3>Vétérinaire habituel</h3>
                        <p className="muted">{data.vet}</p>
                      </div>
                    )}
                  </section>
                ) : (
                  <section>
                    <h2>Aucun contact partagé</h2>
                    <p className="muted">
                      Le propriétaire n’a pas ajouté de contact à cette fiche
                      publique.
                    </p>
                  </section>
                )}
              </>
            ) : (
              <div className="public-unavailable">
                <span className="public-icon">
                  <Icon name="lock" />
                </span>
                <h1>
                  {state === "disabled"
                    ? "Fiche désactivée"
                    : state === "error"
                      ? "Impossible de charger la fiche"
                      : "Fiche indisponible"}
                </h1>
                <p className="muted">
                  {state === "disabled"
                    ? "Le propriétaire a désactivé la consultation publique. Aucune information concernant l’animal ou ses contacts n’est affichée."
                    : state === "error"
                      ? "Vérifiez votre connexion et réessayez."
                      : "Cette fiche n’existe pas ou a été supprimée."}
                </p>
                <button
                  className="button outline"
                  onClick={() => {
                    setData(null);
                    setState("loading");
                    setRetry((v) => v + 1);
                  }}
                >
                  Réessayer
                </button>
              </div>
            )}
          </div>
        </main>
        <p className="muted public-footer">
          Anivaya · Seules les informations choisies par le propriétaire sont
          partagées.
        </p>
      </div>
    </div>
  );
}
