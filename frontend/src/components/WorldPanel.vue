<template>
  <div class="world-panel">
    <div class="wp-header">
      <div class="wp-title">
        <h3>🌍 设定卡</h3>
        <span class="count">共 {{ totalCount }} 项</span>
      </div>
      <div class="wp-actions">
        <select v-model="filterCategory" @change="filter">
          <option value="">全部分类</option>
          <option v-for="cat in categories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
        </select>
        <button class="primary" @click="showNew = true">+ 新设定</button>
      </div>
    </div>

    <div class="wp-body">
      <!-- 空状态 -->
      <div v-if="totalCount === 0" class="empty-state">
        <div style="font-size: 48px; margin-bottom: 16px">🌍</div>
        <h3>还没有设定项</h3>
        <p>从地点、物品、势力、技能开始搭建你的世界观</p>
        <button class="primary" @click="showNew = true" style="margin-top: 16px">+ 创建第一个</button>
      </div>

      <!-- 按分类分组展示 -->
      <div v-for="cat in visibleCategories" :key="cat.value" class="cat-group">
        <div class="cat-title">
          <span class="cat-icon">{{ cat.icon }}</span>
          {{ cat.label }}
          <span class="cat-count">{{ grouped[cat.value]?.length || 0 }}</span>
        </div>
        <div class="card-grid">
          <div
            v-for="item in grouped[cat.value] || []"
            :key="item.id"
            class="world-card"
            @click="select(item)"
          >
            <div class="card-name">{{ item.name }}</div>
            <div class="card-preview">
              {{ getPreview(item) || '点击编辑详情' }}
            </div>
            <div v-if="item.tags?.length" class="card-tags">
              <span v-for="tag in item.tags.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="selected" class="modal-mask" @click.self="selected = null">
      <div class="modal detail-modal">
        <div class="detail-header">
          <input class="detail-name" v-model="form.name" @blur="save" />
          <select v-model="form.category" @change="save">
            <option v-for="cat in categories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
          </select>
          <button class="danger" @click="remove">删除</button>
        </div>

        <div class="detail-body">
          <h4>标签</h4>
          <div class="tag-input">
            <span v-for="(t, i) in form.tags" :key="i" class="tag-edit">
              {{ t }} <a @click="removeTag(i)">×</a>
            </span>
            <input
              v-model="tagInput"
              placeholder="输入标签后回车"
              @keyup.enter="addTag"
              style="flex: 1; min-width: 100px; border: none; background: transparent"
            />
          </div>

          <h4>详情</h4>
          <div v-if="customDefs.length === 0" class="empty-inline">
            还没自定义字段，<a @click="$emit('manage-fields')">去添加</a>
          </div>
          <div v-else class="field-grid">
            <div v-for="def in customDefs" :key="def.id" class="field">
              <label>{{ def.name }}</label>
              <input
                v-if="def.fieldType === 'text' || def.fieldType === 'url'"
                :value="form.attributes?.[def.name] || ''"
                @blur="updateCustom(def.name, $event.target.value)"
              />
              <input
                v-else-if="def.fieldType === 'number'"
                type="number"
                :value="form.attributes?.[def.name] || ''"
                @blur="updateCustom(def.name, Number($event.target.value))"
              />
              <select
                v-else-if="def.fieldType === 'enum'"
                :value="form.attributes?.[def.name] || ''"
                @change="updateCustom(def.name, $event.target.value)"
              >
                <option value="">未选</option>
                <option v-for="opt in def.config?.options || []" :key="opt" :value="opt">{{ opt }}</option>
              </select>
              <input
                v-else-if="def.fieldType === 'date'"
                type="date"
                :value="form.attributes?.[def.name] || ''"
                @blur="updateCustom(def.name, $event.target.value)"
              />
            </div>
          </div>

          <h4>描述</h4>
          <textarea v-model="form._desc" @blur="save" rows="6" placeholder="详细描述..." />
        </div>

        <div class="modal-actions">
          <button class="primary" @click="selected = null">完成</button>
        </div>
      </div>
    </div>

    <!-- 新建弹窗 -->
    <div v-if="showNew" class="modal-mask" @click.self="showNew = false">
      <div class="modal">
        <h3>新建设定项</h3>
        <div class="form-row">
          <label>名称</label>
          <input v-model="newItem.name" autofocus @keyup.enter="create" placeholder="如：青云宗 / 寒霜剑 / 筑基期" />
        </div>
        <div class="form-row">
          <label>分类</label>
          <select v-model="newItem.category">
            <option v-for="cat in categories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
          </select>
        </div>
        <div class="modal-actions">
          <button @click="showNew = false">取消</button>
          <button class="primary" @click="create" :disabled="!newItem.name.trim()">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'

const props = defineProps({ book: { type: Object, required: true } })

const api = axios.create({ baseURL: '/api' })

const categories = [
  { value: 'location', label: '地点', icon: '📍' },
  { value: 'item', label: '物品', icon: '⚔️' },
  { value: 'faction', label: '势力', icon: '🏛️' },
  { value: 'skill', label: '技能', icon: '✨' },
  { value: 'other', label: '其他', icon: '📦' }
]

const grouped = ref({})
const customDefs = ref([])
const filterCategory = ref('')
const selected = ref(null)
const form = ref({ name: '', category: 'location', attributes: {}, tags: [] })
const tagInput = ref('')
const showNew = ref(false)
const newItem = ref({ name: '', category: 'location' })

const totalCount = computed(() => Object.values(grouped.value).reduce((s, arr) => s + arr.length, 0))
const visibleCategories = computed(() => {
  if (!filterCategory.value) return categories
  return categories.filter(c => c.value === filterCategory.value)
})

function filter() { /* 通过 computed 实现 */ }

function loadAll() {
  api.get(`/books/${props.book.id}/world-items/grouped`).then(r => { grouped.value = r.data.grouped })
  api.get(`/books/${props.book.id}/custom-field-defs`, { params: { targetType: 'world_item' } })
    .then(r => { customDefs.value = r.data.defs })
}

onMounted(loadAll)
watch(() => props.book?.id, loadAll)

function getPreview(item) {
  const a = item.attributes || {}
  const keys = Object.keys(a).filter(k => !k.startsWith('_'))
  if (keys.length === 0) return ''
  const preview = keys.slice(0, 2).map(k => `${k}: ${a[k]}`).join(' · ')
  return preview
}

function select(item) {
  selected.value = item
  const a = item.attributes || {}
  form.value = {
    name: item.name,
    category: item.category,
    attributes: { ...a },
    tags: Array.isArray(item.tags) ? [...item.tags] : [],
    _desc: a._desc || ''
  }
}

async function save() {
  if (!selected.value) return
  const attrs = { ...form.value.attributes }
  if (form.value._desc) attrs._desc = form.value._desc; else delete attrs._desc
  try {
    const { data } = await api.patch(`/world-items/${selected.value.id}`, {
      name: form.value.name,
      category: form.value.category,
      attributes: attrs,
      tags: form.value.tags
    })
    selected.value = data.item
    loadAll()
  } catch (e) {}
}

function updateCustom(name, value) {
  if (!form.value.attributes) form.value.attributes = {}
  form.value.attributes[name] = value
  save()
}

function addTag() {
  const v = tagInput.value.trim()
  if (v && !form.value.tags.includes(v)) {
    form.value.tags.push(v)
    tagInput.value = ''
    save()
  }
}
function removeTag(i) {
  form.value.tags.splice(i, 1)
  save()
}

async function remove() {
  if (!confirm(`确定删除「${selected.value.name}」？`)) return
  await api.delete(`/world-items/${selected.value.id}`)
  selected.value = null
  loadAll()
}

async function create() {
  if (!newItem.value.name.trim()) return
  const { data } = await api.post(`/books/${props.book.id}/world-items`, newItem.value)
  showNew.value = false
  newItem.value = { name: '', category: 'location' }
  loadAll()
  select(data.item)
}
</script>

<style scoped>
.world-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.wp-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.wp-title { display: flex; align-items: center; gap: 12px; }
.wp-title h3 { margin: 0; font-size: 16px; }
.count { color: var(--text-muted); font-size: 12px; }

.wp-actions { display: flex; gap: 8px; }
.wp-actions select {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 6px 10px;
  border-radius: 4px;
}

.wp-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-muted);
}

.empty-state h3 { color: var(--text-secondary); margin-bottom: 8px; }

.cat-group { margin-bottom: 32px; }

.cat-title {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cat-icon { font-size: 16px; }
.cat-count {
  background: var(--bg-tertiary);
  color: var(--text-muted);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: normal;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.world-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.world-card:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.card-name {
  font-weight: 600;
  margin-bottom: 6px;
  font-size: 15px;
}

.card-preview {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  min-height: 36px;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.tag {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
}

/* 详情弹窗 */
.detail-modal {
  width: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: center;
}

.detail-name {
  flex: 1;
  font-size: 20px;
  font-weight: 600;
  background: transparent;
  border: 1px solid transparent;
}

.detail-name:focus { background: var(--bg-tertiary); border-color: var(--accent); }

.detail-name:hover { border-color: var(--border); }

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
}

.detail-body h4 {
  margin: 20px 0 10px;
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-body h4:first-child { margin-top: 0; }

.tag-input {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  min-height: 38px;
  align-items: center;
}

.tag-edit {
  background: var(--accent);
  color: white;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tag-edit a {
  cursor: pointer;
  opacity: 0.7;
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.field label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.field input, .field select {
  width: 100%;
}

.empty-inline {
  font-size: 13px;
  color: var(--text-muted);
  padding: 8px 0;
}

.empty-inline a {
  color: var(--accent);
  cursor: pointer;
  text-decoration: underline;
}

textarea {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
  width: 100%;
  resize: vertical;
}

.danger {
  background: transparent;
  border-color: var(--danger);
  color: var(--danger);
}
.danger:hover { background: var(--danger); color: white; }

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
  width: 400px;
  border: 1px solid var(--border);
}
.modal h3 { margin: 0 0 20px; }
.form-row { margin-bottom: 16px; }
.form-row label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
.form-row input, .form-row select { width: 100%; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
</style>
