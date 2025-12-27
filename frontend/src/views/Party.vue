<template>
  <div class="min-h-screen">
    <!-- Header -->
    <header class="bg-dark-800 border-b border-dark-700 py-4 px-6">
      <div class="container mx-auto flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold">{{ partyStore.party?.name }}</h1>
          <div class="flex items-center space-x-2 mt-1">
            <span class="text-sm text-gray-400">Code:</span>
            <code class="text-primary-400 font-mono font-bold text-lg">{{ partyStore.party?.code }}</code>
            <button @click="copyCode" class="text-gray-400 hover:text-white">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

        <button @click="handleLeaveParty" class="btn btn-secondary">Verlassen</button>
      </div>
    </header>

    <div class="container mx-auto px-4 py-6">
      <!-- Waiting State -->
      <div v-if="partyStore.party?.status === 'waiting'" class="max-w-4xl mx-auto">
        <div class="card p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Warte auf Spieler...</h2>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <div
              v-for="member in partyStore.members"
              :key="member.id"
              class="bg-dark-700 p-4 rounded-lg text-center"
            >
              <div class="text-lg font-semibold">{{ member.username }}</div>
              <div class="text-sm" :class="member.isOnline ? 'text-green-400' : 'text-gray-500'">
                {{ member.isOnline ? 'Online' : 'Offline' }}
              </div>
              <div v-if="member.userId === partyStore.party?.hostId" class="text-xs text-primary-400 mt-1">
                Host
              </div>
            </div>
          </div>

          <div v-if="partyStore.isHost" class="space-y-4">
            <button
              @click="handleStartGame"
              :disabled="partyStore.members.length < 2"
              class="btn btn-success w-full"
            >
              Spiel starten ({{ partyStore.members.length }} Spieler)
            </button>

            <button @click="handleCloseParty" class="btn btn-danger w-full">
              Party schließen
            </button>
          </div>

          <div v-else class="text-center text-gray-400">
            Warte auf Host, um das Spiel zu starten...
          </div>
        </div>
      </div>

      <!-- Playing State -->
      <div v-else-if="partyStore.isPlaying" class="max-w-6xl mx-auto">
        <div class="grid lg:grid-cols-3 gap-6">
          <!-- Scoreboard -->
          <div class="lg:col-span-2 space-y-4">
            <div class="card p-4">
              <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold">Scoreboard</h2>
                <div class="text-sm text-gray-400">
                  {{ partyStore.gameState?.settings.startScore }} - {{ partyStore.gameState?.settings.outRule === 'double' ? 'Double-Out' : 'Single-Out' }}
                </div>
              </div>

              <div class="space-y-2">
                <div
                  v-for="member in partyStore.members"
                  :key="member.userId"
                  :class="[
                    'p-4 rounded-lg border-2 transition-all',
                    partyStore.currentPlayer?.userId === member.userId
                      ? 'border-primary-500 bg-primary-900/20'
                      : 'border-dark-600 bg-dark-700'
                  ]"
                >
                  <div class="flex justify-between items-center">
                    <div>
                      <div class="font-semibold text-lg">{{ member.username }}</div>
                      <div v-if="partyStore.currentPlayer?.userId === member.userId" class="text-sm text-primary-400">
                        Am Zug
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="text-3xl font-bold">
                        {{ partyStore.gameState?.scores[member.userId]?.score ?? 0 }}
                      </div>
                      <div class="text-xs text-gray-400">
                        Würfe: {{ partyStore.gameState?.scores[member.userId]?.history.length ?? 0 }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Input Buttons (only visible if it's your turn) -->
            <div v-if="partyStore.isMyTurn" class="card p-4">
              <h3 class="text-lg font-bold mb-4">Deine Eingabe</h3>

              <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                <button
                  v-for="points in quickPoints"
                  :key="points"
                  @click="handleScoreEntry(points)"
                  class="score-button"
                >
                  {{ points }}
                </button>
              </div>

              <div class="grid grid-cols-2 gap-2 mb-4">
                <button @click="handleUndo" class="btn btn-secondary">
                  Undo
                </button>
                <button @click="handleEndTurn" class="btn btn-primary">
                  Zug beenden
                </button>
              </div>

              <div class="flex items-center space-x-2">
                <input
                  v-model.number="customPoints"
                  type="number"
                  min="0"
                  max="180"
                  placeholder="Custom"
                  class="input flex-1"
                  @keydown.enter="handleScoreEntry(customPoints)"
                />
                <button @click="handleScoreEntry(customPoints)" class="btn btn-primary">
                  OK
                </button>
              </div>
            </div>

            <!-- Host Actions -->
            <div v-if="partyStore.isHost" class="card p-4">
              <h3 class="text-lg font-bold mb-4">Host Aktionen</h3>
              <div class="grid grid-cols-2 gap-2">
                <button @click="handleResetGame" class="btn btn-secondary">
                  Spiel Reset
                </button>
                <button @click="handleRandomizeOrder" class="btn btn-secondary">
                  Reihenfolge mischen
                </button>
              </div>
            </div>
          </div>

          <!-- Sidebar: Recent Actions -->
          <div class="lg:col-span-1">
            <div class="card p-4 sticky top-4">
              <h3 class="text-lg font-bold mb-4">History</h3>
              <div class="space-y-2 max-h-[600px] overflow-y-auto">
                <div
                  v-for="action in partyStore.recentActions"
                  :key="action.id"
                  class="bg-dark-700 p-3 rounded text-sm"
                >
                  <div class="font-semibold">{{ action.username }}</div>
                  <div class="text-gray-400">{{ formatAction(action) }}</div>
                  <div class="text-xs text-gray-500 mt-1">
                    {{ formatTime(action.timestamp) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Finished State -->
      <div v-else-if="partyStore.party?.status === 'finished'" class="max-w-4xl mx-auto">
        <div class="card p-8 text-center">
          <h2 class="text-4xl font-bold mb-4">🎉 Spiel beendet!</h2>
          <div class="text-2xl mb-6">
            Gewinner:
            <span class="text-primary-400 font-bold">
              {{ partyStore.members.find(m => m.userId === partyStore.gameState?.winnerId)?.username }}
            </span>
          </div>

          <button v-if="partyStore.isHost" @click="handleResetGame" class="btn btn-primary">
            Neues Spiel starten
          </button>
        </div>
      </div>
    </div>

    <!-- Checkout Confirmation Modal -->
    <div
      v-if="showCheckoutModal"
      class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      @click.self="showCheckoutModal = false"
    >
      <div class="card p-8 max-w-md mx-4">
        <h2 class="text-2xl font-bold mb-4">Checkout Bestätigung</h2>
        <p class="mb-6">War dein letzter Dart ein <strong>Double</strong>?</p>

        <div class="grid grid-cols-2 gap-4">
          <button @click="confirmCheckout(false)" class="btn btn-danger">
            Nein (Bust)
          </button>
          <button @click="confirmCheckout(true)" class="btn btn-success">
            Ja (Win!)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePartyStore } from '@/stores/party.store'
import { useToastStore } from '@/stores/toast.store'
import { ActionLogDTO } from '@/types'

const router = useRouter()
const route = useRoute()
const partyStore = usePartyStore()
const toastStore = useToastStore()

const customPoints = ref<number | null>(null)
const showCheckoutModal = ref(false)
const pendingCheckoutPoints = ref(0)

const quickPoints = [1, 5, 10, 20, 25, 50, 60, 80, 100, 120, 140, 180]

onMounted(async () => {
  if (!partyStore.isInParty) {
    const code = route.params.code as string
    try {
      await partyStore.joinParty(code)
    } catch (err: any) {
      toastStore.error(err.message)
      router.push('/app')
    }
  }
})

onBeforeUnmount(() => {
  // Don't leave party on unmount (user might just navigate away)
})

async function copyCode() {
  if (partyStore.party?.code) {
    await navigator.clipboard.writeText(partyStore.party.code)
    toastStore.success('Code kopiert!')
  }
}

async function handleLeaveParty() {
  try {
    await partyStore.leaveParty()
    router.push('/app')
  } catch (err: any) {
    toastStore.error(err.message)
  }
}

async function handleCloseParty() {
  if (confirm('Party wirklich schließen?')) {
    try {
      await partyStore.closeParty()
      router.push('/app')
    } catch (err: any) {
      toastStore.error(err.message)
    }
  }
}

async function handleStartGame() {
  try {
    await partyStore.startGame()
    toastStore.success('Spiel gestartet!')
  } catch (err: any) {
    toastStore.error(err.message)
  }
}

async function handleResetGame() {
  if (confirm('Spiel wirklich zurücksetzen?')) {
    try {
      await partyStore.resetGame()
      toastStore.success('Spiel zurückgesetzt!')
    } catch (err: any) {
      toastStore.error(err.message)
    }
  }
}

async function handleScoreEntry(points: number | null) {
  if (points === null || points < 0 || points > 180) {
    toastStore.error('Ungültige Punktzahl')
    return
  }

  try {
    await partyStore.scoreEntry(points)
    customPoints.value = null
  } catch (err: any) {
    if (err.message === 'CHECKOUT_CONFIRM_REQUIRED') {
      // Show checkout modal
      pendingCheckoutPoints.value = points
      showCheckoutModal.value = true
    } else {
      toastStore.error(err.message)
    }
  }
}

async function confirmCheckout(isDouble: boolean) {
  showCheckoutModal.value = false

  try {
    await partyStore.checkoutConfirm(pendingCheckoutPoints.value, isDouble)

    if (isDouble) {
      toastStore.success('Checkout erfolgreich!')
    }
  } catch (err: any) {
    toastStore.error(err.message)
  }
}

async function handleUndo() {
  try {
    await partyStore.undo()
    toastStore.info('Aktion rückgängig gemacht')
  } catch (err: any) {
    toastStore.error(err.message)
  }
}

async function handleEndTurn() {
  try {
    await partyStore.endTurn()
  } catch (err: any) {
    toastStore.error(err.message)
  }
}

async function handleRandomizeOrder() {
  try {
    await partyStore.randomizeOrder()
    toastStore.success('Reihenfolge gemischt!')
  } catch (err: any) {
    toastStore.error(err.message)
  }
}

function formatAction(action: ActionLogDTO): string {
  switch (action.actionType) {
    case 'score_entry':
      return `${action.actionData.points} Punkte → ${action.actionData.newScore}`
    case 'checkout_attempt':
      return `Checkout: ${action.actionData.points} (${action.actionData.isDouble ? 'Double' : 'Single'})`
    case 'turn_end':
      return 'Zug beendet'
    case 'undo':
      return 'Undo'
    case 'game_start':
      return 'Spiel gestartet'
    case 'game_reset':
      return 'Spiel zurückgesetzt'
    default:
      return action.actionType
  }
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}
</script>
