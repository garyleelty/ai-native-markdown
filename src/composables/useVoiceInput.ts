import { ref, onUnmounted } from 'vue'
import type { Ref } from 'vue'

export type VoiceInputMode = 'hold' | 'toggle'
export type VoiceInputStatus = 'idle' | 'listening' | 'recognizing' | 'error'

export interface UseVoiceInputOptions {
  language?: string
  continuous?: boolean
  interimResults?: boolean
  onResult?: (text: string, isFinal: boolean) => void
  onError?: (error: string) => void
}

export interface UseVoiceInputReturn {
  status: Ref<VoiceInputStatus>
  transcript: Ref<string>
  interimTranscript: Ref<string>
  isSupported: boolean
  error: Ref<string | null>
  startListening: () => void
  stopListening: () => void
  toggleListening: () => void
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: ((event: Event) => void) | null
  onstart: ((event: Event) => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
}

function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  return SR ? SR : null
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const {
    language = 'zh-CN',
    continuous = false,
    interimResults = true,
    onResult,
    onError,
  } = options

  const status = ref<VoiceInputStatus>('idle')
  const transcript = ref('')
  const interimTranscript = ref('')
  const error = ref<string | null>(null)

  const SpeechRecognitionCtor = getSpeechRecognition()
  const isSupported = !!SpeechRecognitionCtor

  let recognition: SpeechRecognition | null = null
  let disposed = false

  const isCurrentRecognition = (rec: SpeechRecognition) => !disposed && recognition === rec

  const detachRecognitionHandlers = (rec: SpeechRecognition) => {
    rec.onstart = null
    rec.onresult = null
    rec.onerror = null
    rec.onend = null
  }

  const createRecognition = (): SpeechRecognition | null => {
    if (!SpeechRecognitionCtor) return null
    try {
      const rec = new SpeechRecognitionCtor() as SpeechRecognition
      rec.lang = language
      rec.continuous = continuous
      rec.interimResults = interimResults
      rec.maxAlternatives = 1

      rec.onstart = () => {
        if (!isCurrentRecognition(rec)) return
        status.value = 'listening'
        error.value = null
      }

      rec.onresult = (event: SpeechRecognitionEvent) => {
        if (!isCurrentRecognition(rec)) return
        let finalTranscript = ''
        let interim = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript
          } else {
            interim += result[0].transcript
          }
        }

        if (finalTranscript) {
          transcript.value += finalTranscript
          onResult?.(finalTranscript, true)
        }

        interimTranscript.value = interim
        if (interim) {
          onResult?.(interim, false)
        }
      }

      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (!isCurrentRecognition(rec)) return
        let errorMsg = ''
        switch (event.error) {
          case 'no-speech':
            errorMsg = '未检测到语音，请重试'
            break
          case 'audio-capture':
            errorMsg = '未检测到麦克风设备'
            break
          case 'not-allowed':
            errorMsg = '请允许麦克风权限以使用语音输入'
            break
          case 'network':
            errorMsg = '网络错误，语音识别服务不可用'
            break
          case 'aborted':
            errorMsg = ''
            break
          default:
            errorMsg = `语音识别失败: ${event.error}`
        }

        if (errorMsg) {
          error.value = errorMsg
          status.value = 'error'
          onError?.(errorMsg)
        }
      }

      rec.onend = () => {
        if (!isCurrentRecognition(rec)) return
        if (status.value === 'listening' || status.value === 'recognizing') {
          status.value = 'idle'
        }
        recognition = null
      }

      return rec
    } catch {
      return null
    }
  }

  const startListening = () => {
    if (!isSupported) {
      const msg = '当前浏览器不支持语音输入，请使用 Chrome/Edge/Safari'
      error.value = msg
      status.value = 'error'
      onError?.(msg)
      return
    }

    if (status.value === 'listening') return

    transcript.value = ''
    interimTranscript.value = ''
    error.value = null

    try {
      recognition = createRecognition()
      if (recognition) {
        recognition.start()
      } else {
        const msg = '初始化语音识别失败'
        error.value = msg
        status.value = 'error'
        onError?.(msg)
      }
    } catch (e: any) {
      const msg = `启动语音识别失败: ${e?.message || String(e)}`
      error.value = msg
      status.value = 'error'
      onError?.(msg)
    }
  }

  const stopListening = () => {
    if (recognition) {
      try {
        recognition.stop()
      } catch {
        // ignore
      }
      recognition = null
    }
  }

  const toggleListening = () => {
    if (status.value === 'listening') {
      stopListening()
    } else {
      startListening()
    }
  }

  onUnmounted(() => {
    disposed = true
    if (recognition) {
      const rec = recognition
      recognition = null
      detachRecognitionHandlers(rec)
      try {
        rec.abort()
      } catch {
        // ignore
      }
    }
  })

  return {
    status,
    transcript,
    interimTranscript,
    isSupported,
    error,
    startListening,
    stopListening,
    toggleListening,
  }
}
