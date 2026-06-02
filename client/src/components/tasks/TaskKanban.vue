<template>
  <div class="kanban">
    <div v-for="col in columns" :key="col.key" class="kanban-column" @dragover.prevent @drop="(e) => handleDrop(e, col.key)">
      <div class="column-header">
        {{ col.label }}
        <span class="column-count">{{ taskStore.getTasksByStatus(col.key).filter(t => !t.parentId).length }}</span>
      </div>

      <div v-for="task in columnTasks(col.key)" :key="task.id" class="kanban-card" draggable="true" @dragstart="(e) => handleDragStart(e, task)">
        <div class="card-header">
          <span class="card-title" @click="editTask(task)"><span v-if="task.isRecurring" class="recur-icon">&#x1F501;</span>{{ task.title }}</span>
          <el-button :icon="Delete" size="small" text type="danger" @click.stop="handleDelete(task)" class="card-delete" />
        </div>
        <div class="card-meta">
          <el-tag :type="task.priority==='high'?'danger':task.priority==='medium'?'warning':'info'" size="small">
            {{ task.priority==='high'?'高':task.priority==='medium'?'中':'低' }}
          </el-tag>
          <span v-if="task.dueDate" class="card-date">{{ formatDate(task.dueDate) }}</span>
        </div>
        <div v-if="task.notes" class="card-notes" v-html="previewNotes(task.notes)"></div>
        <div v-if="childMap[task.id]?.length" class="card-children">
          <div class="children-toggle" @click.stop="toggleExpand(task.id)">
            <el-icon style="margin-right:2px"><component :is="expanded.has(task.id)?CaretBottom:CaretRight" /></el-icon>
            子任务 {{ doneCount(task) }}/{{ childMap[task.id].length }}
          </div>
          <div v-if="expanded.has(task.id)" class="children-list">
            <div v-for="child in childMap[task.id]" :key="child.id" class="child-item">
              <el-checkbox :model-value="child.completed" size="small" @change="(val) => toggleChild(child, val)" />
              <span :class="{ done: child.completed }" class="child-title">{{ child.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit dialog -->
    <el-dialog v-model="dialogVisible" title="编辑任务" width="500px">
      <el-form v-if="editingTask" label-position="top">
        <el-form-item label="标题"><el-input v-model="editingTask.title" /></el-form-item>
        <el-form-item label="优先级">
          <el-radio-group v-model="editingTask.priority">
            <el-radio value="high">高</el-radio>
            <el-radio value="medium">中</el-radio>
            <el-radio value="low">低</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editingTask.status">
            <el-option value="todo" label="待办" />
            <el-option value="in_progress" label="进行中" />
            <el-option value="done" label="已完成" />
          </el-select>
        </el-form-item>
        <el-form-item label="截止日期">
          <el-date-picker v-model="editingTask.dueDate" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="备注">
          <div class="notes-wrap">
            <div class="md-toolbar">
              <span v-for="c in colorOptions" :key="c.color" class="color-btn" :style="{ background: c.color }" @click="applyColor(c.color)" :title="c.label"></span>
              <el-button size="small" text @click="clearColor" type="danger">清除颜色</el-button>
            </div>
            <div ref="notesRef" class="notes-editor" contenteditable="true" @input="onNotesInput" placeholder="写点备注..."></div>
          </div>
        </el-form-item>
        <el-form-item label="重复">
          <el-switch v-model="editingIsRecurring" active-text="开启" />
        </el-form-item>
        <el-form-item v-if="editingIsRecurring" label="重复规则">
          <div style="display:flex;gap:8px;align-items:center">
            <span>每</span>
            <el-input-number v-model="editingTaskRecurrence.interval" :min="1" :max="30" size="small" style="width:70px" />
            <el-select v-model="editingTaskRecurrence.frequency" size="small" style="width:90px">
              <el-option value="daily" label="天" />
              <el-option value="weekly" label="周" />
              <el-option value="monthly" label="月" />
            </el-select>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { Delete, CaretRight, CaretBottom } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useTaskStore } from '../../stores/tasks'

const taskStore = useTaskStore()
const expanded = ref(new Set())
const dialogVisible = ref(false)
const editingTask = ref(null)
const editingTaskRecurrence = ref({ interval: 1, frequency: 'daily' })
const editingIsRecurring = ref(false)
const notesRef = ref(null)

const colorOptions = [
  { color: '#f56c6c', label: '红' },
  { color: '#e6a23c', label: '橙' },
  { color: '#67c23a', label: '绿' },
  { color: '#409eff', label: '蓝' },
  { color: '#909399', label: '灰' },
  { color: '#e040fb', label: '紫' },
  { color: '#ff6f00', label: '深橙' },
  { color: '#00bfa5', label: '青' },
]

const columns = [
  { key: 'todo', label: '待办' },
  { key: 'in_progress', label: '进行中' },
  { key: 'done', label: '已完成' },
]

const childMap = computed(() => {
  const map = {}
  for (const t of taskStore.tasks) { if (t.parentId && !t.deletedAt) { if (!map[t.parentId]) map[t.parentId] = []; map[t.parentId].push(t) } }
  return map
})

function columnTasks(status) { return taskStore.getTasksByStatus(status).filter(t => !t.parentId) }
function toggleExpand(id) { if (expanded.value.has(id)) expanded.value.delete(id); else expanded.value.add(id); expanded.value = new Set(expanded.value) }
function doneCount(task) { return (childMap.value[task.id] || []).filter(c => c.completed).length }
function toggleChild(child, val) { taskStore.editTask(child.id, { completed: val, status: val ? 'done' : 'todo' }) }

function editTask(task) {
  editingTask.value = { ...task }
  editingIsRecurring.value = task.isRecurring || false
  editingTaskRecurrence.value = task.recurrenceRule || { interval: 1, frequency: 'daily' }
  dialogVisible.value = true
  nextTick(() => {
    if (notesRef.value) notesRef.value.innerHTML = task.notes || ''
  })
}

async function saveEdit() {
  if (notesRef.value) editingTask.value.notes = notesRef.value.innerHTML
  editingTask.value.isRecurring = editingIsRecurring.value
  editingTask.value.recurrenceRule = editingIsRecurring.value ? editingTaskRecurrence.value : null
  await taskStore.editTask(editingTask.value.id, editingTask.value)
  dialogVisible.value = false
  ElMessage.success('已更新')
}

async function handleDelete(task) { await taskStore.removeTask(task.id); ElMessage.success('已移至回收站') }

function previewNotes(notes) {
  if (!notes) return ''
  return '<span style="font-size:12px;color:var(--el-text-color-placeholder);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">' + notes + '</span>'
}

function onNotesInput() {
  if (notesRef.value) editingTask.value.notes = notesRef.value.innerHTML
}

function applyColor(color) {
  if (!notesRef.value) return
  notesRef.value.focus()
  document.execCommand('selectAll')
  document.execCommand('foreColor', false, color)
  notesRef.value.focus()
}

function clearColor() {
  if (!notesRef.value) return
  notesRef.value.focus()
  document.execCommand('selectAll')
  document.execCommand('removeFormat')
  document.execCommand('foreColor', false, '')
  notesRef.value.focus()
}

let draggedTask = null
function handleDragStart(e, task) { draggedTask = task; e.dataTransfer.effectAllowed = 'move' }
async function handleDrop(e, status) { if (draggedTask && draggedTask.status !== status) { await taskStore.editTask(draggedTask.id, { status }) }; draggedTask = null }

function formatDate(date) { if (!date) return ''; return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) }
</script>

<style scoped>
.kanban { display:flex; gap:16px; height:100%; overflow-x:auto; }
.kanban-column { flex:1; min-width:200px; background:var(--el-fill-color-light); border-radius:8px; padding:12px; overflow-y:auto; }
.column-header { position:sticky; top:0; z-index:1; background:var(--el-fill-color-light); font-weight:600; margin-bottom:12px; padding-bottom:8px; border-bottom:2px solid var(--el-color-primary); display:flex; justify-content:space-between; }
.column-count { color:var(--el-text-color-secondary); font-size:13px; }
.kanban-card { background:var(--el-bg-color); border-radius:8px; padding:12px; margin-bottom:8px; cursor:grab; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
.kanban-card:active { cursor:grabbing; }
.card-header { display:flex; justify-content:space-between; align-items:flex-start; }
.recur-icon { margin-right:4px; font-size:13px; }
.card-title { font-size:14px; font-weight:500; cursor:pointer; }
.card-title:hover { color:var(--el-color-primary); }
.card-delete { opacity:0; transition:opacity 0.2s; }
.kanban-card:hover .card-delete { opacity:1; }
.card-meta { display:flex; align-items:center; gap:6px; margin-top:6px; }
.card-date { font-size:12px; color:var(--el-text-color-secondary); }
.card-notes { margin-top:4px; }
.card-notes :deep(span) { font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; }
.card-children { margin-top:8px; border-top:1px solid var(--el-border-color-lighter); padding-top:6px; }
.children-toggle { font-size:12px; color:var(--el-color-primary); cursor:pointer; display:flex; align-items:center; }
.children-toggle:hover { text-decoration:underline; }
.children-list { margin-top:4px; padding-left:4px; }
.child-item { display:flex; align-items:center; gap:6px; padding:3px 0; font-size:13px; }
.child-title { flex:1; }
.child-title.done { text-decoration:line-through; color:var(--el-text-color-placeholder); }

.md-toolbar { display:flex; align-items:center; gap:6px; margin-bottom:6px; flex-shrink:0; }
.color-btn { width:22px; height:22px; border-radius:50%; cursor:pointer; border:2px solid transparent; transition:all 0.15s; display:inline-block; }
.color-btn:hover { border-color:var(--el-text-color-primary); transform:scale(1.15); }

.notes-editor {
  flex:1; min-height:80px; max-height:180px; overflow-y:auto;
  border:1px solid var(--el-border-color); border-radius:4px;
  padding:8px 12px; font-size:14px; line-height:1.6; outline:none;
  background:var(--el-input-bg-color, var(--el-bg-color));
  color:var(--el-text-color-primary);
}
.notes-editor:focus { border-color:var(--el-color-primary); }
.notes-wrap { display:flex; flex-direction:column; gap:0; }
.notes-editor:empty::before {
  content:attr(placeholder); color:var(--el-text-color-placeholder);
}

@media (max-width:768px) {
  .kanban { flex-direction:column; gap:12px; height:auto; overflow-y:auto; }
  .kanban-column { min-width:auto; max-height:50vh; }
}
</style>