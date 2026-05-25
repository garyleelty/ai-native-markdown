export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed'
  content: string
  oldLineNo?: number
  newLineNo?: number
}

export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const result: DiffLine[] = []

  const m = oldLines.length
  const n = newLines.length

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  let i = m, j = n
  const tempResult: DiffLine[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      tempResult.push({ type: 'unchanged', content: oldLines[i - 1], oldLineNo: i, newLineNo: j })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tempResult.push({ type: 'added', content: newLines[j - 1], newLineNo: j })
      j--
    } else {
      tempResult.push({ type: 'removed', content: oldLines[i - 1], oldLineNo: i })
      i--
    }
  }

  tempResult.reverse()
  return tempResult
}
