<template>
  <AppLayout>
    <div class="tasks-page">
      <div class="tasks-main">
        <div class="tasks-toolbar">
          <div class="toolbar-row">
            <el-input
              v-model="newTaskText"
              placeholder="输入任务，支持自然语言..."
              @keyup.enter="handleAddTask"
              class="task-input"
              size="large"
              clearable
            >
              <template #prepend>
                <el-button :icon="Plus" @click="handleAddTask" :loading="parsing" />
              </template>
            </el-input>
            <el-button v-if="!isMobile" :icon="showSidebar?ArrowRight:ArrowLeft" text @click="showSidebar=!showSidebar" class="sidebar-toggle" />
          </div>

          <!-- Filter bar desktop -->
          <div v-if="!isMobile" class="filter-bar">
            <div class="filter-group">
              <el-icon class="filter-icon"><Search /></el-icon>
              <el-input v-model="filters.search" placeholder="搜索任务..." size="small" clearable class="filter-input" @input="applyFilters" />
            </div>
            <el-divider direction="vertical" />
            <div class="filter-group">
              <el-select v-model="filters.priority" placeholder="优先级" size="small" clearable @change="applyFilters" class="filter-select">
                <template #prefix><el-tag v-if="filters.priority" :type="priorityTagType" size="small" class="filter-tag-prefix">{{ priorityLabel }}</el-tag></template>
                <el-option value="high"><el-tag type="danger" size="small">高</el-tag> 高优先级</el-option>
                <el-option value="medium"><el-tag type="warning" size="small">中</el-tag> 中优先级</el-option>
                <el-option value="low"><el-tag type="info" size="small">低</el-tag> 低优先级</el-option>
              </el-select>
            </div>
            <el-divider direction="vertical" />
            <div class="filter-group">
              <el-select v-model="filters.status" placeholder="状态" size="small" clearable @change="applyFilters" class="filter-select">
                <el-option value="todo">
                  <el-icon class="status-dot todo"><CircleCheckFilled /></el-icon> 待办
                </el-option>
                <el-option value="in_progress">
                  <el-icon class="status-dot progress"><Loading /></el-icon> 进行中
                </el-option>
                <el-option value="done">
                  <el-icon class="status-dot done"><CircleCheck /></el-icon> 已完成
                </el-option>
              </el-select>
            </div>

            <div v-if="hasFilters" class="filter-active-count">
              <span>{{ filterCount }} 项筛选</span>
              <el-button size="small" text type="danger" @click="clearFilters">清除</el-button>
            </div>
          </div>

          <!-- Filter bar mobile -->
          <div v-else class="filter-bar-mobile">
            <div class="filter-group">
              <el-icon><Search /></el-icon>
              <el-input v-model="filters.search" placeholder="搜索..." size="small" clearable @input="applyFilters" class="filter-input" />
            </div>
            <el-button size="small" text @click="showMobileFilters=!showMobileFilters" class="filter-more-btn">
              <el-icon><Filter /></el-icon>
              <span v-if="filterCount" class="filter-badge">{{ filterCount }}</span>
            </el-button>
          </div>

          <!-- Mobile filter panel -->
          <div v-if="isMobile && showMobileFilters" class="mobile-filter-panel">
            <div class="mobile-filter-row">
              <span class="filter-label">优先级</span>
              <el-radio-group v-model="filters.priority" size="small" @change="applyFilters">
                <el-radio-button value="high">高</el-radio-button>
                <el-radio-button value="medium">中</el-radio-button>
                <el-radio-button value="low">低</el-radio-button>
              </el-radio-group>
            </div>
            <div class="mobile-filter-row">
              <span class="filter-label">状态</span>
              <el-radio-group v-model="filters.status" size="small" @change="applyFilters">
                <el-radio-button value="todo">待办</el-radio-button>
                <el-radio-button value="in_progress">进行中</el-radio-button>
                <el-radio-button value="done">已完成</el-radio-button>
              </el-radio-group>
            </div>

            <div class="mobile-filter-clear">
              <el-button size="small" @click="clearFilters">清除筛选</el-button>
            </div>
          </div>
        </div>

        <div class="tasks-content">
          <div v-if="taskStore.loading" class="loading-state">
            <el-skeleton :rows="5" animated />
          </div>
          <template v-else>
            <el-tabs v-model="viewMode" class="view-tabs">
              <el-tab-pane label="列表" name="list" />
              <el-tab-pane label="看板" name="kanban" />
            </el-tabs>
            <TaskList v-if="viewMode==='list'" />
            <div v-else class="kanban-view">
              <TaskKanban v-if="taskStore.activeTasks.length" />
              <div v-else class="empty-kanban">
                <el-empty description="暂无任务" />
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- AI sidebar -->
      <transition name="slide">
        <div v-if="showSidebar" class="ai-sidebar">
          <ChatPanel />
        </div>
      </transition>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { Plus, Search, Filter, ArrowRight, ArrowLeft, CircleCheckFilled, CircleCheck, Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import AppLayout from '../components/layout/AppLayout.vue'
import TaskList from '../components/tasks/TaskList.vue'
import TaskKanban from '../components/tasks/TaskKanban.vue'
import ChatPanel from '../components/ai/ChatPanel.vue'
import { useTaskStore } from '../stores/tasks'
import { parseTask } from '../api'

const taskStore = useTaskStore()
const newTaskText = ref('')
const viewMode = ref('list')
const showSidebar = ref(false)
const parsing = ref(false)
const isMobile = ref(window.innerWidth <= 768)
const showMobileFilters = ref(false)

const filters = reactive({
  search: '',
  priority: '',
  status: '',
  tag: '',
})

const hasFilters = computed(() => filters.search || filters.priority || filters.status || filters.tag)
const filterCount = computed(() => {
  let n = 0
  if (filters.search) n++
  if (filters.priority) n++
  if (filters.status) n++
  if (filters.tag) n++
  return n
})

const priorityTagType = computed(() => filters.priority==='high'?'danger':filters.priority==='medium'?'warning':'info')
const priorityLabel = computed(() =>
  filters.priority==='high'?'高':filters.priority==='medium'?'中':filters.priority==='low'?'低':'优先级'
)


window.addEventListener('resize', () => { isMobile.value = window.innerWidth <= 768 })

let filterTimer = null
function applyFilters() {
  clearTimeout(filterTimer)
  filterTimer = setTimeout(() => {
    const params = {}
    if (filters.search) params.search = filters.search
    if (filters.priority) params.priority = filters.priority
    if (filters.status) params.status = filters.status
    if (filters.tag) params.tag = filters.tag
    taskStore.loadTasks(params)
  }, 300)
}

function clearFilters() {
  filters.search = ''; filters.priority = ''; filters.status = ''; filters.tag = ''
  showMobileFilters.value = false
  taskStore.loadTasks()
}


async function handleAddTask() {
  const text = newTaskText.value.trim()
  if (!text) return
  parsing.value = true
  try {
    const parsed = await parseTask(text)
    await taskStore.addTask({ title:parsed.title, dueDate:parsed.dueDate||undefined, dueTime:parsed.dueTime||undefined, priority:parsed.priority||'medium', tags:parsed.tags||[], isRecurring:parsed.isRecurring||false, recurrenceRule:parsed.recurrenceRule||null, aiGenerated:true })
    newTaskText.value = ''; ElMessage.success('AI 解析: '+parsed.title)
  } catch {
    await taskStore.addTask({ title:text }); newTaskText.value = ''; ElMessage.success('已添加')
  }
  parsing.value = false
}

onMounted(() => { taskStore.loadTasks() })
</script>

<style scoped>
.tasks-page { display:flex; flex:1; height:100%; overflow:hidden; }
.tasks-main { flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden; }
.tasks-toolbar { padding:12px 16px; border-bottom:1px solid var(--el-border-color-light); flex-shrink:0; }
.toolbar-row { display:flex; gap:8px; align-items:center; margin-bottom:10px; }
.task-input { flex:1; }
.sidebar-toggle { flex-shrink:0; }

/* Desktop filter bar */
.filter-bar { display:flex; align-items:center; gap:6px; background:var(--el-fill-color-light); border-radius:10px; padding:6px 12px; flex-wrap:wrap; }
.filter-search-group { flex:3; min-width:160px; display:flex; align-items:center; }
.filter-group { display:flex; align-items:center; }
.filter-icon { color:var(--el-text-color-secondary); margin-right:4px; }
.filter-input { width:100%; }
.filter-select { width:90px; flex-shrink:0; }
.filter-tag-prefix { margin-right:0 !important; }
.filter-active-count { display:flex; align-items:center; gap:6px; margin-left:4px; font-size:12px; color:var(--el-color-primary); }
.el-divider--vertical { margin:0 4px; height:20px; }

/* Mobile filter */
.filter-bar-mobile { display:flex; align-items:center; gap:8px; }
.filter-more-btn { position:relative; }
.filter-badge {
  position:absolute; top:-4px; right:-4px;
  background:var(--el-color-primary); color:white;
  font-size:10px; min-width:16px; height:16px; border-radius:8px;
  display:flex; align-items:center; justify-content:center;
}
.mobile-filter-panel {
  margin-top:8px; padding:12px;
  background:var(--el-fill-color-light); border-radius:10px;
}
.mobile-filter-row { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
.mobile-filter-row:last-child { margin-bottom:0; }
.filter-label { font-size:13px; color:var(--el-text-color-secondary); width:44px; flex-shrink:0; }
.mobile-tags { display:flex; gap:6px; flex-wrap:wrap; }
.mobile-tag { cursor:pointer; }
.mobile-filter-clear { margin-top:8px; text-align:right; }

.status-dot.todo { color:var(--el-color-info); }
.status-dot.progress { color:var(--el-color-warning); }
.status-dot.done { color:var(--el-color-success); }

.tasks-content { flex:1; overflow:auto; padding:0 16px; }
.loading-state { padding:24px 0; }
.view-tabs { margin-bottom:12px; }
.kanban-view { height:calc(100vh - 270px); min-height:300px; }
.empty-kanban { display:flex; align-items:center; justify-content:center; height:100%; }
.ai-sidebar { width:400px; min-width:320px; max-width:500px; border-left:1px solid var(--el-border-color-light); flex-shrink:0; overflow:hidden; background:var(--el-bg-color-page); }
.slide-enter-active,.slide-leave-active { transition:width .25s ease,opacity .25s ease; }
.slide-enter-from,.slide-leave-to { width:0!important; opacity:0; }

@media (max-width:900px) {
  .filter-select { width:90px; }
  .el-divider--vertical { display:none; }
}

@media (max-width:768px) {
  .tasks-toolbar { padding:10px 12px; }
  .toolbar-row { margin-bottom:8px; }
  .tasks-content { padding:0 12px; }
  .ai-sidebar { display:none; }
  .kanban-view { height:auto; min-height:40vh; }
  .sidebar-toggle { display:none; }
  .filter-bar { display:none; }
}
</style>