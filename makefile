# Makefile — Slack Learning Bot

# Variables
PORT ?= 4000

# La cible par défaut (executée quand on fait juste "make")
default: welcome

.PHONY: welcome install dev start tunnel env

welcome:
	@echo ""
	@echo "🚀 Bienvenue sur le Slack Learning Bot !"
	@echo ""
	@echo "Lancer make tunnel puis make start pour démarrer le bot en local."
	@echo ""
	@echo "Commandes disponibles :"
	@echo "  make install   → installe les dépendances (npm i)"
	@echo "  make start     → lance le serveur"
	@echo "  make tunnel    → démarre ngrok sur le port $(PORT)"
	@echo "  make env       → affiche les variables d'environnement"
	@echo ""
	@echo "Exemples :"
	@echo "  make all"
	@echo "  make tunnel PORT=4000"
	@echo ""

install:
	@echo "Installation des dépendances..."
	npm install

start:
	@echo "Lancement du serveur en mode développement..."
	npm run dev

tunnel:
	@echo "Démarrage de ngrok sur le port $(PORT)..."
	ngrok http $(PORT)

env:
	@echo "Variables d'environnement actuelles :"
	@grep -v '^#' .env || echo "Aucun fichier .env trouvé."
