<template>
  <div class="heatmap">
    <div class="hm-header">
      <div>
        <span class="hm-title">📊 写作热力图</span>
        <span class="hm-sub">过去 {{ days }} 天 · 共 {{ totalWords.toLocaleString() }} 字 · 活跃 {{ activeDays }} 天</span>
      </div>
      <div class="hm-legend">
        <span class="legend-label">少</span>
        <span class="legend-cell" :data-level="0"></span>
        <span class="legend-cell" :data-level="1"></span>
        <span class="legend-cell" :data-level="2"></span>
        <span class="legend-cell" :data-level="3"></span>
        <span class="legend-cell" :data-level="4"></span>
        <span class="legend-label">多</span>
      </div>
    </div>

    <div class="hm-grid" v-if="cells.length > 0">
      <div class="hm-months">
        <span v-for="m in monthLabels" :key="m.label" :style="{ gridColumnStart: m.col }">{{ m.label }}</span>
      </div>
      <div class="hm-body">
        <div class="hm-weekdays">
          <span v-for="(d, i) in ['', '一', '', '三', '', '五', '']" :key="i">{{ d }}</span>
        </div>
        <div class="hm-cells">
          <div
            v-for="(week, wi) in cells"
            :key="wi"
            class="hm-week"
          >
            <div
              v-for="(day, di) in week"
              :key="di"
              class="hm-cell"
              :data-level="day.level"
              :title="day.date ? `${day.date} · ${day.words || 0} 字` : ''"
            ></div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="hm-loading">暂无数据，开始写作后这里会显示每天的字数 ✍️</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'

const props = defineProps({
  book: { type: Object, required: true },
  days: { type: Number, default: 180 }
})

const api = axios.create({ baseURL: '/api' })

const snapshots = ref([])
const totalWords = ref(0)
const activeDays = computed(() => snapshots.value.filter(s => s.delta > 0).length)

// 按等级分桶：[0, 100), [100, 500), [500, 2000), [2000, 5000), [5000+]
function levelOf(delta) {
  if (!delta || delta <= 0) return 0
  if (delta < 100) return 1
  if (delta < 500) return 2
  if (delta < 2000) return 3
  return 4
}

// 构建网格：每列 7 天（周一到周日）
const cells = computed(() => {
  const map = new Map(snapshots.value.map(s => [s.date, s]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 找到 days 天前的最近的周日（对齐到周日作为第一列开始）
  // 简化：从今天往前推 days 天，按周分列
  const start = new Date(today.getTime() - props.days * 86400 * 1000)
  // 对齐到那一周的周日
  const startDay = start.getDay()
  start.setDate(start.getDate() - startDay)

  const weeks = []
  let week = []
  const cursor = new Date(start)
  while (cursor <= today) {
    const dateStr = cursor.toISOString().slice(0, 10)
    const snap = map.get(dateStr)
    const inRange = cursor >= start && cursor <= today
    week.push({
      date: inRange ? dateStr : null,
      words: snap?.delta || 0,
      level: inRange ? levelOf(snap?.delta || 0) : -1
    })
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  if (week.length > 0) {
    while (week.length < 7) week.push({ date: null, level: -1 })
    weeks.push(week)
  }
  return weeks
})

const monthLabels = computed(() => {
  const labels = []
  let lastMonth = -1
  cells.value.forEach((week, idx) => {
    // 每列第一天
    const firstDay = week.find(d => d.date)
    if (firstDay) {
      const month = new Date(firstDay.date).getMonth()
      if (month !== lastMonth) {
        labels.push({ label: `${month + 1}月`, col: idx + 1 })
        lastMonth = month
      }
    }
  })
  return labels
})

async function load() {
  if (!props.book) return
  const { data } = await api.get(`/books/${props.book.id}/heatmap`, { params: { days: props.days } })
  snapshots.value = data.snapshots
  totalWords.value = data.snapshots.reduce((s, x) => Math.max(s, x.wordCount), 0)
}

onMounted(load)
watch(() => props.book?.id, load)
</script>

<style scoped>
.heatmap {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.hm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 12px;
}

.hm-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
}

.hm-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-left: 12px;
}

.hm-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
}

.legend-cell {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-label {
  margin: 0 4px;
}

.hm-grid {
  overflow-x: auto;
}

.hm-months {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 14px;
  gap: 2px;
  margin-left: 24px;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
  position: relative;
  height: 16px;
}

.hm-months span {
  grid-row: 1;
}

.hm-body {
  display: flex;
  gap: 0;
}

.hm-weekdays {
  display: grid;
  grid-template-rows: repeat(7, 14px);
  gap: 2px;
  width: 22px;
  flex-shrink: 0;
  font-size: 10px;
  color: var(--text-muted);
  text-align: right;
  padding-right: 4px;
}

.hm-cells {
  display: flex;
  gap: 2px;
}

.hm-week {
  display: grid;
  grid-template-rows: repeat(7, 14px);
  gap: 2px;
}

.hm-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: var(--bg-tertiary);
}

.hm-cell[data-level="1"] { background: rgba(99, 102, 241, 0.3); }
.hm-cell[data-level="2"] { background: rgba(99, 102, 241, 0.5); }
.hm-cell[data-level="3"] { background: rgba(99, 102, 241, 0.75); }
.hm-cell[data-level="4"] { background: rgba(99, 102, 241, 1); }

.hm-cell:hover {
  outline: 1px solid var(--accent);
}

.hm-loading {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
