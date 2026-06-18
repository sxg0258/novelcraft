<template>
  <Teleport to="body">
    <div v-if="visible" class="ai-panel-mask" @click.self="$emit('close')">
      <aside class="ai-panel">
        <div class="ai-header">
          <div class="ai-title">
            <span class="icon">✨</span>
            <span>AI 助手</span>
            <span v-if="streaming" class="streaming-badge">生成中…</span>
          </div>
          <button @click="$emit('close')" class="close-btn">✕</button>
        </div>

        <!-- 模式切换 -->
        <div class="ai-modes">
          <button :class="{ active: mode === 'continue' }" @click="mode = 'continue'">✍️ 续写</button>
          <button :class="{ active: mode === 'polish' }" @click="mode = 'polish'">✨ 润色</button>
          <button :class="{ active: mode === 'expand' }" @click="mode = 'expand'">📖 扩写</button>
          <button :class="{ active: mode === 'shrink' }" @click="mode = 'shrink'">📝 缩写</button>
          <button :class="{ active: mode === 'chat' }" @click="mode = 'chat'">💬 对话</button>
        </div>

        <!-- 续写 / 润色 / 扩写 / 缩写 -->
        <div v-if="mode !== 'chat'" class="ai-form">
          <!-- Provider 选择 -->
          <div class="form-row">
            <label>模型提供方</label>
            <select v-model="providerId">
              <option value="">默认</option>
              <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}（{{ p.defaultModel || '未设模型' }}）</option>
            </select>
          </div>

          <!-- 风格选择 -->
          <div class="form-row">
            <label>写作风格</label>
            <select v-model="aiStyleId">
              <option value="">不指定（使用 AI 默认）</option>
              <option v-for="s in styles" :key="s.id" :value="s.id">{{ s.name }}<span v-if="s.isDefault"> ⭐</span></option>
            </select>
          </div>

          <!-- 输入文本（润色/扩写/缩写）-->
          <div v-if="mode !== 'continue'" class="form-row">
            <label>原文</label>
            <textarea v-model="inputText" rows="6" placeholder="选中段落会预填到这里"></textarea>
          </div>

          <!-- 字数 -->
          <div v-if="mode === 'continue' || mode === 'expand' || mode === 'shrink'" class="form-row">
            <label>目标字数（约）</label>
            <input v-model.number="targetLength" type="number" min="100" max="5000" step="100" />
          </div>

          <button
            class="primary generate-btn"
            @click="generate"
            :disabled="streaming || !canGenerate"
          >
            {{ streaming ? '生成中…' : `✨ ${buttonLabel}` }}
          </button>
        </div>

        <!-- 对话模式 -->
        <div v-else class="ai-chat">
          <div class="chat-list" ref="chatListRef">
            <div v-if="messages.length === 0" class="chat-empty">
              和 AI 讨论你的作品。<br>比如：<br>
              • "林渊这个角色的动机合理吗？"<br>
              • "第二幕节奏是不是太慢了？"<br>
              • "帮我构思第三个反派角色"
            </div>
            <div v-for="(m, i) in messages" :key="i" class="chat-msg" :class="m.role">
              <div class="msg-role">{{ m.role === 'user' ? '我' : 'AI' }}</div>
              <div class="msg-content">{{ m.content }}</div>
            </div>
            <div v-if="streaming && messages[messages.length - 1]?.role !== 'assistant'" class="chat-msg assistant pending">
              <div class="msg-role">AI</div>
              <div class="msg-content">
                <span class="typing"></span><span class="typing"></span><span class="typing"></span>
              </div>
            </div>
          </div>
          <div class="chat-input">
            <textarea
              v-model="chatInput"
              rows="2"
              placeholder="输入消息，Enter 发送，Shift+Enter 换行"
              @keydown.enter.exact.prevent="sendChat"
            ></textarea>
            <div class="chat-input-row">
              <select v-model="providerId" style="flex: 1">
                <option value="">默认模型</option>
                <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <select v-model="aiStyleId" style="flex: 1">
                <option value="">无风格</option>
                <option v-for="s in styles" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
              <button class="primary" @click="sendChat" :disabled="streaming || !chatInput.trim()">发送</button>
            </div>
          </div>
        </div>

        <!-- 生成结果区（续写/润色/扩写/缩写）-->
        <div v-if="mode !== 'chat' && result" class="ai-result">
          <div class="result-header">
            <span>生成结果</span>
            <div class="result-actions">
              <button @click="copyResult">📋 复制</button>
              <button @click="insertToEditor" class="primary">插入正文</button>
            </div>
          </div>
          <div class="result-content" v-html="resultHtml"></div>
          <div class="result-meta">
            <span>{{ result.length }} 字</span>
            <span>·</span>
            <span>用时 {{ duration }}秒</span>
          </div>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import axios from 'axios'

const props = defineProps({
  visible: Boolean,
  chapter: Object,
  book: Object,
  selectedText: String
})
const emit = defineEmits(['close', 'insert'])

const api = axios.create({ baseURL: '/api' })

const mode = ref('continue')
const providers = ref([])
const styles = ref([])
const providerId = ref('')
const aiStyleId = ref('')
const inputText = ref('')
const targetLength = ref(500)
const result = ref('')
const streaming = ref(false)
const startTime = ref(0)
const duration = ref(0)

const messages = ref([])
const chatInput = ref('')
const chatListRef = ref(null)
let currentChatId = null

const buttonLabel = computed(() => ({
  continue: '续写', polish: '润色', expand: '扩写', shrink: '缩写'
})[mode.value] || '生成')

const canGenerate = computed(() => {
  if (mode.value === 'continue') return true
  return inputText.value.trim().length > 0
})

const resultHtml = computed(() => {
  if (!result.value) return ''
  return result.value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
})

watch(() => props.visible, async (v) => {
  if (v) {
    if (props.selectedText) inputText.value = props.selectedText
    await loadMetadata()
  }
})

async function loadMetadata() {
  const [p, s] = await Promise.all([
    api.get('/ai/providers'),
    api.get(`/books/${props.book.id}/ai-styles`)
  ])
  providers.value = p.data.providers
  styles.value = s.data.styles
  const defStyle = styles.value.find(s => s.isDefault)
  if (defStyle) aiStyleId.value = defStyle.id
}

async function generate() {
  streaming.value = true
  result.value = ''
  startTime.value = Date.now()
  try {
    if (mode.value === 'continue') {
      await streamContinue()
    } else {
      const { data } = await api.post('/ai/transform', {
        mode: mode.value,
        providerId: providerId.value || undefined,
        model: undefined,
        text: inputText.value,
        length: targetLength.value,
        aiStyleId: aiStyleId.value || undefined
      })
      result.value = data.result
    }
  } catch (e) {
    result.value = `❌ 生成失败：${e.response?.data?.error || e.message}`
  } finally {
    streaming.value = false
    duration.value = Math.round((Date.now() - startTime.value) / 1000)
  }
}

async function streamContinue() {
  // 取章节最近文本作为 context
  const context = props.chapter?.contentText || props.selectedText || ''
  const res = await fetch('/api/ai/continue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerId: providerId.value || undefined,
      context,
      length: targetLength.value,
      aiStyleId: aiStyleId.value || undefined
    })
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const payload = t.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const json = JSON.parse(payload)
        if (json.delta) result.value += json.delta
        if (json.error) throw new Error(json.error)
      } catch (e) {
        if (e.message !== 'Unexpected end of JSON input') throw e
      }
    }
  }
}

function copyResult() {
  navigator.clipboard.writeText(result.value)
}

function insertToEditor() {
  emit('insert', result.value)
}

async function sendChat() {
  if (!chatInput.value.trim() || streaming.value) return
  const userMsg = chatInput.value
  messages.value.push({ role: 'user', content: userMsg })
  chatInput.value = ''
  streaming.value = true

  // 占位 assistant 消息，stream 追加
  messages.value.push({ role: 'assistant', content: '' })

  try {
    const res = await fetch('/api/ai/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookId: props.book.id,
        chapterId: props.chapter?.id,
        aiStyleId: aiStyleId.value || undefined,
        providerId: providerId.value || undefined,
        mode: 'chat',
        message: userMsg,
        bookTitle: props.book.title,
        chatId: currentChatId,
        stream: true
      })
    })
    if (!res.ok) throw new Error(await res.text())

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let assistantText = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() || ''
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        const payload = t.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const json = JSON.parse(payload)
          if (json.chatId && !currentChatId) currentChatId = json.chatId
          if (json.delta) {
            assistantText += json.delta
            messages.value[messages.value.length - 1].content = assistantText
          }
          if (json.error) throw new Error(json.error)
        } catch (e) {
          if (e.message !== 'Unexpected end of JSON input') throw e
        }
      }
    }
    await nextTick()
    if (chatListRef.value) chatListRef.value.scrollTop = chatListRef.value.scrollHeight
  } catch (e) {
    messages.value[messages.value.length - 1].content = `❌ ${e.message}`
  } finally {
    streaming.value = false
  }
}
</script>

<style scoped>
.ai-panel-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  justify-content: flex-end;
  z-index: 200;
}

.ai-panel {
  width: 480px;
  height: 100vh;
  background: var(--bg-primary);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0,0,0,0.3);
}

.ai-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ai-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.icon { font-size: 18px; }

.streaming-badge {
  background: var(--accent);
  color: white;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 3px;
  font-weight: normal;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  padding: 4px 10px;
}

.ai-modes {
  display: flex;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 0 8px;
  overflow-x: auto;
}

.ai-modes button {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 10px 14px;
  font-size: 12px;
  color: var(--text-secondary);
  border-radius: 0;
  white-space: nowrap;
}

.ai-modes button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.ai-form {
  padding: 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.form-row { margin-bottom: 12px; }
.form-row label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.form-row input, .form-row select, .form-row textarea {
  width: 100%;
  font-size: 13px;
}

.generate-btn {
  width: 100%;
  padding: 10px;
  margin-top: 4px;
}

/* 对话模式 */
.ai-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-empty {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.8;
  padding: 30px 10px;
}

.chat-msg {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.6;
}

.chat-msg.user {
  align-self: flex-end;
  background: var(--accent);
  color: white;
}

.chat-msg.assistant {
  align-self: flex-start;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
}

.msg-role {
  font-size: 10px;
  opacity: 0.6;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.chat-msg.pending .msg-content {
  display: flex;
  gap: 3px;
  padding: 8px 0;
}

.typing {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: blink 1.4s infinite both;
}

.typing:nth-child(2) { animation-delay: 0.2s; }
.typing:nth-child(3) { animation-delay: 0.4s; }

@keyframes blink {
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
}

.chat-input {
  border-top: 1px solid var(--border);
  padding: 12px;
  background: var(--bg-secondary);
}

.chat-input textarea {
  width: 100%;
  resize: none;
  font-size: 13px;
  margin-bottom: 8px;
}

.chat-input-row {
  display: flex;
  gap: 6px;
}

.chat-input-row select {
  font-size: 12px;
  padding: 4px 6px;
}

/* 结果区 */
.ai-result {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top: 1px solid var(--border);
}

.result-header {
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  font-size: 13px;
}

.result-actions { display: flex; gap: 6px; }

.result-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.result-meta {
  padding: 8px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
