<template>
  <div class="character-panel">
    <!-- 左：角色列表 -->
    <aside class="char-list">
      <div class="list-header">
        <span>角色 ({{ characters.length }})</span>
        <button class="primary" @click="showNew = true">+ 新建</button>
      </div>
      <div class="list-body">
        <div
          v-for="c in characters"
          :key="c.id"
          class="char-item"
          :class="{ active: selected?.id === c.id }"
          @click="select(c)"
        >
          <div class="char-avatar">{{ c.name.slice(0, 1) }}</div>
          <div class="char-info">
            <div class="char-name">{{ c.name }}</div>
            <div class="char-meta">{{ getAge(c) || '—' }}</div>
          </div>
        </div>
        <div v-if="characters.length === 0" class="empty">
          还没有角色，<a @click="showNew = true">新建一个</a>
        </div>
      </div>
    </aside>

    <!-- 右：详情编辑 -->
    <section class="char-detail">
      <div v-if="!selected" class="placeholder">
        <p>👈 选择一个角色查看详情</p>
      </div>
      <div v-else class="detail-body">
        <div class="detail-header">
          <input class="char-name-input" v-model="form.name" @blur="save" />
          <button class="danger" @click="remove">删除</button>
        </div>

        <div class="detail-content">
          <h4>基本信息</h4>
          <div class="field-grid">
            <div class="field">
              <label>性别</label>
              <input v-model="form._gender" @blur="save" placeholder="男 / 女 / 其他" />
            </div>
            <div class="field">
              <label>年龄</label>
              <input v-model="form._age" @blur="save" placeholder="如：18 / 未知" />
            </div>
            <div class="field">
              <label>身份</label>
              <input v-model="form._identity" @blur="save" placeholder="如：主角 / 反派 / 师父" />
            </div>
          </div>

          <h4>自定义字段</h4>
          <div v-if="customDefs.length === 0" class="empty">
            还没有自定义字段，<a @click="$emit('manage-fields')">去管理</a>
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

          <h4>关系网</h4>
          <div class="relations">
            <div v-for="(rel, idx) in form.relations" :key="idx" class="rel-row">
              <select v-model="rel.to" @change="save">
                <option value="">选择角色</option>
                <option v-for="c in characters.filter(c => c.id !== selected.id)" :key="c.id" :value="c.id">
                  {{ c.name }}
                </option>
              </select>
              <input v-model="rel.type" @blur="save" placeholder="关系，如：师父/师弟/敌人" />
              <button @click="removeRel(idx)">×</button>
            </div>
            <button @click="addRel">+ 添加关系</button>
          </div>

          <h4>备注</h4>
          <textarea v-model="form._notes" @blur="save" rows="4" placeholder="其他信息..." />
        </div>
      </div>
    </section>

    <!-- 新建弹窗 -->
    <div v-if="showNew" class="modal-mask" @click.self="showNew = false">
      <div class="modal">
        <h3>新建角色</h3>
        <div class="form-row">
          <label>姓名</label>
          <input v-model="newChar.name" autofocus @keyup.enter="create" placeholder="如：林渊" />
        </div>
        <div class="modal-actions">
          <button @click="showNew = false">取消</button>
          <button class="primary" @click="create" :disabled="!newChar.name.trim()">创建</button>
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

const characters = ref([])
const customDefs = ref([])
const selected = ref(null)
const form = ref({ name: '', attributes: {}, relations: [] })
const showNew = ref(false)
const newChar = ref({ name: '' })

function loadAll() {
  api.get(`/books/${props.book.id}/characters`).then(r => { characters.value = r.data.characters })
  api.get(`/books/${props.book.id}/custom-field-defs`, { params: { targetType: 'character' } })
    .then(r => { customDefs.value = r.data.defs })
}

onMounted(loadAll)
watch(() => props.book?.id, loadAll)

function select(c) {
  selected.value = c
  // 把 attributes 拍平到 form（基础字段）
  const a = c.attributes || {}
  form.value = {
    name: c.name,
    _gender: a._gender || '',
    _age: a._age || '',
    _identity: a._identity || '',
    _notes: a._notes || '',
    attributes: { ...a },
    relations: Array.isArray(c.relations) ? [...c.relations] : []
  }
}

function getAge(c) {
  const age = c.attributes?._age
  return age ? `${age}${typeof age === 'string' && age.length <= 3 ? '' : ''}` : ''
}

async function save() {
  if (!selected.value) return
  // 合并基础字段回 attributes
  const attrs = { ...form.value.attributes }
  if (form.value._gender) attrs._gender = form.value._gender; else delete attrs._gender
  if (form.value._age) attrs._age = form.value._age; else delete attrs._age
  if (form.value._identity) attrs._identity = form.value._identity; else delete attrs._identity
  if (form.value._notes) attrs._notes = form.value._notes; else delete attrs._notes
  try {
    const { data } = await api.patch(`/characters/${selected.value.id}`, {
      name: form.value.name,
      attributes: attrs,
      relations: form.value.relations.filter(r => r.to)
    })
    selected.value = data.character
    // 同步更新列表
    const idx = characters.value.findIndex(c => c.id === data.character.id)
    if (idx >= 0) characters.value[idx] = data.character
  } catch (e) {}
}

function updateCustom(name, value) {
  if (!form.value.attributes) form.value.attributes = {}
  form.value.attributes[name] = value
  save()
}

function addRel() {
  form.value.relations.push({ to: '', type: '' })
  save()
}
function removeRel(idx) {
  form.value.relations.splice(idx, 1)
  save()
}

async function remove() {
  if (!selected.value) return
  if (!confirm(`确定删除角色「${selected.value.name}」？`)) return
  await api.delete(`/characters/${selected.value.id}`)
  selected.value = null
  loadAll()
}

async function create() {
  if (!newChar.value.name.trim()) return
  const { data } = await api.post(`/books/${props.book.id}/characters`, { name: newChar.value.name })
  showNew.value = false
  newChar.value = { name: '' }
  await loadAll()
  select(data.character)
}
</script>

<style scoped>
.character-panel {
  display: flex;
  width: 100%;
  overflow: hidden;
}

.char-list {
  width: 280px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.list-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-secondary);
}

.list-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.char-item {
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.char-item:hover { background: var(--bg-tertiary); }
.char-item.active { background: var(--accent); color: white; }

.char-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
  color: var(--accent);
}

.char-item.active .char-avatar {
  background: rgba(255,255,255,0.2);
  color: white;
}

.char-info { flex: 1; min-width: 0; }
.char-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.char-meta { font-size: 12px; color: var(--text-secondary); }
.char-item.active .char-meta { color: rgba(255,255,255,0.8); }

.char-detail {
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

.detail-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  gap: 12px;
  align-items: center;
}

.char-name-input {
  flex: 1;
  font-size: 20px;
  font-weight: 600;
  background: transparent;
  border: 1px solid transparent;
  padding: 4px 8px;
}

.char-name-input:hover { border-color: var(--border); }
.char-name-input:focus { background: var(--bg-secondary); border-color: var(--accent); }

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  max-width: 800px;
}

.detail-content h4 {
  margin: 20px 0 12px;
  font-size: 13px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.detail-content h4:first-child { margin-top: 0; }

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.field label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.field input, .field select, .field textarea {
  width: 100%;
}

.relations .rel-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.relations .rel-row select { flex: 0 0 140px; }
.relations .rel-row input { flex: 1; }
.relations .rel-row button {
  background: transparent;
  border: none;
  color: var(--danger);
  font-size: 18px;
  padding: 0 8px;
}

.empty {
  padding: 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.empty a {
  color: var(--accent);
  cursor: pointer;
  text-decoration: underline;
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
.form-row input { width: 100%; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
</style>
