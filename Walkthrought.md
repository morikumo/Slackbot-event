# Slack Learning Bot

## Rapport
En quelques mots, on a pour le moment un formulaire qui s'ouvre lorsque l'on fait la commande /learning. Trés inspiré du fameux shf je me suis tourné vers Grégoire pour avoir des conseils, par ces valeureux conseils j'ai opté pour une stack en express pour le moment le tout sur du js. Pourquoi express? Parce que par défaut Slack pour ces Slackbot prèfére utilsé Bolt mais est peu fléxible concernant le appel API donc bon on fait le choix de rester scalable pour la suite.

Il a fallu donc créer une app slack, l'installer sur un workspace personnel qui va nous permettre de faire nos test et d'avancer, de nombreux ajout a notre scope est nécessaire pour avoir acces à certaine options pour notre commande. Une fois fait on crée notre commande /learning mais premier problème on doit fournir une URL car les commandes fonctionne en Webhook et du coup en http il nous fallait donc un tunnel distant. C'est la que ngrok apparait, c'est un outil qui permet d'exposer sa machine sur internet en 2 minutes. Cela est très pratique pour tester les webhooks. Et surtout ça nous fourni une url qui se fait passé pour notre localhost, donc on reste en local sous fond d'internet quoi.

Ensuite, il a fallu coder les comportements du bot, j'ai commencé par un ping pour voir ce que renvoyé slack en réponse.J'ai pu adapter le tout et recevoir pong. Parfait on à donc bien installé l'app et confectionné le tout. Maintenant /learning. On a d'abord ouvert un modal (notre formulaire) avec un champ. Mais il a fallu aussi activé l'option interactivité pour agir une fois le form rempli. Il a donc fallu activer cette option et codé le comportement de celui-ci une fois fait.

Enfin, il est désormais possible de remplir ce form et recevoir une notification dans le channel learning-session uniquement. Contenant le nom de l'intervenant, la date, le sujet, une petite description et si souhaité des ressources.

Pour la suite on va tenté de connecter les API google et notion et crée le système de rappel en priorité !

## Contenu du code :

Alors le code est séparer en 3 voir 4 grande parties: 
  - Initialisation et chargement des variables d'env
  - Middleware pour vérifier la signature Slack
  - Routes pour les commandes slash (ex: /learning)
  - Gestion de l'intéractivité




## Ce qui est fait
- **Express** : choisi à la place de Bolt parce que Bolt se concentre uniquement sur slack or ici on aura à connecter à d’autres APIs (Google, Notion…).
- **ngrok** : permet d’exposer ton serveur local en HTTPS pour que Slack puisse l’appeler.(a changer dans le futur c'est une solution pour utilisé nos webhook actuellement)
- **/learning** : ouvre un formulaire (modal) dans Slack, l’utilisateur remplit les infos (qui, quoi, quand, description, ressource) et le bot poste un récap dans le channel de learning.

## Étapes suivantes
1. Rappels automatiques (CRON) ✅ priorité  
2. Connexion à l’API Google + Notion ✅ priorité  
3. Statistiques (nombre de learnings, participants, etc.)  
4. Système de votes pour choisir les prochains sujets 




Etape 2 :
# Slack Learning Bot — Intégration avec Google Calendar

## Aperçu général
Le bot Slack permet de planifier automatiquement les **sessions de learning** d’équipe via un simple formulaire Slack.  
Chaque soumission crée un **événement dans Google Calendar** et un **message récapitulatif** dans un canal Slack dédié. J'ai aussi ajouté un petit makefile pour faciliter l'utilisation du projet (pour le moment).

---

## Stack et architecture
- **Express.js** → serveur principal (au lieu de Bolt, pour ouvrir vers d’autres API).  
- **Slack Web API** → gestion des slash commands et modals.  
- **Google Calendar API (v3)** → création des événements.  
- **Luxon** → gestion des dates, fuseaux horaires et formatage.

---

## Fonctionnement
1. L’utilisateur exécute `/learning` sur Slack.  
2. Le bot ouvre un **modal** demandant :
   - la personne concernée,  
   - le nom de la learning,  
   - la date,  
   - une description et une ressource (optionnelle).  
3. À la validation :
   - Les données sont vérifiées côté serveur.  
   - Un événement est créé dans **Google Calendar**.  
   - Un message récapitulatif est posté dans **le canal Slack configuré**.

---

## Intégration Google Calendar

### Étapes de configuration
1. Créer un **projet Google Cloud** et activer **Google Calendar API**.  
2. Créer un **compte de service** et générer une **clé JSON**.  
3. Partager votre calendrier d’équipe avec le **service account**  
   (droit “Apporter des modifications et gérer le partage”).  
4. Ajouter les variables suivantes dans `.env` :
   ```bash
   GCAL_KEY_FILE=./learning-bot-xxxxx.json
   GCAL_CALENDAR_ID=xxxxx@group.calendar.google.com


A suivre : 
## Étapes suivantes

### 1. Données et intégrations
- Compléter et structurer les données (`who`, `what`, `when`, `desc`, `resrc`).
- Envisager une sauvegarde Notion des learnings (via API) pour consultation et statistiques.
- Ajouter un **ID interne** par learning pour relier Slack, Calendar et Notion.

### 2. Google Calendar
- Étendre les permissions pour permettre la création automatique d’un lien Meet

# 25 novembre :

# Learning Bot

## Objectif final
Construire un flux complet :
**Slack → Google Calendar → Notion**,  
avec **rappels automatiques** et bases du **CI/CD**.

---

## Priorités d’ici jeudi

### 1) Slack → Google Calendar

### 2) Ajouter l’intégration Notion
- Créer une fiche automatiquement à chaque learning.
- Sert d'historique + début des statistiques.

### 3) Ajouter les rappels Slack automatiques
- J-1 à XXh  
- Le jour meme a XXh aussi avant la learning

---

## (Objectif ambitieux)

- Génération automatique du **lien Google Meet** (nécessite OAuth / Workspace).
- Déploiement complet Docker + Cloud Run.
- Statistiques avancées.
- Gestion de suppression des event

---

## Démo recommandée
1. `/learning` dans Slack   ✅
2. Event visible dans Google Calendar  ✅
3. Fiche générée dans Notion  ✅
4. Rappel Slack programmé  ✅

Ambitieux :
1. Lien meet avec Oauth ✅
2. CI/CD github action (solution a trouver pour ngrok -> Render) ⚠️ 🚧 ✅(Render et solution a ngrok)
3. Gestion de la suppression de l'event (supprimer les rappel et les event Google, slack et Notion) 🧠


Contacte Marie pour voir ce qu'elle en pense

Pourquoi Render + Github action :

Github action : CI et test avant déploiment

Render : CD et url publique a utilisé

On a tous simplement utilsé Render pour l'url publique surtout. CAr github ne le fait pas. Facilité la tache aussi les job github peuvent etre verbeux. Et enfin pas besoin d'aucun YAML pour Render, ça va vite.


-- 30/12/2025 --
Les liens meet on été mis en places, reste a voir les limites de celui pour ne pas causer de problème.

Mais avant tout je mets en place des routes de debug pour assurer la santé du projet.

Ce qui as ete mis en place:

- Middlaware pour verifier la présence de token pour lancer la route (ou non) -- admin.js
- Un fichier debug routes, pour un debug complet -- debugRoutes.js

Pistes à observer :
- 1) Faires des learning avec des comptes qui ne sont pas de googles
- 2) Faires des learning le meme jour que certaines autre
- 3) Voir si c'est possible de éditer/supprimer le liens meet, meme si ce n'est pas la personne qui a fait la learning
- 4) Si édition il y a, est-ce que le lien meet change, meme si on ne touche pas au lien meet

1) ✅
   Premier test avec le compte de l'appli learning, la learning est bien faite mais ne genere pas de lien meet.
   Avec autre compte Google meme fonctionnement que le précedent, ce qui peut etre facheux car il faudrait que je puisse le faire via tout les comptes googles.

2) 