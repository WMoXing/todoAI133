const express = require('express');
const axios = require('axios');
const config = require('../config');
const { getData } = require('../data/store');
const router = express.Router();

const AUTH = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.deepseek.apiKey });

async function askDS(msgs, temp = 0.3, maxT = 500) {
  const r = await axios.post(config.deepseek.baseURL + '/v1/chat/completions',
    { model: 'deepseek-chat', messages: msgs, temperature: temp, max_tokens: maxT }, { headers: AUTH() });
  return r.data.choices[0].message.content;
}

function clean(t) { return t.trim().replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim(); }

// ── Helpers ──
function todayStr() { return new Date().toISOString().split('T')[0]; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().split('T')[0]; }
function dayName(d) { return ['周日','周一','周二','周三','周四','周五','周六'][new Date(d).getDay()]; }
function priorityLabel(p) { return p==='high'?'高':p==='medium'?'中':'低'; }

function buildTaskContext(tasks) {
  const active = tasks.filter(t => !t.deletedAt);
  const completed = active.filter(t => t.completed);
  const pending = active.filter(t => !t.completed);
  const today = todayStr();
  const weekEnd = addDays(today, 7);

  let ctx = '';

  ctx += '📊 统计:\n';
  ctx += '总任务: ' + active.length + ' | 已完成: ' + completed.length + ' | 待完成: ' + pending.length + '\n';

  const overdue = pending.filter(t => t.dueDate && t.dueDate < today);
  const dueToday = pending.filter(t => t.dueDate === today);
  const dueThisWeek = pending.filter(t => t.dueDate && t.dueDate > today && t.dueDate <= weekEnd);

  ctx += '逾期: ' + overdue.length + ' | 今日截止: ' + dueToday.length + ' | 本周截止: ' + dueThisWeek.length + '\n\n';

  if (overdue.length) {
    ctx += '⚠️ 逾期任务:\n';
    overdue.forEach(t => ctx += '- [' + priorityLabel(t.priority) + '] ' + t.title + ' (截止: ' + t.dueDate + ' ' + dayName(t.dueDate) + ')\n');
    ctx += '\n';
  }

  if (dueToday.length) {
    ctx += '📅 今日截止:\n';
    dueToday.forEach(t => ctx += '- [' + priorityLabel(t.priority) + '] ' + t.title + ' ' + t.status + '\n');
    ctx += '\n';
  }

  if (dueThisWeek.length) {
    ctx += '📅 本周截止:\n';
    dueThisWeek.forEach(t => ctx += '- [' + priorityLabel(t.priority) + '] ' + t.title + ' (截止: ' + t.dueDate + ' ' + dayName(t.dueDate) + ')\n');
    ctx += '\n';
  }

  const todoTasks = pending.filter(t => t.status === 'todo');
  const inProgress = pending.filter(t => t.status === 'in_progress');

  if (inProgress.length) {
    ctx += '🔄 进行中:\n';
    inProgress.forEach(t => ctx += '- [' + priorityLabel(t.priority) + '] ' + t.title + (t.dueDate ? ' 截止: ' + t.dueDate : '') + '\n');
    ctx += '\n';
  }

  if (todoTasks.length > 5) {
    ctx += '📋 待办 (前10个):\n';
    todoTasks.slice(0, 10).forEach(t => ctx += '- [' + priorityLabel(t.priority) + '] ' + t.title + (t.dueDate ? ' 截止: ' + t.dueDate : '') + '\n');
  } else if (todoTasks.length > 0) {
    ctx += '📋 待办:\n';
    todoTasks.forEach(t => ctx += '- [' + priorityLabel(t.priority) + '] ' + t.title + (t.dueDate ? ' 截止: ' + t.dueDate : '') + '\n');
  }

  const highP = pending.filter(t => t.priority === 'high' && t.status !== 'done');
  if (highP.length) {
    ctx += '\n🔴 高优先级待办:\n';
    highP.forEach(t => ctx += '- ' + t.title + (t.dueDate ? ' 截止: ' + t.dueDate : '') + '\n');
  }

  if (completed.length) {
    ctx += '\n✅ 已完成: ' + completed.length + ' 个';
  }

  return ctx || '暂无任务';
}

// ── /parse ──
router.post('/parse', async (req, res) => {
  const { text } = req.body; if (!text) return res.status(400).json({ error: 'no text' });
  const today = todayStr();
  try {
    const sys = 'You are a Chinese task parser. Parse Chinese user input into JSON.\nReturn ONLY the JSON object, no other text.\nFormat: {"title":"task in Chinese","dueDate":"YYYY-MM-DD or null","dueTime":"HH:mm or null","priority":"high|medium|low","tags":["tag"],"isRecurring":false,"recurrenceRule":null}\n- isRecurring: true if the task repeats (daily/weekly/monthly)\n- recurrenceRule: if isRecurring is true, set like {"frequency":"daily","interval":1} or {"frequency":"weekly","interval":1} or {"frequency":"monthly","interval":1}\nRules:\n- title: core task, remove time/priority words\n- Today is ' + today + '. "tomorrow"=next day. "3pm"=15:00\n- priority: important=high, not urgent=low, else medium\n- tags: shopping=购物, work=工作, study=学习, meeting=会议\n\nExample: "明天下午3点去超市买菜，很重要"\nOutput: {"title":"去超市买菜","dueDate":"2026-06-02","dueTime":"15:00","priority":"high","tags":["购物"],"isRecurring":false,"recurrenceRule":null}\nExample 2: "每天早上9点开站会"\nOutput: {"title":"每日站会","dueTime":"09:00","priority":"medium","tags":["工作"],"isRecurring":true,"recurrenceRule":{"frequency":"daily","interval":1}}';
    const content = await askDS([{ role: 'system', content: sys }, { role: 'user', content: text }], 0.1);
    res.json(JSON.parse(clean(content)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── /breakdown ──
router.post('/breakdown', async (req, res) => {
  const { taskTitle, taskNotes } = req.body; if (!taskTitle) return res.status(400).json({ error: 'no title' });
  try {
    const content = await askDS([
      { role: 'system', content: 'Break a complex task into 3-8 sub-steps. Return ONLY JSON array: [{"title":"step","priority":"high|medium|low"}]. Steps must be concrete and ordered.' },
      { role: 'user', content: 'Task: ' + taskTitle + (taskNotes ? '. Notes: ' + taskNotes : '') }
    ]);
    res.json(JSON.parse(clean(content)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── /chat (SSE, enhanced) ──
router.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message) return res.status(400).json({ error: 'no message' });

  const { tasks, chatSessions } = getData();
  const session = chatSessions.find(s => s.id === sessionId) || null;
  const today = todayStr();

  const taskContext = buildTaskContext(tasks);

  const hist = session ? session.messages.slice(-10).map(m => ({ role: m.role, content: m.content })) : [];

  const sys = `You are a Chinese task management assistant called "小助手". Today is ${today} (${dayName(today)}).

Reply in Chinese. Be friendly and concise.

When the user asks to CREATE a task, you MUST include a [TASK:JSON] block in your reply.
The JSON format: {"title":"任务名","priority":"high|medium|low","dueDate":"YYYY-MM-DD","tags":["标签"],"isRecurring":false,"recurrenceRule":null}

CRITICAL RULES for [TASK:JSON]:
- If the task repeats daily, set "isRecurring":true and "recurrenceRule":{"frequency":"daily","interval":1}
- If the task repeats weekly, set "isRecurring":true and "recurrenceRule":{"frequency":"weekly","interval":1}
- If the task repeats monthly, set "isRecurring":true and "recurrenceRule":{"frequency":"monthly","interval":1}
- If the task does NOT repeat, set "isRecurring":false and "recurrenceRule":null
- Detect recurrence from the user's words: 每天/每日=daily, 每周=weekly, 每月/每个月=monthly

Examples:
User: "添加每天早上9点健身"
Reply: 好的，已添加每日健身任务！[TASK:{"title":"健身","priority":"medium","dueTime":"09:00","isRecurring":true,"recurrenceRule":{"frequency":"daily","interval":1},"tags":["健康"]}]

User: "每周五下午开会"
Reply: 已创建每周会议！[TASK:{"title":"周会","priority":"high","dueDate":"2026-06-05","dueTime":"14:00","isRecurring":true,"recurrenceRule":{"frequency":"weekly","interval":1},"tags":["工作"]}]

User: "明天去买菜"
Reply: 好的！[TASK:{"title":"买菜","priority":"medium","dueDate":"2026-06-03","isRecurring":false,"recurrenceRule":null,"tags":["购物"]}]

Only add [TASK:] when the user explicitly asks to create a task. Do NOT add [TASK:] for questions or queries.
Each [TASK:] contains exactly one task.

=== Current Tasks ===
${taskContext}
=== End Tasks ===`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const resp = await axios.post(config.deepseek.baseURL + '/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: sys }, ...hist, { role: 'user', content: message }],
      stream: true, temperature: 0.7, max_tokens: 2000
    }, { headers: AUTH(), responseType: 'stream' });

    let full = '';
    resp.data.on('data', (c) => {
      const parts = c.toString().split('\n').filter(l => l.startsWith('data: '));
      for (const p of parts) {
        const d = p.replace('data: ', '').trim();
        if (d === '[DONE]') {
          res.write('data: [DONE]\n\n');
          if (session) {
            session.messages.push(
              { role: 'user', content: message, timestamp: new Date().toISOString() },
              { role: 'assistant', content: full, timestamp: new Date().toISOString() }
            );
            session.updatedAt = new Date().toISOString();
          }
          res.end();
          return;
        }
        try {
          const j = JSON.parse(d);
          const ct = j.choices?.[0]?.delta?.content || '';
          if (ct) { full += ct; res.write('data: ' + JSON.stringify({ content: ct }) + '\n\n'); }
        } catch {}
      }
    });
    resp.data.on('error', () => { res.write('data: ' + JSON.stringify({ error: 'err' }) + '\n\n'); res.end(); });
  } catch (e) {
    res.write('data: ' + JSON.stringify({ error: 'err' }) + '\n\n'); res.end();
  }
});

// Helper: detect and fix missing recurrence from user message
function enrichTaskFromUserMsg(taskData, userMessage) {
  const lower = (userMessage || '').toLowerCase();
  if (taskData.isRecurring) return taskData; // already set

  if (lower.includes('每天') || lower.includes('每日') || lower.includes('天天') || lower.includes('every day') || lower.includes('daily')) {
    taskData.isRecurring = true;
    taskData.recurrenceRule = { frequency: 'daily', interval: 1 };
  } else if (lower.includes('每周') || lower.includes('weekly') || lower.includes('every week')) {
    taskData.isRecurring = true;
    taskData.recurrenceRule = { frequency: 'weekly', interval: 1 };
  } else if (lower.includes('每月') || lower.includes('每个月') || lower.includes('monthly') || lower.includes('every month')) {
    taskData.isRecurring = true;
    taskData.recurrenceRule = { frequency: 'monthly', interval: 1 };
  }
  return taskData;
}

module.exports = router;