<template>
  <Teleport to="body">
    <div v-if="visible" class="settings-mask" @click.self="$emit('close')">
      <div class="settings-modal">
        <div class="settings-header">
          <h2>⚙️ AI 设置</h2>
          <button @click="$emit('close')">✕</button>
        </div>

        <div class="settings-tabs">
          <button :class="{ active: tab === 'providers' }" @click="tab = 'providers'">API 提供方</button>
          <button :class="{ active: tab === 'styles' }" @click="tab = 'styles'">写作风格</button>
        </div>

        <div class="settings-body">
          <!-- Providers -->
          <div v-if="tab === 'providers'" class="prov-section">
            <p class="section-tip">
              配置你要用的大模型服务。<strong>DeepSeek / 通义千问 / 智谱</strong>性价比高，
              <strong>Ollama</strong>完全本地（需启用 <code>ai-local</code> profile）。
            </p>

            <div v-if="providers.length === 0" class="empty-providers">
              <p>还没有配置 API 提供方</p>
              <button class="primary" @click="showAddProvider = true">+ 添加第一个</button>
            </div>

            <div v-else class="prov-list">
              <div v-for="p in providers" :key="p.id" class="prov-card">
                <div class="prov-main">
                  <div class="prov-icon">{{ iconOf(p.provider) }}</div>
                  <div class="prov-info">
                    <div class="prov-name">{{ p.name }}</div>
                    <div class="prov-meta">
                      <span class="prov-type">{{ labelOf(p.provider) }}</span>
                      <span class="prov-model">{{ p.defaultModel || '未设模型' }}</span>
                      <span v-if="!p.enabled" class="prov-disabled">已停用</span>
                    </div>
                  </div>
                </div>
                <div class="prov-actions">
                  <button @click="testProvider(p)">测试</button>
                  <button @click="editProvider(p)">编辑</button>
                  <button class="danger" @click="removeProvider(p)">删除</button>
                </div>
                <div v-if="testResults[p.id]" class="prov-test">
                  <span v-if="testResults[p.id].ok" class="ok">✅ {{ testResults[p.id].response }}</span>
                  <span v-else class="err">❌ {{ testResults[p.id].error }}</span>
                </div>
              </div>

              <button class="add-prov-btn" @click="showAddProvider = true">+ 添加 API 提供方</button>
            </div>
          </div>

          <!-- Styles -->
          <div v-else-if="tab === 'styles'">
            <p class="section-tip">
              写作风格决定 AI 的语气和风格预设。在续写 / 润色 / 对话时选择。
              每个风格可以独立设置温度、top_p、惩罚参数。
            </p>
            <AIStyleManager :book="book" />
          </div>
        </div>

        <!-- 添加 Provider 弹窗 -->
        <div v-if="showAddProvider" class="sub-modal-mask" @click.self="showAddProvider = false">
          <div class="sub-modal">
            <h3>{{ editingProvider ? '编辑' : '添加' }} API 提供方</h3>
            <div class="form-row">
              <label>显示名</label>
              <input v-model="provForm.name" placeholder="如：我的 DeepSeek" />
            </div>
            <div class="form-row">
              <label>类型</label>
              <select v-model="provForm.provider" @change="onProviderChange">
                <option v-for="p in providerMetas" :key="p.key" :value="p.key">{{ p.label }}</option>
              </select>
            </div>
            <div v-if="provForm.provider !== 'ollama'" class="form-row">
              <label>API Key</label>
              <input v-model="provForm.apiKey" :placeholder="keyHint" type="password" />
            </div>
            <div v-if="provForm.provider === 'ollama' || provForm.provider === 'custom'" class="form-row">
              <label>Base URL</label>
              <input v-model="provForm.baseUrl" :placeholder="baseUrlHint" />
              <button v-if="provForm.provider === 'ollama'" @click="loadOllamaModels" :disabled="loadingOllama" style="margin-top: 8px">
                {{ loadingOllama ? '加载中…' : '🔄 获取本地模型列表' }}
              </button>
              <div v-if="ollamaModels.length > 0" style="margin-top: 8px">
                <select @change="provForm.defaultModel = $event.target.value">
                  <option value="">选择模型…</option>
                  <option v-for="m in ollamaModels" :key="m" :value="m">{{ m }}</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <label>默认模型</label>
              <input v-model="provForm.defaultModel" placeholder="如：deepseek-chat" />
              <div v-if="modelOptions.length > 0" class="model-chips">
                <span v-for="m in modelOptions" :key="m" class="model-chip" @click="provForm.defaultModel = m">{{ m }}</span>
              </div>
            </div>
            <div class="modal-actions">
              <button @click="showAddProvider = false">取消</button>
              <button class="primary" @click="saveProvider" :disabled="!provForm.name || !provForm.provider">保存</button>
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
import AIStyleManager from './AIStyleManager.vue'

const props = defineProps({
  visible: Boolean,
  book: Object
})
defineEmits(['close'])

const api = axios.create({ baseURL: '/api' })

const tab = ref('providers')
const providers = ref([])
const providerMetas = ref([])
const showAddProvider = ref(false)
const editingProvider = ref(null)
const provForm = ref({ name: '', provider: '', baseUrl: '', apiKey: '', defaultModel: '' })
const testResults = ref({})
const ollamaModels = ref([])
const loadingOllama = ref(false)

const modelOptions = computed(() => {
  const meta = providerMetas.value.find(m => m.key === provForm.value.provider)
  return meta?.models || []
})

const keyHint = computed(() => {
  const meta = providerMetas.value.find(m => m.key === provForm.value.provider)
  return meta?.keyFormat || ''
})

const baseUrlHint = computed(() => {
  const meta = providerMetas.value.find(m => m.key === provForm.value.provider)
  return meta?.baseUrl || 'https://your-api.example.com/v1'
})

async function loadAll() {
  const [p1, p2] = await Promise.all([
    api.get('/ai/providers'),
    api.get('/ai/providers/meta')
  ])
  providers.value = p1.data.providers
  providerMetas.value = p2.data.providers
}

watch(() => props.visible, (v) => {
  if (v) loadAll()
})

function onProviderChange() {
  const meta = providerMetas.value.find(m => m.key === provForm.value.provider)
  if (meta?.baseUrl && !provForm.value.baseUrl) {
    provForm.value.baseUrl = meta.baseUrl
  }
  if (meta?.defaultModel && !provForm.value.defaultModel) {
    provForm.value.defaultModel = meta.defaultModel
  }
}

function iconOf(provider) {
  return {
    openai: '🤖', anthropic: '🧠', deepseek: '🐋',
    qwen: '☁️', glm: '🧊', ollama: '🦙', custom: '🔧'
  }[provider] || '✨'
}

function labelOf(provider) {
  const meta = providerMetas.value.find(m => m.key === provider)
  return meta?.label || provider
}

function editProvider(p) {
  editingProvider.value = p
  provForm.value = {
    name: p.name,
    provider: p.provider,
    baseUrl: p.baseUrl || '',
    apiKey: '',
    defaultModel: p.defaultModel || ''
  }
  showAddProvider.value = true
}

async function saveProvider() {
  const data = { ...provForm.value }
  if (!data.apiKey) delete data.apiKey // 不更新 key
  if (editingProvider.value) {
    await api.patch(`/ai/providers/${editingProvider.value.id}`, data)
  } else {
    await api.post('/ai/providers', data)
  }
  showAddProvider.value = false
  editingProvider.value = null
  provForm.value = { name: '', provider: '', baseUrl: '', apiKey: '', defaultModel: '' }
  ollamaModels.value = []
  await loadAll()
}

async function removeProvider(p) {
  if (!confirm(`删除「${p.name}」？`)) return
  await api.delete(`/ai/providers/${p.id}`)
  await loadAll()
}

async function testProvider(p) {
  testResults.value[p.id] = { ok: false, error: '测试中…' }
  try {
    const { data } = await api.post(`/ai/providers/${p.id}/test`)
    testResults.value[p.id] = data
  } catch (e) {
    testResults.value[p.id] = { ok: false, error: e.response?.data?.error || e.message }
  }
}

async function loadOllamaModels() {
  loadingOllama.value = true
  try {
    const { data } = await api.get('/ai/ollama/models', { params: { baseUrl: provForm.value.baseUrl } })
    ollamaModels.value = data.models
  } catch (e) {
    alert('获取 Ollama 模型失败：' + e.message)
  } finally {
    loadingOllama.value = false
  }
}
</script>

<style scoped>
.settings-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.settings-modal {
  background: var(--bg-secondary);
  border-radius: 8px;
  width: 760px;
  max-width: 90vw;
  height: 80vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
}

.settings-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.settings-header h2 {
  margin: 0;
  font-size: 18px;
}

.settings-tabs {
  display: flex;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
}

.settings-tabs button {
  background: transparent;
  border: none;
  padding: 12px 20px;
  border-radius: 0;
  border-bottom: 2px solid transparent;
  font-size: 13px;
  color: var(--text-secondary);
}

.settings-tabs button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.section-tip {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 16px;
  line-height: 1.7;
}

.section-tip code {
  background: var(--bg-tertiary);
  padding: 1px 6px;
  border-radius: 3px;
  font-family: monospace;
}

.prov-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prov-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px;
}

.prov-main {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.prov-icon {
  font-size: 28px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  border-radius: 6px;
}

.prov-info { flex: 1; }
.prov-name { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
.prov-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  flex-wrap: wrap;
}

.prov-type {
  background: var(--bg-primary);
  padding: 1px 8px;
  border-radius: 3px;
}

.prov-disabled {
  background: var(--warning);
  color: black;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
}

.prov-actions {
  display: flex;
  gap: 6px;
}

.prov-test {
  margin-top: 8px;
  font-size: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.prov-test .ok { color: var(--success); }
.prov-test .err { color: var(--danger); }

.add-prov-btn {
  background: transparent;
  border: 1px dashed var(--border);
  padding: 12px;
  color: var(--text-muted);
  border-radius: 6px;
}

.add-prov-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.empty-providers {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
}

.empty-providers p { margin-bottom: 16px; }

/* 子弹窗 */
.sub-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.sub-modal {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 24px;
  width: 480px;
  max-width: 90vw;
  border: 1px solid var(--border);
}

.sub-modal h3 { margin: 0 0 20px; }

.form-row { margin-bottom: 16px; }
.form-row label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.form-row input, .form-row select {
  width: 100%;
}

.model-chips {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.model-chip {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
  color: var(--text-secondary);
}

.model-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

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
