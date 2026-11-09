/** Navigation et animations de la vitrine ; les formulaires sont gérés par React. */
export function mountLanding(host: HTMLElement, t: (text: string) => string) {
  const events = new AbortController();
  const { signal } = events;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Reprise des fondus, révélations décalées et accordéons de l'ancien accueil.
  const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  const running = new Set<Animation>();
  const animate = (
    el: HTMLElement,
    frames: Keyframe[],
    options: KeyframeAnimationOptions = {},
  ) => {
    if (reduced()) return null;
    const animation = el.animate(frames, {
      duration: 480,
      easing: "cubic-bezier(.22,.7,.2,1)",
      ...options,
    });
    running.add(animation);
    void animation.finished
      .catch(() => {})
      .finally(() => running.delete(animation));
    return animation;
  };
  motionPreference.addEventListener(
    "change",
    () => {
      if (reduced()) running.forEach((a) => a.finish());
    },
    { signal },
  );
  const reveal = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const section = entry.target as HTMLElement;
        section
          .querySelectorAll<HTMLElement>(
            ".hero__text > *, .head, .feature, .steps li, .rule, .price-card, .door, .join__intro > *",
          )
          .forEach((el, i) => {
            animate(
              el,
              [
                { opacity: 0, transform: "translateY(20px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              { delay: Math.min(i * 85, 340), fill: "backwards" },
            );
          });
        section
          .querySelectorAll<HTMLElement>(
            ".stage, .share__visual, .page-hero__visual",
          )
          .forEach((el) =>
            animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 800 }),
          );
        section.querySelector(".steps")?.classList.add("steps-revealed");
        reveal.unobserve(section);
      }),
    { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
  );
  host
    .querySelectorAll(".view > section")
    .forEach((section) => reveal.observe(section));
  const faqState = new Map<
    HTMLDetailsElement,
    { wanted: boolean; animation: Animation | null }
  >();
  host.addEventListener(
    "click",
    (event) => {
      const summary = (event.target as Element).closest("summary");
      const details = summary?.parentElement;
      if (!(details instanceof HTMLDetailsElement) || reduced()) return;
      event.preventDefault();
      const previous = faqState.get(details);
      const wanted = !(previous?.wanted ?? details.open);
      // offsetHeight : hauteur avant zoom, la même unité que le style animé (grands écrans).
      const start = details.offsetHeight;
      previous?.animation?.cancel();
      details.open = wanted;
      const end = details.offsetHeight;
      details.open = true;
      details.style.overflow = "hidden";
      const animation = animate(
        details,
        [{ height: start + "px" }, { height: end + "px" }],
        { duration: 280 },
      );
      const state = { wanted, animation };
      faqState.set(details, state);
      void animation?.finished
        .then(() => {
          if (faqState.get(details) !== state) return;
          details.open = wanted;
          details.style.removeProperty("overflow");
          faqState.delete(details);
        })
        .catch(() => {});
    },
    { signal },
  );
  const header = host.querySelector(".site-header");
  const views = [...host.querySelectorAll<HTMLElement>(".view")];
  let timer = 0,
    frame = 0;
  document.documentElement.classList.add("anivaya-blocks");
  const menu = host.querySelector<HTMLElement>("#menu")!;
  const button = host.querySelector<HTMLButtonElement>(".menu-btn")!;
  const previousOverflow = document.body.style.overflow;
  const setMenu = (open: boolean) => {
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute(
      "aria-label",
      t(open ? "Fermer le menu" : "Ouvrir le menu"),
    );
    menu.classList.toggle("is-open", open);
    menu.inert = !open && innerWidth <= 1100;
    document.body.style.overflow = open ? "hidden" : previousOverflow;
    dots.hidden = open;
  };
  const dots = document.createElement("nav");
  dots.className = "block-nav";
  dots.setAttribute("aria-label", t("Navigation entre les blocs"));
  host.append(dots);
  const sections = views.flatMap((v) => [
    ...v.querySelectorAll<HTMLElement>(":scope > section"),
  ]);
  sections.forEach((section, index) => {
    if (!section.id) section.id = "bloc-" + index;
  });
  const titleFor = (section: HTMLElement) =>
    section.querySelector<HTMLElement>("h1, h2") || section;
  // La zone lisible commence sous le header. L’accroche garde toute la section,
  // y compris sa séparation et son espace supérieur, au lieu de rogner jusqu’au titre.
  const measure = () => {
    const edge = (header?.getBoundingClientRect().height || 72) + 1;
    document.documentElement.style.setProperty(
      "--landing-scroll-edge",
      edge + "px",
    );
  };
  const updateDot = () => {
    const active = sections.filter((s) =>
      s.closest(".view")?.classList.contains("is-active"),
    );
    const line = (header?.getBoundingClientRect().height || 72) + 1;
    const current =
      active
        .filter((s) => s.getBoundingClientRect().top <= line + 0.5)
        .at(-1) || active[0];
    dots.querySelectorAll("a").forEach((a) => {
      if (a.hash === "#accueil/" + current?.id)
        a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
  };
  const buildDots = (view: HTMLElement) => {
    dots.replaceChildren();
    view
      .querySelectorAll<HTMLElement>(":scope > section")
      .forEach((section) => {
        const a = document.createElement("a");
        a.href = "#accueil/" + section.id;
        const label = titleFor(section).textContent?.trim() || t("Accueil");
        a.setAttribute("aria-label", label);
        const span = document.createElement("span");
        span.textContent = label;
        a.append(span);
        dots.append(a);
      });
    measure();
    updateDot();
  };
  const resize = new ResizeObserver(measure);
  host.addEventListener(
    "anivaya-home-language",
    () => {
      const view = views.find((view) => view.classList.contains("is-active"));
      if (view) buildDots(view);
      dots.setAttribute("aria-label", t("Navigation entre les blocs"));
      button.setAttribute(
        "aria-label",
        t(
          menu.classList.contains("is-open")
            ? "Fermer le menu"
            : "Ouvrir le menu",
        ),
      );
    },
    { signal },
  );
  sections.forEach((s) => resize.observe(s));
  if (header) resize.observe(header);
  button.addEventListener(
    "click",
    () => setMenu(button.getAttribute("aria-expanded") !== "true"),
    { signal },
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) {
        setMenu(false);
        button.focus();
      }
      if (e.key === "Tab" && menu.classList.contains("is-open")) {
        const links = [
          ...menu.querySelectorAll<HTMLElement>("a,button"),
        ].filter(
          (el) =>
            el.getClientRects().length && !(el as HTMLButtonElement).disabled,
        );
        if (e.shiftKey && document.activeElement === button) {
          e.preventDefault();
          links.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === links.at(-1)) {
          e.preventDefault();
          button.focus();
        }
      }
    },
    { signal },
  );
  window.addEventListener(
    "resize",
    () => {
      blockTarget = null;
      if (innerWidth > 1100) setMenu(false);
      else menu.inert = !menu.classList.contains("is-open");
    },
    { signal },
  );
  window.addEventListener("scroll", updateDot, { passive: true, signal });
  // Le navigateur conserve la vitesse et la durée actuelles du défilement.
  const moveBlock = (top: number, instant = false) => {
    window.scrollTo({
      top: Math.max(0, top),
      behavior: instant || reduced() ? "instant" : "smooth",
    });
  };
  let blockTarget: number | null = null;
  let blockDirection = 0;
  window.addEventListener(
    "scrollend",
    () => {
      blockTarget = null;
    },
    { signal },
  );
  window.addEventListener(
    "scroll",
    () => {
      if (blockTarget !== null && Math.abs(scrollY - blockTarget) < 2)
        blockTarget = null;
    },
    { passive: true, signal },
  );
  // Dans un bloc long, la molette reste native. À son bord, elle bascule
  // vers le bloc voisin avec le même défilement doux que les liens de section.
  host.addEventListener(
    "wheel",
    (event) => {
      if (
        event.ctrlKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
        !event.deltaY ||
        menu.classList.contains("is-open")
      )
        return;
      let element = event.target instanceof Element ? event.target : null;
      if (element?.closest("input,select,textarea,.account-popup")) return;
      while (element && element !== host) {
        if (
          /auto|scroll/.test(getComputedStyle(element).overflowY) &&
          element.scrollHeight > element.clientHeight + 1
        )
          return;
        element = element.parentElement;
      }
      const direction = Math.sign(event.deltaY);
      if (blockTarget !== null) {
        if (direction === blockDirection) {
          event.preventDefault();
          return;
        }
        // Une inversion de la molette interrompt immédiatement le basculement.
        window.scrollTo({ top: scrollY, behavior: "instant" });
        blockTarget = null;
        return;
      }
      const edge = (header?.getBoundingClientRect().height || 72) + 1;
      const visible = Math.max(1, innerHeight - edge);
      const end = Math.max(
        0,
        document.documentElement.scrollHeight - innerHeight,
      );
      const blocks = sections.filter(
        (section) => section.getClientRects().length,
      );
      const footer = host.querySelector<HTMLElement>(".site-footer");
      if (footer?.getClientRects().length) blocks.push(footer);
      const stops = [
        ...new Set([
          0,
          ...blocks.map((block) =>
            Math.max(
              0,
              Math.min(end, block.getBoundingClientRect().top + scrollY - edge),
            ),
          ),
          end,
        ]),
      ].sort((a, b) => a - b);
      const index = Math.max(
        0,
        stops.findLastIndex((top) => top <= scrollY + 2),
      );
      const start = stops[index];
      const next = stops[index + 1] ?? end;
      const bottom = Math.max(start, next - visible);
      const destination =
        direction > 0 && scrollY >= bottom - 2
          ? next
          : direction < 0 && scrollY <= start + 2
            ? Math.max(stops[index - 1] ?? 0, start - visible)
            : null;
      if (destination === null || Math.abs(destination - scrollY) < 2) return;
      event.preventDefault();
      blockTarget = destination;
      blockDirection = direction;
      moveBlock(destination);
    },
    { passive: false, signal },
  );
  const route = () => {
    blockTarget = null;
    if (location.hash && !/^#accueil(?:\/|$)/.test(location.hash)) return;
    const aliases: Record<string, string> = {
      quotidien: "fonctionnalites",
      fonctionnement: "comment",
      engagement: "sante",
      prochainement: "bientot",
      questions: "faq",
      bienvenue: "inscription",
      moments: "partage",
    };
    const requested = location.hash.replace(/^#accueil\/?/, "") || "accueil";
    const id = aliases[requested] || requested;
    const target = [...host.querySelectorAll<HTMLElement>("[id]")].find(
      (el) => el.id === id,
    );
    const view = target?.closest<HTMLElement>(".view") || views[0];
    const changed = !view.classList.contains("is-active");
    views.forEach((el) => el.classList.toggle("is-active", el === view));
    buildDots(view);
    window.dispatchEvent(new Event("anivaya-page-title"));
    setMenu(false);
    host.querySelectorAll<HTMLAnchorElement>(".nav__links a").forEach((a) => {
      if (a.dataset.nav === view.id) a.setAttribute("aria-current", "page");
      else if (a.getAttribute("href") === location.hash)
        a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const anchor = target || view;
      const top =
        anchor.getBoundingClientRect().top +
        window.scrollY -
        (header?.getBoundingClientRect().height || 72) -
        1;
      moveBlock(top, changed);
      if (id === "contenu") target?.focus({ preventScroll: true });
      if (changed) {
        const h = view.querySelector<HTMLElement>("h1");
        h?.setAttribute("tabindex", "-1");
        h?.focus({ preventScroll: true });
      }
    });
  };
  window.addEventListener(
    "scroll",
    () => header?.classList.toggle("is-scrolled", window.scrollY > 8),
    { passive: true, signal },
  );
  window.addEventListener("hashchange", route, { signal });
  host.addEventListener(
    "click",
    (e) => {
      const link = (e.target as Element).closest<HTMLAnchorElement>("a");
      if (link?.dataset.plan) {
        const offer = host.querySelector<HTMLInputElement>(
          '#inscription input[name="offre_visee"]',
        );
        if (offer) offer.value = link.dataset.plan;
      }
      if (link?.getAttribute("href") === "#connexion") setMenu(false);
      const href = link?.getAttribute("href");
      if (
        href?.match(/^#accueil(?:\/|$)/) &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        // Le fragment #accueil correspond aussi à un élément : empêcher son saut natif.
        e.preventDefault();
        if (href === location.hash) route();
        else {
          history.pushState(null, "", href);
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        }
      }
    },
    { signal },
  );
  const stage = host.querySelector<HTMLElement>(".stage");
  stage?.querySelectorAll<HTMLButtonElement>("[data-pet]").forEach((b) => {
    b.addEventListener(
      "click",
      () => {
        if (stage.dataset.animal === b.dataset.pet) return;
        stage.dataset.animal = b.dataset.pet;
        stage
          .querySelectorAll("[data-pet]")
          .forEach((el) => el.setAttribute("aria-pressed", String(el === b)));
        const swap = () => {
          stage.querySelectorAll<HTMLElement>("[data-screen]").forEach((el) => {
            el.hidden = el.dataset.screen !== b.dataset.pet;
          });
          stage.classList.remove("is-swapping");
        };
        clearTimeout(timer);
        if (reduced()) swap();
        else {
          stage.classList.add("is-swapping");
          timer = window.setTimeout(swap, 180);
        }
      },
      { signal },
    );
  });
  host.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
  route();
  return () => {
    events.abort();
    resize.disconnect();
    dots.remove();
    document.body.style.overflow = previousOverflow;
    reveal.disconnect();
    running.forEach((a) => a.cancel());
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    document.documentElement.classList.remove("anivaya-blocks");
    document.documentElement.style.removeProperty("--landing-scroll-edge");
  };
}
