import { useState, useEffect, useRef } from 'react'
import type { AppState, BabyKey, TSBReading, PhototherapySession } from './data/types'
import { loadState, saveState, exportState, importState, calcHoursOfAge } from './data/storage'
import {
  getRiskZone, getBhutaniAt, getPhototherapyThreshold, RISK_ZONE_INFO,
  BHUTANI_CURVES, PHOTO_THRESHOLD_LOW_RISK, PHOTO_THRESHOLD_MED_RISK
} from './data/bhutani'

type Tab = 'chart' | 'readings' | 'phototherapy' | 'settings'

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function formatDT(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function fmtHours(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (hrs === 0) return `${mins}분`
  if (mins === 0) return `${hrs}시간`
  return `${hrs}시간 ${mins}분`
}

// ─── SVG Nomogram Chart ───────────────────────────────────────────────────
function NomogramChart({
  readings, babyKey, babyName, birthAt, hasRiskFactors
}: {
  readings: TSBReading[]
  babyKey: BabyKey
  babyName: string
  birthAt: string
  hasRiskFactors: boolean
}) {
  const W = 480, H = 320
  const MARGIN = { top: 24, right: 16, bottom: 44, left: 44 }
  const chartW = W - MARGIN.left - MARGIN.right
  const chartH = H - MARGIN.top - MARGIN.bottom

  const maxHour = 168  // 7 days
  const maxTSB = 25

  function xScale(h: number) { return MARGIN.left + (h / maxHour) * chartW }
  function yScale(v: number) { return MARGIN.top + chartH - (v / maxTSB) * chartH }

  // Build curve paths
  function curvePath(pts: [number, number][]): string {
    return pts.map((p, i) =>
      (i === 0 ? 'M' : 'L') + xScale(p[0]).toFixed(1) + ',' + yScale(p[1]).toFixed(1)
    ).join(' ')
  }

  const p40pts = BHUTANI_CURVES.map(c => [c[0], c[1]] as [number, number])
  const p75pts = BHUTANI_CURVES.map(c => [c[0], c[2]] as [number, number])
  const p95pts = BHUTANI_CURVES.map(c => [c[0], c[3]] as [number, number])

  const photoLine = hasRiskFactors ? PHOTO_THRESHOLD_MED_RISK : PHOTO_THRESHOLD_LOW_RISK

  // Baby's readings
  const babyReadings = readings.filter(r => r.babyKey === babyKey && r.hoursOfAge >= 0)
    .sort((a, b) => a.hoursOfAge - b.hoursOfAge)

  // Grid
  const hourTicks = [0, 24, 48, 72, 96, 120, 144, 168]
  const tsbTicks = [0, 5, 10, 15, 20, 25]

  const riskColors = {
    low: '#dcfce7',
    'low-intermediate': '#fef9c3',
    'high-intermediate': '#ffedd5',
    high: '#fee2e2'
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }}
      aria-label="Bhutani 노모그램">

      {/* Risk zone fills */}
      {/* High risk zone: above p95 */}
      <clipPath id="chartClip">
        <rect x={MARGIN.left} y={MARGIN.top} width={chartW} height={chartH} />
      </clipPath>

      {/* Background zones */}
      <rect x={MARGIN.left} y={MARGIN.top} width={chartW} height={chartH} fill={riskColors['high']} clipPath="url(#chartClip)" />

      {/* High-intermediate: p75 ~ p95 — overwrite with lighter */}
      <path
        d={[...p75pts.map((p, i) => (i === 0 ? 'M' : 'L') + xScale(p[0]).toFixed(1) + ',' + yScale(p[1]).toFixed(1)),
          ...[...p95pts].reverse().map((p, i) => 'L' + xScale(p[0]).toFixed(1) + ',' + yScale(p[1]).toFixed(1)),
          'Z'].join(' ')}
        fill={riskColors['high-intermediate']}
        clipPath="url(#chartClip)"
      />

      {/* Low-intermediate: p40 ~ p75 */}
      <path
        d={[...p40pts.map((p, i) => (i === 0 ? 'M' : 'L') + xScale(p[0]).toFixed(1) + ',' + yScale(p[1]).toFixed(1)),
          ...[...p75pts].reverse().map((p, i) => 'L' + xScale(p[0]).toFixed(1) + ',' + yScale(p[1]).toFixed(1)),
          'Z'].join(' ')}
        fill={riskColors['low-intermediate']}
        clipPath="url(#chartClip)"
      />

      {/* Low: below p40 */}
      <path
        d={[...p40pts.map((p, i) => (i === 0 ? 'M' : 'L') + xScale(p[0]).toFixed(1) + ',' + yScale(p[1]).toFixed(1)),
          'L' + xScale(maxHour).toFixed(1) + ',' + yScale(0).toFixed(1),
          'L' + xScale(0).toFixed(1) + ',' + yScale(0).toFixed(1),
          'Z'].join(' ')}
        fill={riskColors['low']}
        clipPath="url(#chartClip)"
      />

      {/* Grid lines */}
      {hourTicks.map(h => (
        <g key={h}>
          <line x1={xScale(h)} y1={MARGIN.top} x2={xScale(h)} y2={MARGIN.top + chartH}
            stroke="#fff" strokeWidth="0.5" opacity="0.6" />
          <text x={xScale(h)} y={MARGIN.top + chartH + 16} textAnchor="middle"
            fontSize="10" fill="#666">{h}h</text>
        </g>
      ))}
      {tsbTicks.map(v => v > 0 && (
        <g key={v}>
          <line x1={MARGIN.left} y1={yScale(v)} x2={MARGIN.left + chartW} y2={yScale(v)}
            stroke="#fff" strokeWidth="0.5" opacity="0.6" />
          <text x={MARGIN.left - 6} y={yScale(v) + 3} textAnchor="end"
            fontSize="10" fill="#666">{v}</text>
        </g>
      ))}

      {/* Percentile curves */}
      <path d={curvePath(p40pts)} fill="none" stroke="#84cc16" strokeWidth="1.5" strokeDasharray="4,3" />
      <path d={curvePath(p75pts)} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4,3" />
      <path d={curvePath(p95pts)} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,3" />

      {/* Phototherapy threshold */}
      <path
        d={photoLine.map((p, i) => (i === 0 ? 'M' : 'L') + xScale(p[0]).toFixed(1) + ',' + yScale(p[1]).toFixed(1)).join(' ')}
        fill="none" stroke="#7c3aed" strokeWidth="2" strokeDasharray="6,3"
      />

      {/* Axes */}
      <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + chartH} stroke="#333" strokeWidth="1" />
      <line x1={MARGIN.left} y1={MARGIN.top + chartH} x2={MARGIN.left + chartW} y2={MARGIN.top + chartH} stroke="#333" strokeWidth="1" />

      {/* Axis labels */}
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="#444">시간령 (hours)</text>
      <text x={10} y={H / 2} textAnchor="middle" fontSize="11" fill="#444"
        transform={`rotate(-90, 10, ${H / 2})`}>TSB (mg/dL)</text>

      {/* Reading points + connecting line */}
      {babyReadings.length > 1 && (
        <polyline
          points={babyReadings.map(r => `${xScale(r.hoursOfAge).toFixed(1)},${yScale(r.tsb).toFixed(1)}`).join(' ')}
          fill="none" stroke="#1d4ed8" strokeWidth="2"
        />
      )}
      {babyReadings.map((r, i) => {
        const zone = getRiskZone(r.tsb, r.hoursOfAge)
        const color = RISK_ZONE_INFO[zone].color
        return (
          <g key={r.id}>
            <circle
              cx={xScale(r.hoursOfAge)} cy={yScale(r.tsb)}
              r="5" fill={color} stroke="#fff" strokeWidth="1.5"
            />
            <text x={xScale(r.hoursOfAge)} y={yScale(r.tsb) - 8}
              textAnchor="middle" fontSize="9" fill={color} fontWeight="bold">
              {r.tsb}
            </text>
          </g>
        )
      })}

      {/* Legend */}
      <g transform={`translate(${MARGIN.left + 4}, ${MARGIN.top + 4})`}>
        {[
          { label: 'p40 (40th)', color: '#84cc16', dash: '4,3' },
          { label: 'p75 (75th)', color: '#f59e0b', dash: '4,3' },
          { label: 'p95 (95th)', color: '#ef4444', dash: '4,3' },
          { label: '광선치료 기준', color: '#7c3aed', dash: '6,3' },
        ].map((item, i) => (
          <g key={i} transform={`translate(0, ${i * 14})`}>
            <line x1="0" y1="5" x2="18" y2="5" stroke={item.color} strokeWidth="1.5" strokeDasharray={item.dash} />
            <text x="22" y="9" fontSize="8.5" fill="#444">{item.label}</text>
          </g>
        ))}
      </g>

      {/* Title */}
      <text x={W / 2} y={12} textAnchor="middle" fontSize="11" fill="#666" fontWeight="600">
        {babyName} — Bhutani 노모그램
      </text>
    </svg>
  )
}

// ─── Add Reading Form ─────────────────────────────────────────────────────
function AddReadingForm({
  state, onAdd, onClose
}: {
  state: AppState
  onAdd: (r: TSBReading) => void
  onClose: () => void
}) {
  const now = new Date()
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16)

  const [babyKey, setBabyKey] = useState<BabyKey>('a')
  const [tsb, setTsb] = useState('')
  const [measuredAt, setMeasuredAt] = useState(localNow)
  const [note, setNote] = useState('')
  const [location, setLocation] = useState('')
  const [underPhoto, setUnderPhoto] = useState(false)

  const baby = state.babies[babyKey]
  const hoursOfAge = baby.birthAt
    ? calcHoursOfAge(baby.birthAt, new Date(measuredAt).toISOString())
    : 0
  const zone = tsb && hoursOfAge > 0
    ? getRiskZone(parseFloat(tsb), hoursOfAge) : null
  const photoThresh = baby.birthAt
    ? getPhototherapyThreshold(hoursOfAge, baby.hasRiskFactors) : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tsb || parseFloat(tsb) <= 0) return
    if (!baby.birthAt) { alert('설정에서 출생 시각을 먼저 입력해주세요.'); return }
    onAdd({
      id: generateId(),
      babyKey,
      tsb: parseFloat(tsb),
      hoursOfAge,
      recordedAt: new Date(measuredAt).toISOString(),
      note: note || undefined,
      location: location || undefined,
      underPhototherapy: underPhoto || undefined
    })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '24px',
        width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }}>
        <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>📊 수치 기록</h2>
        <form onSubmit={handleSubmit}>
          {/* Baby select */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>아기 선택</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['a', 'b'] as BabyKey[]).map(k => (
                <button key={k} type="button"
                  onClick={() => setBabyKey(k)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid',
                    borderColor: babyKey === k ? '#f59e0b' : '#e5e7eb',
                    background: babyKey === k ? '#fffbeb' : '#f9fafb',
                    fontWeight: babyKey === k ? '700' : '400',
                    cursor: 'pointer', fontSize: '15px'
                  }}>
                  {state.babies[k].name}
                </button>
              ))}
            </div>
          </div>

          {/* TSB */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>TSB 수치 (mg/dL)</label>
            <input
              type="number" step="0.1" min="0" max="30"
              value={tsb} onChange={e => setTsb(e.target.value)}
              required
              placeholder="예: 12.5"
              style={inputStyle}
            />
            {zone && (
              <div style={{
                marginTop: '8px', padding: '8px 12px', borderRadius: '8px',
                background: RISK_ZONE_INFO[zone].bg,
                color: RISK_ZONE_INFO[zone].color,
                fontSize: '13px', fontWeight: '600'
              }}>
                {RISK_ZONE_INFO[zone].label}
                {photoThresh && (
                  <span style={{ fontWeight: '400', marginLeft: '8px' }}>
                    (광선치료 기준: {photoThresh.toFixed(1)} mg/dL)
                  </span>
                )}
              </div>
            )}
            {zone && hoursOfAge > 0 && (
              <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                시간령: {fmtHours(hoursOfAge)} ({hoursOfAge.toFixed(1)}시간)
              </div>
            )}
          </div>

          {/* Measured at */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>검사 시각</label>
            <input type="datetime-local" value={measuredAt}
              onChange={e => setMeasuredAt(e.target.value)}
              required style={inputStyle}
            />
          </div>

          {/* Location */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>병원/장소 (선택)</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)}
              placeholder="예: 성북우리아이들병원"
              style={inputStyle}
            />
          </div>

          {/* Phototherapy */}
          <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" id="underPhoto" checked={underPhoto}
              onChange={e => setUnderPhoto(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            <label htmlFor="underPhoto" style={{ fontSize: '14px' }}>광선치료 중 측정</label>
          </div>

          {/* Note */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>메모 (선택)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="특이사항, 의사 코멘트 등"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: '15px' }}>
              취소
            </button>
            <button type="submit"
              style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: '#f59e0b', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '15px' }}>
              기록하기
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Add Phototherapy Form ────────────────────────────────────────────────
function AddPhotoForm({
  state, onAdd, onClose
}: {
  state: AppState
  onAdd: (p: PhototherapySession) => void
  onClose: () => void
}) {
  const now = new Date()
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  const [babyKey, setBabyKey] = useState<BabyKey>('a')
  const [startAt, setStartAt] = useState(localNow)
  const [endAt, setEndAt] = useState('')
  const [hospitalName, setHospitalName] = useState('')
  const [note, setNote] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onAdd({
      id: generateId(),
      babyKey,
      startAt: new Date(startAt).toISOString(),
      endAt: endAt ? new Date(endAt).toISOString() : undefined,
      hospitalName: hospitalName || undefined,
      note: note || undefined
    })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '24px',
        width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }}>
        <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>💡 광선치료 기록</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>아기 선택</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['a', 'b'] as BabyKey[]).map(k => (
                <button key={k} type="button" onClick={() => setBabyKey(k)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid',
                    borderColor: babyKey === k ? '#7c3aed' : '#e5e7eb',
                    background: babyKey === k ? '#f5f3ff' : '#f9fafb',
                    fontWeight: babyKey === k ? '700' : '400',
                    cursor: 'pointer', fontSize: '15px'
                  }}>
                  {state.babies[k].name}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>시작 시각</label>
            <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} required style={inputStyle} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>종료 시각 (치료 중이면 비워두세요)</label>
            <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>병원명 (선택)</label>
            <input type="text" value={hospitalName} onChange={e => setHospitalName(e.target.value)} placeholder="예: 성북우리아이들병원" style={inputStyle} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>메모 (선택)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer' }}>
              취소
            </button>
            <button type="submit"
              style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: '#7c3aed', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '15px' }}>
              기록하기
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Settings ────────────────────────────────────────────────────────────
function Settings({ state, onChange }: { state: AppState; onChange: (s: AppState) => void }) {
  function updateBaby(key: 'a' | 'b', field: string, value: string | number | boolean) {
    const next = { ...state, babies: { ...state.babies, [key]: { ...state.babies[key], [field]: value } } }
    onChange(next)
  }

  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{ padding: '16px 0' }}>
      <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>⚙️ 설정</h2>

      {(['a', 'b'] as const).map(k => {
        const b = state.babies[k]
        // format for datetime-local
        const localBirth = b.birthAt
          ? new Date(new Date(b.birthAt).getTime() - new Date(b.birthAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
          : ''
        return (
          <div key={k} style={{
            background: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '16px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
          }}>
            <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>
              {k === 'a' ? '🐣 ' : '🐥 '}{b.name}
            </h3>
            <div style={{ marginBottom: '10px' }}>
              <label style={labelStyle}>이름</label>
              <input value={b.name} onChange={e => updateBaby(k, 'name', e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={labelStyle}>출생 시각 <span style={{ color: '#e53e3e', fontWeight: '700' }}>*필수</span></label>
              <input type="datetime-local" value={localBirth}
                onChange={e => updateBaby(k, 'birthAt', e.target.value ? new Date(e.target.value).toISOString() : '')}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={labelStyle}>재태주수</label>
              <input type="number" min="24" max="42" value={b.gestationalWeeks}
                onChange={e => updateBaby(k, 'gestationalWeeks', parseInt(e.target.value))}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id={`risk-${k}`} checked={b.hasRiskFactors}
                onChange={e => updateBaby(k, 'hasRiskFactors', e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <label htmlFor={`risk-${k}`} style={{ fontSize: '14px' }}>
                위험인자 있음 (용혈성 질환, G6PD 결핍, 조산 등)
              </label>
            </div>
          </div>
        )
      })}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
        <button onClick={() => exportState(state)}
          style={btnStyle('#1d4ed8')}>
          📤 데이터 내보내기 (JSON)
        </button>
        <button onClick={() => fileRef.current?.click()}
          style={btnStyle('#6b7280')}>
          📥 데이터 불러오기
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              const imported = await importState(f)
              onChange(imported)
              alert('데이터를 불러왔습니다!')
            } catch (err) {
              alert('가져오기 실패: ' + (err as Error).message)
            }
          }}
        />
      </div>

      <div style={{ marginTop: '20px', padding: '12px', background: '#f0f4ff', borderRadius: '10px', fontSize: '12px', color: '#4b5563', lineHeight: '1.6' }}>
        ⚠️ <strong>의학적 면책고지:</strong> 이 앱은 의학적 진단 도구가 아닙니다.
        모든 결정은 담당 소아과 의사와 상의하십시오. 수치가 걱정되면 즉시 병원에 연락하세요.
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: '600', color: '#4b5563', marginBottom: '6px'
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb',
  fontSize: '15px', background: '#fafafa', outline: 'none'
}
function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '12px', borderRadius: '10px', border: 'none', background: bg,
    color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '14px', textAlign: 'center'
  }
}

// ─── Main App ─────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [tab, setTab] = useState<Tab>('chart')
  const [selectedBaby, setSelectedBaby] = useState<BabyKey>('a')
  const [showAddReading, setShowAddReading] = useState(false)
  const [showAddPhoto, setShowAddPhoto] = useState(false)

  useEffect(() => { saveState(state) }, [state])

  function handleAddReading(r: TSBReading) {
    setState(s => ({ ...s, readings: [...s.readings, r] }))
  }
  function handleDeleteReading(id: string) {
    if (!confirm('이 기록을 삭제할까요?')) return
    setState(s => ({ ...s, readings: s.readings.filter(r => r.id !== id) }))
  }
  function handleAddPhoto(p: PhototherapySession) {
    setState(s => ({ ...s, phototherapy: [...s.phototherapy, p] }))
  }
  function handleDeletePhoto(id: string) {
    if (!confirm('이 기록을 삭제할까요?')) return
    setState(s => ({ ...s, phototherapy: s.phototherapy.filter(p => p.id !== id) }))
  }
  function handleEndPhoto(id: string) {
    setState(s => ({
      ...s,
      phototherapy: s.phototherapy.map(p =>
        p.id === id ? { ...p, endAt: new Date().toISOString() } : p
      )
    }))
  }

  const babies = state.babies
  const curBaby = babies[selectedBaby]
  const curReadings = state.readings
    .filter(r => r.babyKey === selectedBaby)
    .sort((a, b) => a.hoursOfAge - b.hoursOfAge)
  const latestReading = curReadings[curReadings.length - 1]

  const tabs: { key: Tab; label: string }[] = [
    { key: 'chart', label: '📈 차트' },
    { key: 'readings', label: '📋 기록' },
    { key: 'phototherapy', label: '💡 광선치료' },
    { key: 'settings', label: '⚙️ 설정' }
  ]

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', padding: '0 0 80px 0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
        padding: '20px 16px 16px', color: '#fff'
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '4px' }}>
          🌟 황달 수치 일기
        </h1>
        <p style={{ fontSize: '13px', opacity: 0.9 }}>TSB 트래킹 + Bhutani 노모그램</p>

        {/* Baby switcher */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          {(['a', 'b'] as BabyKey[]).map(k => (
            <button key={k} onClick={() => setSelectedBaby(k)}
              style={{
                flex: 1, padding: '8px', borderRadius: '10px', border: '2px solid',
                borderColor: selectedBaby === k ? '#fff' : 'rgba(255,255,255,0.4)',
                background: selectedBaby === k ? 'rgba(255,255,255,0.25)' : 'transparent',
                color: '#fff', fontWeight: selectedBaby === k ? '700' : '400',
                cursor: 'pointer', fontSize: '15px'
              }}>
              {babies[k].name}
              {(() => {
                const lr = state.readings.filter(r => r.babyKey === k)
                  .sort((a, b) => a.hoursOfAge - b.hoursOfAge)
                const last = lr[lr.length - 1]
                if (!last) return null
                const zone = getRiskZone(last.tsb, last.hoursOfAge)
                const dots: Record<string, string> = {
                  low: ' 🟢', 'low-intermediate': ' 🟡',
                  'high-intermediate': ' 🟠', high: ' 🔴'
                }
                return <span style={{ fontSize: '12px' }}>{dots[zone]}</span>
              })()}
            </button>
          ))}
        </div>
      </div>

      {/* Latest reading summary */}
      {latestReading && (
        <div style={{
          margin: '12px 16px 0',
          padding: '12px 14px',
          borderRadius: '12px',
          background: RISK_ZONE_INFO[getRiskZone(latestReading.tsb, latestReading.hoursOfAge)].bg,
          borderLeft: `4px solid ${RISK_ZONE_INFO[getRiskZone(latestReading.tsb, latestReading.hoursOfAge)].color}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '22px', fontWeight: '800', color: RISK_ZONE_INFO[getRiskZone(latestReading.tsb, latestReading.hoursOfAge)].color }}>
                {latestReading.tsb} mg/dL
              </span>
              <span style={{ fontSize: '13px', color: '#666', marginLeft: '8px' }}>
                최근 측정
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: RISK_ZONE_INFO[getRiskZone(latestReading.tsb, latestReading.hoursOfAge)].color }}>
                {RISK_ZONE_INFO[getRiskZone(latestReading.tsb, latestReading.hoursOfAge)].label}
              </div>
              <div style={{ fontSize: '11px', color: '#888' }}>
                {fmtHours(latestReading.hoursOfAge)} 령
              </div>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: '#555', marginTop: '6px' }}>
            {RISK_ZONE_INFO[getRiskZone(latestReading.tsb, latestReading.hoursOfAge)].advice}
          </p>
        </div>
      )}
      {!latestReading && curBaby.birthAt && (
        <div style={{ margin: '12px 16px 0', padding: '12px 14px', borderRadius: '12px', background: '#f3f4f6', color: '#888', fontSize: '14px' }}>
          아직 기록이 없습니다. + 버튼으로 첫 수치를 기록해보세요.
        </div>
      )}
      {!curBaby.birthAt && (
        <div style={{ margin: '12px 16px 0', padding: '12px 14px', borderRadius: '12px', background: '#fff7ed', borderLeft: '4px solid #f97316', fontSize: '14px', color: '#92400e' }}>
          ⚠️ 설정에서 {curBaby.name} 출생 시각을 먼저 입력해주세요.
        </div>
      )}

      {/* Tab navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', margin: '12px 16px 0' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '10px 4px', border: 'none', background: 'none',
              fontSize: '12px', fontWeight: tab === t.key ? '700' : '400',
              color: tab === t.key ? '#f59e0b' : '#6b7280',
              borderBottom: tab === t.key ? '2px solid #f59e0b' : '2px solid transparent',
              cursor: 'pointer'
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: '12px 16px' }}>
        {tab === 'chart' && (
          <div>
            <NomogramChart
              readings={state.readings}
              babyKey={selectedBaby}
              babyName={curBaby.name}
              birthAt={curBaby.birthAt}
              hasRiskFactors={curBaby.hasRiskFactors}
            />
            {/* Zone legend */}
            <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {(['low', 'low-intermediate', 'high-intermediate', 'high'] as const).map(zone => (
                <div key={zone} style={{
                  padding: '8px', borderRadius: '8px',
                  background: RISK_ZONE_INFO[zone].bg,
                  borderLeft: `3px solid ${RISK_ZONE_INFO[zone].color}`
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: RISK_ZONE_INFO[zone].color }}>
                    {RISK_ZONE_INFO[zone].label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                    {RISK_ZONE_INFO[zone].advice}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'readings' && (
          <div>
            {curReadings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: '15px' }}>
                아직 기록이 없습니다
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[...curReadings].reverse().map(r => {
                  const zone = getRiskZone(r.tsb, r.hoursOfAge)
                  const info = RISK_ZONE_INFO[zone]
                  const photoThresh = getPhototherapyThreshold(r.hoursOfAge, curBaby.hasRiskFactors)
                  const aboveThresh = r.tsb >= photoThresh
                  return (
                    <div key={r.id} style={{
                      background: '#fff', borderRadius: '12px', padding: '14px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                      borderLeft: `4px solid ${info.color}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '24px', fontWeight: '800', color: info.color }}>{r.tsb}</span>
                          <span style={{ fontSize: '13px', color: '#888', marginLeft: '4px' }}>mg/dL</span>
                          {r.underPhototherapy && (
                            <span style={{ marginLeft: '8px', fontSize: '11px', background: '#ede9fe', color: '#7c3aed', padding: '2px 6px', borderRadius: '4px' }}>
                              광선치료 중
                            </span>
                          )}
                        </div>
                        <button onClick={() => handleDeleteReading(r.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#d1d5db' }}>
                          ×
                        </button>
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '12px', color: '#4b5563' }}>
                        <span style={{ fontWeight: '600', color: info.color }}>{info.label}</span>
                        {' · '}시간령 {fmtHours(r.hoursOfAge)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        광선치료 기준: {photoThresh.toFixed(1)} mg/dL
                        {aboveThresh && (
                          <span style={{ color: '#dc2626', fontWeight: '700', marginLeft: '6px' }}>
                            ⚠️ 기준 초과!
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                        {formatDT(r.recordedAt)}
                        {r.location && <span> · {r.location}</span>}
                      </div>
                      {r.note && (
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px', fontStyle: 'italic' }}>
                          "{r.note}"
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'phototherapy' && (
          <div>
            {/* Ongoing sessions */}
            {state.phototherapy.filter(p => p.babyKey === selectedBaby && !p.endAt).map(p => (
              <div key={p.id} style={{
                background: '#f5f3ff', borderRadius: '12px', padding: '14px',
                borderLeft: '4px solid #7c3aed', marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#7c3aed' }}>🔵 진행 중</span>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      시작: {formatDT(p.startAt)}
                      {p.hospitalName && <span> · {p.hospitalName}</span>}
                    </div>
                    {p.note && <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#888', marginTop: '4px' }}>"{p.note}"</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button onClick={() => handleEndPhoto(p.id)}
                      style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>
                      종료
                    </button>
                    <button onClick={() => handleDeletePhoto(p.id)}
                      style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '12px' }}>
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Completed sessions */}
            {state.phototherapy.filter(p => p.babyKey === selectedBaby && p.endAt).length === 0 &&
              state.phototherapy.filter(p => p.babyKey === selectedBaby && !p.endAt).length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: '15px' }}>
                  광선치료 기록이 없습니다
                </div>
              )}

            {state.phototherapy
              .filter(p => p.babyKey === selectedBaby && p.endAt)
              .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
              .map(p => {
                const dur = p.endAt
                  ? (new Date(p.endAt).getTime() - new Date(p.startAt).getTime()) / 3600000
                  : 0
                return (
                  <div key={p.id} style={{
                    background: '#fff', borderRadius: '12px', padding: '14px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '10px',
                    borderLeft: '4px solid #a78bfa'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontWeight: '700', fontSize: '15px', color: '#6d28d9' }}>
                          💡 {dur.toFixed(1)}시간
                        </span>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                          {formatDT(p.startAt)} → {p.endAt ? formatDT(p.endAt) : '—'}
                        </div>
                        {p.hospitalName && <div style={{ fontSize: '12px', color: '#888' }}>{p.hospitalName}</div>}
                      </div>
                      <button onClick={() => handleDeletePhoto(p.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#d1d5db' }}>
                        ×
                      </button>
                    </div>
                  </div>
                )
              })}
          </div>
        )}

        {tab === 'settings' && (
          <Settings state={state} onChange={(s) => { setState(s); saveState(s) }} />
        )}
      </div>

      {/* FAB */}
      {tab !== 'settings' && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end'
        }}>
          {tab === 'phototherapy' && (
            <button onClick={() => setShowAddPhoto(true)}
              style={{
                width: '48px', height: '48px', borderRadius: '50%', border: 'none',
                background: '#7c3aed', color: '#fff', fontSize: '22px', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(124,58,237,0.4)'
              }}>
              +
            </button>
          )}
          {tab !== 'phototherapy' && (
            <button onClick={() => setShowAddReading(true)}
              style={{
                width: '56px', height: '56px', borderRadius: '50%', border: 'none',
                background: '#f59e0b', color: '#fff', fontSize: '28px', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(245,158,11,0.5)'
              }}>
              +
            </button>
          )}
        </div>
      )}

      {showAddReading && (
        <AddReadingForm state={state} onAdd={handleAddReading} onClose={() => setShowAddReading(false)} />
      )}
      {showAddPhoto && (
        <AddPhotoForm state={state} onAdd={handleAddPhoto} onClose={() => setShowAddPhoto(false)} />
      )}
    </div>
  )
}
