import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'todo-reminder.tasks.v1'

let reminderAudioContext

function getReminderAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return null
  reminderAudioContext ||= new AudioContext()
  return reminderAudioContext
}

async function playReminderSound() {
  const audioContext = getReminderAudioContext()
  if (!audioContext) return false

  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }

  const startAt = audioContext.currentTime
  const frequencies = [880, 1175, 988]

  frequencies.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const noteStart = startAt + index * 0.18

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, noteStart)
    gain.gain.setValueAtTime(0.0001, noteStart)
    gain.gain.exponentialRampToValueAtTime(0.14, noteStart + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.16)

    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(noteStart)
    oscillator.stop(noteStart + 0.18)
  })

  return true
}

const seedTasks = [
  {
    id: crypto.randomUUID(),
    title: '整理今天的关键事项',
    notes: '把最重要的三件事放在上午处理。',
    dueAt: getDateTimeValue(1),
    priority: 'high',
    done: false,
    reminded: false,
    dismissed: false,
    lastAlertAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: '复盘未完成任务',
    notes: '',
    dueAt: getDateTimeValue(4),
    priority: 'medium',
    done: false,
    reminded: false,
    dismissed: false,
    lastAlertAt: null,
    createdAt: new Date().toISOString(),
  },
]

const priorityMeta = {
  high: { label: '高', className: 'priority-high' },
  medium: { label: '中', className: 'priority-medium' },
  low: { label: '低', className: 'priority-low' },
}

function getDateTimeValue(hoursFromNow = 0) {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function getDateTimeFromTimestamp(timestamp) {
  const date = new Date(timestamp)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function formatDateTime(value) {
  if (!value) return '未设置'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getTaskState(task) {
  if (task.done) return 'done'
  if (!task.dueAt) return 'open'
  if (new Date(task.dueAt).getTime() <= Date.now()) {
    return task.dismissed ? 'overdue' : 'ringing'
  }
  return 'upcoming'
}

function App() {
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : seedTasks
  })
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({
    title: '',
    notes: '',
    dueAt: getDateTimeValue(2),
    priority: 'medium',
  })
  const [notificationState, setNotificationState] = useState(
    'Notification' in window ? Notification.permission : 'unsupported',
  )
  const [soundState, setSoundState] = useState(
    'AudioContext' in window || 'webkitAudioContext' in window
      ? 'idle'
      : 'unsupported',
  )
  const tasksRef = useRef(tasks)

  useEffect(() => {
    tasksRef.current = tasks
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now()
      const dueTasks = tasksRef.current.filter((task) => {
        if (task.done || task.dismissed || !task.dueAt) return false
        if (new Date(task.dueAt).getTime() > now) return false

        return !task.lastAlertAt || now - task.lastAlertAt >= 10000
      })

      if (dueTasks.length === 0) return

      if (soundState === 'ready') {
        void playReminderSound()
      }

      if ('Notification' in window && Notification.permission === 'granted') {
        dueTasks.forEach((task) => {
          new Notification('待办提醒', {
            body: `${task.title} 到时间了`,
          })
        })
      }

      const dueTaskIds = new Set(dueTasks.map((task) => task.id))
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          dueTaskIds.has(task.id)
            ? { ...task, reminded: true, lastAlertAt: now }
            : task,
        ),
      )
    }, 1000)

    return () => window.clearInterval(timer)
  }, [soundState])

  const stats = useMemo(() => {
    return tasks.reduce(
      (result, task) => {
        const state = getTaskState(task)
        result.total += 1
        if (state === 'done') result.done += 1
        if (state === 'overdue') result.overdue += 1
        if (state === 'upcoming') result.upcoming += 1
        if (state === 'ringing') result.ringing += 1
        return result
      },
      { total: 0, done: 0, overdue: 0, upcoming: 0, ringing: 0 },
    )
  }, [tasks])

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => filter === 'all' || getTaskState(task) === filter)
      .sort((a, b) => {
        if (a.done !== b.done) return Number(a.done) - Number(b.done)
        if (!a.dueAt) return 1
        if (!b.dueAt) return -1
        return new Date(a.dueAt) - new Date(b.dueAt)
      })
  }, [filter, tasks])

  const nextTask = filteredTasks.find((task) => !task.done)

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.title.trim()) return

    setTasks((currentTasks) => [
      {
        id: crypto.randomUUID(),
        title: form.title.trim(),
        notes: form.notes.trim(),
        dueAt: form.dueAt,
        priority: form.priority,
        done: false,
        reminded: false,
        dismissed: false,
        lastAlertAt: null,
        createdAt: new Date().toISOString(),
      },
      ...currentTasks,
    ])

    setForm({
      title: '',
      notes: '',
      dueAt: getDateTimeValue(2),
      priority: 'medium',
    })
  }

  async function enableReminderSound() {
    if (soundState === 'unsupported') return

    try {
      const enabled = await playReminderSound()
      setSoundState(enabled ? 'ready' : 'unsupported')
    } catch {
      setSoundState('blocked')
    }
  }

  async function requestNotifications() {
    await enableReminderSound()

    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      setNotificationState(permission)
    }
  }

  function updateTask(id, updater) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === id ? { ...task, ...updater(task) } : task,
      ),
    )
  }

  function snoozeTask(id, minutes) {
    updateTask(id, (task) => {
      const currentDueTime = task.dueAt ? new Date(task.dueAt).getTime() : 0
      const baseTime = Math.max(Date.now(), currentDueTime)
      const dueAt = getDateTimeFromTimestamp(baseTime + minutes * 60 * 1000)

      return {
        dueAt,
        done: false,
        reminded: false,
        dismissed: false,
        lastAlertAt: null,
      }
    })
  }

  function stopReminder(id) {
    updateTask(id, () => ({
      done: true,
      reminded: true,
      dismissed: true,
      lastAlertAt: null,
    }))
  }

  function removeTask(id) {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id))
  }

  return (
    <main className="app-shell">
      <section className="summary-panel">
        <div>
          <p className="eyebrow">Todo Reminder</p>
          <h1>待办事项提醒</h1>
          <p className="intro">
            管理任务、设置时间，到点后在网页内标记并触发浏览器通知。
          </p>
        </div>
        <div className="reminder-controls">
          <button
            className="notify-button"
            type="button"
            disabled={
              notificationState !== 'default' && soundState === 'ready'
            }
            onClick={requestNotifications}
          >
            {notificationState === 'granted'
              ? '通知已开启'
              : notificationState === 'denied'
                ? '通知被阻止'
                : notificationState === 'unsupported'
                  ? '开启声音'
                  : '开启通知和声音'}
          </button>
          <button
            className="sound-button"
            type="button"
            disabled={soundState === 'unsupported'}
            onClick={enableReminderSound}
          >
            {soundState === 'ready'
              ? '测试声音'
              : soundState === 'blocked'
                ? '再次开启声音'
                : soundState === 'unsupported'
                  ? '不支持声音'
                  : '开启声音'}
          </button>
        </div>
      </section>

      <section className="dashboard">
        <article className="focus-card">
          <span>下一项</span>
          <strong>{nextTask ? nextTask.title : '当前没有待处理任务'}</strong>
          <small>{nextTask ? formatDateTime(nextTask.dueAt) : '可以放心休息一下'}</small>
        </article>
        <article>
          <span>全部</span>
          <strong>{stats.total}</strong>
        </article>
        <article>
          <span>即将</span>
          <strong>{stats.upcoming}</strong>
        </article>
        <article>
          <span>提醒中</span>
          <strong>{stats.ringing}</strong>
        </article>
      </section>

      <section className="workspace">
        <form className="task-form" onSubmit={handleSubmit}>
          <label>
            任务
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="例如：16:00 回电话"
            />
          </label>

          <label>
            备注
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="补充地点、资料或上下文"
            />
          </label>

          <div className="form-row">
            <label>
              提醒时间
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, dueAt: event.target.value }))
                }
              />
            </label>

            <label>
              优先级
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value,
                  }))
                }
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </label>
          </div>

          <button className="primary-button" type="submit">
            添加待办
          </button>
        </form>

        <section className="task-panel">
          <div className="filters" aria-label="任务筛选">
            {[
              ['all', '全部'],
              ['upcoming', '即将'],
              ['ringing', '提醒中'],
              ['done', '完成'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? 'active' : ''}
                type="button"
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="task-list">
            {filteredTasks.length === 0 ? (
              <div className="empty-state">这个分类里暂时没有任务。</div>
            ) : (
              filteredTasks.map((task) => {
                const state = getTaskState(task)
                const priority = priorityMeta[task.priority]

                return (
                  <article className={`task-item ${state}`} key={task.id}>
                    <label className="check-control">
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={(event) =>
                          updateTask(task.id, () => ({
                            done: event.target.checked,
                            reminded: event.target.checked,
                            dismissed: event.target.checked,
                            lastAlertAt: null,
                          }))
                        }
                      />
                      <span></span>
                    </label>

                    <div className="task-content">
                      <div className="task-title-row">
                        <h2>{task.title}</h2>
                        <span className={`priority ${priority.className}`}>
                          {priority.label}
                        </span>
                      </div>
                      {task.notes && <p>{task.notes}</p>}
                      <div className="task-meta">
                        <span>{formatDateTime(task.dueAt)}</span>
                        <span>
                          {state === 'overdue'
                            ? '已逾期'
                            : state === 'ringing'
                              ? '正在提醒'
                            : state === 'done'
                              ? '已完成'
                              : task.reminded
                                ? '已提醒'
                                : '等待提醒'}
                        </span>
                      </div>
                    </div>

                    <div className="task-actions">
                      {state === 'ringing' && (
                        <button
                          className="stop-button"
                          type="button"
                          onClick={() => stopReminder(task.id)}
                        >
                          终止提醒
                        </button>
                      )}
                      <button type="button" onClick={() => snoozeTask(task.id, 10)}>
                        10 分钟后
                      </button>
                      <button type="button" onClick={() => removeTask(task.id)}>
                        删除
                      </button>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
