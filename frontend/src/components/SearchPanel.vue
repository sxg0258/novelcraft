<template>
  <Teleport to="body">
    <div v-if="visible" class="search-mask" @click.self="$emit('close')">
      <div class="search-panel">
        <div class="search-header">
          <span class="search-icon">🔍</span>
          <input
            ref="inputRef"
            v-model="query"
            class="search-input"
            placeholder="搜索章节内容、章节标题、书名..."
            @keydown.enter="goToHit(selectedHitIdx)"
            @keydown.down.prevent="moveHit(1)"
            @keydown.up.prevent="moveHit(-1)"
          />
          <span class="search-hint">ESC</span>
        </div>

        <div class="search-body">
          <div v-if="loading" class="search-status">搜索中…</div>
          <div v-else-if="!query.trim()" class="search-status">
            💡 支持中英文、章节标题、正文片段
          </div>
          <div v-else-if="hits.length === 0" class="search-status">
            没有找到匹配的内容
          </div>
          <div v-else class="search-results">
            <div class="result-meta">{{ hits.length }} 个匹配</div>
            <div
              v-for="(hit, i) in hits"
              :key="hit.chapterId + '-' + i"
              class="result-item"
              :class="{ active: i === selectedHitIdx }"
              @click="goToHit(i)"
              @mouseenter="selectedHitIdx = i"
            >
              <div class="result-book">{{ hit.bookTitle }}</div>
              <div class="result-title">
                {{ hit.chapterTitle }}
                <span class="result-words">{{ hit.wordCount }} 字</span>
              </div>
              <div class="result-snippet" v-html="highlight(hit.snippet)"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import axios from 'axios'

const props = defineProps({
  visible: Boolean,
  bookId: String
})
const emit = defineEmits(['close', 'jump'])

const api = axios.create({ baseURL: '/api' })

const query = ref('')
const hits = ref([])
const loading = ref(false)
const selectedHitIdx = ref(0)
const inputRef = ref(null)
let timer = null

watch(() => props.visible, (v) => {
  if (v) {
    query.value = ''
    hits.value = []
    selectedHitIdx.value = 0
    nextTick(() => inputRef.value?.focus())
  }
})

watch(query, (q) => {
  clearTimeout(timer)
  if (!q.trim()) {
    hits.value = []
    return
  }
  timer = setTimeout(() => doSearch(q), 300)
})

async function doSearch(q) {
  loading.value = true
  try {
    const { data } = await api.get('/search', {
      params: { q, ...(props.bookId ? { bookId: props.bookId } : {}) }
    })
    hits.value = data.hits
    selectedHitIdx.value = 0
  } catch (e) {
    hits.value = []
  } finally {
    loading.value = false
  }
}

function moveHit(delta) {
  if (hits.value.length === 0) return
  selectedHitIdx.value = (selectedHitIdx.value + delta + hits.value.length) % hits.value.length
}

function goToHit(idx) {
  const hit = hits.value[idx]
  if (hit) {
    emit('jump', hit)
    emit('close')
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}

function highlight(text) {
  if (!text) return ''
  const safe = escapeHtml(text)
  const q = escapeHtml(query.value.trim())
  if (!q) return safe
  return safe.replaceAll(q, `<mark>${q}</mark>`)
}
</script>

<style scoped>
.search-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 100px;
  z-index: 300;
}

.search-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 600px;
  max-width: 90vw;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

.search-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  gap: 8px;
}

.search-icon { font-size: 18px; }

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 16px;
  padding: 8px 0;
}

.search-input:focus { outline: none; background: transparent; border: none; }

.search-hint {
  font-size: 11px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--text-muted);
}

.search-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.search-status {
  padding: 40px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.search-results { padding: 0 8px; }

.result-meta {
  padding: 4px 12px;
  font-size: 11px;
  color: var(--text-muted);
}

.result-item {
  padding: 12px 14px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
}

.result-item.active {
  background: var(--bg-tertiary);
}

.result-book {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.result-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-words {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: normal;
}

.result-snippet {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.result-snippet :deep(mark) {
  background: var(--accent);
  color: white;
  padding: 1px 3px;
  border-radius: 2px;
}
</style>
