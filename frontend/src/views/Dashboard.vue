<template>
  <div class="min-h-screen">
    <!-- Header -->
    <header class="bg-dark-800 border-b border-dark-700 py-4 px-6">
      <div class="container mx-auto flex justify-between items-center">
        <h1 class="text-2xl font-bold">🎯 Dart Party</h1>
        <div class="flex items-center space-x-4">
          <span class="text-gray-300">{{ authStore.user?.username }}</span>
          <button @click="handleLogout" class="btn btn-secondary">Logout</button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <div class="container mx-auto px-6 py-8">
      <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <!-- Create Party -->
        <div class="card p-6">
          <h2 class="text-xl font-bold mb-4">Party erstellen</h2>

          <form @submit.prevent="handleCreateParty" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">Party Name</label>
              <input
                v-model="createForm.name"
                type="text"
                required
                class="input"
                placeholder="Meine Dart Party"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Startscore</label>
              <select v-model="createForm.startScore" class="input">
                <option :value="301">301</option>
                <option :value="501">501</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Out-Regel</label>
              <select v-model="createForm.outRule" class="input">
                <option value="single">Single-Out</option>
                <option value="double">Double-Out</option>
              </select>
            </div>

            <div class="flex items-center space-x-2">
              <input
                v-model="createForm.isPublic"
                type="checkbox"
                id="isPublic"
                class="w-4 h-4"
              />
              <label for="isPublic" class="text-sm">Öffentliche Party</label>
            </div>

            <button
              type="submit"
              :disabled="creating"
              class="btn btn-primary w-full"
            >
              {{ creating ? 'Erstelle...' : 'Party erstellen' }}
            </button>
          </form>
        </div>

        <!-- Join Party -->
        <div class="card p-6">
          <h2 class="text-xl font-bold mb-4">Party beitreten</h2>

          <form @submit.prevent="handleJoinParty" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">Party Code</label>
              <input
                v-model="joinCode"
                type="text"
                required
                maxlength="6"
                class="input uppercase"
                placeholder="ABCD12"
                @input="joinCode = joinCode.toUpperCase()"
              />
              <p class="text-sm text-gray-400 mt-1">6-stelliger Code von deinem Host</p>
            </div>

            <button
              type="submit"
              :disabled="joining"
              class="btn btn-primary w-full"
            >
              {{ joining ? 'Beitrete...' : 'Beitreten' }}
            </button>
          </form>
        </div>
      </div>

      <!-- Instructions -->
      <div class="card p-6 max-w-4xl mx-auto mt-8">
        <h2 class="text-xl font-bold mb-4">Wie funktioniert's?</h2>
        <div class="space-y-3 text-gray-300">
          <p><strong>1.</strong> Erstelle eine Party oder trete einer bei (mit Party-Code)</p>
          <p><strong>2.</strong> Warte auf deine Freunde (sie brauchen den Code)</p>
          <p><strong>3.</strong> Der Host startet das Spiel</p>
          <p><strong>4.</strong> Tragt eure Würfe ein und spielt X01!</p>
          <p class="text-sm text-gray-400 mt-4">
            <strong>Tipp:</strong> Bei Double-Out musst du mit einem Doppel auschecken.
            Single-Out ist einfacher für Anfänger.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { usePartyStore } from '@/stores/party.store'
import { useToastStore } from '@/stores/toast.store'
import { GameSettings } from '@/types'

const router = useRouter()
const authStore = useAuthStore()
const partyStore = usePartyStore()
const toastStore = useToastStore()

const createForm = ref({
  name: '',
  startScore: 501 as 301 | 501,
  outRule: 'double' as 'single' | 'double',
  isPublic: false,
})

const joinCode = ref('')
const creating = ref(false)
const joining = ref(false)

async function handleCreateParty() {
  creating.value = true

  try {
    const settings: GameSettings = {
      startScore: createForm.value.startScore,
      outRule: createForm.value.outRule,
    }

    await partyStore.createParty(createForm.value.name, createForm.value.isPublic, settings)
    toastStore.success('Party erstellt!')
    router.push(`/party/${partyStore.party!.code}`)
  } catch (err: any) {
    toastStore.error(err.message || 'Fehler beim Erstellen der Party')
  } finally {
    creating.value = false
  }
}

async function handleJoinParty() {
  joining.value = true

  try {
    await partyStore.joinParty(joinCode.value)
    toastStore.success('Party beigetreten!')
    router.push(`/party/${joinCode.value}`)
  } catch (err: any) {
    toastStore.error(err.message || 'Fehler beim Beitreten der Party')
  } finally {
    joining.value = false
  }
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>
