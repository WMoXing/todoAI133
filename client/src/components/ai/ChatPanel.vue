<template>
  <div class="chat-panel" :class="{ 'full-screen': fullScreen }">
    <div class="chat-header">
      <h3>AI 助手</h3>
      <div class="chat-actions">
        <el-button :icon="Plus" size="small" text @click="newChat" />
      </div>
    </div>

    <div class="chat-messages" ref="messagesRef">
      <div v-if="!currentSession || currentSession.messages.length === 0" class="chat-empty">
        <p>👋 我是你的 AI 任务助手</p>
        <p class="hint">试着问我：</p>
        <ul>
          <li>"帮我添加一个明天下午3点开会的任务"</li>
          <li>"这周还有哪些任务没做完？"</li>
          <li>"帮我拆解这个任务"</li>
          <li>"给我一个今日任务总结"</li>
        </ul>
      </div>

      <div v-for="(msg, i) in currentSession?.messages || []" :key="i" class="chat-message" :class="msg.role">
        <div class="msg-content" v-html="renderMarkdown(msg.content)" />
      </div>

      <div v-if="streaming" class="chat-message assistant">
        <div class="msg-content" v-html="streamingContent" />
      </div>
    </div>

    <div class="quick-actions" v-if="currentSession && currentSession.messages?.length <= 2">
      <span class="quick-label">快捷提问：</span>
      <el-button v-for="qa in quickActions" :key="qa.label" size="small" round @click="quickSend(qa.text)" :disabled="streaming">{{ qa.label }}</el-button>
    </div>

    <div class="chat-input">
      <el-input v-model="inputText" placeholder="跟 AI 聊聊你的任务..." @keyup.enter="sendMessage" :disabled="streaming" size="default">
        <template #append>
          <el-button :icon="Promotion" @click="sendMessage" :loading="streaming" :disabled="!inputText.trim()" />
        </template>
      </el-input>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { Plus, Promotion } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'
import { createChatSession, fetchChatSessions, fetchChatSession, sendChatMessage } from '../../api'
import { useTaskStore } from '../../stores/tasks'

const props = defineProps({ fullScreen: { type: Boolean, default: false } })
const taskStore = useTaskStore()

const sessions = ref([])
const currentSession = ref(null)
const inputText = ref('')
const streaming = ref(false)
const streamingContent = ref('')
const messagesRef = ref(null)
const lastUserMessage = ref('')

const quickActions = [
  { label: '📊 今日概览', text: '给我一个今日任务概览' },
  { label: '📅 本周截止', text: '哪些任务本周截止？' },
  { label: '⚠️ 逾期任务', text: '有哪些逾期没完成的任务？' },
  { label: '🔴 高优先级', text: '列出所有高优先级待办任务' },
  { label: '📈 进度分析', text: '分析一下我的任务进度' },
  { label: '🗓️ 每周回顾', text: '给我做一个每周回顾总结' },
]

onMounted(async () => {
  const list = await fetchChatSessions()
  sessions.value = list
  if (list.length > 0) {
    currentSession.value = await fetchChatSession(list[0].id)
  }
})

async function newChat() {
  const session = await createChatSession()
  sessions.value.unshift(session)
  currentSession.value = session
}

function enrichRecurring(taskData, userMsg) {
  if (taskData.isRecurring) return taskData
  const msg = (userMsg || '').toLowerCase()
  if (msg.includes('每天') || msg.includes('每日') || msg.includes('天天')) {
    taskData.isRecurring = true
    taskData.recurrenceRule = { frequency: 'daily', interval: 1 }
  } else if (msg.includes('每周')) {
    taskData.isRecurring = true
    taskData.recurrenceRule = { frequency: 'weekly', interval: 1 }
  } else if (msg.includes('每月') || msg.includes('每个月')) {
    taskData.isRecurring = true
    taskData.recurrenceRule = { frequency: 'monthly', interval: 1 }
  }
  return taskData
}

function extractTaskBlocks(text) {
  const results = []
  let i = 0
  while ((i = text.indexOf('[TASK:', i)) !== -1) {
    const start = i + 6
    let depth = 1
    let j = start
    for (; j < text.length; j++) {
      if (text[j] === '{' || text[j] === '[') depth++
      else if (text[j] === '}' || text[j] === ']') depth--
      if (depth === 0) break
    }
    if (depth === 0) {
      results.push(text.substring(start, j))
    }
    i = j + 1
  }
  return results
}

async function parseAndCreateTasks(text, userMsg) {
  const blocks = extractTaskBlocks(text)
  for (const block of blocks) {
    try {
      const json = block.startsWith('{') ? block : block.substring(block.indexOf('{'))
      if (!json.startsWith('{')) continue
      const taskData = enrichRecurring(JSON.parse(json), userMsg)
      await taskStore.addTask({
        title: taskData.title || '新任务',
        priority: taskData.priority || 'medium',
        dueDate: taskData.dueDate || undefined,
        tags: taskData.tags || [],
        isRecurring: taskData.isRecurring || false,
        recurrenceRule: taskData.recurrenceRule || null,
        aiGenerated: true,
      })
      ElMessage.success('AI 已添加: ' + (taskData.title || '新任务'))
    } catch (e) {
      // skip invalid JSON
    }
  }
  let cleaned = text
  for (const block of blocks) {
    cleaned = cleaned.replace('[TASK:' + block + ']', '')
  }
  return cleaned.trim()
}

function quickSend(text) {
  inputText.value = text
  sendMessage()
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || streaming.value) return

  if (!currentSession.value) await newChat()

  inputText.value = ''
  lastUserMessage.value = text
  streaming.value = true
  streamingContent.value = ''

  if (!currentSession.value.messages) currentSession.value.messages = []
  currentSession.value.messages.push({ role: 'user', content: text })

  await nextTick()
  scrollToBottom()

  try {
    const response = await sendChatMessage(text, currentSession.value.id)
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            const cleaned = await parseAndCreateTasks(streamingContent.value, lastUserMessage.value)
            currentSession.value.messages.push({ role: 'assistant', content: cleaned })
            streaming.value = false
            streamingContent.value = ''
            return
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              streamingContent.value += parsed.content
              await nextTick()
              scrollToBottom()
            }
            if (parsed.error) {
              streaming.value = false
              streamingContent.value = ''
              ElMessage.error(parsed.error)
            }
          } catch {}
        }
      }
    }
  } catch {
    streaming.value = false
    ElMessage.error('发送失败')
  }
}

function scrollToBottom() {
  if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
}

function renderMarkdown(text) {
  if (!text) return ''
  let cleaned = text
  const blocks = extractTaskBlocks(text)
  for (const block of blocks) {
    cleaned = cleaned.replace('[TASK:' + block + ']', '')
  }
  return marked.parse(cleaned)
}
</script>

<style scoped>
.chat-panel { display:flex; flex-direction:column; height:100%; }
.chat-panel.full-screen { max-width:800px; margin:0 auto; }
.chat-header { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--el-border-color-light); flex-shrink:0; }
.chat-header h3 { margin:0; font-size:16px; }
.chat-messages { flex:1; overflow-y:auto; padding:16px; }
.chat-empty { text-align:center; padding:32px 16px; color:var(--el-text-color-secondary); }
.chat-empty .hint { margin-top:16px; font-weight:500; }
.chat-empty ul { text-align:left; padding-left:20px; margin-top:8px; }
.chat-message { margin-bottom:16px; }
.chat-message.user .msg-content { background:var(--el-color-primary); color:white; margin-left:auto; max-width:80%; padding:10px 14px; border-radius:12px 12px 0 12px; }
.chat-message.assistant .msg-content { background:var(--el-fill-color-light); max-width:85%; padding:10px 14px; border-radius:12px 12px 12px 0; }
.msg-content :deep(p) { margin:0 0 4px; }
.msg-content :deep(ul) { margin:4px 0; padding-left:18px; }
.msg-content :deep(code) { background:rgba(0,0,0,0.1); padding:2px 6px; border-radius:4px; font-size:13px; }
.quick-actions { display:flex; flex-wrap:wrap; gap:6px; padding:8px 16px; border-top:1px solid var(--el-border-color-lighter); flex-shrink:0; align-items:center; }
.quick-label { font-size:12px; color:var(--el-text-color-placeholder); margin-right:4px; white-space:nowrap; }
.chat-input { padding:12px 16px; border-top:1px solid var(--el-border-color-light); flex-shrink:0; }
</style>