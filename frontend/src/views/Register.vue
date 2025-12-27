<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="card p-8 w-full max-w-md">
      <h1 class="text-3xl font-bold text-center mb-8">Registrieren</h1>

      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">Email</label>
          <input
            v-model="email"
            type="email"
            required
            class="input"
            placeholder="dein@email.de"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">Benutzername</label>
          <input
            v-model="username"
            type="text"
            required
            minlength="3"
            maxlength="20"
            class="input"
            placeholder="DeinName"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">Passwort</label>
          <input
            v-model="password"
            type="password"
            required
            minlength="6"
            class="input"
            placeholder="••••••••"
          />
        </div>

        <div v-if="error" class="p-3 bg-red-900 border border-red-500 rounded-lg text-sm">
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="authStore.loading"
          class="btn btn-primary w-full"
        >
          {{ authStore.loading ? 'Wird geladen...' : 'Registrieren' }}
        </button>
      </form>

      <div class="mt-6 text-center">
        <p class="text-sm text-gray-400">
          Bereits registriert?
          <RouterLink to="/login" class="text-primary-400 hover:text-primary-300">
            Login
          </RouterLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()

const email = ref('')
const username = ref('')
const password = ref('')
const error = ref('')

async function handleRegister() {
  error.value = ''

  try {
    await authStore.register(email.value, username.value, password.value)
    toastStore.success('Account erfolgreich erstellt! Bitte einloggen.')
    router.push('/login')
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message || 'Registrierung fehlgeschlagen'
  }
}
</script>
