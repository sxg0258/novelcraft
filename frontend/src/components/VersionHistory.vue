<template>
  <Teleport to="body">
    <div v-if="visible" class="vh-mask" @click.self="$emit('close')">
      <div class="vh-modal">
        <div class="vh-header">
          <h2>📜 版本历史 · {{ chapterTitle }}</h2>
          <button @click="$emit('close')">✕</button>
        </div>

        <div class="vh-body">
          <!-- 左：快照列表 -->
          <div class="vh-list">
            <div class="vh-list-header">
              <span>最近 {{ snapshots.length }} 个版本</span>
              <button @click="createSnapshot" :disabled="creating">📸 当前拍快照</button>
            </div>
            <div v-if="snapshots.length === 0" class="empty">
              还没有快照。<br>
              <small>每 10 分钟且字数变化超过 50 字时自动拍一张</small>
            </div>
            <div
              v-for="(s, i) in snapshots"
              :key="s.id"
              class="vh-item"
              :class="{ active: selected?.id === s.id }"
              @click="select(s)"
            >
              <div class="vh-item-time">{{ formatTime(s.createdAt) }}</div>
              <div class="vh-item-title">{{ s.title }}</div>
              <div class="vh-item-meta">{{ s.wordCount }} 字</div>
              <div v-if="selected && snapshots[i - 1]?.id === compareId" class="vh-item-tag">对比基线</div>
            </div>
          </div>

          <!-- 右：详情 + 对比 -->
          <div class="vh-detail">
            <div v-if="!selected" class="vh-detail-empty">
              👈 选择一个快照查看详情
            </div>
            <div v-else>
              <div class="vh-detail-actions">
                <button @click="compareWithPrev" :disabled="!hasPrev">⤺ 与上一版对比</button>
                <button @click="rollback" class="danger">↺ 回滚到此版本</button>
              </div>

              <div v-if="diff" class="vh-diff">
                <h4>变更概要</h4>
                <div class="diff-summary">
                  <span :class="diff.wordDelta > 0 ? 'positive' : diff.wordDelta < 0 ? 'negative' : ''">
                    {{ diff.wordDelta > 0 ? '+' : '' }}{{ diff.wordDelta }} 字
                  </span>
                  <span>·</span>
                  <span class="added">+{{ diff.added.length }} 段</span>
                  <span class="removed">−{{ diff.removed.length }} 段</span>
                </div>

                <div v-if="diff.added.length" class="diff-section">
                  <h5 class="diff-title added">新增段落</h5>
                  <div v-for="(p, i) in diff.added" :key="'a' + i" class="diff-block added">{{ p }}</div>
                </div>
                <div v-if="diff.removed.length" class="diff-section">
                  <h5 class="diff-title removed">删除段落</h5>
                  <div v-for="(p, i) in diff.removed" :key="'r' + i" class="diff-block removed">{{ p }}</div>
                </div>
                <div v-if="diff.added.length === 0 && diff.removed.length === 0" class="diff-empty">
                  内容相同（仅元数据变更）
                </div>
              </div>

              <div v-else>
                <h4>完整内容</h4>
                <pre class="vh-content">{{ selected.contentText }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import axios from 'axios'

const props = defineProps({
  visible: Boolean,
  chapterId: String,
  chapterTitle: String
})
const emit = defineEmits(['close', 'rolled-back'])

const api = axios.create({ baseURL: '/api' })

const snapshots = ref([])
const selected = ref(null)
const compareId = ref(null)
const diff = ref(null)
const creating = ref(false)

const hasPrev = computed(() => {
  if (!selected.value) return false
  const idx = snapshots.value.findIndex(s => s.id === selected.value.id)
  return idx < snapshots.value.length - 1
})

watch(() => props.visible, async (v) => {
  if (v) {
    selected.value = null
    diff.value = null
    compareId.value = null
    await load()
  }
})

async function load() {
  if (!props.chapterId) return
  const { data } = await api.get(`/chapters/${props.chapterId}/snapshots`)
  snapshots.value = data.snapshots
}

async function select(s) {
  selected.value = s
  diff.value = null
  compareId.value = null
  // 获取完整快照内容
  const { data } = await api.get(`/snapshots/${s.id}`)
  selected.value = { ...s, ...data.snapshot }
}

async function compareWithPrev() {
  const idx = snapshots.value.findIndex(s => s.id === selected.value.id)
  if (idx >= snapshots.value.length - 1) return
  const prev = snapshots.value[idx + 1]
  compareId.value = prev.id
  const { data } = await api.get(`/chapters/${props.chapterId}/diff`, {
    params: { from: prev.id, to: selected.value.id }
  })
  diff.value = data
}

async function rollback() {
  if (!selected.value) return
  if (!confirm(`确定回滚到 ${formatTime(selected.value.createdAt)} 的版本？当前未保存的修改会丢失。`)) return
  await api.post(`/chapters/${props.chapterId}/rollback/${selected.value.id}`)
  alert('✅ 已回滚，刷新页面查看最新内容')
  emit('rolled-back')
  emit('close')
}

async function createSnapshot() {
  creating.value = true
  try {
    await api.post(`/chapters/${props.chapterId}/snapshots`)
    await load()
  } finally {
    creating.value = false
  }
}

function formatTime(t) {
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.vh-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.vh-modal {
  background: var(--bg-secondary);
  border-radius: 8px;
  width: 900px;
  max-width: 95vw;
  height: 80vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
}

.vh-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.vh-header h2 { margin: 0; font-size: 16px; }

.vh-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.vh-list {
  width: 260px;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.vh-list-header {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
}

.vh-list-header button {
  font-size: 11px;
  padding: 4px 8px;
}

.vh-item {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}

.vh-item:hover { background: var(--bg-tertiary); }
.vh-item.active { background: var(--bg-tertiary); border-left: 3px solid var(--accent); }

.vh-item-time {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.vh-item-title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vh-item-meta {
  font-size: 11px;
  color: var(--text-muted);
}

.vh-item-tag {
  display: inline-block;
  margin-top: 4px;
  background: var(--accent);
  color: white;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
}

.vh-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.vh-detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.vh-detail-actions {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  gap: 8px;
}

.vh-diff, .vh-content-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.vh-content {
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.8;
  background: var(--bg-tertiary);
  padding: 16px;
  border-radius: 6px;
}

.vh-diff h4 {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.diff-summary {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
  margin-bottom: 20px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.positive { color: var(--success); font-weight: 600; }
.negative { color: var(--danger); font-weight: 600; }

.added { color: var(--success); }
.removed { color: var(--danger); }

.diff-section { margin-bottom: 20px; }

.diff-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
}

.diff-block {
  padding: 10px 12px;
  border-radius: 4px;
  margin-bottom: 6px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.diff-block.added {
  background: rgba(16, 185, 129, 0.1);
  border-left: 3px solid var(--success);
}

.diff-block.removed {
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid var(--danger);
  text-decoration: line-through;
  opacity: 0.7;
}

.diff-empty {
  text-align: center;
  padding: 30px;
  color: var(--text-muted);
}

.empty {
  padding: 40px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.8;
}

.danger {
  background: transparent;
  border-color: var(--danger);
  color: var(--danger);
}

.danger:hover {
  background: var(--danger);
  color: white;
}
</style>
