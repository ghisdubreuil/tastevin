# Tastevin

Carnet de dégustation pour vins, bières et spiritueux : on note la robe, le nez, la bouche,
la structure et une note sur 20, en quelques gestes, pendant qu’on parle au vigneron.

**Appli :** <https://ghisdubreuil.github.io/tastevin/>
On peut l’ajouter à l’écran d’accueil. Elle marche hors ligne.

## Ce qu’on y fait

- **Carnet** : toutes les dégustations, avec recherche (domaine, cuvée, cépage, millésime…),
  filtre vin, bière ou spiritueux, et tri par date ou par note.
- **Déguster**, en 7 écrans :
  1. le type de boisson et sa famille ;
  2. les détails : producteur, cuvée, millésime, photo, avec un mode avancé (origine,
     parcelle, cépages, degré, prix, élevage) ;
  3. l’œil : un verre qui prend la couleur choisie sur un dégradé propre à la boisson,
     puis l’aspect ;
  4. le nez, puis 5. la bouche : 14 familles d’arômes, chacune avec ses sous-arômes, une
     recherche et une intensité de 0 à 10 ;
  6. la structure : acidité, sucre, corps, attaque, longueur…
  7. la note sur 20, le dégustateur, la date, le lieu, les accords et un commentaire.
- **Fiche** : tout le détail, avec « Modifier » et « Re-déguster » (une nouvelle note du même vin).
- **Palmarès** : top 10, producteurs et arômes les plus cités.
- **Réglages** : prénom, code de cave partagée, export JSON ou CSV, import (y compris
  l’export de Vinlo).

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
