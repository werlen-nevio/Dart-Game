<template>
  <div id="app">
    <!-- Login Screen -->
    <div v-if="!user" class="login-container">
      <div class="login-card">
        <h1 class="login-title">Dart Game</h1>
        <br>
        <a href="/auth/google" class="login-btn">
          Mit Google anmelden
        </a>
      </div>
    </div>

    <!-- Lobby Screen -->
    <div v-else-if="!party">
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div v-if="profilePicture" class="profile-pic-small" :style="{ backgroundImage: `url(${profilePicture})` }"></div>
            <h2>Willkommen, {{ user }}!</h2>
          </div>
          <div style="display: flex; gap: 8px;">
            <button @click="showProfileSettings = true" class="secondary">Profile</button>
            <button @click="logout" class="logout-btn">Logout</button>
          </div>
        </div>

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

        <hr class="divider" />

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
        <div
          class="shot-box"
          v-for="(shot, index) in 3"
          :key="index"
          :class="{ clickable: isCurrentPlayer && party.currentShots && party.currentShots[index] !== undefined }"
          @click="removeShot(index)"
        >
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
        <!-- Dartboard Overlay Messages -->
        <div v-if="dartboardMessage" class="dartboard-overlay">
          <div :class="['dartboard-message', dartboardMessage.type]">
            <div class="dartboard-message-icon">
              <span v-if="dartboardMessage.type === 'bust'">💥</span>
              <span v-else-if="dartboardMessage.type === 'double-required'">🎯</span>
              <span v-else>⚠️</span>
            </div>
            <div class="dartboard-message-text">{{ dartboardMessage.text }}</div>
          </div>
        </div>

        <!-- Circular Dartboard -->
        <div class="dartboard-circle">
          <svg viewBox="0 0 600 600" class="dartboard-svg-circle">
            <!-- Background -->
            <circle cx="300" cy="300" r="285" fill="#1a1a1a" stroke="#333" stroke-width="3"/>

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
              cx="300"
              cy="300"
              r="40"
              fill="#2e7d32"
              stroke="#000"
              stroke-width="2"
              @click="handleBullClick(25)"
              :class="['dartboard-segment', { disabled: !isCurrentPlayer }]"
            />

            <!-- Bull (50) -->
            <circle
              cx="300"
              cy="300"
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
          <button @click="addMiss" :disabled="!isCurrentPlayer || (party.currentShots && party.currentShots.length >= 3)" class="ctrl-btn miss-btn">Miss</button>
          <button @click="submitThrow" :disabled="!isCurrentPlayer" class="ctrl-btn submit-btn">Next Player</button>
        </div>
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
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <div v-if="player.profilePicture" class="profile-pic-small" :style="{ backgroundImage: `url(${player.profilePicture})` }"></div>
            <div class="player-name" style="margin-bottom: 0;">{{ player.username }}</div>
          </div>
          <div class="player-score">{{ player.score }}</div>
        </div>
      </div>
    </div>

    <!-- Profile Settings Modal -->
    <div v-if="showProfileSettings" class="modal-overlay">
      <div class="modal">
        <h3>Profile Settings</h3>

        <div class="form-group" style="margin-top: 20px;">
          <label>Profile Picture</label>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
            <div
              @click="triggerFileInput"
              class="profile-pic-preview clickable"
              :style="{ backgroundImage: profilePicture ? `url(${profilePicture})` : 'none' }"
            >
              <div v-if="!profilePicture" class="upload-placeholder">Click to upload</div>
              <div v-else class="edit-overlay">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span>Edit</span>
              </div>
            </div>
            <input
              ref="fileInput"
              type="file"
              @change="onFileSelected"
              accept="image/*"
              style="display: none;"
            />
            <p style="color: #8a8d8f; font-size: 0.85rem; margin: 0;">Click on the image to change your profile picture</p>
          </div>
        </div>

        <div class="form-group" style="margin-top: 24px;">
          <label>Username</label>
          <div style="display: flex; gap: 8px; align-items: stretch;">
            <input
              v-model="newUsername"
              placeholder="Enter new username"
              style="flex: 1; margin-bottom: 0;"
              @keyup.enter="updateUsername"
            />
            <button
              @click="updateUsername"
              :disabled="!newUsername.trim() || newUsername.trim() === user"
              style="padding: 14px 24px; white-space: nowrap;"
            >
              Save
            </button>
          </div>
        </div>

        <hr class="divider" style="margin: 24px 0;" />

        <button @click="showProfileSettings = false" style="width: 100%;">Close</button>
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
import { ref, computed, onUnmounted, onMounted } from 'vue';
import { io } from 'socket.io-client';

const socket = io({
  withCredentials: true
});

// State
const user = ref(null);
const party = ref(null);
const joinCode = ref('');
const createForm = ref({
  partyName: '',
  mode: '501',
  outMode: 'double'
});
const message = ref(null);
const dartboardMessage = ref(null);
const winner = ref(null);
const showProfileSettings = ref(false);
const profilePicture = ref(null);
const newUsername = ref('');
const fileInput = ref(null);

// Check if user is already authenticated via Google OAuth
onMounted(async () => {
  try {
    const response = await fetch('/auth/user', {
      credentials: 'include'
    });
    if (response.ok) {
      const userData = await response.json();
      user.value = userData.username;
      profilePicture.value = userData.profilePicture;
      newUsername.value = userData.username;
      // Also log in via socket
      socket.emit('user:login', userData.username);
    }
  } catch (error) {
    // User not authenticated, show login screen
    console.log('Not authenticated via OAuth');
  }
});

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
async function logout() {
  try {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    user.value = null;
    party.value = null;
    profilePicture.value = null;
    socket.disconnect();
    socket.connect();
  } catch (error) {
    console.error('Logout failed:', error);
  }
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

function addMiss() {
  if (!isCurrentPlayer.value) return;
  socket.emit('game:add_throw', {
    value: 0,
    multiplier: 0,
    baseNumber: 0
  });
}

function removeShot(index) {
  if (!isCurrentPlayer.value) return;
  if (!party.value.currentShots || party.value.currentShots[index] === undefined) return;
  socket.emit('game:remove_shot', index);
}

function getSegmentPath(index, innerRadius, outerRadius) {
  const anglePerSegment = (2 * Math.PI) / 20;
  const startAngle = index * anglePerSegment - Math.PI / 2 - anglePerSegment / 2;
  const endAngle = startAngle + anglePerSegment;
  const centerX = 300;
  const centerY = 300;

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
  const radius = 262;

  return {
    x: 300 + radius * Math.cos(angle),
    y: 300 + radius * Math.sin(angle)
  };
}

function getSingleColor(index) {
  // Alternating black and beige/white for single areas
  return index % 2 === 0 ? '#1a1a1a' : '#f5f5dc';
}

function getRingColor(index) {
  // Double and Triple rings: alternating red and green
  return index % 2 === 0 ? '#c62828' : '#2e7d32';
}

function submitThrow() {
  socket.emit('game:submit_throw');
}

function showMessage(text, type = 'info') {
  message.value = { text, type };
  setTimeout(() => {
    message.value = null;
  }, 3000);
}

function showDartboardMessage(text, type = 'error') {
  dartboardMessage.value = { text, type };
  setTimeout(() => {
    dartboardMessage.value = null;
  }, 2000);
}

function triggerFileInput() {
  fileInput.value.click();
}

async function resizeImage(file, maxWidth = 800, maxHeight = 800) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.85);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function onFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    // Resize image before upload
    const resizedBlob = await resizeImage(file);

    const formData = new FormData();
    formData.append('profilePicture', resizedBlob, 'profile.jpg');

    const response = await fetch('/api/upload-profile-picture', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    if (response.ok) {
      const data = await response.json();
      profilePicture.value = data.profilePicture;
      showMessage('Profile picture updated!', 'success');
      // Add cache buster to force reload
      if (profilePicture.value && !profilePicture.value.includes('?')) {
        profilePicture.value += '?t=' + Date.now();
      }
    } else {
      showMessage('Failed to upload profile picture', 'error');
    }
  } catch (error) {
    showMessage('Error uploading profile picture', 'error');
    console.error(error);
  }

  // Reset file input
  event.target.value = '';
}

async function updateUsername() {
  if (!newUsername.value.trim()) {
    showMessage('Username cannot be empty', 'error');
    return;
  }

  try {
    const response = await fetch('/api/update-username', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: newUsername.value.trim() })
    });

    if (response.ok) {
      const data = await response.json();
      user.value = data.username;
      showMessage('Username updated!', 'success');
      // Also update socket
      socket.emit('user:login', data.username);
    } else {
      showMessage('Failed to update username', 'error');
    }
  } catch (error) {
    showMessage('Error updating username', 'error');
    console.error(error);
  }
}

// Socket Listeners
socket.on('user:logged_in', (data) => {
  user.value = data.username;
  if (data.profilePicture) {
    profilePicture.value = data.profilePicture;
  }
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
  showDartboardMessage(msg, 'bust');
});

socket.on('game:double_required', (msg) => {
  showDartboardMessage(msg, 'double-required');
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
