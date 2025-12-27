// Shared types with backend
export interface UserDTO {
  id: string
  email: string
  username: string
}

export interface PartyDTO {
  id: string
  code: string
  name: string
  hostId: string
  isPublic: boolean
  status: 'waiting' | 'playing' | 'finished'
  createdAt: string
}

export interface PartyMemberDTO {
  id: string
  userId: string
  username: string
  isOnline: boolean
  joinedAt: string
}

export interface GameSettings {
  startScore: 301 | 501
  outRule: 'single' | 'double'
  doubleIn?: boolean
}

export interface PlayerScore {
  score: number
  history: number[]
}

export interface GameStateDTO {
  mode: 'X01'
  settings: GameSettings
  scores: Record<string, PlayerScore>
  turnIndex: number
  playerOrder: string[]
  status: 'playing' | 'finished'
  winnerId: string | null
}

export interface ActionLogDTO {
  id: string
  userId: string
  username: string
  actionType: 'score_entry' | 'undo' | 'turn_end' | 'game_start' | 'game_reset' | 'checkout_attempt'
  actionData: any
  timestamp: string
}

export interface PartyStateDTO {
  party: PartyDTO
  members: PartyMemberDTO[]
  gameState: GameStateDTO | null
  recentActions: ActionLogDTO[]
}

// Frontend-specific types
export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}
