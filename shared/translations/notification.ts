import type { Notification } from "../models.ts";
import type { Translator } from "../translations.ts";

/** Only recognised system messages are translated. Captured names are always raw values. */
export function notificationText(
  notification: Pick<Notification, "category" | "title" | "text">,
  field: "title" | "text",
  tr: Translator,
) {
  const source = notification[field];
  if (field === "title") {
    // A reminder title can consist entirely of user-chosen reminder/animal names.
    if (notification.category === "reminders") {
      const match = /^Un rappel pour (.+)$/s.exec(source);
      return match ? tr("Un rappel pour {0}", [match[1]]) : source;
    }
    const templates: [string, RegExp, string][] = [
      ["social", /^Un message de (.+)$/s, "Un message de {0}"],
      ["social", /^Un échange dans (.+)$/s, "Un échange dans {0}"],
      [
        "social",
        /^(.+) souhaite devenir votre ami$/s,
        "{0} souhaite devenir votre ami",
      ],
      ["shares", /^(.+) vous partage « (.+) »$/s, "{0} vous partage « {1} »"],
    ];
    for (const [category, pattern, template] of templates) {
      const match = notification.category === category && pattern.exec(source);
      if (match) return tr(template, match.slice(1));
    }
  } else if (notification.category === "shares") {
    const match = /^Document de (.+), en lecture seule jusqu’au (.+)\.$/s.exec(
      source,
    );
    if (match)
      return tr("Document de {0}, en lecture seule jusqu’au {1}.", [
        match[1],
        match[2]
          .split(" ")
          .map((part) => tr(part))
          .join(" "),
      ]);
  } else if (notification.category === "reminders") {
    const match = /^À faire le (.+)\.$/s.exec(source);
    if (match) {
      const date = match[1]
        .split(" ")
        .map((part) => tr(part))
        .join(" ");
      return tr("À faire le {0}.", [date]);
    }
  }
  const systemCopy =
    field === "title"
      ? [
          "Votre rendez-vous est confirmé",
          "Votre partage est prêt",
          "Vos documents sont à portée de main",
          "Bienvenue dans votre espace Anivaya",
        ]
      : [
          "À faire aujourd’hui.",
          "Retrouvez la conversation dans votre espace Communautés.",
          "Consultez les invitations dans Mes amis, depuis la messagerie.",
          "Retrouvez ses prochaines échéances dans vos rappels.",
          "Consultez les détails de votre réservation.",
          "Retrouvez les accès accordés et vos personnes de confiance.",
          "Le dossier de vos compagnons est disponible.",
          "Personnalisez votre photo et vos coordonnées pour vous sentir chez vous.",
        ];
  return systemCopy.includes(source) ? tr(source) : source;
}
