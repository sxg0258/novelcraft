<template>
  <div class="outline-panel">
    <div class="op-header">
      <h3>🗂 大纲</h3>
      <button class="primary" @click="showNew = true">+ 新节点</button>
    </div>

    <div class="op-body">
      <div v-if="outlines.length === 0" class="empty-state">
        <div style="font-size: 48px; margin-bottom: 16px">🗂</div>
        <h3>还没有大纲</h3>
        <p>用大纲理清故事的起因、经过、结果</p>
        <button class="primary" @click="showNew = true" style="margin-top: 16px">+ 创建节点</button>
      </div>
      <div v-else class="tree">
        <OutlineNode
          v-for="node in outlines"
          :key="node.id"
          :node="node"
          :depth="0"
          @select="select"
          @delete="remove"
          @add-child="addChild"
        />
      </div>
    </div>

    <!-- 详情/编辑区 -->
    <aside v-if="selected" class="op-detail">
      <div class="op-detail-header">
        <input class="op-detail-title" v-model="form.title" @blur="save" />
        <button class="ghost" @click="selected = null">×</button>
      </div>
      <textarea
        v-model="form.content"
        @blur="save"
        placeholder="这个节点的详细说明...&#10;&#10;可以是：&#10;- 关键剧情转折&#10;- 角色发展节点&#10;- 主线/支线说明"
        rows="20"
      />
      <div class="op-detail-meta">
        <span>{{ selected.children?.length || 0 }} 个子节点</span>
        <span>·</span>
        <span>更新于 {{ formatDate(selected.updatedAt) }}</span>
      </div>
    </aside>

    <!-- 新建弹窗 -->
    <div v-if="showNew" class="modal-mask" @click.self="showNew = false">
      <div class="modal">
        <h3>新建大纲节点</h3>
        <div class="form-row">
          <label>标题</label>
          <input v-model="newNode.title" autofocus @keyup.enter="create" placeholder="如：起因 - 山村少年 / 第一幕" />
        </div>
        <div class="form-row">
          <label>父节点（可选，留空为根节点）</label>
          <select v-model="newNode.parentId">
            <option value="">无（顶级节点）</option>
            <option v-for="o in flatOutlines" :key="o.id" :value="o.id">{{ '　'.repeat(o.depth) }}{{ o.title }}</option>
          </select>
        </div>
        <div class="modal-actions">
          <button @click="showNew = false">取消</button>
          <button class="primary" @click="create" :disabled="!newNode.title.trim()">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, h } from 'vue'
import axios from 'axios'

const props = defineProps({ book: { type: Object, required: true } })

const api = axios.create({ baseURL: '/api' })

const outlines = ref([])
const selected = ref(null)
const form = ref({ title: '', content: '' })
const showNew = ref(false)
const newNode = ref({ title: '', parentId: '' })

// 递归组件：渲染节点（直接写在本文件里以避免额外文件）
const OutlineNode = {
  name: 'OutlineNode',
  props: ['node', 'depth'],
  emits: ['select', 'delete', 'addChild'],
  setup(props, { emit }) {
    const expanded = ref(true)
    return () => h('div', { class: 'outline-node' }, [
      h('div', {
        class: ['node-row', { active: false }],
        style: { paddingLeft: (props.depth * 20 + 8) + 'px' }
      }, [
        props.node.children?.length ? h('span', {
          class: 'caret',
          onClick: (e) => { e.stopPropagation(); expanded.value = !expanded.value }
        }, expanded.value ? '▾' : '▸') : h('span', { class: 'caret-spacer' }, '·'),
        h('span', {
          class: 'node-title',
          onClick: () => emit('select', props.node)
        }, props.node.title),
        h('div', { class: 'node-actions' }, [
          h('button', {
            class: 'node-action',
            onClick: (e) => { e.stopPropagation(); emit('addChild', props.node) }
          }, '+子'),
          h('button', {
            class: 'node-action danger',
            onClick: (e) => { e.stopPropagation(); emit('delete', props.node) }
          }, '×')
        ])
      ]),
      expanded.value && props.node.children?.length ? h('div', { class: 'node-children' },
        props.node.children.map(c => h(OutlineNode, {
          node: c,
          depth: props.depth + 1,
          onSelect: (n) => emit('select', n),
          onDelete: (n) => emit('delete', n),
          onAddChild: (n) => emit('addChild', n)
        }))
      ) : null
    ])
  }
}

const flatOutlines = computed(() => {
  const arr = []
  function walk(nodes, depth) {
    for (const n of nodes) {
      arr.push({ id: n.id, title: n.title, depth })
      if (n.children) walk(n.children, depth + 1)
    }
  }
  walk(outlines.value, 0)
  return arr
})

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function load() {
  const { data } = await api.get(`/books/${props.book.id}/outlines`)
  outlines.value = data.outlines
}

onMounted(load)
watch(() => props.book?.id, load)

function select(node) {
  selected.value = node
  form.value = { title: node.title, content: node.content || '' }
}

async function save() {
  if (!selected.value) return
  const { data } = await api.patch(`/outlines/${selected.value.id}`, form.value)
  selected.value = { ...selected.value, ...data.outline }
  await load()
}

async function remove(node) {
  if (!confirm(`删除节点「${node.title}」？子节点也会一并删除。`)) return
  await api.delete(`/outlines/${node.id}`)
  if (selected.value?.id === node.id) selected.value = null
  await load()
}

async function addChild(node) {
  const title = prompt(`新建「${node.title}」的子节点`, '')
  if (!title?.trim()) return
  await api.post(`/books/${props.book.id}/outlines`, { title, parentId: node.id })
  await load()
}

async function create() {
  if (!newNode.value.title.trim()) return
  await api.post(`/books/${props.book.id}/outlines`, newNode.value)
  showNew.value = false
  newNode.value = { title: '', parentId: '' }
  await load()
}
</script>

<style scoped>
.outline-panel {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.op-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary);
  flex-shrink: 0;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.op-header h3 { margin: 0; font-size: 16px; }

.op-body {
  flex: 1;
  overflow-y: auto;
  padding: 70px 24px 24px;
  width: 100%;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-muted);
}

.empty-state h3 { color: var(--text-secondary); margin-bottom: 8px; }

.tree { max-width: 900px; }

.outline-node { margin-bottom: 2px; }

.node-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s;
}

.node-row:hover { background: var(--bg-secondary); }

.caret {
  cursor: pointer;
  user-select: none;
  width: 14px;
  text-align: center;
  color: var(--text-muted);
  flex-shrink: 0;
}

.caret-spacer {
  width: 14px;
  text-align: center;
  color: var(--text-muted);
  flex-shrink: 0;
}

.node-title {
  flex: 1;
  font-size: 14px;
}

.node-actions {
  display: none;
  gap: 4px;
}

.node-row:hover .node-actions {
  display: flex;
}

.node-action {
  background: transparent;
  border: 1px solid var(--border);
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 3px;
}

.node-action.danger {
  color: var(--danger);
  border-color: var(--danger);
}

.node-children {
  margin-left: 4px;
  border-left: 1px dashed var(--border);
  padding-left: 0;
}

/* 右侧详情面板 */
.op-detail {
  width: 360px;
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: var(--bg-secondary);
}

.op-detail-header {
  padding: 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  gap: 8px;
}

.op-detail-title {
  flex: 1;
  background: transparent;
  border: 1px solid transparent;
  font-size: 16px;
  font-weight: 600;
  padding: 4px 8px;
}

.op-detail-title:focus { background: var(--bg-tertiary); border-color: var(--accent); }

.op-detail textarea {
  flex: 1;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: none;
  padding: 16px;
  font-size: 14px;
  line-height: 1.7;
  resize: none;
}

.op-detail-meta {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  gap: 8px;
}

.ghost {
  background: transparent;
  border: none;
  font-size: 18px;
  color: var(--text-muted);
}

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
  border: 1px solid var(--border);
}
.modal h3 { margin: 0 0 20px; }
.form-row { margin-bottom: 16px; }
.form-row label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
.form-row input, .form-row select { width: 100%; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
</style>
