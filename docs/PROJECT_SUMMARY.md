# AI Todo 项目总结

> 一个 AI 增强的个人 Todo 应用  
> 技术栈：Vue 3 + Express.js + DeepSeek API + 缤纷云 S3  
> 部署：Render Web Service  
> 2026 年 6 月

---

## 一、项目概览

### 1.1 这是什么

一个面向个人使用的智能待办事项应用。核心亮点是**用 AI 做你的任务管家**——你可以用自然语言告诉它"明天下班前完成周报"，它会自动解析出标题、截止时间、优先级并创建任务。还可以跟 AI 对话，让它帮你回顾进度、分析哪些任务逾期了。

### 1.2 技术架构

```
┌─────────────────────────────────────────────┐
│                    用户                      │
└─────────────────┬───────────────────────────┘
                  │
     ┌────────────▼────────────┐
     │   Render Web Service    │
     │                        │
     │  ┌──────────────────┐  │
     │  │  Express 后端     │  │
     │  │  /api/*  路由     │  │
     │  └────────┬─────────┘  │
     │           │             │
     │  ┌────────▼─────────┐  │
     │  │  Vue 3 前端      │  │
     │  │  client/dist/    │  │
     │  └──────────────────┘  │
     └────────┬───────────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
┌───▼───┐ ┌──▼──┐ ┌────▼────┐
│DeepSeek│ │缤纷云│ │ 浏览器  │
│  API   │ │ S3  │ │ 本地    │
└───────┘ └─────┘ └─────────┘
```

**前端**：Vue 3 Composition API (`<script setup>`)、Element Plus 组件库、Pinia 状态管理、Vue Router  
**后端**：Express.js，所有数据存为单个 JSON 文件在缤纷云（AWS S3 兼容）上  
**AI**：DeepSeek API，三个端点——自然语言解析、任务拆解、流式对话  
**部署**：单个 Render Web Service 同时提供前端静态文件和后端 API

### 1.3 文件结构

```
codex-deepseek4.0-todoAI/
├── render.yaml              # Render 部署蓝图
├── package.json             # 根（concurrently 同时启动前后端）
├── server/
│   ├── .env.example         # 环境变量模板
│   ├── package.json
│   └── src/
│       ├── index.js         # Express 入口 + 静态文件服务 + SPA fallback
│       ├── config.js        # dotenv 配置
│       ├── data/store.js    # 缤纷云 S3 读写（单个 JSON 文件）
│       └── routes/
│           ├── tasks.js     # 任务 CRUD
│           ├── projects.js  # 项目 CRUD
│           ├── ai.js        # /parse /breakdown /chat (SSE)
│           └── chat.js      # 对话会话 CRUD
└── client/
    ├── vite.config.js       # Vite 配置 + 开发代理
    └── src/
        ├── main.js          # 入口（Element Plus + 中文语言包）
        ├── App.vue
        ├── router/index.js
        ├── api/index.js     # axios 实例 + 所有 API 函数
        ├── composables/
        │   └── useNotesEditor.js  # 备注编辑器共享逻辑
        ├── stores/
        │   ├── tasks.js     # Pinia 任务 store
        │   ├── projects.js
        │   └── app.js       # 深色模式
        ├── views/
        │   ├── TasksView.vue       # 主页（输入栏 + 筛选 + 列表/看板 + AI 侧栏）
        │   └── AIAssistantView.vue # 移动端全屏 AI 对话
        └── components/
            ├── layout/AppLayout.vue   # 顶栏 + 深色开关 + 回收站抽屉
            ├── tasks/TaskList.vue     # 列表视图 + 编辑弹窗 + 拆解弹窗
            ├── tasks/TaskKanban.vue   # 三列看板 + 拖拽移动
            └── ai/ChatPanel.vue       # SSE 流式 AI 对话
```

---

## 二、功能清单

| 模块 | 功能 | 技术实现 |
|------|------|----------|
| **CRUD** | 添加/编辑/删除/软删除+回收站恢复 | Express REST API + Pinia store |
| **任务层级** | 父子任务、缩进展开、子任务计数 | `parentId` + `childIds` 数组 |
| **列表视图** | 搜索、优先级/状态筛选、移动端折叠 | 防抖 300ms + Element Plus 组件 |
| **看板视图** | 三列拖拽、卡片子任务展开 | HTML5 Drag & Drop + computed childMap |
| **深色模式** | 一键切换、全局生效 | Pinia store + `html.dark` class + CSS 变量 |
| **重复任务** | 🔁 图标、编辑弹窗开关+规则配置 | `isRecurring` + `recurrenceRule` 字段 |
| **自然语言解析** | 输入"明天下午3点开会"自动创建 | DeepSeek /parse 端点 + JSON 响应 |
| **任务拆解** | 魔法棒按钮生成子任务 | DeepSeek /breakdown 端点 |
| **AI 对话** | SSE 流式聊天、查询/回顾/创建任务 | DeepSeek /chat 端点 + 平衡括号解析器 |
| **备注编辑器** | 8 色按钮 + contenteditable WYSIWYG | useNotesEditor composable |
| **移动端** | 底部导航、看板竖排、筛选面板 | CSS @media + 响应式布局 |
| **部署** | Render 一键部署 | render.yaml + Express 静态文件服务 |

---

## 三、技术决策与经验教训

### 3.1 DeepSeek API 使用心得

**教训 1：模型选择很重要**

用户 API Key 将所有模型映射到 `deepseek-v4-flash`。这个模型对**英文 system prompt 响应更好**——中文提示词下的结构化输出（如 JSON 格式）经常出错。最终方案：对话用中文，但 JSON 格式指令用英文写。

```javascript
// ❌ 不好的写法
const sys = `当用户要求添加任务时，回复中包含 [TASK:{"title":"任务名"...}]`

// ✅ 好的写法
const sys = `You are a Chinese task assistant.
When the user asks to CREATE a task, you MUST include a [TASK:JSON] block.
CRITICAL RULES for [TASK:JSON]:
- If the task repeats daily, set "isRecurring":true and "recurrenceRule":{"frequency":"daily","interval":1}
Examples:
User: "添加每天早上9点健身"
Reply: 好的！[TASK:{"title":"健身","priority":"medium","isRecurring":true,...}]`
```

**教训 2：结构化输出不可靠，需要防御性解析**

AI 输出的 `[TASK:JSON]` 可能缺字段、格式错误、或包含中文引号。项目做了三层防御：
- 后端系统提示词给出了明确的 JSON 格式和示例
- 前端 `enrichRecurring()` 从用户原始消息检测"每天/每周/每月"关键词补齐遗漏字段
- JSON 解析失败静默跳过，不阻塞对话流程

### 3.2 平衡括号解析器

**这是项目中踩得最深的坑。**

最初用正则 `\[TASK:(.*?)\]` 提取 AI 回复中的任务 JSON。测试时没问题，直到 AI 返回了包含数组标签的任务：

```json
[TASK:{"title":"测试","tags":["工作","学习"]}]
```

正则的 `.*?` 在遇到 `"工作","学习"]` 中的第一个 `]` 时就停止了匹配，导致 JSON 被截断：

```
// 实际匹配到的：{"title":"测试","tags":["工作，"}
//                              ↑ 在这里就断了
```

**修复：手写平衡括号解析器**

```javascript
function extractTaskBlocks(text) {
  const results = []
  let i = 0
  while ((i = text.indexOf('[TASK:', i)) !== -1) {
    const start = i + 6
    let depth = 1  // ← 从 1 开始，代表 [TASK: 外层容器
    let j = start
    for (; j < text.length; j++) {
      if (text[j] === '{' || text[j] === '[') depth++
      else if (text[j] === '}' || text[j] === ']') depth--
      if (depth === 0) break       // ← 归零时正好是 [TASK: 的闭合 ]
    }
    if (depth === 0) {
      results.push(text.substring(start, j))  // ← 不含尾部 ]
    }
    i = j + 1
  }
  return results
}
```

核心思路：用计数器追踪括号嵌套深度，而不是依赖正则的非贪婪匹配。

### 3.3 SSE 流式对话的坑

**坑 1：await 不能忘**

`parseAndCreateTasks` 里调 `taskStore.addTask()` 创建任务——这是个异步 API 调用。最初忘了 `await`，函数返回时 API 请求还没完成，任务实际没创建。

```javascript
// ❌ fire-and-forget：任务创建还没完成函数就返回了
taskStore.addTask({ title: taskData.title })

// ✅ 等待 API 完成
await taskStore.addTask({ title: taskData.title })
```

**坑 2：SSE chunk 边界**

DeepSeek 的流式响应按 chunk 到达，一个 SSE 消息可能跨多个 TCP 包。需要用 buffer 累积数据，按 `\n` 分割行，最后一行可能不完整要保留到下一个 chunk。

```javascript
buffer += decoder.decode(value, { stream: true })
const lines = buffer.split('\n')
buffer = lines.pop()  // 保留不完整的最后一行
```

### 3.4 PowerShell 编码灾难

**Windows PowerShell 处理 UTF-8 中文文件是噩梦。**

项目过程中多次出现：用 `Get-Content | Replace | Set-Content` 处理后，中文全部变成乱码。原因：
- `Get-Content` 默认编码不是 UTF-8
- `Set-Content` 默认用系统编码（GBK）
- `-replace` 操作符的字符串拼接容易引入编码问题

**最终方案：只用 `[System.IO.File]::WriteAllText`**

```powershell
# ❌ 会损坏中文
$t = Get-Content file.vue -Raw
$t = $t.Replace("old", "new")
Set-Content file.vue $t

# ✅ 安全
$t = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($f))
$t = $t.Replace("old", "new")
[System.IO.File]::WriteAllText($f, $t, [System.Text.UTF8Encoding]::new($false))
```

参数 `::new($false)` 表示**不带 BOM**，和 Vite 期望的编码一致。

### 3.5 contenteditable 所见即所得

备注字段最初用 `<textarea>`，加颜色按钮后用户看到的是原始 `<span style="color:red">文字</span>` 标签，体验很差。

换用 `<div contenteditable="true">` 后：
- 颜色按钮通过 `document.execCommand('foreColor', false, color)` 直接着色
- 如果没有选中文字，自动包裹全部内容为 `<span style="color:...">`
- 保存时取 `innerHTML`，加载时设 `innerHTML`
- 列表摘要通过 `v-html` 渲染，保留颜色效果

`contenteditable` 的 placeholder 效果用 CSS 实现：
```css
.notes-editor:empty::before {
  content: attr(placeholder);
  color: var(--el-text-color-placeholder);
}
```

### 3.6 Render 部署经验

**单服务架构**：Express 同时提供 API 和前端静态文件，只需一个 Render Web Service。

关键点：
- `render.yaml` 放在项目根目录，Render 蓝图表自动识别
- `buildCommand` 需要构建前端：`npm install && cd ../client && npm install && npm run build`
- Express 用 `express.static('client/dist')` + SPA fallback 提供前端
- 敏感变量（API Key）在 `render.yaml` 中标记 `sync: false`，部署后在 Render Dashboard 手动填写
- 免费实例 15 分钟无请求会休眠，首次访问需等约 30 秒唤醒

### 3.7 代码组织经验

**composable 提取**：TaskList.vue 和 TaskKanban.vue 原先各自定义了一套 `applyColor`、`clearColor`、`previewNotes` 等函数，完全相同。提取到 `useNotesEditor.js` composable 后，两个组件各减少约 15 行，且逻辑统一维护。

**死代码清理**：优化过程中发现了多个死代码——`watch` 导入未使用、`createTask` 导入未使用、后端 `enrichTaskFromUserMsg` 函数定义了从未调用、`filters.tag` 字段残留。清理后净减少 62 行。

---

## 四、AI 功能深度解析

### 4.1 三个 AI 端点

| 端点 | 用途 | 输入 | 输出 | 流式 |
|------|------|------|------|------|
| `POST /api/ai/parse` | 自然语言→结构化任务 | `"明天下午3点开会"` | `{title, dueDate, priority, tags}` | ❌ |
| `POST /api/ai/breakdown` | 复杂任务拆成子步骤 | `"搬家"` | `[{title, priority}, ...]` | ❌ |
| `POST /api/ai/chat` | 对话式任务管理 | `"这周有什么逾期任务？"` | 流式中文回复 + `[TASK:JSON]` | ✅ SSE |

### 4.2 对话上下文的构建策略

为了让 AI 能回答"哪些任务逾期了"、"本周有哪些截止"等问题，每次对话请求都会在 system prompt 中注入当前所有任务的结构化摘要：

```
📊 统计:
总任务: 12 | 已完成: 5 | 待完成: 7
逾期: 2 | 今日截止: 1 | 本周截止: 3

⚠️ 逾期任务:
- [高] 完成周报 (截止: 2026-06-01 周日)
- [中] 还书 (截止: 2026-06-02 周一)

📅 今日截止:
- [高] 提交代码 review
...
```

这个摘要由 `buildTaskContext()` 函数动态生成，按逾期→今日→本周→进行中→待办的优先级排列，AI 可以直接基于这些数据回答，不需要额外查询数据库。

### 4.3 AI 创建任务的完整链路

```
用户输入 "每天早上8点健身"
    ↓
前端 sendMessage() → POST /api/ai/chat
    ↓
后端构建 system prompt（含全量任务上下文）
    ↓
DeepSeek SSE 流式返回:
  "好的，已添加每日健身任务！[TASK:{"title":"健身","priority":"medium","isRecurring":true,"recurrenceRule":{"frequency":"daily","interval":1},"tags":["健康"]}]"
    ↓
前端 extractTaskBlocks() 平衡括号提取 JSON
    ↓
enrichRecurring() 从用户消息检测"每天"→补齐 recurring 字段
    ↓
await taskStore.addTask() → POST /api/tasks → 缤纷云持久化
    ↓
ElMessage.success('AI 已添加: 健身')
```

---

## 五、部署步骤速查

### 本地开发

```bash
# 根目录
npm run dev          # concurrently 同时启动前后端

# 或分开启动
cd server && npm run dev    # Express on :3001
cd client && npm run dev    # Vite on :5173 (proxy /api → :3001)
```

### Render 部署

1. `server/.env` → 填入 DeepSeek API Key + 缤纷云凭证
2. 推送代码到 GitHub
3. Render Dashboard → New Web Service → 连接仓库
4. 配置：
   - Root Directory: `server`
   - Build Command: `npm install && cd ../client && npm install && npm run build`
   - Start Command: `node src/index.js`
5. 添加环境变量：`DEEPSEEK_API_KEY`、`BITIFUL_ACCESS_KEY`、`BITIFUL_SECRET_KEY`、`BITIFUL_BUCKET`

---

## 六、未来可扩展方向

1. **键盘快捷键** — Ctrl+N 新建任务、Ctrl+K 搜索等
2. **Markdown 详情页** — 点击任务查看完整 Markdown 渲染的备注
3. **AI 更智能** — 多轮对话上下文、任务依赖关系分析、自动排期建议
4. **通知提醒** — 截止日期前浏览器通知
5. **多用户** — 登录系统、数据隔离

---

## 七、踩坑速记

| 坑 | 原因 | 解决 |
|----|------|------|
| AI 无法创建含标签的任务 | 正则 `.*?` 被 JSON 内 `]` 截断 | 手写平衡括号解析器 |
| AI 创建的任务"消失" | `async addTask` 没 `await` | 改为 `await taskStore.addTask()` |
| 中文文件变成乱码 | PowerShell `Set-Content` 编码问题 | 统一用 `[System.IO.File]::WriteAllText` |
| DeepSeek 不遵循中文格式指令 | flash 模型对英文 prompt 响应更好 | system prompt 中的格式指令改用英文 |
| Render 部署后 "Not Found" | `client/dist/` 未构建 | 构建命令加上 `npm run build`，Express 加降级页面 |
| 重复任务刷新后失效 | `editTask` 没同步 `editingIsRecurring` ref | 打开弹窗时从 task 数据同步到独立 ref |
| Vite 500 错误 | PowerShell 替换损坏了文件编码 | 完整重写文件而非字符串替换 |