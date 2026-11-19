/* Sāqiya — réglages du site vitrine.
   Sur le PC (serveur Python) : le tableau de bord est à « /app/ » et les chiffres en direct sont disponibles.
   Sur GitHub Pages, ce fichier est remplacé au moment de la publication (voir .github/workflows/pages.yml)
   par l'adresse du tableau de bord choisie dans Settings › Secrets and variables › Actions › Variables › SAQIYA_APP_URL. */
window.SAQIYA = {
  app: "/app/",     // adresse du tableau de bord
  live: true,       // chiffres de la parcelle en direct (seulement quand le site est servi par le serveur Python)
  embed: true,      // aperçu du tableau de bord intégré dans la page
};
