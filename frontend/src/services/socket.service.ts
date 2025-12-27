import { io, Socket } from 'socket.io-client'
import { PartyDTO, PartyStateDTO, GameStateDTO, ActionLogDTO, PartyMemberDTO, GameSettings } from '@/types'

const SOCKET_URL = 'http://localhost:3001'

interface SocketResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

class SocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(SOCKET_URL, {
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
      })

      this.socket.on('connect', () => {
        console.log('Socket connected')
        this.reconnectAttempts = 0
        resolve()
      })

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error)
        this.reconnectAttempts++

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('Failed to connect to server'))
        }
      })

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason)
      })
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  // Party Management
  createParty(name: string, isPublic: boolean, mode: 'X01', settings: GameSettings): Promise<PartyDTO> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('party:create', { name, isPublic, mode, settings }, (response: SocketResponse<PartyDTO>) => {
        if (response.success && response.data) {
          resolve(response.data)
        } else {
          reject(new Error(response.error || 'Failed to create party'))
        }
      })
    })
  }

  joinParty(code: string): Promise<PartyStateDTO> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('party:join', { code }, (response: SocketResponse<PartyStateDTO>) => {
        if (response.success && response.data) {
          resolve(response.data)
        } else {
          reject(new Error(response.error || 'Failed to join party'))
        }
      })
    })
  }

  leaveParty(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('party:leave', (response: SocketResponse) => {
        if (response.success) {
          resolve()
        } else {
          reject(new Error(response.error || 'Failed to leave party'))
        }
      })
    })
  }

  kickPlayer(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('party:kick', { userId }, (response: SocketResponse) => {
        if (response.success) {
          resolve()
        } else {
          reject(new Error(response.error || 'Failed to kick player'))
        }
      })
    })
  }

  closeParty(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('party:close', (response: SocketResponse) => {
        if (response.success) {
          resolve()
        } else {
          reject(new Error(response.error || 'Failed to close party'))
        }
      })
    })
  }

  // Game Actions
  startGame(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('game:start', (response: SocketResponse) => {
        if (response.success) {
          resolve()
        } else {
          reject(new Error(response.error || 'Failed to start game'))
        }
      })
    })
  }

  resetGame(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('game:reset', (response: SocketResponse) => {
        if (response.success) {
          resolve()
        } else {
          reject(new Error(response.error || 'Failed to reset game'))
        }
      })
    })
  }

  scoreEntry(points: number, actionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('game:score_entry', { points, actionId }, (response: SocketResponse) => {
        if (response.success) {
          resolve()
        } else {
          reject(new Error(response.error || 'Failed to enter score'))
        }
      })
    })
  }

  checkoutConfirm(points: number, isDouble: boolean, actionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('game:checkout_confirm', { points, isDouble, actionId }, (response: SocketResponse) => {
        if (response.success) {
          resolve()
        } else {
          reject(new Error(response.error || 'Failed to confirm checkout'))
        }
      })
    })
  }

  undo(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('game:undo', (response: SocketResponse) => {
        if (response.success) {
          resolve()
        } else {
          reject(new Error(response.error || 'Failed to undo'))
        }
      })
    })
  }

  endTurn(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('game:turn_end', (response: SocketResponse) => {
        if (response.success) {
          resolve()
        } else {
          reject(new Error(response.error || 'Failed to end turn'))
        }
      })
    })
  }

  setPlayerOrder(playerOrder: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('game:set_player_order', { playerOrder }, (response: SocketResponse) => {
        if (response.success) {
          resolve()
        } else {
          reject(new Error(response.error || 'Failed to set player order'))
        }
      })
    })
  }

  randomizeOrder(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('game:randomize_order', (response: SocketResponse) => {
        if (response.success) {
          resolve()
        } else {
          reject(new Error(response.error || 'Failed to randomize order'))
        }
      })
    })
  }

  getPartyState(): Promise<PartyStateDTO> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('party:get_state', (response: SocketResponse<PartyStateDTO>) => {
        if (response.success && response.data) {
          resolve(response.data)
        } else {
          reject(new Error(response.error || 'Failed to get party state'))
        }
      })
    })
  }

  // Event Listeners
  onPartyUpdated(callback: (party: PartyDTO) => void) {
    this.socket?.on('party:updated', callback)
  }

  onMemberJoined(callback: (member: PartyMemberDTO) => void) {
    this.socket?.on('party:member_joined', callback)
  }

  onMemberLeft(callback: (data: { userId: string }) => void) {
    this.socket?.on('party:member_left', callback)
  }

  onMemberStatus(callback: (data: { userId: string; isOnline: boolean }) => void) {
    this.socket?.on('party:member_status', callback)
  }

  onPartyClosed(callback: () => void) {
    this.socket?.on('party:closed', callback)
  }

  onPartyKicked(callback: () => void) {
    this.socket?.on('party:kicked', callback)
  }

  onGameStateUpdated(callback: (gameState: GameStateDTO) => void) {
    this.socket?.on('game:state_updated', callback)
  }

  onActionLogged(callback: (action: ActionLogDTO) => void) {
    this.socket?.on('game:action_logged', callback)
  }

  onGameFinished(callback: (data: { winnerId: string; winnerName: string }) => void) {
    this.socket?.on('game:finished', callback)
  }

  onFullState(callback: (state: PartyStateDTO) => void) {
    this.socket?.on('party:full_state', callback)
  }

  onError(callback: (data: { message: string }) => void) {
    this.socket?.on('error', callback)
  }

  onNotification(callback: (data: { type: 'info' | 'warning' | 'success'; message: string }) => void) {
    this.socket?.on('notification', callback)
  }

  // Remove all listeners
  removeAllListeners() {
    this.socket?.removeAllListeners()
  }
}

export const socketService = new SocketService()
