import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../types';
import { partyService } from '../services/party.service';
import { gameService } from '../services/game.service';
import { logger } from '../utils/logger';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// Track processed action IDs to prevent duplicate actions
const processedActions = new Set<string>();
const ACTION_ID_TTL = 10000; // 10 seconds

export function registerSocketHandlers(io: TypedServer) {
  io.on('connection', (socket: TypedSocket) => {
    const userId = socket.data.userId;
    const username = socket.data.username;

    logger.info(`User connected: ${username} (${userId})`);

    // ==========================================
    // PARTY MANAGEMENT
    // ==========================================

    socket.on('party:create', async (data, callback) => {
      try {
        logger.info(`User ${username} creating party`, { data });

        const party = await partyService.createParty(
          userId,
          data.name,
          data.isPublic,
          data.mode,
          data.settings
        );

        // Join socket room
        socket.join(`party:${party.id}`);
        socket.data.partyId = party.id;

        callback({ success: true, data: party });
        logger.info(`Party created: ${party.code}`);
      } catch (error: any) {
        logger.error('Error creating party', { error: error.message });
        callback({ success: false, error: error.message });
      }
    });

    socket.on('party:join', async (data, callback) => {
      try {
        logger.info(`User ${username} joining party ${data.code}`);

        const partyState = await partyService.joinParty(data.code, userId);

        // Join socket room
        socket.join(`party:${partyState.party.id}`);
        socket.data.partyId = partyState.party.id;

        // Notify others
        socket.to(`party:${partyState.party.id}`).emit('party:member_joined', {
          id: userId,
          userId,
          username,
          isOnline: true,
          joinedAt: new Date().toISOString(),
        });

        callback({ success: true, data: partyState });
        logger.info(`User ${username} joined party ${partyState.party.code}`);
      } catch (error: any) {
        logger.error('Error joining party', { error: error.message });
        callback({ success: false, error: error.message });
      }
    });

    socket.on('party:leave', async (callback) => {
      try {
        const partyId = socket.data.partyId;
        if (!partyId) {
          callback({ success: false, error: 'Not in a party' });
          return;
        }

        await partyService.leaveParty(partyId, userId);

        // Notify others
        socket.to(`party:${partyId}`).emit('party:member_left', { userId });

        // Leave socket room
        socket.leave(`party:${partyId}`);
        socket.data.partyId = undefined;

        callback({ success: true });
        logger.info(`User ${username} left party ${partyId}`);
      } catch (error: any) {
        logger.error('Error leaving party', { error: error.message });
        callback({ success: false, error: error.message });
      }
    });

    socket.on('party:kick', async (data, callback) => {
      try {
        const partyId = socket.data.partyId;
        if (!partyId) {
          callback({ success: false, error: 'Not in a party' });
          return;
        }

        await partyService.kickPlayer(partyId, userId, data.userId);

        // Notify kicked user
        io.to(`party:${partyId}`).emit('party:member_left', { userId: data.userId });

        // Notify kicked user specifically
        const kickedSockets = await io.in(`party:${partyId}`).fetchSockets();
        for (const s of kickedSockets) {
          if (s.data.userId === data.userId) {
            s.emit('party:kicked');
            s.leave(`party:${partyId}`);
            s.data.partyId = undefined;
          }
        }

        callback({ success: true });
        logger.info(`User ${data.userId} kicked from party ${partyId}`);
      } catch (error: any) {
        logger.error('Error kicking player', { error: error.message });
        callback({ success: false, error: error.message });
      }
    });

    socket.on('party:close', async (callback) => {
      try {
        const partyId = socket.data.partyId;
        if (!partyId) {
          callback({ success: false, error: 'Not in a party' });
          return;
        }

        await partyService.closeParty(partyId, userId);

        // Notify all members
        io.to(`party:${partyId}`).emit('party:closed');

        // Remove all from room
        const sockets = await io.in(`party:${partyId}`).fetchSockets();
        for (const s of sockets) {
          s.leave(`party:${partyId}`);
          s.data.partyId = undefined;
        }

        callback({ success: true });
        logger.info(`Party ${partyId} closed`);
      } catch (error: any) {
        logger.error('Error closing party', { error: error.message });
        callback({ success: false, error: error.message });
      }
    });

    // ==========================================
    // GAME ACTIONS
    // ==========================================

    socket.on('game:start', async (callback) => {
      try {
        const partyId = socket.data.partyId;
        if (!partyId) {
          callback({ success: false, error: 'Not in a party' });
          return;
        }

        const gameState = await partyService.startGame(partyId, userId);

        // Broadcast to all in party
        io.to(`party:${partyId}`).emit('game:state_updated', gameState);

        const actionLog = await partyService.logAction(partyId, userId, 'game_start', {});
        io.to(`party:${partyId}`).emit('game:action_logged', actionLog);

        callback({ success: true });
        logger.info(`Game started in party ${partyId}`);
      } catch (error: any) {
        logger.error('Error starting game', { error: error.message });
        callback({ success: false, error: error.message });
      }
    });

    socket.on('game:reset', async (callback) => {
      try {
        const partyId = socket.data.partyId;
        if (!partyId) {
          callback({ success: false, error: 'Not in a party' });
          return;
        }

        await partyService.resetGame(partyId, userId);

        // Broadcast state update
        const partyState = await partyService.getPartyState(partyId);
        io.to(`party:${partyId}`).emit('party:full_state', partyState);

        callback({ success: true });
        logger.info(`Game reset in party ${partyId}`);
      } catch (error: any) {
        logger.error('Error resetting game', { error: error.message });
        callback({ success: false, error: error.message });
      }
    });

    socket.on('game:score_entry', async (data, callback) => {
      try {
        const partyId = socket.data.partyId;
        if (!partyId) {
          callback({ success: false, error: 'Not in a party' });
          return;
        }

        // Idempotency check
        if (processedActions.has(data.actionId)) {
          callback({ success: true }); // Already processed
          return;
        }

        const partyState = await partyService.getPartyState(partyId);
        if (!partyState.gameState) {
          callback({ success: false, error: 'Game not started' });
          return;
        }

        const gameState = partyState.gameState;
        const currentPlayer = gameService.getCurrentPlayer(gameState);

        // Only current player can enter score (unless admin mode - future feature)
        if (currentPlayer !== userId) {
          callback({ success: false, error: 'Not your turn' });
          return;
        }

        const currentScore = gameState.scores[userId].score;

        // Validate entry
        const validation = gameService.validateScoreEntry(currentScore, data.points, gameState.settings);

        if (!validation.valid) {
          callback({ success: false, error: validation.error });
          return;
        }

        // If checkout confirmation required
        if (validation.requiresCheckoutConfirm) {
          callback({ success: false, error: 'CHECKOUT_CONFIRM_REQUIRED' });
          return;
        }

        // Apply score entry
        const { gameState: newGameState, isWinner } = gameService.applyScoreEntry(
          gameState,
          userId,
          data.points
        );

        await partyService.updateGameState(partyId, newGameState);

        // Log action
        const actionLog = await partyService.logAction(partyId, userId, 'score_entry', {
          points: data.points,
          newScore: newGameState.scores[userId].score,
        });

        // Broadcast updates
        io.to(`party:${partyId}`).emit('game:state_updated', newGameState);
        io.to(`party:${partyId}`).emit('game:action_logged', actionLog);

        if (isWinner) {
          io.to(`party:${partyId}`).emit('game:finished', {
            winnerId: userId,
            winnerName: username,
          });
        }

        // Mark action as processed
        processedActions.add(data.actionId);
        setTimeout(() => processedActions.delete(data.actionId), ACTION_ID_TTL);

        callback({ success: true });
      } catch (error: any) {
        logger.error('Error processing score entry', { error: error.message });
        callback({ success: false, error: error.message });
      }
    });

    socket.on('game:checkout_confirm', async (data, callback) => {
      try {
        const partyId = socket.data.partyId;
        if (!partyId) {
          callback({ success: false, error: 'Not in a party' });
          return;
        }

        // Idempotency check
        if (processedActions.has(data.actionId)) {
          callback({ success: true }); // Already processed
          return;
        }

        const partyState = await partyService.getPartyState(partyId);
        if (!partyState.gameState) {
          callback({ success: false, error: 'Game not started' });
          return;
        }

        const gameState = partyState.gameState;
        const currentPlayer = gameService.getCurrentPlayer(gameState);

        if (currentPlayer !== userId) {
          callback({ success: false, error: 'Not your turn' });
          return;
        }

        const currentScore = gameState.scores[userId].score;

        // Validate checkout
        const validation = gameService.validateCheckout(
          currentScore,
          data.points,
          data.isDouble,
          gameState.settings
        );

        if (!validation.valid) {
          callback({ success: false, error: validation.error });
          return;
        }

        // Apply score entry
        const { gameState: newGameState, isWinner } = gameService.applyScoreEntry(
          gameState,
          userId,
          data.points
        );

        await partyService.updateGameState(partyId, newGameState);

        // Log action
        const actionLog = await partyService.logAction(partyId, userId, 'checkout_attempt', {
          points: data.points,
          isDouble: data.isDouble,
          success: true,
        });

        // Broadcast updates
        io.to(`party:${partyId}`).emit('game:state_updated', newGameState);
        io.to(`party:${partyId}`).emit('game:action_logged', actionLog);

        if (isWinner) {
          io.to(`party:${partyId}`).emit('game:finished', {
            winnerId: userId,
            winnerName: username,
          });
        }

        // Mark action as processed
        processedActions.add(data.actionId);
        setTimeout(() => processedActions.delete(data.actionId), ACTION_ID_TTL);

        callback({ success: true });
      } catch (error: any) {
        logger.error('Error processing checkout', { error: error.message });
        callback({ success: false, error: error.message });
      }
    });

    socket.on('game:undo', async (callback) => {
      try {
        const partyId = socket.data.partyId;
        if (!partyId) {
          callback({ success: false, error: 'Not in a party' });
          return;
        }

        const partyState = await partyService.getPartyState(partyId);
        if (!partyState.gameState) {
          callback({ success: false, error: 'Game not started' });
          return;
        }

        const lastAction = await partyService.getLastAction(partyId);
        if (!lastAction) {
          callback({ success: false, error: 'No action to undo' });
          return;
        }

        // Only undo score_entry, checkout_attempt, or turn_end
        if (!['score_entry', 'checkout_attempt', 'turn_end'].includes(lastAction.actionType)) {
          callback({ success: false, error: 'Cannot undo this action' });
          return;
        }

        const gameState = partyState.gameState;
        const actionData = {
          userId: lastAction.userId,
          points: lastAction.actionData.points || 0,
          wasTurnEnd: lastAction.actionType === 'turn_end',
        };

        const newGameState = gameService.undoLastAction(gameState, actionData);
        await partyService.updateGameState(partyId, newGameState);

        // Log undo action
        const actionLog = await partyService.logAction(partyId, userId, 'undo', {
          undoneActionId: lastAction.id,
        });

        // Broadcast updates
        io.to(`party:${partyId}`).emit('game:state_updated', newGameState);
        io.to(`party:${partyId}`).emit('game:action_logged', actionLog);

        callback({ success: true });
        logger.info(`Action undone in party ${partyId}`);
      } catch (error: any) {
        logger.error('Error undoing action', { error: error.message });
        callback({ success: false, error: error.message });
      }
    });

    socket.on('game:turn_end', async (callback) => {
      try {
        const partyId = socket.data.partyId;
        if (!partyId) {
          callback({ success: false, error: 'Not in a party' });
          return;
        }

        const partyState = await partyService.getPartyState(partyId);
        if (!partyState.gameState) {
          callback({ success: false, error: 'Game not started' });
          return;
        }

        const gameState = partyState.gameState;
        const currentPlayer = gameService.getCurrentPlayer(gameState);

        if (currentPlayer !== userId) {
          callback({ success: false, error: 'Not your turn' });
          return;
        }

        const newGameState = gameService.advanceTurn(gameState);
        await partyService.updateGameState(partyId, newGameState);

        // Log action
        const actionLog = await partyService.logAction(partyId, userId, 'turn_end', {
          nextPlayer: gameService.getCurrentPlayer(newGameState),
        });

        // Broadcast updates
        io.to(`party:${partyId}`).emit('game:state_updated', newGameState);
        io.to(`party:${partyId}`).emit('game:action_logged', actionLog);

        callback({ success: true });
      } catch (error: any) {
        logger.error('Error ending turn', { error: error.message });
        callback({ success: false, error: error.message });
      }
    });

    socket.on('game:set_player_order', async (data, callback) => {
      try {
        const partyId = socket.data.partyId;
        if (!partyId) {
          callback({ success: false, error: 'Not in a party' });
          return;
        }

        await partyService.setPlayerOrder(partyId, userId, data.playerOrder);

        const partyState = await partyService.getPartyState(partyId);
        io.to(`party:${partyId}`).emit('party:full_state', partyState);

        callback({ success: true });
      } catch (error: any) {
        logger.error('Error setting player order', { error: error.message });
        callback({ success: false, error: error.message });
      }
    });

    socket.on('game:randomize_order', async (callback) => {
      try {
        const partyId = socket.data.partyId;
        if (!partyId) {
          callback({ success: false, error: 'Not in a party' });
          return;
        }

        const partyState = await partyService.getPartyState(partyId);
        if (!partyState.gameState) {
          callback({ success: false, error: 'Game not started' });
          return;
        }

        const playerOrder = gameService.randomizePlayerOrder(partyState.gameState.playerOrder);
        await partyService.setPlayerOrder(partyId, userId, playerOrder);

        const newPartyState = await partyService.getPartyState(partyId);
        io.to(`party:${partyId}`).emit('party:full_state', newPartyState);

        callback({ success: true });
      } catch (error: any) {
        logger.error('Error randomizing order', { error: error.message });
        callback({ success: false, error: error.message });
      }
    });

    // ==========================================
    // STATE SYNC
    // ==========================================

    socket.on('party:get_state', async (callback) => {
      try {
        const partyId = socket.data.partyId;
        if (!partyId) {
          callback({ success: false, error: 'Not in a party' });
          return;
        }

        const partyState = await partyService.getPartyState(partyId);
        callback({ success: true, data: partyState });
      } catch (error: any) {
        logger.error('Error getting party state', { error: error.message });
        callback({ success: false, error: error.message });
      }
    });

    // ==========================================
    // DISCONNECT
    // ==========================================

    socket.on('disconnect', async () => {
      logger.info(`User disconnected: ${username}`);

      const partyId = socket.data.partyId;
      if (partyId) {
        try {
          await partyService.leaveParty(partyId, userId);
          socket.to(`party:${partyId}`).emit('party:member_status', {
            userId,
            isOnline: false,
          });
        } catch (error: any) {
          logger.error('Error handling disconnect', { error: error.message });
        }
      }
    });
  });
}
