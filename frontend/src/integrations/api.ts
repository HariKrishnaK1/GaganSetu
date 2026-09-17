import type { SimState } from '@backend/model/simulator'

export interface CloudDbStatus {
  status: 'connected' | 'connecting' | 'disconnected' | 'unconfigured'
  message: string
  host?: string
  dbName?: string
}

export interface CloudHealthResponse {
  status: string
  service: string
  timestamp: string
  database: CloudDbStatus
}

export interface SavedCloudRun {
  _id: string
  title: string
  createdAt: string
  config: {
    origin: string
    destination: string
    scenario: string
    initialBattery: number
    speedKmh: number
    windSpeedKmh: number
    windDirectionDeg: number
    notificationDelay: number
    closureAt: number
    fleetMode: boolean
  }
  outcome: {
    status: string
    target: string
    durationSeconds: number
    distanceKm: number
    energyLeftKwh: number
    diverted: boolean
    failure: string | null
  }
  events: Array<{
    id?: number
    time: number
    type: string
    message: string
  }>
  pnr?: {
    distanceKm: number
    isPast: boolean
    marginAtPnr: number
  } | null
  fleet?: Array<{
    id: string
    callsign: string
    status: string
    target: string
    energy: number
    distance: number
    diverted: boolean
    altitudeMeters: number
  }>
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export async function fetchHealth(): Promise<CloudHealthResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/health`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function saveMissionToCloud(
  state: SimState,
  title?: string
): Promise<{ ok: boolean; run?: SavedCloudRun; error?: string }> {
  try {
    const payload = {
      title: title || `Flight: ${state.config.origin} ? ${state.target || state.config.destination} (${state.status})`,
      config: state.config,
      outcome: {
        status: state.status,
        target: state.target,
        durationSeconds: state.time,
        distanceKm: state.distance,
        energyLeftKwh: state.energy,
        diverted: state.diverted,
        failure: state.failure,
      },
      events: state.events,
      history: state.history,
      pnr: state.pnr,
      fleet: state.config.fleetMode
        ? state.fleet.map((v) => ({
            id: v.id,
            callsign: v.callsign,
            status: v.status,
            target: v.target,
            energy: v.energy,
            distance: v.distance,
            diverted: v.diverted,
            altitudeMeters: v.altitudeMeters,
          }))
        : [],
    }

    const res = await fetch(`${API_BASE}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || data.hint || 'Failed to save mission to MongoDB Atlas.' }
    }
    return { ok: true, run: data.run }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

export async function fetchCloudRuns(): Promise<{
  ok: boolean
  runs: SavedCloudRun[]
  dbStatus?: CloudDbStatus
  error?: string
}> {
  try {
    const res = await fetch(`${API_BASE}/api/runs`)
    const data = await res.json()
    if (!res.ok) return { ok: false, runs: [], error: data.error || 'Failed to fetch cloud runs.' }
    return { ok: true, runs: data.runs || [], dbStatus: data.dbStatus }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, runs: [], error: msg }
  }
}

export async function deleteCloudRun(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/runs/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok || !data.ok) return { ok: false, error: data.error || 'Failed to delete.' }
    return { ok: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
