import type { AppState, BabyKey, BabyConfig, TSBReading, PhototherapySession } from './types'

const STORAGE_KEY = 'bilirubin-diary-v1'

const DEFAULT_STATE: AppState = {
  babies: {
    a: {
      key: 'a',
      name: '아둥이',
      birthAt: '',
      gestationalWeeks: 38,
      hasRiskFactors: false
    },
    b: {
      key: 'b',
      name: '바둥이',
      birthAt: '',
      gestationalWeeks: 38,
      hasRiskFactors: false
    }
  },
  readings: [],
  phototherapy: [],
  lastUpdated: new Date().toISOString()
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE))
    return JSON.parse(raw)
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_STATE))
  }
}

export function saveState(state: AppState): void {
  state.lastUpdated = new Date().toISOString()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function exportState(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bilirubin-diary-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importState(file: File): Promise<AppState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as AppState
        resolve(data)
      } catch {
        reject(new Error('파일 형식이 올바르지 않습니다'))
      }
    }
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsText(file)
  })
}

export function calcHoursOfAge(babyBirthAt: string, measuredAt?: string): number {
  if (!babyBirthAt) return 0
  const birth = new Date(babyBirthAt)
  const measured = measuredAt ? new Date(measuredAt) : new Date()
  return Math.max(0, (measured.getTime() - birth.getTime()) / (1000 * 60 * 60))
}
