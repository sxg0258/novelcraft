<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-brand">
        <div class="brand-icon">📖</div>
        <h1>NovelCraft</h1>
        <p>Docker 化小说写作工具</p>
      </div>

      <div class="login-tabs">
        <button :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
        <button :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
      </div>

      <form @submit.prevent="submit" class="login-form">
        <div class="form-row">
          <label>用户名</label>
          <input v-model="username" autofocus required minlength="3" maxlength="30" />
        </div>
        <div class="form-row">
          <label>密码</label>
          <input v-model="password" type="password" required minlength="6" />
        </div>
        <div v-if="mode === 'register'" class="form-row">
          <label>昵称（可选）</label>
          <input v-model="nickname" maxlength="30" />
        </div>
        <div v-if="error" class="login-error">{{ error }}</div>
        <button type="submit" class="primary login-btn" :disabled="loading">
          {{ loading ? '处理中…' : (mode === 'login' ? '登录' : '注册') }}
        </button>
      </form>

      <p class="login-tip">
        <span v-if="mode === 'register'">💡 第一个注册的用户将自动成为管理员</span>
        <span v-else>💡 数据全部存在你的飞牛 NAS 本地</span>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useAuth } from '../stores/auth.js'

const emit = defineEmits(['login'])
const auth = useAuth()

const mode = ref('login')
const username = ref('')
const password = ref('')
const nickname = ref('')
const error = ref('')
const loading = ref(false)

const api = axios.create({ baseURL: '/api' })

async function submit() {
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'login') {
      const { data } = await api.post('/auth/login', { username: username.value, password: password.value })
      auth.setSession(data.accessToken, data.user)
      emit('login', data.user)
    } else {
      await api.post('/auth/register', { username: username.value, password: password.value, nickname: nickname.value })
      // 注册完自动登录
      const { data } = await api.post('/auth/login', { username: username.value, password: password.value })
      auth.setSession(data.accessToken, data.user)
      emit('login', data.user)
    }
  } catch (e) {
    error.value = e.response?.data?.error || e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d1b4e 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.login-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 36px 32px;
  width: 380px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

.login-brand {
  text-align: center;
  margin-bottom: 28px;
}

.brand-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.login-brand h1 {
  font-size: 24px;
  margin: 0 0 4px;
  color: var(--accent);
}

.login-brand p {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.login-tabs {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border);
}

.login-tabs button {
  flex: 1;
  background: transparent;
  border: none;
  padding: 10px;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  color: var(--text-muted);
  font-size: 14px;
}

.login-tabs button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.login-form { display: flex; flex-direction: column; gap: 14px; }

.form-row label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-row input { width: 100%; }

.login-error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
}

.login-btn {
  width: 100%;
  padding: 10px;
  margin-top: 6px;
}

.login-tip {
  margin: 16px 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
