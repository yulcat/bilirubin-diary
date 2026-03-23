export type BabyKey = 'a' | 'b'

export interface TSBReading {
  id: string
  babyKey: BabyKey
  tsb: number        // mg/dL
  hoursOfAge: number // hours since birth
  recordedAt: string // ISO datetime
  note?: string
  location?: string  // 병원명 etc
  underPhototherapy?: boolean
}

export interface PhototherapySession {
  id: string
  babyKey: BabyKey
  startAt: string   // ISO
  endAt?: string    // ISO, undefined = ongoing
  hospitalName?: string
  lightColor?: string // 광선 색상 정보
  note?: string
}

export interface BabyConfig {
  key: BabyKey
  name: string      // 아둥이 or 바둥이
  birthAt: string   // ISO datetime (출생 시각)
  gestationalWeeks: number // 재태주수
  hasRiskFactors: boolean  // isoimmune disease, G6PD deficiency, etc
}

export interface AppState {
  babies: Record<BabyKey, BabyConfig>
  readings: TSBReading[]
  phototherapy: PhototherapySession[]
  lastUpdated: string
}
