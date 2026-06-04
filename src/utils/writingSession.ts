import { safeStorage } from './security'

const SESSION_KEY = 'writing_session'

export interface WritingSession {
  startTime: number
  totalWordsWritten: number
  lastWordCount: number
  isActive: boolean
}

export function startSession(currentWordCount: number): WritingSession {
  const session: WritingSession = {
    startTime: Date.now(),
    totalWordsWritten: 0,
    lastWordCount: currentWordCount,
    isActive: true
  }
  safeStorage.set(SESSION_KEY, session)
  return session
}

export function getActiveSession(): WritingSession | null {
  const session = safeStorage.get<WritingSession | null>(SESSION_KEY, null)
  if (!session?.isActive) return null
  if (Date.now() - session.startTime > 24 * 60 * 60 * 1000) {
    endSession()
    return null
  }
  return session
}

export function updateSession(currentWordCount: number): WritingSession {
  let session = getActiveSession()
  if (!session) session = startSession(currentWordCount)

  const diff = currentWordCount - session.lastWordCount
  if (diff > 0) session.totalWordsWritten += diff
  session.lastWordCount = currentWordCount

  safeStorage.set(SESSION_KEY, session)
  return session
}

export function endSession(): void {
  safeStorage.remove(SESSION_KEY)
}

export function getSessionDuration(session: WritingSession): string {
  const mins = Math.floor((Date.now() - session.startTime) / 60000)
  if (mins < 60) return `${mins} 分钟`
  return `${Math.floor(mins / 60)} 小时 ${mins % 60} 分钟`
}
