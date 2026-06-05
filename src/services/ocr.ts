import { createWorker } from 'tesseract.js'

let worker: Tesseract.Worker | null = null
let workerPromise: Promise<Tesseract.Worker> | null = null

async function getWorker() {
  if (worker) return worker

  if (!workerPromise) {
    workerPromise = createWorker('chi_sim+eng')
      .then((createdWorker) => {
        worker = createdWorker
        return createdWorker
      })
      .catch((error) => {
        workerPromise = null
        throw error
      })
  }

  return workerPromise
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
  const activeWorker = worker ?? (workerPromise ? await workerPromise.catch(() => null) : null)
  worker = null
  workerPromise = null
  await activeWorker?.terminate()
}
