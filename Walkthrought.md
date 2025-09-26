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
