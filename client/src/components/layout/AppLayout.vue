<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-left">
        <h1 class="logo" @click="$router.push('/')">🤖 AI Todo</h1>
      </div>
      <div class="header-right">
        <el-switch
          v-model="appStore.darkMode"
          :active-icon="Moon"
          :inactive-icon="Sunny"
          inline-prompt
        />
        <el-button text @click="showTrash = true">
          <el-icon><Delete /></el-icon>
          <span class="trash-label">回收站</span>
        </el-button>
      </div>
    </el-header>

    <el-container class="app-main">
      <slot />
    </el-container>

    <!-- Recycle bin dialog -->
    <el-drawer v-model="showTrash" title="回收站" direction="rtl" size="400px">
      <div v-if="trashTasks.length === 0" class="trash-empty">
        <el-empty description="回收站为空" />
      </div>
      <div v-for="task in trashTasks" :key="task.id" class="trash-item">
        <div class="trash-info">
          <span class="trash-title">{{ task.title }}</span>
          <span class="trash-date">{{ formatDate(task.deletedAt) }}</span>
        </div>
        <div class="trash-actions">
          <el-button size="small" text type="primary" @click="handleRestore(task)">
            恢复
          </el-button>
        </div>
      </div>
    </el-drawer>

    <!-- Mobile bottom tabs -->
    <div class="mobile-tabs">
      <div class="tab-item" :class="{ active: $route.path === '/' }" @click="$router.push('/')">
        <el-icon><List /></el-icon>
        <span>任务</span>
      </div>
      <div class="tab-item" :class="{ active: $route.path === '/ai' }" @click="$router.push('/ai')">
        <el-icon><ChatDotRound /></el-icon>
        <span>AI</span>
      </div>
    </div>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Sunny, Moon, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../../stores/app'
import { useTaskStore } from '../../stores/tasks'

const appStore = useAppStore()
const taskStore = useTaskStore()

const showTrash = ref(false)

const trashTasks = computed(() => taskStore.trashTasks)

async function handleRestore(task) {
  await taskStore.recoverTask(task.id)
  ElMessage.success('已恢复')
}

function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  const now = new Date()
  const diff = now - d
  if (diff < 86400000) return '今天'
  if (diff < 172800000) return '昨天'
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

onMounted(() => {
  appStore.initDarkMode()
})
</script>

<style scoped>
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-light);
  padding: 0 20px;
  height: 56px;
  flex-shrink: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.trash-label {
  margin-left: 4px;
}

.logo {
  font-size: 20px;
  cursor: pointer;
  margin: 0;
}

.app-main {
  flex: 1;
  overflow: hidden;
}

.trash-empty {
  padding-top: 80px;
}

.trash-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.trash-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trash-title {
  font-size: 14px;
}

.trash-date {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.mobile-tabs {
  display: none;
}

@media (max-width: 768px) {
  .mobile-tabs {
    display: flex;
    border-top: 1px solid var(--el-border-color-light);
    background: var(--el-bg-color);
    flex-shrink: 0;
  }

  .tab-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    gap: 2px;
  }

  .tab-item.active {
    color: var(--el-color-primary);
  }
}
@media (max-width:768px) {
  .logo { font-size:16px !important; }
  .app-header { padding:0 12px !important; height:48px !important; }
  .trash-label { display:none; }
  .mobile-tabs { display:flex; border-top:1px solid var(--el-border-color-light); background:var(--el-bg-color); flex-shrink:0; }
  .tab-item { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:6px 0; font-size:11px; color:var(--el-text-color-secondary); cursor:pointer; gap:2px; }
  .tab-item.active { color:var(--el-color-primary); }
}
</style>