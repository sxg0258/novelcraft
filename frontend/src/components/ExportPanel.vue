<template>
  <div class="export-panel">
    <div class="ep-header">
      <h3>📤 导出与备份</h3>
    </div>
    <div class="ep-body">
      <div class="export-grid">
        <div class="export-card">
          <div class="export-icon">📝</div>
          <h4>Markdown 全文</h4>
          <p>导出整本书为 Markdown 格式，包含章节结构与正文，可用于静态站点发布或二次编辑。</p>
          <button class="primary" @click="download('/api/books/' + book.id + '/export/markdown', book.title + '.md')">
            下载 .md
          </button>
        </div>

        <div class="export-card">
          <div class="export-icon">📄</div>
          <h4>纯文本</h4>
          <p>导出为纯 .txt 文件，最通用的格式，适合投给编辑或离线阅读。</p>
          <button class="primary" @click="download('/api/books/' + book.id + '/export/txt', book.title + '.txt')">
            下载 .txt
          </button>
        </div>

        <div class="export-card">
          <div class="export-icon">📘</div>
          <h4>Word 文档</h4>
          <p>导出为 .docx 格式，排版精美，包含封面、目录与章节分页。可直接投稿或继续编辑。</p>
          <button class="primary" @click="download('/api/books/' + book.id + '/export/docx', book.title + '.docx', true)">
            下载 .docx
          </button>
        </div>

        <div class="export-card">
          <div class="export-icon">📕</div>
          <h4>PDF / 打印版</h4>
          <p>生成排版好的 HTML 页面，在浏览器中按 <kbd>Ctrl+P</kbd>（Mac: <kbd>⌘+P</kbd>）保存为 PDF。</p>
          <button class="primary" @click="openPrint('/api/books/' + book.id + '/export/pdf-html')">
            打开打印视图
          </button>
        </div>
      </div>

      <h3 style="margin-top: 40px">💾 数据备份</h3>
      <div class="export-card" style="width: 100%; text-align: left">
        <h4>方式 1：JSON 备份（推荐）</h4>
        <p>导出全部数据为 JSON 文件，包含书、章节、角色、设定、大纲、AI 风格、AI 对话。在另一台 NovelCraft 上可以一键恢复。</p>
        <div style="display: flex; gap: 8px; margin-top: 12px">
          <button class="primary" @click="exportJSON">📤 导出 JSON 备份</button>
          <label class="import-btn">
            📥 导入 JSON 备份
            <input type="file" accept=".json" @change="importJSON" hidden />
          </label>
        </div>

        <h4 style="margin-top: 24px">方式 2：PostgreSQL 备份（更彻底）</h4>
        <p>通过 SSH 在飞牛上执行以下命令备份（包含所有表和全文索引）：</p>
        <pre class="code-block">cd /vol1/1000/docker/novelcraft
docker compose exec db pg_dump -U novelcraft novelcraft > backup_$(date +%Y%m%d).sql</pre>
        <p style="margin-top: 8px; color: var(--text-muted)">恢复：<code>cat backup.sql | docker compose exec -T db psql -U novelcraft novelcraft</code></p>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({ book: { type: Object, required: true } })

async function download(path, filename, isBinary = false) {
  try {
    const res = await fetch(path)
    if (!res.ok) throw new Error('下载失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('导出失败：' + e.message)
  }
}

function openPrint(path) {
  window.open(path, '_blank')
}

async function exportJSON() {
  try {
    const res = await fetch('/api/backup/export')
    if (!res.ok) throw new Error('导出失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `novelcraft-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('导出失败：' + e.message)
  }
}

async function importJSON(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!confirm('导入会覆盖当前所有数据，确定继续？建议先导出当前备份。')) return
  const text = await file.text()
  try {
    const data = JSON.parse(text)
    const res = await fetch('/api/backup/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, mode: 'replace' })
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error)
    alert(`✅ 导入完成！书 ${result.stats.books} / 章节 ${result.stats.chapters} / 角色 ${result.stats.characters} / 设定 ${result.stats.worldItems} / 大纲 ${result.stats.outlines}`)
    location.reload()
  } catch (err) {
    alert('导入失败：' + err.message)
  }
}
</script>

<style scoped>
.export-panel {
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.ep-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

.ep-header h3 { margin: 0; font-size: 16px; }

.ep-body {
  padding: 24px;
  max-width: 1000px;
}

.export-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.export-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  transition: border-color 0.15s;
}

.export-card:not(.disabled):hover {
  border-color: var(--accent);
}

.export-card.disabled {
  opacity: 0.5;
}

.export-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.export-card h4 {
  margin: 8px 0;
  font-size: 15px;
}

.export-card p {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 16px;
  line-height: 1.6;
  min-height: 60px;
}

.code-block {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 12px;
  font-family: "Fira Code", "Consolas", monospace;
  font-size: 12px;
  color: var(--text-secondary);
  overflow-x: auto;
  margin-top: 12px;
}

code {
  background: var(--bg-primary);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: "Fira Code", "Consolas", monospace;
  font-size: 0.9em;
  color: var(--accent);
}

.import-btn {
  display: inline-block;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.import-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
