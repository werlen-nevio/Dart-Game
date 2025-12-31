Badge hinzufügen:
docker exec dart-game-backend node add-badge.js "Username" "badge-id" "Badge Name" "🏆" "Beschreibung"

Badge entfernen:
docker exec dart-game-backend node remove-badge.js "Username" "badge-id"

Zeigt alle Badges eines Benutzers an.
docker exec dart-game-backend node list-badges.js "Mr. Blindsight"
