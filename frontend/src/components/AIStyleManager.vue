<template>
  <div class="ai-style-manager">
    <div class="asm-header">
      <button class="primary" @click="showNew = true">+ 新风格</button>
    </div>
    <div v-if="styles.length === 0" class="empty">
      <p>还没有自定义风格。先创建几个，AI 续写/润色时会让你选。</p>
      <p style="color: var(--text-muted); font-size: 12px; margin-top: 8px">
        提示：每个风格包含 system prompt + 温度等参数。同一本书可以有多个风格，根据场景切换。
      </p>
    </div>
    <div v-else class="asm-list">
      <div v-for="s in styles" :key="s.id" class="asm-card" :class="{ default: s.isDefault }">
        <div class="asm-card-main">
          <div class="asm-name">
            {{ s.name }}
            <span v-if="s.isDefault" class="default-badge">默认</span>
          </div>
          <div v-if="s.description" class="asm-desc">{{ s.description }}</div>
          <div class="asm-params">
            <span>🌡 {{ s.temperature }}</span>
            <span>📊 top_p {{ s.topP }}</span>
            <span v-if="s.frequencyPenalty">⚡ 频率 {{ s.frequencyPenalty }}</span>
            <span v-if="s.presencePenalty">⚡ 存在 {{ s.presencePenalty }}</span>
          </div>
        </div>
        <div class="asm-actions">
          <button @click="edit(s)">编辑</button>
          <button v-if="!s.isDefault" @click="setDefault(s)">设为默认</button>
          <button class="danger" @click="remove(s)">删除</button>
        </div>
      </div>
    </div>

    <!-- 新建/编辑弹窗 -->
    <div v-if="showNew" class="modal-mask" @click.self="showNew = false">
      <div class="modal">
        <h3>{{ editing ? '编辑' : '新建' }}风格</h3>
        <div class="form-row">
          <label>风格名</label>
          <input v-model="form.name" placeholder="如：古风玄幻 / 都市言情 / 严肃文学" />
        </div>
        <div class="form-row">
          <label>描述（可选）</label>
          <input v-model="form.description" placeholder="一句话描述这个风格" />
        </div>
        <div class="form-row">
          <label>System Prompt（给 AI 的角色设定）</label>
          <textarea v-model="form.systemPrompt" rows="5" placeholder="如：你是古风玄幻小说家，文风华丽、善用比喻、人物对白古朴典雅…"></textarea>
        </div>
        <div class="form-row form-row-grid">
          <div>
            <label>Temperature (0~2)</label>
            <input v-model.number="form.temperature" type="number" step="0.1" min="0" max="2" />
          </div>
          <div>
            <label>Top P (0~1)</label>
            <input v-model.number="form.topP" type="number" step="0.05" min="0" max="1" />
          </div>
          <div>
            <label>Frequency Penalty (-2~2)</label>
            <input v-model.number="form.frequencyPenalty" type="number" step="0.1" min="-2" max="2" />
          </div>
          <div>
            <label>Presence Penalty (-2~2)</label>
            <input v-model.number="form.presencePenalty" type="number" step="0.1" min="-2" max="2" />
          </div>
        </div>
        <div class="modal-actions">
          <button @click="showNew = false">取消</button>
          <button class="primary" @click="save" :disabled="!form.name">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import axios from 'axios'

const props = defineProps({ book: { type: Object, required: true } })

const api = axios.create({ baseURL: '/api' })
const styles = ref([])
const showNew = ref(false)
const editing = ref(null)
const form = ref({
  name: '', description: '', systemPrompt: '',
  temperature: 0.7, topP: 1.0, frequencyPenalty: 0, presencePenalty: 0
})

async function load() {
  if (!props.book) return
  const { data } = await api.get(`/books/${props.book.id}/ai-styles`)
  styles.value = data.styles
}

onMounted(load)
watch(() => props.book?.id, load)

function edit(s) {
  editing.value = s
  form.value = { ...s }
  showNew.value = true
}

async function save() {
  if (editing.value) {
    await api.patch(`/ai-styles/${editing.value.id}`, form.value)
  } else {
    await api.post(`/books/${props.book.id}/ai-styles`, form.value)
  }
  showNew.value = false
  editing.value = null
  form.value = { name: '', description: '', systemPrompt: '', temperature: 0.7, topP: 1.0, frequencyPenalty: 0, presencePenalty: 0 }
  await load()
}

async function remove(s) {
  if (!confirm(`删除风格「${s.name}」？`)) return
  await api.delete(`/ai-styles/${s.id}`)
  await load()
}

async function setDefault(s) {
  await api.patch(`/ai-styles/${s.id}`, { isDefault: true })
  await load()
}
</script>

<style scoped>
.ai-style-manager { width: 100%; }

.asm-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
}

.asm-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.asm-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.asm-card.default {
  border-color: var(--accent);
}

.asm-name {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.default-badge {
  background: var(--accent);
  color: white;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: normal;
}

.asm-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.asm-params {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
}

.asm-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.modal {
  background: var(--bg-secondary);
  padding: 24px;
  border-radius: 8px;
  width: 560px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  border: 1px solid var(--border);
}

.modal h3 { margin: 0 0 20px; }

.form-row { margin-bottom: 16px; }
.form-row label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-row input, .form-row textarea, .form-row select { width: 100%; }

.form-row-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-row-grid > div { margin-bottom: 0; }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
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
