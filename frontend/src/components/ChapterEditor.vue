<template>
  <div class="editor-layout">
    <!-- 章节树 -->
    <div class="chapter-tree">
      <div class="tree-header">
        <span>章节</span>
        <button @click="showNewChapterModal = true">+ 新章节</button>
      </div>
      <div class="tree-body">
        <div
          v-for="chapter in chapters"
          :key="chapter.id"
          class="chapter-item"
          :class="{ active: selectedChapter?.id === chapter.id }"
          @click="selectChapter(chapter)"
        >
          <span class="chapter-title">{{ chapter.title }}</span>
          <span class="chapter-words">{{ chapter.wordCount }} 字</span>
        </div>
        <div v-if="chapters.length === 0" class="empty">
          还没有章节，<a @click="showNewChapterModal = true">新建一个</a>
        </div>
      </div>
    </div>

    <!-- 编辑器 -->
    <div class="editor-main">
      <div v-if="!selectedChapter" class="placeholder">
        <Heatmap :book="book" :days="90" />
        <p style="margin-top: 40px">👈 选择一个章节开始写作</p>
      </div>
      <div v-else class="editor-wrap">
        <div class="editor-topbar">
          <input
            class="chapter-name-input"
            :value="selectedChapter.title"
            @blur="updateTitle($event.target.value)"
            placeholder="章节标题"
          />
          <div class="topbar-actions">
            <span v-if="saving" class="save-status saving">保存中…</span>
            <span v-else-if="lastSaved" class="save-status saved">已保存 {{ lastSaved }}</span>
            <button class="history-btn" @click="$emit('show-history')" title="版本历史">📜 历史</button>
            <button class="focus-btn" @click="openFocus" title="专注模式">🎯 专注</button>
          </div>
        </div>

        <EditorContent :editor="editor" class="editor-content" />

        <div class="editor-toolbar">
          <button @click="editor.chain().focus().toggleBold().run()" :class="{ active: editor.isActive('bold') }">B</button>
          <button @click="editor.chain().focus().toggleItalic().run()" :class="{ active: editor.isActive('italic') }"><i>I</i></button>
          <button @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" :class="{ active: editor.isActive('heading', { level: 1 }) }">H1</button>
          <button @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ active: editor.isActive('heading', { level: 2 }) }">H2</button>
          <button @click="editor.chain().focus().toggleBulletList().run()" :class="{ active: editor.isActive('bulletList') }">•</button>
          <button @click="editor.chain().focus().toggleBlockquote().run()" :class="{ active: editor.isActive('blockquote') }">"</button>
          <button @click="editor.chain().focus().undo().run()">↶</button>
          <button @click="editor.chain().focus().redo().run()">↷</button>
        </div>
      </div>
    </div>

    <!-- 新章节弹窗 -->
    <div v-if="showNewChapterModal" class="modal-mask" @click.self="showNewChapterModal = false">
      <div class="modal">
        <h3>新建章节</h3>
        <div class="form-row">
          <label>章节标题</label>
          <input v-model="newChapter.title" placeholder="比如：第一章 山村少年" autofocus @keyup.enter="createChapter" />
        </div>
        <div class="modal-actions">
          <button @click="showNewChapterModal = false">取消</button>
          <button class="primary" @click="createChapter" :disabled="!newChapter.title.trim()">创建</button>
        </div>
      </div>
    </div>

    <!-- 专注模式 -->
    <FocusMode ref="focusRef" @save="saveFocusText" />
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import axios from 'axios'
import Heatmap from './Heatmap.vue'
import FocusMode from './FocusMode.vue'

const props = defineProps({
  book: { type: Object, required: true }
})
const emit = defineEmits(['book-updated', 'show-history'])

// 防御性处理：后端可能返回 chapters 为 undefined 或缺字段
const chapters = computed(() => props.book?.chapters || [])

const selectedChapter = ref(null)
const showNewChapterModal = ref(false)
const newChapter = ref({ title: '' })
const saving = ref(false)
const lastSaved = ref('')
const editor = ref(null)
const focusRef = ref(null)

const api = axios.create({ baseURL: '/api' })

let saveTimer = null

watch(() => props.book?.id, () => {
  selectedChapter.value = null
  if (editor.value) editor.value.destroy()
  editor.value = null
})

watch(selectedChapter, (chapter) => {
  if (editor.value) editor.value.destroy()
  if (!chapter) {
    editor.value = null
    return
  }
  editor.value = new Editor({
    content: chapter.content || { type: 'doc', content: [{ type: 'paragraph' }] },
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '开始你的故事…' })
    ],
    onUpdate: ({ editor }) => scheduleSave(editor.getJSON())
  })
})

function scheduleSave(json) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveContent(json), 1500)
}

async function saveContent(json) {
  if (!selectedChapter.value) return
  saving.value = true
  try {
    const { data } = await api.patch(`/chapters/${selectedChapter.value.id}`, {
      content: json
    })
    selectedChapter.value.wordCount = data.chapter.wordCount
    saving.value = false
    lastSaved.value = formatTime(new Date())
  } catch (e) {
    saving.value = false
  }
}

async function updateTitle(title) {
  if (!selectedChapter.value || selectedChapter.value.title === title) return
  try {
    await api.patch(`/chapters/${selectedChapter.value.id}`, { title })
    selectedChapter.value.title = title
    // 触发父组件刷新
    emit('book-updated')
  } catch (e) {}
}

function formatTime(date) {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

async function selectChapter(chapter) {
  selectedChapter.value = chapter
}

async function createChapter() {
  if (!newChapter.value.title.trim()) return
  try {
    const { data } = await api.post(`/books/${props.book.id}/chapters`, {
      title: newChapter.value.title
    })
    showNewChapterModal.value = false
    newChapter.value = { title: '' }
    // 刷新父组件拿最新章节列表
    emit('book-updated')
    // 本地立刻选中
    selectedChapter.value = data.chapter
    // 但 chapters 数组需要父组件更新，先手动加进去
    if (props.book.chapters) {
      props.book.chapters.push(data.chapter)
    }
  } catch (e) {}
}

// ===== 专注模式 =====
function openFocus() {
  if (!selectedChapter.value) return
  // 把当前编辑器内容转成纯文本
  const text = editor.value?.getText() || ''
  focusRef.value?.start(text)
}

async function saveFocusText(text) {
  if (!selectedChapter.value) return
  try {
    // 把纯文本转成简单的 Tiptap doc
    const paragraphs = text.split('\n').filter(p => p.trim()).map(p => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }]
    }))
    const content = { type: 'doc', content: paragraphs }
    const { data } = await api.patch(`/chapters/${selectedChapter.value.id}`, { content })
    selectedChapter.value.wordCount = data.chapter.wordCount
    // 重置编辑器
    if (editor.value) {
      editor.value.commands.setContent(content)
    }
    lastSaved.value = formatTime(new Date())
  } catch (e) {}
}

onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  if (editor.value) editor.value.destroy()
})

// 暴露给父组件（App）使用
defineExpose({
  getCurrentChapter: () => selectedChapter.value,
  getSelectedText: () => {
    if (!editor.value) return ''
    const { from, to } = editor.value.state.selection
    return editor.value.state.doc.textBetween(from, to, '\n')
  },
  insertText: (text) => {
    if (!editor.value) return
    editor.value.chain().focus().insertContent(text).run()
  },
  selectChapter: (chapterId) => {
    const ch = chapters.value.find(c => c.id === chapterId)
    if (ch) selectChapter(ch)
  }
})
</script>

<style scoped>
.editor-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.chapter-tree {
  width: 240px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.tree-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-secondary);
}

.tree-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.chapter-item {
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 2px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.chapter-item:hover {
  background: var(--bg-tertiary);
}

.chapter-item.active {
  background: var(--accent);
  color: white;
}

.chapter-words {
  font-size: 11px;
  color: var(--text-muted);
}

.chapter-item.active .chapter-words {
  color: rgba(255,255,255,0.8);
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.empty a {
  color: var(--accent);
  cursor: pointer;
  text-decoration: underline;
}

.editor-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.editor-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-topbar {
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.chapter-name-input {
  background: transparent;
  border: none;
  font-size: 18px;
  font-weight: 500;
  flex: 1;
  padding: 4px 0;
}

.chapter-name-input:focus {
  border: none;
  background: transparent;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.save-status {
  font-size: 12px;
  color: var(--text-muted);
}

.save-status.saving {
  color: var(--warning);
}

.save-status.saved {
  color: var(--success);
}

.focus-btn {
  background: transparent;
  border: 1px solid var(--border);
  font-size: 12px;
  padding: 4px 12px;
}

.focus-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.history-btn {
  background: transparent;
  border: 1px solid var(--border);
  font-size: 12px;
  padding: 4px 12px;
}

.history-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.editor-content {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-primary);
}

.editor-toolbar {
  padding: 8px 24px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  background: var(--bg-secondary);
}

.editor-toolbar button {
  min-width: 32px;
}

.editor-toolbar button.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
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
  width: 420px;
  max-width: 90vw;
  border: 1px solid var(--border);
}

.modal h3 {
  margin-bottom: 20px;
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

.form-row input {
  width: 100%;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
</style>
