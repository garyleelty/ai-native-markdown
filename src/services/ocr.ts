import { createWorker } from 'tesseract.js'

let worker: Tesseract.Worker | null = null

async function getWorker() {
  if (!worker) {
    worker = await createWorker('chi_sim+eng')
  }
  return worker
}

export async function extractTextFromImage(imageSource: string | File): Promise<string> {
  const w = await getWorker()
  const result = await w.recognize(imageSource)
  return result.data.text
}

export async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function terminateOCR() {
  if (worker) {
    await worker.terminate()
    worker = null
  }
}
