# Tastevin

Carnet de dégustation pour vins, bières et spiritueux : on note la robe, le nez, la bouche,
la structure et une note sur 20, en quelques gestes, pendant qu’on parle au vigneron.

**Appli :** <https://ghisdubreuil.github.io/tastevin/>
On peut l’ajouter à l’écran d’accueil. Elle marche hors ligne.

## Ce qu’on y fait

- **Carnet** : toutes les dégustations, avec recherche (domaine, cuvée, cépage, millésime…),
  filtre vin, bière ou spiritueux, et tri par date ou par note.
- **Déguster**, au choix de trois modes :
  - **Fiche rapide** : la bouteille, une photo, la note et tes remarques, sur un seul écran,
    quand le temps manque.
  - **Dégustation complète**, en 7 écrans : la boisson et sa famille ; les détails, avec un
    mode avancé (origine, parcelle, cépages, degré, prix, élevage) ; l’œil, avec un verre
    qui prend la couleur choisie sur un dégradé propre à la boisson ; le nez et la bouche,
    avec 14 familles d’arômes, leurs sous-arômes, une recherche et une intensité de 0 à 10 ;
    la structure ; la note sur 20 et le commentaire.
  - **À l’aveugle** : l’œil, le nez, la bouche, la structure et la note, sans voir
    l’étiquette, puis les pronostics : cépage ou cépages, région, château. Il n’y a pas de
    bonne réponse dans l’appli : les pronostics de chacun sont rangés par date dans le
    palmarès, pour les comparer ensemble lors de la session.
  - Dans tous les modes, la note reste vierge tant qu’on n’a pas noté.
- **Sessions** à l’aveugle, en groupe :
  - l’**organisateur** (mode activé dans Réglages par un mot de passe) crée la session,
    son thème réel caché et ses bouteilles numérotées 1, 2, 3… sans limite, avec
    l’identité complète et une photo ;
  - chaque **participant** ouvre la session : les bouteilles s’affichent en tuiles, il
    déguste et donne ses pronostics (cépages, région, château), voit ceux de la tablée et
    propose le thème commun ;
  - l’organisateur **déclare la fin** : les pronostics sont comparés à la réalité, avec
    une tolérance aux accents et aux fautes de frappe, et le vainqueur est désigné.
    Barème : 3 points par cépage trouvé (−1 par cépage faux), 2 pour la région, 3 pour le
    château, 5 pour le thème.
  - Tout le monde doit utiliser le même code de cave.
- **Fiche** : tout le détail, avec « Modifier » et « Re-déguster » (une nouvelle note du même vin).
- **Palmarès** : top 10, producteurs et arômes les plus cités.
- **Réglages** : prénom, code de cave partagée, export JSON ou CSV, import (y compris
  l’export de Vinlo).

## Design

Fond blanc et ivoire, filets fins, vert de vigne, bordeaux et or. Cormorant Garamond pour
les titres, à la manière d’une étiquette de domaine, et Manrope pour l’interface. Les
tailles de texte et les espacements sont fluides (`clamp`) et les grilles se replient
d’elles-mêmes : rien ne déborde, de 240 px de large à l’ordinateur, même texte agrandi à
200 %.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `style.css`, `app.js` | L’appli (aucune étape de build) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installation et usage hors ligne |
| `backend/tastevin.gs` | Serveur Google Apps Script (Sheet et photos Drive) |

## Serveur

Les dégustations sont gardées sur le téléphone. Avec un code de cave, elles sont aussi
envoyées à une Google Sheet, et tous ceux qui ont le code partagent le même carnet.

- Le code n’est jamais dans le dépôt : il se règle dans le script déployé (`CODE`) ou dans
  une propriété de script `CODE`.
- Avant la première utilisation, ouvre le projet Apps Script, choisis `setup` puis
  **Exécuter**, et accepte les autorisations.
- Après une modification du script : **Déployer > Gérer les déploiements > Modifier >
  Nouvelle version**, pour garder la même URL (constante `API` dans `app.js`).
