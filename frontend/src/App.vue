<template>
  <LoginPage v-if="showLogin" @login="onLoginSuccess" />
  <div v-else class="app-layout">
    <!-- 侧边栏：书列表 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1 class="logo">📖 NovelCraft</h1>
        <button class="primary" @click="showNewBookModal = true">+ 新建书</button>
      </div>
      <div class="book-list">
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="books.length === 0" class="empty">还没有书，新建第一本吧 ✍️</div>
        <div
          v-for="book in books"
          :key="book.id"
          class="book-item"
          :class="{ active: selectedBook?.id === book.id }"
          @click="selectBook(book)"
        >
          <div class="book-title">{{ book.title }}</div>
          <div class="book-meta">
            <span>{{ book._count?.chapters || 0 }} 章</span>
            <span class="status" :class="book.status">{{ statusLabel(book.status) }}</span>
          </div>
        </div>
      </div>
      <div class="sidebar-footer">
        <button @click="showSearch = true" class="ghost" title="Ctrl+K">🔍 搜索</button>
        <button @click="showAISettings = true" class="ghost">⚙️ AI 设置</button>
        <div v-if="auth.isLoggedIn" class="user-info" @click="showUserMenu = !showUserMenu">
          <span class="user-avatar">{{ (auth.user?.nickname || auth.user?.username || '?').slice(0, 1) }}</span>
          <span class="user-name">{{ auth.user?.nickname || auth.user?.username }}</span>
          <div v-if="showUserMenu" class="user-menu" @click.stop>
            <button @click="logout">退出登录</button>
          </div>
        </div>
      </div>
    </aside>

    <!-- 主区 -->
    <main class="main">
      <div v-if="!selectedBook" class="welcome">
        <h2>欢迎使用 NovelCraft</h2>
        <p>从左侧选择一本书，或新建一本开始创作。</p>
        <p style="margin-top: 20px; font-size: 13px">
          💡 快捷键：
          <kbd>Ctrl+J</kbd> AI 助手 ·
          <kbd>Ctrl+K</kbd> 搜索
        </p>
      </div>
      <template v-else>
        <!-- 顶部标签栏 -->
        <nav class="tabs">
          <button :class="{ active: tab === 'editor' }" @click="tab = 'editor'">📝 写作</button>
          <button :class="{ active: tab === 'characters' }" @click="tab = 'characters'">👥 角色</button>
          <button :class="{ active: tab === 'world' }" @click="tab = 'world'">🌍 设定</button>
          <button :class="{ active: tab === 'outline' }" @click="tab = 'outline'">🗂 大纲</button>
          <button :class="{ active: tab === 'export' }" @click="tab = 'export'">📤 导出</button>
          <div class="tab-spacer"></div>
          <button @click="showSearch = true" class="ghost" title="Ctrl+K">🔍</button>
          <button @click="showStats = true" class="ghost">📊 统计</button>
        </nav>

        <!-- 内容区 -->
        <div class="tab-content">
          <ChapterEditor
            v-if="tab === 'editor'"
            :book="selectedBook"
            ref="editorRef"
            @book-updated="reloadBooks"
            @show-history="openVersionHistory"
          />
          <CharacterPanel
            v-else-if="tab === 'characters'"
            :book="selectedBook"
          />
          <WorldPanel
            v-else-if="tab === 'world'"
            :book="selectedBook"
          />
          <OutlinePanel
            v-else-if="tab === 'outline'"
            :book="selectedBook"
          />
          <ExportPanel
            v-else-if="tab === 'export'"
            :book="selectedBook"
          />
        </div>
      </template>
    </main>

    <!-- 新建书弹窗 -->
    <div v-if="showNewBookModal" class="modal-mask" @click.self="showNewBookModal = false">
      <div class="modal">
        <h3>新建书</h3>
        <div class="form-row">
          <label>书名</label>
          <input v-model="newBook.title" placeholder="比如：九重天" autofocus @keyup.enter="createBook" />
        </div>
        <div class="form-row">
          <label>简介（可选）</label>
          <textarea v-model="newBook.summary" rows="3" placeholder="一句话讲讲这本书讲什么" />
        </div>
        <div class="modal-actions">
          <button @click="showNewBookModal = false">取消</button>
          <button class="primary" @click="createBook" :disabled="!newBook.title.trim()">创建</button>
        </div>
      </div>
    </div>

    <!-- 统计弹窗 -->
    <div v-if="showStats" class="modal-mask" @click.self="showStats = false">
      <div class="modal" style="width: 420px">
        <h3>📊 写作统计</h3>
        <div v-if="stats" class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ stats.chapterCount }}</div>
            <div class="stat-label">章节数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.totalWords.toLocaleString() }}</div>
            <div class="stat-label">总字数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.averageWords.toLocaleString() }}</div>
            <div class="stat-label">平均每章</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ formatDate(stats.lastUpdated) }}</div>
            <div class="stat-label">最近更新</div>
          </div>
        </div>
        <div v-else class="empty">加载中…</div>
        <div class="modal-actions">
          <button class="primary" @click="showStats = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 全局提示 -->
    <div v-if="toast" class="toast">{{ toast }}</div>

    <!-- AI 设置 -->
    <AISettings
      :visible="showAISettings"
      :book="selectedBook"
      @close="showAISettings = false"
    />

    <!-- AI 助手 -->
    <AIAssistant
      :visible="showAI"
      :chapter="aiChapter"
      :book="selectedBook"
      :selected-text="aiSelectedText"
      @close="showAI = false"
      @insert="onAIInsert"
    />

    <!-- 搜索面板 -->
    <SearchPanel
      :visible="showSearch"
      :book-id="selectedBook?.id"
      @close="showSearch = false"
      @jump="onSearchJump"
    />

    <!-- 版本历史 -->
    <VersionHistory
      v-if="historyChapterId"
      :visible="showHistory"
      :chapter-id="historyChapterId"
      :chapter-title="historyChapterTitle"
      @close="showHistory = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import axios from 'axios'
import ChapterEditor from './components/ChapterEditor.vue'
import CharacterPanel from './components/CharacterPanel.vue'
import WorldPanel from './components/WorldPanel.vue'
import OutlinePanel from './components/OutlinePanel.vue'
import ExportPanel from './components/ExportPanel.vue'
import AISettings from './components/AISettings.vue'
import AIAssistant from './components/AIAssistant.vue'
import SearchPanel from './components/SearchPanel.vue'
import VersionHistory from './components/VersionHistory.vue'
import LoginPage from './components/LoginPage.vue'
import { useAuth } from './stores/auth.js'

const auth = useAuth()

const books = ref([])
const selectedBook = ref(null)
const loading = ref(true)
const tab = ref('editor')
const showNewBookModal = ref(false)
const newBook = ref({ title: '', summary: '' })
const toast = ref('')
const showStats = ref(false)
const stats = ref(null)
const showAISettings = ref(false)
const showAI = ref(false)
const aiChapter = ref(null)
const aiSelectedText = ref('')
const editorRef = ref(null)
const showSearch = ref(false)
const showHistory = ref(false)
const historyChapterId = ref(null)
const historyChapterTitle = ref('')
const showUserMenu = ref(false)

// 检查后端是否启用了鉴权（第一个用户注册前允许匿名访问）
const showLogin = ref(false)

async function checkAuth() {
  // 先尝试不登录拉一下书列表
  try {
    const { data } = await axios.get('/api/books')
    books.value = data.books
  } catch (e) {
    if (e.response?.status === 401) {
      showLogin.value = true
    }
  }
}

function onLoginSuccess(user) {
  showLogin.value = false
  checkAuth().then(() => {
    if (books.value.length > 0 && !selectedBook.value) selectBook(books.value[0])
  })
}

// 全局快捷键
function onKeydown(e) {
  // Ctrl+J：AI 助手
  if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
    e.preventDefault()
    if (selectedBook.value && tab.value === 'editor') {
      aiChapter.value = editorRef.value?.getCurrentChapter?.()
      aiSelectedText.value = editorRef.value?.getSelectedText?.() || ''
      showAI.value = true
    }
  }
  // Ctrl+K：搜索
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    showSearch.value = true
  }
  // ESC 关闭弹窗
  if (e.key === 'Escape') {
    if (showSearch.value) showSearch.value = false
    else if (showAI.value) showAI.value = false
    else if (showHistory.value) showHistory.value = false
  }
}

function onAIInsert(text) {
  if (editorRef.value?.insertText) {
    editorRef.value.insertText(text)
    showToast('✅ 已插入正文')
  }
}

function openVersionHistory() {
  const ch = editorRef.value?.getCurrentChapter?.()
  if (!ch) return
  historyChapterId.value = ch.id
  historyChapterTitle.value = ch.title
  showHistory.value = true
}

function onSearchJump(hit) {
  // 切换到该书 + 选中章节
  const book = books.value.find(b => b.id === hit.bookId)
  if (book && book.id !== selectedBook.value?.id) {
    selectBook(book).then(() => {
      setTimeout(() => selectChapterInEditor(hit.chapterId), 500)
    })
  } else {
    selectChapterInEditor(hit.chapterId)
  }
}

function selectChapterInEditor(chapterId) {
  if (editorRef.value?.selectChapter) {
    editorRef.value.selectChapter(chapterId)
  }
}

function logout() {
  auth.logout()
  location.reload()
}

onMounted(() => {
  // 设置 axios 拦截器自动加 JWT
  setupAxiosInterceptor()
  window.addEventListener('keydown', onKeydown)
  checkAuth()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

function setupAxiosInterceptor() {
  // 拦截所有 /api 请求，自动加 Authorization
  const orig = axios.prototype.request
  axios.interceptors.request.use(cfg => {
    if (auth.token && cfg.url?.startsWith('/api')) {
      cfg.headers.Authorization = `Bearer ${auth.token}`
    }
    return cfg
  })
  axios.interceptors.response.use(
    res => res,
    err => {
      if (err.response?.status === 401) {
        // 未授权，清掉 session 但不强制刷新（首次未注册也返回 401）
      }
      return Promise.reject(err)
    }
  )
}

const api = axios.create({ baseURL: '/api', timeout: 10000 })
api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error || err.message
    showToast(`❌ ${msg}`)
    return Promise.reject(err)
  }
)

function showToast(msg) {
  toast.value = msg
  setTimeout(() => toast.value = '', 3000)
}

function statusLabel(s) {
  return { drafting: '在写', archiving: '存稿', completed: '完结' }[s] || s
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function loadBooks() {
  loading.value = true
  try {
    const { data } = await api.get('/books')
    books.value = data.books
    if (books.value.length > 0 && !selectedBook.value) {
      await selectBook(books.value[0])
    }
  } finally {
    loading.value = false
  }
}

async function reloadBooks() {
  await loadBooks()
  if (selectedBook.value) {
    const fresh = books.value.find(b => b.id === selectedBook.value.id)
    if (fresh) await selectBook(fresh)
  }
}

async function selectBook(book) {
  try {
    const { data } = await api.get(`/books/${book.id}`)
    selectedBook.value = data.book
    // 重置 tab 到编辑
    tab.value = 'editor'
  } catch (e) {
    showToast('加载书失败')
  }
}

async function createBook() {
  if (!newBook.value.title.trim()) return
  try {
    const { data } = await api.post('/books', newBook.value)
    showToast('✅ 创建成功')
    showNewBookModal.value = false
    newBook.value = { title: '', summary: '' }
    await loadBooks()
    await selectBook(data.book)
  } catch (e) {}
}

async function loadStats() {
  if (!selectedBook.value) return
  try {
    const { data } = await api.get(`/books/${selectedBook.value.id}/stats`)
    stats.value = data
  } catch (e) {
    stats.value = { chapterCount: 0, totalWords: 0, averageWords: 0, lastUpdated: null }
  }
}

watch(showStats, (val) => {
  if (val) {
    stats.value = null
    loadStats()
  }
})

onMounted(() => {
  loadBooks()
})
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: 260px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.logo {
  font-size: 17px;
  font-weight: 600;
  color: var(--accent);
  margin: 0;
}

.book-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty {
  padding: 40px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.book-item {
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background 0.15s;
}

.book-item:hover {
  background: var(--bg-tertiary);
}

.book-item.active {
  background: var(--accent);
  color: white;
}

.book-title {
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-meta {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  gap: 8px;
  align-items: center;
}

.book-item.active .book-meta {
  color: rgba(255,255,255,0.8);
}

.status {
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(255,255,255,0.1);
  font-size: 11px;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar-footer .ghost {
  width: 100%;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 12px;
}

.sidebar-footer .ghost:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  margin-top: 4px;
}

.user-info:hover { background: var(--bg-tertiary); }

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.user-name {
  font-size: 13px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px;
  margin-bottom: 4px;
}

.user-menu button {
  width: 100%;
  text-align: left;
  font-size: 12px;
}

kbd {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  padding: 1px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 11px;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.welcome h2 {
  margin-bottom: 12px;
  color: var(--text-secondary);
}

.tabs {
  display: flex;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 0 8px;
  flex-shrink: 0;
  align-items: center;
}

.tabs button {
  background: transparent;
  border: none;
  padding: 12px 16px;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.tabs button:hover {
  background: var(--bg-tertiary);
  border-color: transparent;
}

.tabs button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: transparent;
}

.tab-spacer {
  flex: 1;
}

.tabs button.ghost {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  padding: 8px 12px;
}

.tab-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 模态框 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--bg-secondary);
  padding: 24px;
  border-radius: 8px;
  width: 480px;
  max-width: 90vw;
  border: 1px solid var(--border);
}

.modal h3 {
  margin: 0 0 20px;
}

.form-row {
  margin-bottom: 16px;
}

.form-row label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-row input,
.form-row textarea {
  width: 100%;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

/* 统计 */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-card {
  background: var(--bg-tertiary);
  padding: 16px;
  border-radius: 6px;
  text-align: center;
}

.stat-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--accent);
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-tertiary);
  padding: 10px 20px;
  border-radius: 6px;
  border: 1px solid var(--border);
  z-index: 200;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}
</style>
