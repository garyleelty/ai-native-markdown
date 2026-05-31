import { ElNotification, ElMessage } from 'element-plus'

export const notify = {
  success: (title: string, message?: string) => {
    ElNotification({ title, message: message || '', type: 'success', duration: 3000 })
  },
  error: (title: string, message?: string) => {
    ElNotification({ title, message: message || '', type: 'error', duration: 5000 })
  },
  warning: (title: string, message?: string) => {
    ElNotification({ title, message: message || '', type: 'warning', duration: 4000 })
  },
  info: (title: string, message?: string) => {
    ElNotification({ title, message: message || '', type: 'info', duration: 3000 })
  },
  toast: {
    success: (msg: string) => ElMessage.success(msg),
    error: (msg: string) => ElMessage.error(msg),
    warning: (msg: string) => ElMessage.warning(msg),
    info: (msg: string) => ElMessage.info(msg),
  }
}
