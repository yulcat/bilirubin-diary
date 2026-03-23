// Bhutani Nomogram (1999, AAP 2004 guideline)
// Risk zones based on hour-specific bilirubin levels
// Source: Bhutani VK et al. Pediatrics 1999;103:6-14
// AAP 2004 clinical practice guideline

// Nomogram curves (hours of age → TSB mg/dL)
// Hour samples at: 0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120
// 40th, 75th, 95th percentile reference curves

export type RiskZone =
  | 'low'        // < 40th percentile
  | 'low-intermediate'  // 40th–75th
  | 'high-intermediate' // 75th–95th
  | 'high'       // > 95th (high risk)

// AAP 2004 phototherapy thresholds for ≥38 weeks, no risk factors (mg/dL)
// By hour of age
export const PHOTO_THRESHOLD_LOW_RISK: [number, number][] = [
  [0, 10], [12, 12], [18, 12.5], [24, 13], [36, 14.5],
  [48, 15], [60, 16], [72, 17], [84, 17.5], [96, 18],
  [108, 19], [120, 20], [144, 21], [168, 21]
]

// AAP 2004 phototherapy thresholds for 35-37 6/7 weeks gestation (lower risk)
export const PHOTO_THRESHOLD_MED_RISK: [number, number][] = [
  [0, 8], [12, 10], [18, 10.5], [24, 11], [36, 12.5],
  [48, 13], [60, 14], [72, 15], [84, 16], [96, 17],
  [108, 17.5], [120, 18], [144, 19], [168, 20]
]

// Bhutani nomogram percentile curves
// [hoursOfAge, p40, p75, p95] 
export const BHUTANI_CURVES: [number, number, number, number][] = [
  [0,   5.0,  6.5,  8.5],
  [6,   5.5,  7.0,  9.0],
  [12,  6.5,  8.5, 11.0],
  [18,  7.5,  9.5, 12.5],
  [24,  8.5, 11.0, 14.0],
  [30,  9.5, 12.0, 15.0],
  [36, 10.0, 13.0, 16.0],
  [42, 10.5, 13.5, 16.5],
  [48, 11.0, 14.0, 17.0],
  [54, 11.0, 14.0, 17.5],
  [60, 11.0, 14.0, 17.5],
  [66, 11.0, 13.8, 17.5],
  [72, 11.0, 13.5, 17.0],
  [84, 10.5, 13.0, 16.5],
  [96, 10.0, 12.5, 16.0],
  [120, 9.5, 12.0, 15.5],
  [144, 9.0, 11.5, 15.0],
  [168, 8.5, 11.0, 14.5],
]

// Linear interpolation helper
function lerp(x0: number, y0: number, x1: number, y1: number, x: number): number {
  if (x <= x0) return y0
  if (x >= x1) return y1
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
}

// Get percentile values at a given hour
export function getBhutaniAt(hoursOfAge: number): { p40: number; p75: number; p95: number } {
  const curves = BHUTANI_CURVES
  for (let i = 0; i < curves.length - 1; i++) {
    if (hoursOfAge >= curves[i][0] && hoursOfAge <= curves[i + 1][0]) {
      return {
        p40: lerp(curves[i][0], curves[i][1], curves[i + 1][0], curves[i + 1][1], hoursOfAge),
        p75: lerp(curves[i][0], curves[i][2], curves[i + 1][0], curves[i + 1][2], hoursOfAge),
        p95: lerp(curves[i][0], curves[i][3], curves[i + 1][0], curves[i + 1][3], hoursOfAge),
      }
    }
  }
  // outside range
  const last = curves[curves.length - 1]
  return { p40: last[1], p75: last[2], p95: last[3] }
}

export function getRiskZone(tsb: number, hoursOfAge: number): RiskZone {
  const { p40, p75, p95 } = getBhutaniAt(hoursOfAge)
  if (tsb >= p95) return 'high'
  if (tsb >= p75) return 'high-intermediate'
  if (tsb >= p40) return 'low-intermediate'
  return 'low'
}

export function getPhototherapyThreshold(hoursOfAge: number, highRisk: boolean): number {
  const thresholds = highRisk ? PHOTO_THRESHOLD_MED_RISK : PHOTO_THRESHOLD_LOW_RISK
  for (let i = 0; i < thresholds.length - 1; i++) {
    if (hoursOfAge >= thresholds[i][0] && hoursOfAge <= thresholds[i + 1][0]) {
      return lerp(thresholds[i][0], thresholds[i][1], thresholds[i + 1][0], thresholds[i + 1][1], hoursOfAge)
    }
  }
  return thresholds[thresholds.length - 1][1]
}

export const RISK_ZONE_INFO: Record<RiskZone, { label: string; color: string; bg: string; advice: string }> = {
  low: {
    label: '저위험 (Low Risk)',
    color: '#16a34a',
    bg: '#dcfce7',
    advice: '안전 구간입니다. 정기 체크를 계속하세요.'
  },
  'low-intermediate': {
    label: '중저위험 (Low-Intermediate)',
    color: '#ca8a04',
    bg: '#fef9c3',
    advice: '주의 구간입니다. 소아과 일정대로 추적관찰하세요.'
  },
  'high-intermediate': {
    label: '중고위험 (High-Intermediate)',
    color: '#ea580c',
    bg: '#ffedd5',
    advice: '주의! 소아과에 연락하여 추가 검사 여부를 확인하세요.'
  },
  high: {
    label: '고위험 (High Risk)',
    color: '#dc2626',
    bg: '#fee2e2',
    advice: '즉시 소아과 방문이 필요합니다. 광선치료 기준을 초과했을 수 있습니다.'
  }
}
