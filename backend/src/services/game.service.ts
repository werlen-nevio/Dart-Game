import { GameSettings, GameStateDTO, PlayerScore } from '../types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  requiresCheckoutConfirm?: boolean;
}

export class GameService {
  /**
   * Validates a score entry for X01 game mode
   */
  validateScoreEntry(
    currentScore: number,
    points: number,
    settings: GameSettings
  ): ValidationResult {
    // Points must be positive
    if (points < 0) {
      return { valid: false, error: 'Points must be positive' };
    }

    // Maximum possible in 3 darts is 180
    if (points > 180) {
      return { valid: false, error: 'Maximum points per turn is 180' };
    }

    const newScore = currentScore - points;

    // Bust: score cannot go below 0
    if (newScore < 0) {
      return { valid: false, error: 'Bust! Score cannot go below 0' };
    }

    // Check if this is a checkout attempt (score would be 0)
    if (newScore === 0) {
      // Double-Out rule: need confirmation that last dart was a double
      if (settings.outRule === 'double') {
        return {
          valid: true,
          requiresCheckoutConfirm: true,
        };
      }

      // Single-Out: checkout is always valid if exactly 0
      return { valid: true };
    }

    // Double-Out rule: cannot end on 1 (impossible to checkout with double)
    if (newScore === 1 && settings.outRule === 'double') {
      return { valid: false, error: 'Bust! Cannot end on 1 with Double-Out rule' };
    }

    // Valid non-checkout entry
    return { valid: true };
  }

  /**
   * Validates a checkout confirmation
   */
  validateCheckout(
    currentScore: number,
    points: number,
    isDouble: boolean,
    settings: GameSettings
  ): ValidationResult {
    const newScore = currentScore - points;

    if (newScore !== 0) {
      return { valid: false, error: 'Checkout must result in exactly 0' };
    }

    if (settings.outRule === 'double' && !isDouble) {
      return { valid: false, error: 'Double-Out: Last dart must be a double' };
    }

    return { valid: true };
  }

  /**
   * Initialize game state for X01
   */
  initializeGameState(playerIds: string[], settings: GameSettings): GameStateDTO {
    const scores: Record<string, PlayerScore> = {};

    for (const playerId of playerIds) {
      scores[playerId] = {
        score: settings.startScore,
        history: [],
      };
    }

    return {
      mode: 'X01',
      settings,
      scores,
      turnIndex: 0,
      playerOrder: playerIds,
      status: 'playing',
      winnerId: null,
    };
  }

  /**
   * Apply a score entry to game state
   */
  applyScoreEntry(
    gameState: GameStateDTO,
    userId: string,
    points: number
  ): { gameState: GameStateDTO; isWinner: boolean } {
    const newGameState = JSON.parse(JSON.stringify(gameState)) as GameStateDTO;
    const playerScore = newGameState.scores[userId];

    if (!playerScore) {
      throw new Error('Player not found in game');
    }

    playerScore.score -= points;
    playerScore.history.push(points);

    // Check for win
    if (playerScore.score === 0) {
      newGameState.status = 'finished';
      newGameState.winnerId = userId;
      return { gameState: newGameState, isWinner: true };
    }

    return { gameState: newGameState, isWinner: false };
  }

  /**
   * Undo last action
   */
  undoLastAction(
    gameState: GameStateDTO,
    lastActionData: { userId: string; points: number; wasTurnEnd?: boolean }
  ): GameStateDTO {
    const newGameState = JSON.parse(JSON.stringify(gameState)) as GameStateDTO;
    const playerScore = newGameState.scores[lastActionData.userId];

    if (!playerScore || playerScore.history.length === 0) {
      throw new Error('No action to undo');
    }

    // Restore score
    const lastPoints = playerScore.history.pop()!;
    playerScore.score += lastPoints;

    // Restore game status if it was finished
    if (newGameState.status === 'finished') {
      newGameState.status = 'playing';
      newGameState.winnerId = null;
    }

    // Restore turn if it was ended
    if (lastActionData.wasTurnEnd) {
      newGameState.turnIndex = (newGameState.turnIndex - 1 + newGameState.playerOrder.length) % newGameState.playerOrder.length;
    }

    return newGameState;
  }

  /**
   * Advance to next player
   */
  advanceTurn(gameState: GameStateDTO): GameStateDTO {
    const newGameState = JSON.parse(JSON.stringify(gameState)) as GameStateDTO;
    newGameState.turnIndex = (newGameState.turnIndex + 1) % newGameState.playerOrder.length;
    return newGameState;
  }

  /**
   * Get current player
   */
  getCurrentPlayer(gameState: GameStateDTO): string {
    return gameState.playerOrder[gameState.turnIndex];
  }

  /**
   * Randomize player order
   */
  randomizePlayerOrder(playerIds: string[]): string[] {
    const shuffled = [...playerIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

export const gameService = new GameService();
