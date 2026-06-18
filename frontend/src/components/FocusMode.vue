<template>
  <Teleport to="body">
    <div v-if="active" class="focus-mask">
      <div class="focus-topbar">
        <button @click="exit">✕ 退出专注</button>
        <div class="focus-stats">
          <span v-if="todayWords > 0">今日 +{{ todayWords }} 字</span>
          <span v-else>还没开始今日写作</span>
        </div>
        <div class="focus-controls">
          <button :class="{ active: sound === 'rain' }" @click="toggleSound('rain')">🌧 雨声</button>
          <button :class="{ active: sound === 'fire' }" @click="toggleSound('fire')">🔥 炉火</button>
          <button :class="{ active: sound === 'white' }" @click="toggleSound('white')">📻 白噪</button>
          <button :class="{ active: sound === null }" @click="toggleSound(null)">🔇 静音</button>
        </div>
      </div>

      <div class="focus-body">
        <textarea
          ref="editor"
          v-model="text"
          class="focus-editor"
          placeholder="开始写吧…什么都可以写，先动笔。"
          @input="onInput"
        ></textarea>
        <div class="focus-meta">
          <span class="words">{{ wordCount }} 字</span>
          <span class="sep">·</span>
          <span class="duration">{{ formatDuration(elapsed) }}</span>
          <span class="sep">·</span>
          <span class="timer" :class="{ overtime: isOvertime }">{{ timerLabel }}</span>
        </div>
      </div>

      <div class="focus-bottombar">
        <div class="pomodoro">
          <div class="pom-circle" :style="{ '--progress': pomodoroProgress }">
            <span class="pom-time">{{ Math.floor(pomodoroLeft / 60) }}:{{ String(pomodoroLeft % 60).padStart(2, '0') }}</span>
          </div>
          <div class="pom-actions">
            <button @click="resetPomodoro">↻</button>
            <button @click="togglePomodoro">{{ pomodoroRunning ? '⏸' : '▶' }}</button>
          </div>
          <div class="pom-status">{{ pomodoroLabel }}</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  initialText: { type: String, default: '' }
})
const emit = defineEmits(['save'])

const active = ref(false)
const text = ref('')
const initial = ref('')
const editor = ref(null)
const startTime = ref(null)
const elapsed = ref(0)
const todayWords = ref(0)

const pomodoroRunning = ref(false)
const pomodoroPhase = ref('work') // work / break
const pomodoroLeft = ref(25 * 60) // 25 minutes
const pomodoroDuration = ref(25 * 60)
const sound = ref(null)
let audioCtx = null
let noiseNode = null
let pomodoroTimer = null
let elapsedTimer = null

const wordCount = computed(() => {
  const cn = (text.value.match(/[\u4e00-\u9fa5]/g) || []).length
  const en = (text.value.match(/[a-zA-Z]+/g) || []).length
  return cn + en
})

const isOvertime = computed(() => elapsed.value >= 25 * 60)

const timerLabel = computed(() => {
  const m = Math.floor(elapsed.value / 60)
  return m < 60 ? `${m} 分钟` : `${Math.floor(m / 60)} 小时 ${m % 60} 分钟`
})

const pomodoroProgress = computed(() => {
  return `${((pomodoroDuration.value - pomodoroLeft.value) / pomodoroDuration.value) * 360}deg`
})

const pomodoroLabel = computed(() => pomodoroPhase.value === 'work' ? '专注中' : '休息中')

function start(initialText = '') {
  text.value = initialText
  initial.value = initialText
  active.value = true
  startTime.value = Date.now()
  elapsed.value = 0
  document.body.style.overflow = 'hidden'
  // 计算今日字数（简单实现：和初始对比）
  todayWords.value = 0
  // 启动计时
  elapsedTimer = setInterval(() => {
    elapsed.value = Math.floor((Date.now() - startTime.value) / 1000)
  }, 1000)
  // 启动番茄钟
  startPomodoro()
  // 聚焦
  setTimeout(() => editor.value?.focus(), 100)
}

function exit() {
  active.value = false
  document.body.style.overflow = ''
  if (pomodoroTimer) clearInterval(pomodoroTimer)
  if (elapsedTimer) clearInterval(elapsedTimer)
  stopSound()
  // 保存
  if (text.value !== initial.value) {
    emit('save', text.value)
  }
}

function onInput() {
  // 防抖保存
  clearTimeout(window._focusSaveTimer)
  window._focusSaveTimer = setTimeout(() => {
    emit('save', text.value)
    initial.value = text.value
  }, 1500)
}

// ===== 番茄钟 =====

function startPomodoro() {
  pomodoroRunning.value = true
  pomodoroTimer = setInterval(() => {
    pomodoroLeft.value--
    if (pomodoroLeft.value <= 0) {
      // 切换阶段
      if (pomodoroPhase.value === 'work') {
        pomodoroPhase.value = 'break'
        pomodoroDuration.value = 5 * 60
        pomodoroLeft.value = 5 * 60
        playBeep()
      } else {
        pomodoroPhase.value = 'work'
        pomodoroDuration.value = 25 * 60
        pomodoroLeft.value = 25 * 60
        playBeep()
      }
    }
  }, 1000)
}

function togglePomodoro() {
  if (pomodoroRunning.value) {
    clearInterval(pomodoroTimer)
    pomodoroRunning.value = false
  } else {
    startPomodoro()
  }
}

function resetPomodoro() {
  clearInterval(pomodoroTimer)
  pomodoroPhase.value = 'work'
  pomodoroDuration.value = 25 * 60
  pomodoroLeft.value = 25 * 60
  pomodoroRunning.value = false
}

function formatDuration(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function playBeep() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.frequency.value = 880
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5)
  osc.connect(gain).connect(audioCtx.destination)
  osc.start()
  osc.stop(audioCtx.currentTime + 0.5)
}

// ===== 白噪音 =====

function toggleSound(type) {
  if (sound.value === type) {
    stopSound()
    sound.value = null
    return
  }
  stopSound()
  sound.value = type
  if (type) startSound(type)
}

function startSound(type) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()

  // 用白噪音 + 不同滤波器模拟不同声音
  const bufferSize = 2 * audioCtx.sampleRate
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }

  noiseNode = audioCtx.createBufferSource()
  noiseNode.buffer = noiseBuffer
  noiseNode.loop = true

  const gain = audioCtx.createGain()
  gain.gain.value = 0.04

  let filter
  if (type === 'rain') {
    filter = audioCtx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1500
  } else if (type === 'fire') {
    filter = audioCtx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 400
    // 加点 crackle
    const gain2 = audioCtx.createGain()
    gain2.gain.value = 0.06
    noiseNode.connect(filter).connect(gain2).connect(audioCtx.destination)
    noiseNode.connect(gain).connect(audioCtx.destination)
    noiseNode.start()
    return
  } else if (type === 'white') {
    filter = audioCtx.createBiquadFilter()
    filter.type = 'allpass'
  }

  noiseNode.connect(filter || gain).connect(gain).connect(audioCtx.destination)
  noiseNode.start()
}

function stopSound() {
  if (noiseNode) {
    try { noiseNode.stop() } catch (e) {}
    noiseNode = null
  }
}

onBeforeUnmount(() => {
  if (pomodoroTimer) clearInterval(pomodoroTimer)
  if (elapsedTimer) clearInterval(elapsedTimer)
  stopSound()
})

defineExpose({ start })
</script>

<style scoped>
.focus-mask {
  position: fixed;
  inset: 0;
  background: #0d0d0d;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.focus-topbar {
  padding: 16px 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #222;
  background: #111;
}

.focus-topbar button {
  background: transparent;
  border: 1px solid #333;
  color: #888;
}

.focus-topbar button:hover {
  background: #222;
  color: white;
  border-color: #444;
}

.focus-stats {
  color: #666;
  font-size: 13px;
}

.focus-controls {
  display: flex;
  gap: 8px;
}

.focus-controls button {
  background: transparent;
  border: 1px solid #333;
  color: #888;
  font-size: 12px;
}

.focus-controls button.active {
  background: #6366f1;
  border-color: #6366f1;
  color: white;
}

.focus-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  overflow: hidden;
}

.focus-editor {
  width: 100%;
  max-width: 760px;
  height: 70vh;
  background: transparent;
  border: none;
  color: #e8e8e8;
  font-size: 19px;
  line-height: 2;
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", serif;
  resize: none;
  outline: none;
}

.focus-editor::placeholder {
  color: #444;
}

.focus-meta {
  margin-top: 24px;
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #666;
}

.sep { color: #333; }

.timer.overtime { color: #f59e0b; }

.focus-bottombar {
  padding: 24px;
  display: flex;
  justify-content: center;
  background: #111;
  border-top: 1px solid #222;
}

.pomodoro {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pom-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: conic-gradient(#6366f1 var(--progress, 0deg), #222 var(--progress, 0deg));
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.pom-circle::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background: #111;
}

.pom-time {
  position: relative;
  font-size: 14px;
  font-weight: 600;
  color: #e8e8e8;
  z-index: 1;
}

.pom-actions {
  display: flex;
  gap: 4px;
}

.pom-actions button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: transparent;
  border: 1px solid #333;
  color: #888;
}

.pom-status {
  font-size: 12px;
  color: #666;
  min-width: 60px;
}
</style>
