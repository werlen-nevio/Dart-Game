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

      <!-- Current Shots Display -->
      <div class="current-shots-display">
        <div class="shot-box" v-for="(shot, index) in 3" :key="index">
          <div class="shot-label">Wurf {{ index + 1 }}</div>
          <div class="shot-value" :class="{ filled: party.currentShots && party.currentShots[index] !== undefined }">
            {{ party.currentShots && party.currentShots[index] !== undefined ? party.currentShots[index].value : '-' }}
          </div>
        </div>
        <div class="shot-total">
          <div class="shot-label">Total</div>
          <div class="shot-value filled">
            {{ party.currentShots ? party.currentShots.reduce((sum, shot) => sum + shot.value, 0) : 0 }}
          </div>
        </div>
      </div>

      <!-- Dartboard -->
      <div class="card">
        <!-- Circular Dartboard -->
        <div class="dartboard-circle">
          <svg viewBox="0 0 500 500" class="dartboard-svg-circle">
            <!-- Background -->
            <circle cx="250" cy="250" r="245" fill="#1a1a1a" stroke="#333" stroke-width="3"/>

            <!-- Segments -->
            <g v-for="(num, index) in boardNumbers" :key="'seg-' + num">
              <!-- Double Ring (outer) -->
              <path
                :d="getSegmentPath(index, 225, 240)"
                :fill="getRingColor(index, 'double')"
                stroke="#000"
                stroke-width="1"
                @click="handleRingClick(num, 2)"
                :class="['dartboard-segment', { disabled: !isCurrentPlayer }]"
              />

              <!-- Single Outer -->
              <path
                :d="getSegmentPath(index, 145, 225)"
                :fill="getSingleColor(index)"
                stroke="#000"
                stroke-width="0.5"
                @click="handleRingClick(num, 1)"
                :class="['dartboard-segment', { disabled: !isCurrentPlayer }]"
              />

              <!-- Triple Ring -->
              <path
                :d="getSegmentPath(index, 130, 145)"
                :fill="getRingColor(index, 'triple')"
                stroke="#000"
                stroke-width="1"
                @click="handleRingClick(num, 3)"
                :class="['dartboard-segment', { disabled: !isCurrentPlayer }]"
              />

              <!-- Single Inner -->
              <path
                :d="getSegmentPath(index, 40, 130)"
                :fill="getSingleColor(index)"
                stroke="#000"
                stroke-width="0.5"
                @click="handleRingClick(num, 1)"
                :class="['dartboard-segment', { disabled: !isCurrentPlayer }]"
              />

              <!-- Number labels -->
              <text
                :x="getNumberPos(index).x"
                :y="getNumberPos(index).y"
                class="segment-label"
                text-anchor="middle"
                dominant-baseline="middle"
              >
                {{ num }}
              </text>
            </g>

            <!-- Outer Bull (25) -->
            <circle
              cx="250"
              cy="250"
              r="40"
              fill="#2e7d32"
              stroke="#000"
              stroke-width="2"
              @click="handleBullClick(25)"
              :class="['dartboard-segment', { disabled: !isCurrentPlayer }]"
            />

            <!-- Bull (50) -->
            <circle
              cx="250"
              cy="250"
              r="16"
              fill="#c62828"
              stroke="#000"
              stroke-width="2"
              @click="handleBullClick(50)"
              :class="['dartboard-segment', { disabled: !isCurrentPlayer }]"
            />
          </svg>
        </div>

        <!-- Control Buttons -->
        <div class="control-btns">
          <button @click="clearThrow" :disabled="!isCurrentPlayer" class="ctrl-btn clear-btn">Clear</button>
          <button @click="submitThrow" :disabled="!isCurrentPlayer" class="ctrl-btn submit-btn">Submit</button>
        </div>

        <button @click="undo" class="ctrl-btn undo-btn" style="width: 100%;">
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
const winner = ref(null);

// Dartboard numbers in standard order (clockwise from top)
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

function handleRingClick(num, ringMultiplier) {
  if (!isCurrentPlayer.value) return;
  socket.emit('game:add_throw', {
    value: num * ringMultiplier,
    multiplier: ringMultiplier,
    baseNumber: num
  });
}

function handleBullClick(value) {
  if (!isCurrentPlayer.value) return;
  // Bull (50) and outer bull (25)
  const isDoubleBull = value === 50;
  socket.emit('game:add_throw', {
    value: value,
    multiplier: isDoubleBull ? 2 : 1,
    baseNumber: isDoubleBull ? 25 : 25
  });
}

function clearThrow() {
  socket.emit('game:clear_throw');
}

function getSegmentPath(index, innerRadius, outerRadius) {
  const anglePerSegment = (2 * Math.PI) / 20;
  const startAngle = index * anglePerSegment - Math.PI / 2 - anglePerSegment / 2;
  const endAngle = startAngle + anglePerSegment;
  const centerX = 250;
  const centerY = 250;

  const x1 = centerX + innerRadius * Math.cos(startAngle);
  const y1 = centerY + innerRadius * Math.sin(startAngle);
  const x2 = centerX + outerRadius * Math.cos(startAngle);
  const y2 = centerY + outerRadius * Math.sin(startAngle);
  const x3 = centerX + outerRadius * Math.cos(endAngle);
  const y3 = centerY + outerRadius * Math.sin(endAngle);
  const x4 = centerX + innerRadius * Math.cos(endAngle);
  const y4 = centerY + innerRadius * Math.sin(endAngle);

  return `M ${x1} ${y1} L ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 0 0 ${x1} ${y1} Z`;
}

function getNumberPos(index) {
  const anglePerSegment = (2 * Math.PI) / 20;
  const angle = index * anglePerSegment - Math.PI / 2;
  const radius = 260;

  return {
    x: 250 + radius * Math.cos(angle),
    y: 250 + radius * Math.sin(angle)
  };
}

function getSingleColor(index) {
  // Alternating black and beige/white for single areas
  return index % 2 === 0 ? '#1a1a1a' : '#f5f5dc';
}

function getRingColor(index, ring) {
  // Double and Triple rings: alternating red and green (like single areas)
  return index % 2 === 0 ? '#c62828' : '#2e7d32';
}

function submitThrow() {
  socket.emit('game:submit_throw');
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
