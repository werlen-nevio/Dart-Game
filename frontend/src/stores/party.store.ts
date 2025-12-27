import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { socketService } from '@/services/socket.service'
import { PartyDTO, PartyMemberDTO, GameStateDTO, ActionLogDTO, PartyStateDTO, GameSettings } from '@/types'
import { useAuthStore } from './auth.store'

export const usePartyStore = defineStore('party', () => {
  const authStore = useAuthStore()

  const party = ref<PartyDTO | null>(null)
  const members = ref<PartyMemberDTO[]>([])
  const gameState = ref<GameStateDTO | null>(null)
  const recentActions = ref<ActionLogDTO[]>([])

  const isInParty = computed(() => party.value !== null)
  const isHost = computed(() => party.value?.hostId === authStore.user?.id)
  const isPlaying = computed(() => gameState.value?.status === 'playing')
  const isMyTurn = computed(() => {
    if (!gameState.value || !authStore.user) return false
    const currentPlayerId = gameState.value.playerOrder[gameState.value.turnIndex]
    return currentPlayerId === authStore.user.id
  })

  const currentPlayer = computed(() => {
    if (!gameState.value) return null
    const playerId = gameState.value.playerOrder[gameState.value.turnIndex]
    return members.value.find((m) => m.userId === playerId)
  })

  const myScore = computed(() => {
    if (!gameState.value || !authStore.user) return null
    return gameState.value.scores[authStore.user.id] || null
  })

  function setupSocketListeners() {
    socketService.onPartyUpdated((updatedParty) => {
      party.value = updatedParty
    })

    socketService.onMemberJoined((member) => {
      const existing = members.value.find((m) => m.userId === member.userId)
      if (!existing) {
        members.value.push(member)
      }
    })

    socketService.onMemberLeft((data) => {
      members.value = members.value.filter((m) => m.userId !== data.userId)
    })

    socketService.onMemberStatus((data) => {
      const member = members.value.find((m) => m.userId === data.userId)
      if (member) {
        member.isOnline = data.isOnline
      }
    })

    socketService.onPartyClosed(() => {
      clearParty()
    })

    socketService.onPartyKicked(() => {
      clearParty()
    })

    socketService.onGameStateUpdated((state) => {
      gameState.value = state
    })

    socketService.onActionLogged((action) => {
      recentActions.value.unshift(action)
      if (recentActions.value.length > 20) {
        recentActions.value = recentActions.value.slice(0, 20)
      }
    })

    socketService.onFullState((state) => {
      setPartyState(state)
    })
  }

  function setPartyState(state: PartyStateDTO) {
    party.value = state.party
    members.value = state.members
    gameState.value = state.gameState
    recentActions.value = state.recentActions
  }

  function clearParty() {
    party.value = null
    members.value = []
    gameState.value = null
    recentActions.value = []
  }

  async function createParty(name: string, isPublic: boolean, settings: GameSettings) {
    const createdParty = await socketService.createParty(name, isPublic, 'X01', settings)
    party.value = createdParty

    // Get full state
    const state = await socketService.getPartyState()
    setPartyState(state)

    setupSocketListeners()
  }

  async function joinParty(code: string) {
    const state = await socketService.joinParty(code)
    setPartyState(state)
    setupSocketListeners()
  }

  async function leaveParty() {
    await socketService.leaveParty()
    socketService.removeAllListeners()
    clearParty()
  }

  async function kickPlayer(userId: string) {
    await socketService.kickPlayer(userId)
  }

  async function closeParty() {
    await socketService.closeParty()
    socketService.removeAllListeners()
    clearParty()
  }

  async function startGame() {
    await socketService.startGame()
  }

  async function resetGame() {
    await socketService.resetGame()
  }

  async function scoreEntry(points: number) {
    const actionId = `${Date.now()}-${Math.random()}`
    await socketService.scoreEntry(points, actionId)
  }

  async function checkoutConfirm(points: number, isDouble: boolean) {
    const actionId = `${Date.now()}-${Math.random()}`
    await socketService.checkoutConfirm(points, isDouble, actionId)
  }

  async function undo() {
    await socketService.undo()
  }

  async function endTurn() {
    await socketService.endTurn()
  }

  async function randomizeOrder() {
    await socketService.randomizeOrder()
  }

  return {
    // State
    party,
    members,
    gameState,
    recentActions,

    // Computed
    isInParty,
    isHost,
    isPlaying,
    isMyTurn,
    currentPlayer,
    myScore,

    // Actions
    createParty,
    joinParty,
    leaveParty,
    kickPlayer,
    closeParty,
    startGame,
    resetGame,
    scoreEntry,
    checkoutConfirm,
    undo,
    endTurn,
    randomizeOrder,
    clearParty,
  }
})
