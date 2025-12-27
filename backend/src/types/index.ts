// ============================================
// SHARED TYPES & DTOs
// ============================================

export interface UserDTO {
  id: string;
  email: string;
  username: string;
}

export interface PartyDTO {
  id: string;
  code: string;
  name: string;
  hostId: string;
  isPublic: boolean;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: string;
}

export interface PartyMemberDTO {
  id: string;
  userId: string;
  username: string;
  isOnline: boolean;
  joinedAt: string;
}

export interface GameSettings {
  startScore: 301 | 501;
  outRule: 'single' | 'double';
  doubleIn?: boolean; // future feature
}

export interface PlayerScore {
  score: number;
  history: number[]; // all throws
}

export interface GameStateDTO {
  mode: 'X01';
  settings: GameSettings;
  scores: Record<string, PlayerScore>; // userId -> score
  turnIndex: number;
  playerOrder: string[]; // userIds
  status: 'playing' | 'finished';
  winnerId: string | null;
}

export interface ActionLogDTO {
  id: string;
  userId: string;
  username: string;
  actionType: 'score_entry' | 'undo' | 'turn_end' | 'game_start' | 'game_reset' | 'checkout_attempt';
  actionData: any;
  timestamp: string;
}

export interface PartyStateDTO {
  party: PartyDTO;
  members: PartyMemberDTO[];
  gameState: GameStateDTO | null;
  recentActions: ActionLogDTO[];
}

// ============================================
// SOCKET.IO EVENTS
// ============================================

// Client -> Server Events
export interface ClientToServerEvents {
  // Party Management
  'party:create': (data: { name: string; isPublic: boolean; mode: 'X01'; settings: GameSettings }, callback: (response: { success: boolean; data?: PartyDTO; error?: string }) => void) => void;
  'party:join': (data: { code: string }, callback: (response: { success: boolean; data?: PartyStateDTO; error?: string }) => void) => void;
  'party:leave': (callback: (response: { success: boolean; error?: string }) => void) => void;
  'party:kick': (data: { userId: string }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'party:close': (callback: (response: { success: boolean; error?: string }) => void) => void;

  // Game Actions
  'game:start': (callback: (response: { success: boolean; error?: string }) => void) => void;
  'game:reset': (callback: (response: { success: boolean; error?: string }) => void) => void;
  'game:score_entry': (data: { points: number; actionId: string }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'game:checkout_confirm': (data: { points: number; isDouble: boolean; actionId: string }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'game:undo': (callback: (response: { success: boolean; error?: string }) => void) => void;
  'game:turn_end': (callback: (response: { success: boolean; error?: string }) => void) => void;
  'game:set_player_order': (data: { playerOrder: string[] }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'game:randomize_order': (callback: (response: { success: boolean; error?: string }) => void) => void;

  // State Sync
  'party:get_state': (callback: (response: { success: boolean; data?: PartyStateDTO; error?: string }) => void) => void;
}

// Server -> Client Events
export interface ServerToClientEvents {
  // Party Updates
  'party:updated': (data: PartyDTO) => void;
  'party:member_joined': (data: PartyMemberDTO) => void;
  'party:member_left': (data: { userId: string }) => void;
  'party:member_status': (data: { userId: string; isOnline: boolean }) => void;
  'party:closed': () => void;
  'party:kicked': () => void;

  // Game State Updates
  'game:state_updated': (data: GameStateDTO) => void;
  'game:action_logged': (data: ActionLogDTO) => void;
  'game:finished': (data: { winnerId: string; winnerName: string }) => void;

  // Full State Sync
  'party:full_state': (data: PartyStateDTO) => void;

  // Errors & Notifications
  'error': (data: { message: string }) => void;
  'notification': (data: { type: 'info' | 'warning' | 'success'; message: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  username: string;
  partyId?: string;
}
