import PublicHeader from "../../shared/layout/PublicHeader.tsx";
import { useState } from "react";
import type { KeyboardEvent } from "react";
export default function HomePage() {
  const [situation, setSituation] = useState("appointment");
  function changeTab(event: KeyboardEvent<HTMLButtonElement>) {
    const tabs = ["appointment", "away", "daily"];
    const i = tabs.indexOf(situation);
    let next: number;
    if (event.key === "ArrowRight") next = (i + 1) % 3;
    else if (event.key === "ArrowLeft") next = (i + 2) % 3;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 2;
    else return;
    event.preventDefault();
    setSituation(tabs[next]);
    document.getElementById("tab-" + tabs[next])?.focus();
  }
  return (
    <div className="public-site">
      <a
        className="skip"
        href="#contenu"
        onClick={(event) => {
          event.preventDefault();
          document
            .getElementById("contenu")
            ?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        Aller au contenu
      </a>
      <PublicHeader />
      <main id="contenu">
        <section className="hero wrap" aria-labelledby="titre">
          <div className="hero-copy">
            <h1 id="titre">
              Leur petite vie.
              <br />
              <span>Votre grande histoire.</span>
            </h1>
            <p>
              Le carnet, les documents et les rappels de vos chiens et chats.
              Tout au même endroit, pour profiter du reste ensemble.
            </p>
            <div className="hero-actions">
              <a className="button gold-button" href="#espace">
                Essayer le carnet
              </a>
              <a
                className="text-link"
                href="#fonctionnement"
                onClick={(event) => {
                  event.preventDefault();
                  document
                    .getElementById("fonctionnement")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Voir comment ça marche
              </a>
            </div>
            <p className="hero-demo-note">
              Compte de démonstration disponible · Sans inscription
            </p>
          </div>
          <div className="hero-media">
            <img
              src="/images/maquettes/d25132e6896e1d07.png"
              alt="Un chien et un chat, côte à côte dans une maison lumineuse"
              width="1448"
              height="1086"
              fetchPriority="high"
            />
          </div>
        </section>
        <div className="ribbon">
          <span aria-hidden="true">♡</span> Toute leur vie, à vos côtés.{" "}
          <span aria-hidden="true">♡</span>
        </div>
        <section
          className="essentials wrap"
          id="quotidien"
          aria-labelledby="essentials-title"
        >
          <h2 id="essentials-title">Leur quotidien, enfin au même endroit.</h2>
          <div className="feature-grid">
            <article className="feature">
              <span className="icon-disc">
                <svg aria-hidden="true">
                  <use href="#file" />
                </svg>
              </span>
              <div>
                <h3>Retrouvez le bon document</h3>
                <p>Ses papiers réunis dans son carnet, faciles à retrouver.</p>
              </div>
            </article>
            <article className="feature">
              <span className="icon-disc">
                <svg aria-hidden="true">
                  <use href="#calendar" />
                </svg>
              </span>
              <div>
                <h3>Gardez les dates en tête</h3>
                <p>
                  Un rendez-vous ou un départ à préparer ? Gardez vos échéances
                  sous la main.
                </p>
              </div>
            </article>
            <article className="feature">
              <span className="icon-disc">
                <svg aria-hidden="true">
                  <use href="#people" />
                </svg>
              </span>
              <div>
                <h3>Facilitez le relais</h3>
                <p>
                  Ses habitudes et les contacts utiles, pour préparer le relais
                  avec un proche.
                </p>
              </div>
            </article>
          </div>
        </section>
        <section className="moments" aria-labelledby="moments-title">
          <div className="moments-grid wrap">
            <figure className="life-photo">
              <img
                src="/images/maquettes/bdd78c8f6974390d.png"
                alt="Une femme partage un moment de tendresse à la maison avec un chien et un chat"
                width="1448"
                height="1086"
                loading="lazy"
              />
              <figcaption>
                Un peu de présence, quelques habitudes, et beaucoup d’affection.
              </figcaption>
            </figure>
            <div>
              <h2 id="moments-title">
                Moins de choses à retenir.
                <br />
                <span>Plus de moments à partager.</span>
              </h2>
              <p className="moments-intro">
                À chaque situation, les bonnes informations. Choisissez celle
                qui vous ressemble.
              </p>
              <div
                className="moment-tabs"
                role="tablist"
                aria-label="Choisir une situation du quotidien"
              >
                <button
                  type="button"
                  role="tab"
                  id="tab-appointment"
                  aria-controls="panel-appointment"
                  aria-selected={situation === "appointment"}
                  tabIndex={situation === "appointment" ? 0 : -1}
                  onClick={() => setSituation("appointment")}
                  onKeyDown={changeTab}
                >
                  Un rendez-vous
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-away"
                  aria-controls="panel-away"
                  aria-selected={situation === "away"}
                  tabIndex={situation === "away" ? 0 : -1}
                  onClick={() => setSituation("away")}
                  onKeyDown={changeTab}
                >
                  Une absence
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-daily"
                  aria-controls="panel-daily"
                  aria-selected={situation === "daily"}
                  tabIndex={situation === "daily" ? 0 : -1}
                  onClick={() => setSituation("daily")}
                  onKeyDown={changeTab}
                >
                  En famille
                </button>
              </div>
              <div
                className="situation-panel"
                id="panel-appointment"
                role="tabpanel"
                aria-labelledby="tab-appointment"
                tabIndex={0}
                hidden={situation !== "appointment"}
              >
                <h3>Avant le rendez-vous, tout retrouver.</h3>
                <p>
                  La laisse, la caisse de transport… et les documents. Retrouvez
                  l’essentiel avant de partir.
                </p>
                <ul>
                  <li>
                    Retrouvez ses documents et les informations déclarées.
                  </li>
                  <li>
                    Notez la date du prochain rendez-vous dans ses rappels.
                  </li>
                </ul>
              </div>
              <div
                className="situation-panel"
                id="panel-away"
                role="tabpanel"
                aria-labelledby="tab-away"
                tabIndex={0}
                hidden={situation !== "away"}
              >
                <h3>Partir avec les idées plus légères.</h3>
                <p>
                  Son repas préféré, sa promenade du soir : préparez ses
                  habitudes pour la personne qui prend le relais.
                </p>
                <ul>
                  <li>Rassemblez ses habitudes et les contacts à retrouver.</li>
                  <li>Prévoyez un rappel pour préparer ses affaires.</li>
                </ul>
                <p className="panel-note">
                  Le partage d’une fiche de garde sera proposé dans une
                  prochaine étape.
                </p>
              </div>
              <div
                className="situation-panel"
                id="panel-daily"
                role="tabpanel"
                aria-labelledby="tab-daily"
                tabIndex={0}
                hidden={situation !== "daily"}
              >
                <h3>Une petite tribu, des besoins différents.</h3>
                <p>
                  Chacun son caractère, chacun son carnet. Gardez les bonnes
                  informations pour chaque compagnon.
                </p>
                <ul>
                  <li>Créez un carnet pour chacun de vos animaux.</li>
                  <li>Associez ses rappels et ses documents à son profil.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
        <section
          className="how"
          id="fonctionnement"
          aria-labelledby="how-title"
        >
          <div className="how-grid wrap">
            <div>
              <h2 id="how-title">
                De vos premiers clics à leurs petits repères.
              </h2>
              <p className="how-intro">Trois étapes, à votre rythme.</p>
            </div>
            <ol className="steps">
              <li>
                <span className="step-number">1</span>
                <h3>Créez son profil</h3>
                <p>Ajoutez votre chien ou votre chat et ses informations.</p>
              </li>
              <li>
                <span className="step-number">2</span>
                <h3>Rassemblez l’essentiel</h3>
                <p>Rangez ses documents dans son carnet.</p>
              </li>
              <li>
                <span className="step-number">3</span>
                <h3>Organisez votre quotidien</h3>
                <p>Notez vos dates et retrouvez ses repères.</p>
              </li>
            </ol>
          </div>
        </section>
        <section className="outside">
          <div className="outside-grid wrap">
            <img
              src="/images/maquettes/c1c0f5f9beaaefe1.png"
              alt="Un couple partage une promenade au parc avec son chien en laisse"
              width="1536"
              height="1024"
              loading="lazy"
            />
            <div>
              <h2>
                Les papiers rangés.
                <br />
                La vie devant vous.
              </h2>
              <p>
                Une promenade, un départ, une nouvelle habitude…
                <br />
                Gardez une place pour les moments qui comptent.
              </p>
              <span className="outside-signature">
                Toute leur vie, à vos côtés.
              </span>
            </div>
          </div>
        </section>
        <section
          className="trust wrap"
          id="engagement"
          aria-labelledby="trust-title"
        >
          <div className="trust-copy">
            <h2 id="trust-title">Leur bien-être mérite votre confiance.</h2>
            <p>
              Vous connaissez votre animal. Anivaya vous aide à garder ses
              repères, avec des règles claires.
            </p>
            <p className="trust-signature">
              Une technologie pour vous accompagner.
              <br />
              Des professionnels pour les soigner.
            </p>
          </div>
          <div>
            <article className="trust-row">
              <svg aria-hidden="true">
                <use href="#lock" />
              </svg>
              <div>
                <h3>Vous gardez la main</h3>
                <p>
                  Un dossier privé et une fiche d’urgence dont vous choisissez
                  les informations visibles.
                </p>
              </div>
            </article>
            <article className="trust-row">
              <svg aria-hidden="true">
                <use href="#check" />
              </svg>
              <div>
                <h3>Des informations à vérifier</h3>
                <p>
                  Avec le futur import IA, vous relisez et confirmez les
                  informations extraites.
                </p>
              </div>
            </article>
            <article className="trust-row">
              <svg aria-hidden="true">
                <use href="#medical" />
              </svg>
              <div>
                <h3>Le vétérinaire reste votre référence</h3>
                <p>
                  L’organisation sur Anivaya ; les diagnostics et les soins chez
                  votre vétérinaire.
                </p>
              </div>
            </article>
          </div>
        </section>
        <section
          className="future"
          id="prochainement"
          aria-labelledby="future-title"
        >
          <div className="wrap">
            <div className="section-intro">
              <h2 id="future-title">
                Et bientôt, un peu plus de monde autour de vous.
              </h2>
              <p>
                Après le carnet, des services et des rencontres près de chez
                vous.
              </p>
            </div>
            <div className="future-grid">
              <article className="future-item">
                <svg aria-hidden="true">
                  <use href="#pin" />
                </svg>
                <h3>Trouver un professionnel</h3>
                <p>
                  Cliniques, éducateurs et toiletteurs : les contacts utiles à
                  proximité.
                </p>
              </article>
              <article className="future-item">
                <svg aria-hidden="true">
                  <use href="#bag" />
                </svg>
                <h3>Préparer une garde</h3>
                <p>
                  Une personne de confiance et les bonnes consignes pour son
                  séjour.
                </p>
              </article>
              <article className="future-item">
                <svg aria-hidden="true">
                  <use href="#people" />
                </svg>
                <h3>Faire de belles rencontres</h3>
                <p>
                  Des balades et des activités à partager près de chez vous.
                </p>
              </article>
            </div>
            <p className="future-note">
              L’annuaire et les réservations sont disponibles en démonstration.
              Les services réels et les rencontres viendront ensuite.
            </p>
          </div>
        </section>
        <section
          className="faq wrap"
          id="questions"
          aria-labelledby="faq-title"
        >
          <div className="faq-heading">
            <h2 id="faq-title">Vous vous posez peut-être ces questions.</h2>
          </div>
          <div className="faq-grid">
            <details>
              <summary>À quels animaux s’adresse Anivaya ?</summary>
              <p>
                Le projet s’adresse d’abord aux propriétaires de chiens et de
                chats. Chaque animal dispose de son propre carnet. Une ouverture
                à d’autres espèces pourra être étudiée plus tard.
              </p>
            </details>
            <details>
              <summary>Puis-je ajouter plusieurs animaux ?</summary>
              <p>
                Oui, vous pouvez créer plusieurs profils dans le même foyer.
                Leurs informations, documents et rappels restent rattachés au
                bon compagnon.
              </p>
            </details>
            <details>
              <summary>Est-ce un carnet de santé officiel ?</summary>
              <p>
                Le carnet Anivaya rassemble les informations et documents que
                vous ajoutez. Il reste déclaratif et ne remplace pas les
                documents officiels ni les informations validées par votre
                vétérinaire.
              </p>
            </details>
            <details>
              <summary>
                Mes documents sont-ils visibles par tout le monde ?
              </summary>
              <p>
                Vos documents sont privés et enregistrés dans votre compte. Les
                partages de documents sont simulés pour le moment. Seules les
                informations que vous sauvegardez dans une fiche d’urgence
                active sont consultables via son lien public.
              </p>
            </details>
            <details>
              <summary>
                Puis-je déjà réserver une garde ou un rendez-vous ?
              </summary>
              <p>
                Vous pouvez essayer le parcours dans l’annuaire : choisir un
                professionnel, un service et un créneau. La réservation est
                conservée dans votre compte, mais les professionnels et
                paiements restent fictifs. Aucun rendez-vous réel n’est pris.
              </p>
            </details>
            <details>
              <summary>Que puis-je essayer dans la démo ?</summary>
              <p>
                Vous pouvez explorer un foyer fictif, ajouter un animal ou un
                rappel, ouvrir les fiches et manipuler des documents de test. La
                connexion est réelle et les modifications sont conservées après
                actualisation. Aucune notification réelle n’est envoyée.
              </p>
            </details>
          </div>
        </section>
        <section className="invitation" aria-labelledby="invitation-title">
          <h2 id="invitation-title">
            Une place pour eux.
            <br />
            Un peu de simplicité pour vous.
          </h2>
          <p>L’essentiel bien rangé. Le reste à vivre ensemble.</p>
          <a className="button" href="#espace">
            Essayer le carnet
          </a>
          <small>
            Un compte de démonstration est disponible sur la page de connexion.
          </small>
        </section>
      </main>
      <footer className="footer wrap">
        <div className="footer-brand">
          <a href="#accueil" aria-label="Anivaya, retour à l’accueil">
            <img src="/images/logo.png" alt="Anivaya" width="72" height="63" />
          </a>
          <p>
            Toute leur vie,
            <br />à vos côtés.
          </p>
        </div>
        <nav aria-label="Navigation de pied de page">
          <a href="#contact">Contact et informations</a>
          <a
            href="#quotidien"
            onClick={(event) => {
              event.preventDefault();
              document
                .getElementById("quotidien")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Le quotidien
          </a>
          <a
            href="#engagement"
            onClick={(event) => {
              event.preventDefault();
              document
                .getElementById("engagement")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Notre engagement
          </a>
          <a
            href="#questions"
            onClick={(event) => {
              event.preventDefault();
              document
                .getElementById("questions")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Questions fréquentes
          </a>
        </nav>
        <div className="footer-bottom">
          <span>Anivaya · Toute leur vie, à vos côtés.</span>
          <span>Pour les chiens, les chats et les humains qui les aiment.</span>
        </div>
      </footer>
      <svg className="svg-library" xmlns="http://www.w3.org/2000/svg">
        <symbol id="file" viewBox="0 0 24 24">
          <path d="M6 3h8l5 5v13H6zM14 3v6h5M9 13h7M9 17h5" />
        </symbol>
        <symbol id="calendar" viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 2v6M17 2v6M3 11h18M7 15h2M15 15h2M7 18h2" />
        </symbol>
        <symbol id="people" viewBox="0 0 24 24">
          <circle cx="12" cy="7" r="4" />
          <path d="M5 22v-4a7 7 0 0 1 14 0v4zM3 7a3 3 0 0 0 0 6M21 7a3 3 0 0 1 0 6M2 16l-1 5M22 16l1 5" />
        </symbol>
        <symbol id="medical" viewBox="0 0 24 24">
          <path d="M5 3v5a5 5 0 0 0 10 0V3M3 3h4M13 3h4M10 13v3a5 5 0 0 0 10 0v-2" />
          <circle cx="20" cy="11" r="3" />
        </symbol>
        <symbol id="bag" viewBox="0 0 24 24">
          <rect x="3" y="7" width="18" height="14" rx="2" />
          <path d="M8 7V3h8v4M8 7v14M16 7v14" />
        </symbol>
        <symbol id="home" viewBox="0 0 24 24">
          <path d="m2 11 10-8 10 8M5 9v12h5v-7h4v7h5V9" />
        </symbol>
        <symbol id="lock" viewBox="0 0 24 24">
          <rect x="5" y="10" width="14" height="12" rx="2" />
          <path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3" />
        </symbol>
        <symbol id="check" viewBox="0 0 24 24">
          <path d="m4 13 5 5L21 6" />
        </symbol>
        <symbol id="pin" viewBox="0 0 24 24">
          <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </symbol>
      </svg>
    </div>
  );
}
