import { ref, computed, watch, type Ref } from 'vue'

export interface WritingSession {
  id: string
  startTime: Date
  endTime?: Date
  duration: number // in seconds
  wordsWritten: number
  charactersWritten: number
  filesModified: string[]
  productivity: number // words per minute
}

export interface WritingStats {
  totalSessions: number
  totalDuration: number // in seconds
  totalWords: number
  totalCharacters: number
  averageSessionDuration: number
  averageWordsPerSession: number
  averageProductivity: number
  longestSession: WritingSession | null
  mostProductiveSession: WritingSession | null
  dailyStats: DailyStats[]
  weeklyStats: WeeklyStats[]
  monthlyStats: MonthlyStats[]
}

export interface DailyStats {
  date: string
  sessions: number
  duration: number
  words: number
  productivity: number
}

export interface WeeklyStats {
  week: string
  sessions: number
  duration: number
  words: number
  productivity: number
}

export interface MonthlyStats {
  month: string
  sessions: number
  duration: number
  words: number
  productivity: number
}

export interface WritingGoal {
  type: 'daily' | 'weekly' | 'monthly'
  target: number
  metric: 'words' | 'duration' | 'sessions'
  current: number
  progress: number
}

export function useWritingAnalytics() {
  const sessions = ref<WritingSession[]>([])
  const currentSession = ref<WritingSession | null>(null)
  const goals = ref<WritingGoal[]>([])
  const isTracking = ref(false)

  // Start a new writing session
  function startSession() {
    if (currentSession.value) {
      endSession()
    }

    currentSession.value = {
      id: `session-${Date.now()}`,
      startTime: new Date(),
      duration: 0,
      wordsWritten: 0,
      charactersWritten: 0,
      filesModified: [],
      productivity: 0,
    }

    isTracking.value = true
  }

  // End current session
  function endSession() {
    if (!currentSession.value) return

    const session = currentSession.value
    session.endTime = new Date()
    session.duration = Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000)

    // Calculate productivity
    if (session.duration > 0) {
      session.productivity = Math.round((session.wordsWritten / (session.duration / 60)) * 100) / 100
    }

    sessions.value.push(session)
    currentSession.value = null
    isTracking.value = false
  }

  // Update current session stats
  function updateSessionStats(words: number, characters: number, file?: string) {
    if (!currentSession.value) return

    currentSession.value.wordsWritten = words
    currentSession.value.charactersWritten = characters

    if (file && !currentSession.value.filesModified.includes(file)) {
      currentSession.value.filesModified.push(file)
    }
  }

  // Calculate overall statistics
  const stats = computed<WritingStats>(() => {
    const allSessions = [...sessions.value]
    if (currentSession.value) {
      allSessions.push(currentSession.value)
    }

    if (allSessions.length === 0) {
      return {
        totalSessions: 0,
        totalDuration: 0,
        totalWords: 0,
        totalCharacters: 0,
        averageSessionDuration: 0,
        averageWordsPerSession: 0,
        averageProductivity: 0,
        longestSession: null,
        mostProductiveSession: null,
        dailyStats: [],
        weeklyStats: [],
        monthlyStats: [],
      }
    }

    const totalDuration = allSessions.reduce((sum, s) => sum + s.duration, 0)
    const totalWords = allSessions.reduce((sum, s) => sum + s.wordsWritten, 0)
    const totalCharacters = allSessions.reduce((sum, s) => sum + s.charactersWritten, 0)
    const averageSessionDuration = totalDuration / allSessions.length
    const averageWordsPerSession = totalWords / allSessions.length
    const averageProductivity = allSessions.reduce((sum, s) => sum + s.productivity, 0) / allSessions.length

    const longestSession = allSessions.reduce((longest, s) =>
      s.duration > (longest?.duration || 0) ? s : longest, null as WritingSession | null)

    const mostProductiveSession = allSessions.reduce((productive, s) =>
      s.productivity > (productive?.productivity || 0) ? s : productive, null as WritingSession | null)

    // Calculate daily stats
    const dailyStats = calculateDailyStats(allSessions)

    // Calculate weekly stats
    const weeklyStats = calculateWeeklyStats(allSessions)

    // Calculate monthly stats
    const monthlyStats = calculateMonthlyStats(allSessions)

    return {
      totalSessions: allSessions.length,
      totalDuration,
      totalWords,
      totalCharacters,
      averageSessionDuration,
      averageWordsPerSession,
      averageProductivity,
      longestSession,
      mostProductiveSession,
      dailyStats,
      weeklyStats,
      monthlyStats,
    }
  })

  // Calculate daily statistics
  function calculateDailyStats(sessions: WritingSession[]): DailyStats[] {
    const dailyMap = new Map<string, DailyStats>()

    for (const session of sessions) {
      const date = session.startTime.toISOString().split('T')[0]
      const existing = dailyMap.get(date) || {
        date,
        sessions: 0,
        duration: 0,
        words: 0,
        productivity: 0,
      }

      existing.sessions++
      existing.duration += session.duration
      existing.words += session.wordsWritten
      existing.productivity = (existing.productivity * (existing.sessions - 1) + session.productivity) / existing.sessions

      dailyMap.set(date, existing)
    }

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  // Calculate weekly statistics
  function calculateWeeklyStats(sessions: WritingSession[]): WeeklyStats[] {
    const weeklyMap = new Map<string, WeeklyStats>()

    for (const session of sessions) {
      const date = new Date(session.startTime)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const week = weekStart.toISOString().split('T')[0]

      const existing = weeklyMap.get(week) || {
        week,
        sessions: 0,
        duration: 0,
        words: 0,
        productivity: 0,
      }

      existing.sessions++
      existing.duration += session.duration
      existing.words += session.wordsWritten
      existing.productivity = (existing.productivity * (existing.sessions - 1) + session.productivity) / existing.sessions

      weeklyMap.set(week, existing)
    }

    return Array.from(weeklyMap.values()).sort((a, b) => a.week.localeCompare(b.week))
  }

  // Calculate monthly statistics
  function calculateMonthlyStats(sessions: WritingSession[]): MonthlyStats[] {
    const monthlyMap = new Map<string, MonthlyStats>()

    for (const session of sessions) {
      const date = new Date(session.startTime)
      const month = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`

      const existing = monthlyMap.get(month) || {
        month,
        sessions: 0,
        duration: 0,
        words: 0,
        productivity: 0,
      }

      existing.sessions++
      existing.duration += session.duration
      existing.words += session.wordsWritten
      existing.productivity = (existing.productivity * (existing.sessions - 1) + session.productivity) / existing.sessions

      monthlyMap.set(month, existing)
    }

    return Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month))
  }

  // Set a writing goal
  function setGoal(goal: Omit<WritingGoal, 'current' | 'progress'>) {
    const existingIndex = goals.value.findIndex(g => g.type === goal.type && g.metric === goal.metric)
    const newGoal: WritingGoal = {
      ...goal,
      current: 0,
      progress: 0,
    }

    if (existingIndex !== -1) {
      goals.value[existingIndex] = newGoal
    } else {
      goals.value.push(newGoal)
    }
  }

  // Update goal progress
  function updateGoals() {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    const week = weekStart.toISOString().split('T')[0]
    const month = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`

    for (const goal of goals.value) {
      let relevantSessions: WritingSession[] = []

      switch (goal.type) {
        case 'daily':
          relevantSessions = sessions.value.filter(s =>
            s.startTime.toISOString().split('T')[0] === today)
          break
        case 'weekly':
          relevantSessions = sessions.value.filter(s => {
            const sessionWeekStart = new Date(s.startTime)
            sessionWeekStart.setDate(s.startTime.getDate() - s.startTime.getDay())
            return sessionWeekStart.toISOString().split('T')[0] === week
          })
          break
        case 'monthly':
          relevantSessions = sessions.value.filter(s => {
            const sessionMonth = `${s.startTime.getFullYear()}-${(s.startTime.getMonth() + 1).toString().padStart(2, '0')}`
            return sessionMonth === month
          })
          break
      }

      switch (goal.metric) {
        case 'words':
          goal.current = relevantSessions.reduce((sum, s) => sum + s.wordsWritten, 0)
          break
        case 'duration':
          goal.current = relevantSessions.reduce((sum, s) => sum + s.duration, 0)
          break
        case 'sessions':
          goal.current = relevantSessions.length
          break
      }

      goal.progress = Math.min(100, Math.round((goal.current / goal.target) * 100))
    }
  }

  // Get writing streak
  const writingStreak = computed(() => {
    if (sessions.value.length === 0) return 0

    const dates = new Set(sessions.value.map(s =>
      s.startTime.toISOString().split('T')[0]))

    let streak = 0
    const today = new Date()
    let currentDate = new Date(today)

    while (true) {
      const dateStr = currentDate.toISOString().split('T')[0]
      if (dates.has(dateStr)) {
        streak++
        currentDate.setDate(currentDate.getDate() - 1)
      } else {
        break
      }
    }

    return streak
  })

  // Get most productive time of day
  const mostProductiveTime = computed(() => {
    if (sessions.value.length === 0) return null

    const hourStats = new Map<number, { totalWords: number; count: number }>()

    for (const session of sessions.value) {
      const hour = session.startTime.getHours()
      const existing = hourStats.get(hour) || { totalWords: 0, count: 0 }
      existing.totalWords += session.wordsWritten
      existing.count++
      hourStats.set(hour, existing)
    }

    let bestHour = 0
    let bestProductivity = 0

    for (const [hour, stats] of hourStats) {
      const productivity = stats.totalWords / stats.count
      if (productivity > bestProductivity) {
        bestProductivity = productivity
        bestHour = hour
      }
    }

    return {
      hour: bestHour,
      productivity: Math.round(bestProductivity),
      label: `${bestHour}:00 - ${bestHour + 1}:00`,
    }
  })

  // Clear all data
  function clearData() {
    sessions.value = []
    currentSession.value = null
    goals.value = []
    isTracking.value = false
  }

  return {
    sessions,
    currentSession,
    goals,
    isTracking,
    stats,
    writingStreak,
    mostProductiveTime,
    startSession,
    endSession,
    updateSessionStats,
    setGoal,
    updateGoals,
    clearData,
  }
}
