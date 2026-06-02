<template>
  <div class="task-list">
    <template v-for="task in rootTasks" :key="task.id">
      <!-- Parent task -->
      <div class="task-item parent" :class="{ 'has-children': actualChildren(task).length }">
        <el-checkbox :model-value="task.completed" @change="(val) => toggleComplete(task, val)" />
        <div class="task-info" @click="editTask(task)">
          <div class="task-title" :class="{ completed: task.completed }"><span v-if="task.isRecurring" class="recur-icon">&#x1F501;</span>{{ task.title }}</div>
          <div class="task-notes-preview" v-if="task.notes">{{ truncateNotes(task.notes) }}</div>
          <div class="task-meta">
            <el-tag v-if="task.priority==='high'" type="danger" size="small">高</el-tag>
            <el-tag v-else-if="task.priority==='medium'" type="warning" size="small">中</el-tag>
            <el-tag v-else type="info" size="small">低</el-tag>
            <el-tag v-for="tag in task.tags" :key="tag" size="small">{{ tag }}</el-tag>
            <span v-if="task.dueDate" class="due-date">{{ formatDate(task.dueDate) }}</span>
            <span v-if="actualChildren(task).length" class="child-badge" @click.stop="toggleExpand(task.id)">
              <el-icon style="margin-right:2px"><component :is="expanded.has(task.id)?CaretBottom:CaretRight" /></el-icon>
              {{ completedChildren(task) }}/{{ task.childIds.length }} 子任务
            </span>
          </div>
        </div>
        <div class="task-actions">
          <el-tooltip content="AI 拆解" placement="top">
            <el-button :icon="MagicStick" size="small" text @click.stop="startBreakdown(task)" :loading="breakdownLoading===task.id" />
          </el-tooltip>
          <el-button v-if="task.status!=='in_progress'" :icon="VideoPlay" size="small" text @click.stop="setStatus(task,'in_progress')" />
          <el-button :icon="Delete" size="small" text @click.stop="handleDelete(task)" />
        </div>
      </div>

      <!-- Child tasks -->
      <template v-if="actualChildren(task).length && expanded.has(task.id)">
        <div v-for="childId in actualChildren(task)" :key="childId" class="child-wrapper">
          <div v-if="getChild(childId)" class="task-item child">
            <div class="child-indent"><span class="child-line"></span></div>
            <el-checkbox :model-value="getChild(childId).completed" @change="(val) => toggleComplete(getChild(childId), val)" size="small" />
            <div class="task-info" @click="editTask(getChild(childId))">
              <div class="task-title" :class="{ completed: getChild(childId).completed }"><span v-if="getChild(childId).isRecurring" class="recur-icon">&#x1F501;</span>{{ getChild(childId).title }}</div>
              <div class="task-notes-preview" v-if="getChild(childId).notes">{{ truncateNotes(getChild(childId).notes) }}</div>
              <div class="task-meta">
                <el-tag v-if="getChild(childId).priority==='high'" type="danger" size="small">高</el-tag>
                <el-tag v-else-if="getChild(childId).priority==='medium'" type="warning" size="small">中</el-tag>
                <el-tag v-else type="info" size="small">低</el-tag>
                <span v-if="getChild(childId).dueDate" class="due-date">{{ formatDate(getChild(childId).dueDate) }}</span>
              </div>
            </div>
            <div class="task-actions">
              <el-button v-if="getChild(childId).status!=='in_progress'" :icon="VideoPlay" size="small" text @click.stop="setStatus(getChild(childId),'in_progress')" />
              <el-button :icon="Delete" size="small" text @click.stop="handleDelete(getChild(childId))" />
            </div>
          </div>
        </div>
      </template>
    </template>

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
        <el-form-item label="截止日期">
          <el-date-picker v-model="editingTask.dueDate" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editingTask.status">
            <el-option value="todo" label="待办" />
            <el-option value="in_progress" label="进行中" />
            <el-option value="done" label="已完成" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <div class="md-toolbar">
            <el-button size="small" @click="applyBold" title="加粗"><b>B</b></el-button>
            <el-color-picker size="small" @change="applyColor" :show-alpha="false" :predefine="predefineColors" />
          </div>
          <el-input ref="notesRef" v-model="editingTask.notes" type="textarea" :rows="4" placeholder="支持 Markdown" />
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

    <!-- Breakdown dialog -->
    <el-dialog v-model="breakdownVisible" title="AI 任务拆解" width="540px">
      <div v-if="breakdownLoading" style="padding:40px 0;text-align:center">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p style="margin-top:12px;color:var(--el-text-color-secondary)">AI 正在分析任务...</p>
      </div>
      <div v-else>
        <p style="margin-bottom:12px;color:var(--el-text-color-secondary)">将 <strong>{{ breakdownTask?.title }}</strong> 拆解为：</p>
        <div v-for="(step, i) in breakdownSteps" :key="i" class="step-row">
          <el-input v-model="step.title" placeholder="子步骤标题" size="default" style="flex:1" />
          <el-select v-model="step.priority" size="default" style="width:80px">
            <el-option value="high" label="高" />
            <el-option value="medium" label="中" />
            <el-option value="low" label="低" />
          </el-select>
          <el-button :icon="Delete" size="small" text type="danger" @click="breakdownSteps.splice(i,1)" />
        </div>
        <el-button style="margin-top:8px" size="small" @click="breakdownSteps.push({title:'',priority:'medium'})">+ 添加步骤</el-button>
      </div>
      <template #footer>
        <el-button @click="breakdownVisible=false">取消</el-button>
        <el-button type="primary" @click="confirmBreakdown" :disabled="!breakdownSteps.length">确认生成 ({{ breakdownSteps.length }} 个子任务)</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { VideoPlay, Delete, MagicStick, Loading, CaretRight, CaretBottom } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useTaskStore } from '../../stores/tasks'
import { breakdownTask as breakdownApi } from '../../api'

const taskStore = useTaskStore()
const dialogVisible = ref(false)
const editingTask = ref(null)
const editingTaskRecurrence = ref({ interval: 1, frequency: 'daily' })
const editingIsRecurring = ref(false)
const expanded = ref(new Set())
const notesRef = ref(null)

const breakdownVisible = ref(false)
const breakdownLoading = ref(false)
const breakdownTask = ref(null)
const breakdownSteps = ref([])

const predefineColors = ['#f56c6c', '#e6a23c', '#67c23a', '#409eff', '#909399']

const rootTasks = computed(() => taskStore.activeTasks.filter(t => !t.parentId))
function getChild(id) { return taskStore.tasks.find(t => t.id === id) }
function actualChildren(task) { if (task.childIds?.length) return task.childIds; return taskStore.tasks.filter(t => t.parentId===task.id && !t.deletedAt).map(t=>t.id) }
function toggleExpand(id) { if (expanded.value.has(id)) expanded.value.delete(id); else expanded.value.add(id); expanded.value = new Set(expanded.value) }
function completedChildren(task) { const ids = actualChildren(task); if (!ids.length) return 0; return ids.filter(id => taskStore.tasks.find(t => t.id === id)?.completed).length }

function toggleComplete(task, val) { taskStore.editTask(task.id, { completed: val, status: val ? 'done' : 'todo' }) }
function setStatus(task, status) { taskStore.editTask(task.id, { status }) }

function editTask(task) {
  editingTask.value = { ...task }
  editingIsRecurring.value = task.isRecurring || false
  editingTaskRecurrence.value = task.recurrenceRule || { interval: 1, frequency: 'daily' }
  dialogVisible.value = true
}

async function saveEdit() {
  editingTask.value.isRecurring = editingIsRecurring.value
  editingTask.value.recurrenceRule = editingIsRecurring.value ? editingTaskRecurrence.value : null
  await taskStore.editTask(editingTask.value.id, editingTask.value)
  dialogVisible.value = false
  ElMessage.success('已更新')
}

async function handleDelete(task) { await taskStore.removeTask(task.id); ElMessage.success('已移至回收站') }

function truncateNotes(notes) {
  if (!notes) return ''
  const plain = notes.replace(/<[^>]+>/g, '').replace(/[*_~`#]/g, '').trim()
  return plain.length > 40 ? plain.substring(0, 40) + '...' : plain
}

// ── Markdown toolbar ──
function getTextarea() { return notesRef.value?.$el?.querySelector('textarea') || notesRef.value?.textarea }

function applyBold() {
  const el = getTextarea(); if (!el) return
  const text = editingTask.value.notes || ''
  const start = el.selectionStart; const end = el.selectionEnd
  const hasSelection = start !== end
  if (hasSelection) {
    const selected = text.substring(start, end)
    editingTask.value.notes = text.substring(0, start) + '**' + selected + '**' + text.substring(end)
    nextTick(() => { el.focus(); el.setSelectionRange(start + 2, start + 2 + selected.length) })
  } else {
    editingTask.value.notes = text.substring(0, start) + '**粗体**' + text.substring(start)
    nextTick(() => { el.focus(); el.setSelectionRange(start + 2, start + 4) })
  }
}

function applyColor(color) {
  const el = getTextarea(); if (!el) return
  const text = editingTask.value.notes || ''
  const start = el.selectionStart; const end = el.selectionEnd
  const hasSelection = start !== end
  if (hasSelection) {
    const selected = text.substring(start, end)
    editingTask.value.notes = text.substring(0, start) + '<span style="color:' + color + '">' + selected + '</span>' + text.substring(end)
  } else {
    editingTask.value.notes = text.substring(0, start) + '<span style="color:' + color + '">文字</span>' + text.substring(start)
  }
  nextTick(() => { el.focus() })
}

async function startBreakdown(task) {
  breakdownTask.value = task; breakdownVisible.value = true; breakdownLoading.value = true; breakdownSteps.value = []
  try { const steps = await breakdownApi(task.title, task.notes); breakdownSteps.value = steps.map(s => ({ title: s.title, priority: s.priority || 'medium' })) }
  catch { ElMessage.error('AI 拆解失败'); breakdownVisible.value = false }
  breakdownLoading.value = false
}

async function confirmBreakdown() {
  const parent = breakdownTask.value; const steps = breakdownSteps.value.filter(s => s.title.trim())
  if (!steps.length || !parent) return
  const childIds = []
  for (const step of steps) { const child = await taskStore.addTask({ title: step.title.trim(), priority: step.priority, parentId: parent.id, projectId: parent.projectId, aiGenerated: true, aiParentId: parent.id }); childIds.push(child.id) }
  const allIds = [...new Set([...(parent.childIds||[]), ...childIds])]; await taskStore.editTask(parent.id, { childIds: allIds })
  expanded.value.add(parent.id); expanded.value = new Set(expanded.value); breakdownVisible.value = false
  ElMessage.success('已生成 ' + steps.length + ' 个子任务')
}

function formatDate(date) { if (!date) return ''; return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) }
</script>

<style scoped>
.task-item { display:flex; align-items:center; padding:12px 0; gap:12px; border-bottom:1px solid var(--el-border-color-lighter); }
.task-item.parent.has-children { border-bottom:none; }
.task-item.child { padding:8px 0 8px 0; }
.task-info { flex:1; cursor:pointer; min-width:0; }
.recur-icon { margin-right:4px; font-size:13px; }
.task-title { font-size:15px; margin-bottom:2px; }
.task-item.child .task-title { font-size:14px; color:var(--el-text-color-regular); }
.task-title.completed { text-decoration:line-through; color:var(--el-text-color-placeholder); }
.task-notes-preview { font-size:12px; color:var(--el-text-color-placeholder); margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:320px; }
.task-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.due-date { font-size:12px; color:var(--el-text-color-secondary); }
.child-badge { font-size:12px; color:var(--el-color-primary); cursor:pointer; display:inline-flex; align-items:center; }
.child-badge:hover { text-decoration:underline; }
.task-actions { flex-shrink:0; opacity:0; transition:opacity 0.2s; display:flex; gap:2px; }
.task-item:hover .task-actions { opacity:1; }
.child-wrapper { position:relative; }
.child-indent { width:40px; flex-shrink:0; display:flex; justify-content:flex-end; padding-right:8px; position:relative; }
.child-line { display:block; width:1.5px; height:100%; background:var(--el-border-color); position:relative; }
.child-line::after { content:''; position:absolute; bottom:50%; left:0; width:12px; height:1.5px; background:var(--el-border-color); }
.step-row { display:flex; gap:8px; margin-bottom:8px; align-items:center; }

.md-toolbar { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
.md-toolbar .el-button { min-width:28px; height:28px; padding:0 6px; font-size:12px; }
</style>