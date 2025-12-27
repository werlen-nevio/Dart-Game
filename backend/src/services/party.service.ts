import { PrismaClient } from '@prisma/client';
import { PartyDTO, PartyMemberDTO, GameStateDTO, ActionLogDTO, PartyStateDTO, GameSettings } from '../types';
import { generatePartyCode } from '../utils/partyCode';
import { gameService } from './game.service';

const prisma = new PrismaClient();

export class PartyService {
  async createParty(
    hostId: string,
    name: string,
    isPublic: boolean,
    mode: 'X01',
    settings: GameSettings
  ): Promise<PartyDTO> {
    let code = generatePartyCode();

    // Ensure unique code
    let existing = await prisma.party.findUnique({ where: { code } });
    while (existing) {
      code = generatePartyCode();
      existing = await prisma.party.findUnique({ where: { code } });
    }

    const party = await prisma.party.create({
      data: {
        code,
        name,
        hostId,
        isPublic,
        status: 'waiting',
        members: {
          create: {
            userId: hostId,
            isOnline: true,
          },
        },
      },
    });

    return this.toPartyDTO(party);
  }

  async joinParty(code: string, userId: string): Promise<PartyStateDTO> {
    const party = await prisma.party.findUnique({
      where: { code },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    if (!party) {
      throw new Error('Party not found');
    }

    if (party.status === 'finished') {
      throw new Error('Party has finished');
    }

    // Check if already a member
    const existingMember = party.members.find((m) => m.userId === userId);

    if (existingMember) {
      // Rejoin: update online status
      await prisma.partyMember.update({
        where: { id: existingMember.id },
        data: { isOnline: true },
      });
    } else {
      // New member
      if (party.status === 'playing') {
        throw new Error('Cannot join a party that is already playing');
      }

      await prisma.partyMember.create({
        data: {
          partyId: party.id,
          userId,
          isOnline: true,
        },
      });
    }

    return this.getPartyState(party.id);
  }

  async leaveParty(partyId: string, userId: string): Promise<void> {
    const member = await prisma.partyMember.findFirst({
      where: {
        partyId,
        userId,
      },
    });

    if (member) {
      await prisma.partyMember.update({
        where: { id: member.id },
        data: { isOnline: false },
      });
    }
  }

  async kickPlayer(partyId: string, hostId: string, targetUserId: string): Promise<void> {
    const party = await prisma.party.findUnique({ where: { id: partyId } });

    if (!party || party.hostId !== hostId) {
      throw new Error('Only host can kick players');
    }

    if (targetUserId === hostId) {
      throw new Error('Host cannot kick themselves');
    }

    await prisma.partyMember.deleteMany({
      where: {
        partyId,
        userId: targetUserId,
      },
    });
  }

  async closeParty(partyId: string, userId: string): Promise<void> {
    const party = await prisma.party.findUnique({ where: { id: partyId } });

    if (!party || party.hostId !== userId) {
      throw new Error('Only host can close party');
    }

    await prisma.party.delete({ where: { id: partyId } });
  }

  async getPartyState(partyId: string): Promise<PartyStateDTO> {
    const party = await prisma.party.findUnique({
      where: { id: partyId },
      include: {
        members: {
          include: { user: true },
        },
        gameState: true,
        actionLogs: {
          orderBy: { timestamp: 'desc' },
          take: 20,
        },
      },
    });

    if (!party) {
      throw new Error('Party not found');
    }

    const members: PartyMemberDTO[] = party.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      username: m.user.username,
      isOnline: m.isOnline,
      joinedAt: m.joinedAt.toISOString(),
    }));

    const gameState: GameStateDTO | null = party.gameState
      ? {
          mode: party.gameState.mode as 'X01',
          settings: JSON.parse(party.gameState.settings),
          scores: JSON.parse(party.gameState.scores),
          turnIndex: party.gameState.turnIndex,
          playerOrder: JSON.parse(party.gameState.playerOrder),
          status: party.gameState.status as 'playing' | 'finished',
          winnerId: party.gameState.winnerId,
        }
      : null;

    const recentActions: ActionLogDTO[] = await this.getRecentActions(partyId);

    return {
      party: this.toPartyDTO(party),
      members,
      gameState,
      recentActions,
    };
  }

  async startGame(partyId: string, userId: string): Promise<GameStateDTO> {
    const party = await prisma.party.findUnique({
      where: { id: partyId },
      include: {
        members: {
          where: { isOnline: true },
          include: { user: true },
        },
      },
    });

    if (!party || party.hostId !== userId) {
      throw new Error('Only host can start game');
    }

    if (party.members.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    if (party.status === 'playing') {
      throw new Error('Game already started');
    }

    // Default settings for X01
    const settings: GameSettings = {
      startScore: 501,
      outRule: 'double',
    };

    const playerIds = party.members.map((m) => m.userId);
    const gameState = gameService.initializeGameState(playerIds, settings);

    // Save to DB
    await prisma.gameState.create({
      data: {
        partyId,
        mode: gameState.mode,
        settings: JSON.stringify(gameState.settings),
        scores: JSON.stringify(gameState.scores),
        turnIndex: gameState.turnIndex,
        playerOrder: JSON.stringify(gameState.playerOrder),
        status: gameState.status,
      },
    });

    await prisma.party.update({
      where: { id: partyId },
      data: { status: 'playing' },
    });

    await this.logAction(partyId, userId, 'game_start', { settings });

    return gameState;
  }

  async resetGame(partyId: string, userId: string): Promise<void> {
    const party = await prisma.party.findUnique({ where: { id: partyId } });

    if (!party || party.hostId !== userId) {
      throw new Error('Only host can reset game');
    }

    await prisma.gameState.deleteMany({ where: { partyId } });
    await prisma.actionLog.deleteMany({ where: { partyId } });
    await prisma.party.update({
      where: { id: partyId },
      data: { status: 'waiting' },
    });

    await this.logAction(partyId, userId, 'game_reset', {});
  }

  async updateGameState(partyId: string, gameState: GameStateDTO): Promise<void> {
    await prisma.gameState.updateMany({
      where: { partyId },
      data: {
        scores: JSON.stringify(gameState.scores),
        turnIndex: gameState.turnIndex,
        playerOrder: JSON.stringify(gameState.playerOrder),
        status: gameState.status,
        winnerId: gameState.winnerId,
      },
    });

    if (gameState.status === 'finished') {
      await prisma.party.update({
        where: { id: partyId },
        data: { status: 'finished' },
      });
    }
  }

  async logAction(
    partyId: string,
    userId: string,
    actionType: string,
    actionData: any
  ): Promise<ActionLogDTO> {
    const action = await prisma.actionLog.create({
      data: {
        partyId,
        userId,
        actionType,
        actionData: JSON.stringify(actionData),
      },
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });

    return {
      id: action.id,
      userId: action.userId,
      username: user?.username || 'Unknown',
      actionType: actionType as any,
      actionData,
      timestamp: action.timestamp.toISOString(),
    };
  }

  async getRecentActions(partyId: string): Promise<ActionLogDTO[]> {
    const actions = await prisma.actionLog.findMany({
      where: { partyId },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    const userIds = [...new Set(actions.map((a) => a.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
    });

    const userMap = new Map(users.map((u) => [u.id, u.username]));

    return actions.map((a) => ({
      id: a.id,
      userId: a.userId,
      username: userMap.get(a.userId) || 'Unknown',
      actionType: a.actionType as any,
      actionData: JSON.parse(a.actionData),
      timestamp: a.timestamp.toISOString(),
    }));
  }

  async getLastAction(partyId: string): Promise<ActionLogDTO | null> {
    const action = await prisma.actionLog.findFirst({
      where: { partyId },
      orderBy: { timestamp: 'desc' },
    });

    if (!action) return null;

    const user = await prisma.user.findUnique({ where: { id: action.userId } });

    return {
      id: action.id,
      userId: action.userId,
      username: user?.username || 'Unknown',
      actionType: action.actionType as any,
      actionData: JSON.parse(action.actionData),
      timestamp: action.timestamp.toISOString(),
    };
  }

  async setPlayerOrder(partyId: string, userId: string, playerOrder: string[]): Promise<void> {
    const party = await prisma.party.findUnique({ where: { id: partyId } });

    if (!party || party.hostId !== userId) {
      throw new Error('Only host can set player order');
    }

    await prisma.gameState.updateMany({
      where: { partyId },
      data: {
        playerOrder: JSON.stringify(playerOrder),
      },
    });
  }

  private toPartyDTO(party: any): PartyDTO {
    return {
      id: party.id,
      code: party.code,
      name: party.name,
      hostId: party.hostId,
      isPublic: party.isPublic,
      status: party.status,
      createdAt: party.createdAt.toISOString(),
    };
  }
}

export const partyService = new PartyService();
