<template>
  <div id="app">
    <h1>🎯 Dart Online</h1>

    <!-- Login Screen -->
    <div v-if="!user" class="card">
      <h2>Login</h2>
      <div class="form-group">
        <input
          v-model="loginUsername"
          @keyup.enter="login"
          placeholder="Dein Username"
          type="text"
        />
      </div>
      <button @click="login">Login</button>
    </div>

    <!-- Lobby Screen -->
    <div v-else-if="!party">
      <div class="card">
        <h2>Willkommen, {{ user }}!</h2>

        <h3 style="margin-top: 24px; margin-bottom: 12px;">Party erstellen</h3>
        <div class="form-group">
          <label>Party Name</label>
          <input v-model="createForm.partyName" placeholder="Meine Dart Party" />
        </div>
        <div class="form-group">
          <label>Spielmodus</label>
          <select v-model="createForm.mode">
            <option value="301">301</option>
            <option value="501">501</option>
          </select>
        </div>
        <div class="form-group">
          <label>Out-Modus</label>
          <select v-model="createForm.outMode">
            <option value="single">Single Out</option>
            <option value="double">Double Out</option>
          </select>
        </div>
        <button @click="createParty">Party erstellen</button>

        <hr style="margin: 32px 0; border: 1px solid #444;" />

        <h3 style="margin-bottom: 12px;">Party beitreten</h3>
        <div class="form-group">
          <label>Party Code</label>
          <input
            v-model="joinCode"
            @keyup.enter="joinParty"
            placeholder="6-stelliger Code"
            style="text-transform: uppercase;"
          />
        </div>
        <button @click="joinParty" class="secondary">Beitreten</button>
      </div>
    </div>

    <!-- Party/Game Screen -->
    <div v-else>
      <div class="party-header">
        <h2>{{ party.name }}</h2>
        <div class="party-code">{{ party.code }}</div>
        <p style="margin-top: 12px; color: #ccc;">
          {{ party.mode }} • {{ party.outMode === 'double' ? 'Double Out' : 'Single Out' }}
        </p>
      </div>

      <div v-if="message" :class="'alert alert-' + message.type">
        {{ message.text }}
      </div>

      <div class="turn-indicator">
        Am Zug: {{ currentPlayer?.username || '...' }}
      </div>

      <!-- Current Throw Display -->
      <div class="current-throw-display">
        <div class="current-throw-label">Aktueller Wurf</div>
        <div class="current-throw-value">{{ party.currentThrow || 0 }}</div>
      </div>

      <!-- Dartboard -->
      <div class="card">
        <h3 style="margin-bottom: 16px;">Dartboard</h3>

        <!-- Dartboard Grid -->
        <div class="dartboard">
          <!-- Outer Ring (Numbers) -->
          <div class="board-ring">
            <div v-for="num in boardNumbers" :key="'num-' + num" class="board-number">
              {{ num }}
            </div>
          </div>

          <!-- Main Board -->
          <div class="board-main">
            <!-- Single Sections -->
            <div class="board-sections">
              <button
                v-for="num in boardNumbers"
                :key="'single-' + num"
                @click="addThrow(num)"
                :disabled="!isCurrentPlayer"
                class="board-section single"
                :class="getBoardColor(num)"
              >
                {{ num }}
              </button>
            </div>

            <!-- Double Ring -->
            <div class="board-ring-inner double-ring">
              <button
                v-for="num in boardNumbers"
                :key="'double-' + num"
                @click="addThrow(num * 2)"
                :disabled="!isCurrentPlayer"
                class="board-section-small double"
                :class="getBoardColor(num)"
              >
                D{{ num }}
              </button>
            </div>

            <!-- Triple Ring -->
            <div class="board-ring-inner triple-ring">
              <button
                v-for="num in boardNumbers"
                :key="'triple-' + num"
                @click="addThrow(num * 3)"
                :disabled="!isCurrentPlayer"
                class="board-section-small triple"
                :class="getBoardColor(num)"
              >
                T{{ num }}
              </button>
            </div>

            <!-- Bull's Eye -->
            <div class="bulls-eye-container">
              <button
                @click="addThrow(50)"
                :disabled="!isCurrentPlayer"
                class="bulls-eye bullseye"
              >
                50
              </button>
              <button
                @click="addThrow(25)"
                :disabled="!isCurrentPlayer"
                class="bulls-eye single-bull"
              >
                25
              </button>
            </div>
          </div>
        </div>

        <!-- Control Buttons -->
        <div class="grid grid-3" style="margin-top: 20px;">
          <button @click="clearThrow" :disabled="!isCurrentPlayer" class="danger">Clear</button>
          <button @click="submitThrow" :disabled="!isCurrentPlayer" class="success">Submit</button>
          <button @click="nextPlayer" :disabled="!isCurrentPlayer" class="secondary">Next Player</button>
        </div>

        <button @click="undo" class="secondary" style="margin-top: 12px; width: 100%;">
          Undo
        </button>
      </div>

      <!-- Players -->
      <div class="grid grid-2">
        <div
          v-for="(player, index) in party.players"
          :key="player.username"
          :class="['player-card', {
            active: index === party.currentPlayerIndex,
            winner: player.score === 0
          }]"
        >
          <div class="player-name">{{ player.username }}</div>
          <div class="player-score">{{ player.score }}</div>
        </div>
      </div>
    </div>

    <!-- Double-Out Modal -->
    <div v-if="showDoubleModal" class="modal-overlay">
      <div class="modal">
        <h3>Double getroffen?</h3>
        <p style="color: #ccc; margin-bottom: 20px;">
          Du brauchst ein Double für den Win!
        </p>
        <div class="modal-buttons">
          <button @click="confirmDouble(false)" class="secondary">Nein</button>
          <button @click="confirmDouble(true)" class="success">Ja</button>
        </div>
      </div>
    </div>

    <!-- Winner Modal -->
    <div v-if="winner" class="modal-overlay">
      <div class="modal">
        <h3>🎉 Gewinner!</h3>
        <p style="font-size: 1.5rem; margin: 20px 0; color: #2ecc71;">
          {{ winner }}
        </p>
        <button @click="winner = null" class="success">OK</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

// State
const user = ref(null);
const party = ref(null);
const loginUsername = ref('');
const joinCode = ref('');
const createForm = ref({
  partyName: '',
  mode: '501',
  outMode: 'double'
});
const message = ref(null);
const showDoubleModal = ref(false);
const winner = ref(null);

// Dartboard numbers in standard order
const boardNumbers = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Computed
const currentPlayer = computed(() => {
  if (!party.value) return null;
  return party.value.players[party.value.currentPlayerIndex];
});

const isCurrentPlayer = computed(() => {
  if (!party.value || !user.value) return false;
  return currentPlayer.value?.username === user.value;
});

// Methods
function login() {
  if (!loginUsername.value.trim()) return;
  socket.emit('user:login', loginUsername.value.trim());
}

function createParty() {
  if (!createForm.value.partyName.trim()) {
    showMessage('Bitte Party-Name eingeben', 'error');
    return;
  }
  socket.emit('party:create', createForm.value);
}

function joinParty() {
  if (!joinCode.value.trim()) return;
  socket.emit('party:join', joinCode.value.trim().toUpperCase());
}

function addThrow(value) {
  socket.emit('game:add_throw', value);
}

function clearThrow() {
  socket.emit('game:clear_throw');
}

function submitThrow() {
  const currentPlayerObj = currentPlayer.value;
  const throwValue = party.value.currentThrow || 0;
  const newScore = currentPlayerObj.score - throwValue;

  // Check if it would be exactly 0 and double-out is required
  if (newScore === 0 && party.value.outMode === 'double') {
    showDoubleModal.value = true;
  } else {
    socket.emit('game:submit_throw', { doubleHit: false });
  }
}

function confirmDouble(hit) {
  showDoubleModal.value = false;
  socket.emit('game:submit_throw', { doubleHit: hit });
}

function nextPlayer() {
  socket.emit('game:next_player');
}

function undo() {
  socket.emit('game:undo');
}

function showMessage(text, type = 'info') {
  message.value = { text, type };
  setTimeout(() => {
    message.value = null;
  }, 3000);
}

function getBoardColor(num) {
  // Dartboard coloring: alternating red and green/black
  const redNumbers = [1, 4, 6, 10, 13, 15, 3, 17, 19, 9];
  return redNumbers.includes(num) ? 'red' : 'green';
}

// Socket Listeners
socket.on('user:logged_in', (data) => {
  user.value = data.username;
});

socket.on('party:created', (data) => {
  party.value = data;
});

socket.on('party:joined', (data) => {
  party.value = data;
});

socket.on('party:state', (data) => {
  party.value = data;
});

socket.on('game:bust', (msg) => {
  showMessage(msg, 'error');
});

socket.on('game:double_required', (msg) => {
  showMessage(msg, 'error');
});

socket.on('game:winner', (username) => {
  winner.value = username;
});

socket.on('error', (msg) => {
  showMessage(msg, 'error');
});

onUnmounted(() => {
  socket.disconnect();
});
</script>
