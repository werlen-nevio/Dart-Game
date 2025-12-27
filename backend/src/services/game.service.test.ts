import { GameService } from './game.service';
import { GameSettings } from '../types';

describe('GameService - X01 Validation', () => {
  let gameService: GameService;

  beforeEach(() => {
    gameService = new GameService();
  });

  describe('validateScoreEntry - Single-Out', () => {
    const settings: GameSettings = {
      startScore: 501,
      outRule: 'single',
    };

    test('should accept valid score entry', () => {
      const result = gameService.validateScoreEntry(501, 60, settings);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject bust (score below 0)', () => {
      const result = gameService.validateScoreEntry(50, 60, settings);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bust! Score cannot go below 0');
    });

    test('should accept exact checkout to 0', () => {
      const result = gameService.validateScoreEntry(50, 50, settings);
      expect(result.valid).toBe(true);
      expect(result.requiresCheckoutConfirm).toBeUndefined();
    });

    test('should allow score of 1 with single-out', () => {
      const result = gameService.validateScoreEntry(101, 100, settings);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateScoreEntry - Double-Out', () => {
    const settings: GameSettings = {
      startScore: 501,
      outRule: 'double',
    };

    test('should require checkout confirmation when reaching 0', () => {
      const result = gameService.validateScoreEntry(50, 50, settings);
      expect(result.valid).toBe(true);
      expect(result.requiresCheckoutConfirm).toBe(true);
    });

    test('should reject score ending on 1 (impossible to checkout with double)', () => {
      const result = gameService.validateScoreEntry(101, 100, settings);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bust! Cannot end on 1 with Double-Out rule');
    });

    test('should reject bust', () => {
      const result = gameService.validateScoreEntry(50, 60, settings);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bust! Score cannot go below 0');
    });

    test('should accept non-checkout entries', () => {
      const result = gameService.validateScoreEntry(301, 60, settings);
      expect(result.valid).toBe(true);
      expect(result.requiresCheckoutConfirm).toBeUndefined();
    });
  });

  describe('validateCheckout', () => {
    const settings: GameSettings = {
      startScore: 501,
      outRule: 'double',
    };

    test('should accept valid double checkout', () => {
      const result = gameService.validateCheckout(50, 50, true, settings);
      expect(result.valid).toBe(true);
    });

    test('should reject checkout without double when double-out is required', () => {
      const result = gameService.validateCheckout(50, 50, false, settings);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Double-Out: Last dart must be a double');
    });

    test('should reject checkout that does not result in 0', () => {
      const result = gameService.validateCheckout(100, 50, true, settings);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Checkout must result in exactly 0');
    });
  });

  describe('applyScoreEntry', () => {
    test('should correctly apply score and detect winner', () => {
      const gameState = gameService.initializeGameState(['user1', 'user2'], {
        startScore: 301,
        outRule: 'single',
      });

      gameState.scores['user1'].score = 50;

      const { gameState: newState, isWinner } = gameService.applyScoreEntry(gameState, 'user1', 50);

      expect(newState.scores['user1'].score).toBe(0);
      expect(newState.scores['user1'].history).toContain(50);
      expect(isWinner).toBe(true);
      expect(newState.status).toBe('finished');
      expect(newState.winnerId).toBe('user1');
    });

    test('should correctly apply score for non-winning entry', () => {
      const gameState = gameService.initializeGameState(['user1', 'user2'], {
        startScore: 301,
        outRule: 'single',
      });

      const { gameState: newState, isWinner } = gameService.applyScoreEntry(gameState, 'user1', 60);

      expect(newState.scores['user1'].score).toBe(241);
      expect(newState.scores['user1'].history).toContain(60);
      expect(isWinner).toBe(false);
      expect(newState.status).toBe('playing');
    });
  });

  describe('undoLastAction', () => {
    test('should correctly undo score entry', () => {
      const gameState = gameService.initializeGameState(['user1', 'user2'], {
        startScore: 301,
        outRule: 'single',
      });

      const { gameState: afterEntry } = gameService.applyScoreEntry(gameState, 'user1', 60);

      const undone = gameService.undoLastAction(afterEntry, {
        userId: 'user1',
        points: 60,
      });

      expect(undone.scores['user1'].score).toBe(301);
      expect(undone.scores['user1'].history.length).toBe(0);
    });

    test('should restore playing status after undoing winning entry', () => {
      const gameState = gameService.initializeGameState(['user1', 'user2'], {
        startScore: 301,
        outRule: 'single',
      });

      gameState.scores['user1'].score = 50;

      const { gameState: afterWin } = gameService.applyScoreEntry(gameState, 'user1', 50);

      expect(afterWin.status).toBe('finished');
      expect(afterWin.winnerId).toBe('user1');

      const undone = gameService.undoLastAction(afterWin, {
        userId: 'user1',
        points: 50,
      });

      expect(undone.status).toBe('playing');
      expect(undone.winnerId).toBeNull();
      expect(undone.scores['user1'].score).toBe(50);
    });
  });

  describe('advanceTurn', () => {
    test('should correctly advance turn to next player', () => {
      const gameState = gameService.initializeGameState(['user1', 'user2', 'user3'], {
        startScore: 301,
        outRule: 'single',
      });

      expect(gameState.turnIndex).toBe(0);

      const afterFirst = gameService.advanceTurn(gameState);
      expect(afterFirst.turnIndex).toBe(1);

      const afterSecond = gameService.advanceTurn(afterFirst);
      expect(afterSecond.turnIndex).toBe(2);

      const afterThird = gameService.advanceTurn(afterSecond);
      expect(afterThird.turnIndex).toBe(0); // Wrap around
    });
  });

  describe('randomizePlayerOrder', () => {
    test('should return all players in different order', () => {
      const players = ['user1', 'user2', 'user3', 'user4'];
      const randomized = gameService.randomizePlayerOrder(players);

      expect(randomized.length).toBe(players.length);
      expect(randomized).toEqual(expect.arrayContaining(players));
    });
  });
});
