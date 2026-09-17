import { PADS, padById, distanceKm, shortestRoute, bearingDegrees, windAdjustment } from './network'
import type { Point } from './network'

export type PadStatus = 'open' | 'closed'
export type Scenario = 'normal' | 'closure'
export type Config = {
  origin: string; destination: string; initialBattery: number; capacityKwh: number
  speedKmh: number; cruiseKwhPerKm: number; takeoffKwh: number; landingKwh: number
  reserveKwh: number; notificationDelay: number; closureAt: number; scenario: Scenario
  windSpeedKmh: number; windDirectionDeg: number; fleetMode: boolean
}
export const DEFAULT_CONFIG: Config = {
  origin: 'P01', destination: 'P07', initialBattery: 85, capacityKwh: 38,
  speedKmh: 120, cruiseKwhPerKm: 1, takeoffKwh: 1.5, landingKwh: 1.5,
  reserveKwh: 5, notificationDelay: 0, closureAt: 135, scenario: 'closure',
  windSpeedKmh: 15, windDirectionDeg: 90, fleetMode: false,
}
export type Observation = { status: PadStatus; observedAt: number; receivedAt: number }
type Message = { pad: string; status: PadStatus; observedAt: number; deliverAt: number }
export type Event = { id: number; time: number; type: 'info' | 'warning' | 'success' | 'error'; message: string }
export type RunStatus = 'ready' | 'flying' | 'landed' | 'blocked' | 'infeasible'
type Flight = {
  status: RunStatus; position: Point; node: string | null; edge: [string, string] | null
  remaining: string[]; plannedRoute: string[]; history: Point[]; energy: number
  distance: number; target: string; diverted: boolean; altitudeMeters: number
  groundSpeedKmh: number; effectiveBurnPerKm: number; headwindKmh: number; failure: string | null
}
export type FleetVehicle = Flight & { id: string; callsign: string; color: string; origin: string; destination: string }
export type PnrInfo = { distanceKm: number; position: Point; isPast: boolean; marginAtPnr: number }
export type SimState = Flight & {
  config: Config; time: number; closureDone: boolean; actual: Record<string, PadStatus>
  observations: Record<string, Observation>; pending: Message[]; events: Event[]
  updates: number; nextHeartbeat: number; pnr: PnrInfo | null
  fleet: FleetVehicle[]; padReservations: Record<string, string[]>
}
export type Alternative = {
  id: string; path: string[]; distance: number; required: number; margin: number
  feasible: boolean; age: number; reportedStatus: PadStatus
}
const EPS = 1e-8
const PRIMARY = 'GS-01'

export function validateConfig(c: Config): void {
  padById(c.origin); padById(c.destination)
  if (c.origin === c.destination) throw new Error('Choose different departure and destination pads.')
  if (!['normal', 'closure'].includes(c.scenario)) throw new Error('Unknown scenario.')
  for (const key of ['initialBattery', 'capacityKwh', 'speedKmh', 'cruiseKwhPerKm', 'takeoffKwh',
    'landingKwh', 'reserveKwh', 'notificationDelay', 'closureAt', 'windSpeedKmh', 'windDirectionDeg'] as const) {
    if (!Number.isFinite(c[key]) || c[key] < 0) throw new Error('Invalid ' + key + '.')
  }
  if (c.initialBattery > 100 || c.capacityKwh === 0 || c.speedKmh === 0 || c.cruiseKwhPerKm === 0)
    throw new Error('Invalid aircraft parameters.')
  if (c.windDirectionDeg > 360) throw new Error('Wind direction must be between 0 and 360 degrees.')
  if (typeof c.fleetMode !== 'boolean') throw new Error('Invalid fleet mode.')
  if (!Number.isFinite(c.capacityKwh * c.initialBattery / 100) ||
      !Number.isFinite(c.takeoffKwh + c.landingKwh + c.reserveKwh))
    throw new Error('Aircraft parameters exceed the supported numeric range.')
}
function event(s: SimState, type: Event['type'], message: string) {
  s.events.push({ id: s.events.length, time: s.time, type, message })
}
function legWind(c: Config, a: Point, b: Point) {
  return windAdjustment(bearingDegrees(a, b), c.windSpeedKmh, c.windDirectionDeg, c.speedKmh, c.cruiseKwhPerKm)
}
function legStart(f: Pick<Flight, 'position' | 'edge'>, next: string): Point {
  // Use a fixed corridor heading, including reversals along the current edge.
  if (f.edge?.includes(next)) return padById(f.edge[0] === next ? f.edge[1] : f.edge[0])
  return f.position
}
function routeCost(c: Config, position: Point, path: string[], edge: Flight['edge'] = null) {
  let energy = 0, distance = 0, from = position
  for (const [i, id] of path.entries()) {
    const to = padById(id), d = distanceKm(from, to)
    const effect = legWind(c, i === 0 ? legStart({ position, edge }, id) : from, to)
    distance += d; energy += d * effect.effectiveBurnPerKm; from = to
  }
  return { energy, distance }
}
function makeFlight(c: Config, origin: string, destination: string, battery: number): Flight {
  const start = padById(origin), route = shortestRoute(origin, destination)
  const energy = c.capacityKwh * battery / 100, remaining = route?.path.slice(1) ?? []
  const required = c.takeoffKwh + routeCost(c, start, remaining).energy + c.landingKwh + c.reserveKwh
  const feasible = !!route && Number.isFinite(required) && energy >= required - EPS
  return {
    status: feasible ? 'ready' : 'infeasible', position: { lat: start.lat, lng: start.lng },
    node: origin, edge: null, remaining, plannedRoute: route?.path ?? [],
    history: [{ lat: start.lat, lng: start.lng }], energy, distance: 0, target: destination,
    diverted: false, altitudeMeters: 0, groundSpeedKmh: c.speedKmh,
    effectiveBurnPerKm: c.cruiseKwhPerKm, headwindKmh: 0,
    failure: feasible ? null : 'Insufficient energy for the wind-adjusted route, landing and reserve.',
  }
}
export function createFleetVehicles(c: Config): FleetVehicle[] {
  return [
    { ...makeFlight(c, c.origin, c.destination, c.initialBattery), id: PRIMARY, callsign: 'Gagan-01 (Primary)', color: '#008b75', origin: c.origin, destination: c.destination },
    { ...makeFlight(c, 'P03', 'P05', 90), id: 'GS-02', callsign: 'Gagan-02 (Passenger)', color: '#2563eb', origin: 'P03', destination: 'P05' },
    { ...makeFlight(c, 'P09', 'P02', 95), id: 'GS-03', callsign: 'Gagan-03 (Medical)', color: '#7c3aed', origin: 'P09', destination: 'P02' },
  ]
}
export function calculateAltitude(distance: number, totalDist: number, status: RunStatus): number {
  if (status === 'ready' || status === 'landed' || status === 'infeasible' || totalDist <= 0) return 0
  const climb = Math.min(0.6, totalDist * 0.2), descent = Math.min(0.8, totalDist * 0.25)
  if (distance < climb) return Math.round(distance / climb * 300)
  if (totalDist - distance < descent) return Math.max(0, Math.round((totalDist - distance) / descent * 300))
  return 300
}
function routesFrom(f: Pick<Flight, 'position' | 'node' | 'edge'>, to: string) {
  if (f.node) {
    const r = shortestRoute(f.node, to)
    return r ? [{ path: r.path.slice(1), distance: r.distance }] : []
  }
  return f.edge?.flatMap(id => {
    const r = shortestRoute(id, to)
    return r ? [{ path: r.path, distance: distanceKm(f.position, padById(id)) + r.distance }] : []
  }) ?? []
}
export function routeFromPosition(s: SimState, to: string): { path: string[]; distance: number } | null {
  return routesFrom(s, to).sort((a, b) => a.distance - b.distance)[0] ?? null
}
function flightAlternatives(s: SimState, f: Flight, destination: string, includeDestination = false): Alternative[] {
  const energy = f.energy - (f.status === 'ready' ? s.config.takeoffKwh : 0)
  return PADS.filter(p => includeDestination || p.id !== destination).map(p => {
    const choices = routesFrom(f, p.id).map(route => ({
      ...route, required: routeCost(s.config, f.position, route.path, f.edge).energy + s.config.landingKwh + s.config.reserveKwh,
    }))
    // Prefer a reachable route; a shorter headwind route may use more energy.
    choices.sort((a, b) => Number(energy >= b.required - EPS) - Number(energy >= a.required - EPS) || a.distance - b.distance)
    const route = choices[0], obs = s.observations[p.id], required = route?.required ?? Infinity
    return {
      id: p.id, path: route?.path ?? [], distance: route?.distance ?? Infinity, required,
      margin: energy - required, feasible: obs.status === 'open' && energy >= required - EPS,
      age: s.time - obs.observedAt, reportedStatus: obs.status,
    }
  }).sort((a, b) => Number(b.feasible) - Number(a.feasible) || a.distance - b.distance)
}
export function alternatives(s: SimState, includeDestination = false): Alternative[] {
  return flightAlternatives(s, s, s.config.destination, includeDestination)
}
export function calculatePnr(s: SimState): PnrInfo | null {
  if (!['ready', 'flying'].includes(s.status)) return null
  // Estimate the first loss of alternatives along the remaining corridor, in
  // at most 250m increments. Null means no boundary was found, not a guarantee.
  let position = { ...s.position }, energy = s.energy - (s.status === 'ready' ? s.config.takeoffKwh : 0)
  let travelled = 0, node = s.node, edge = s.edge
  const assess = (): PnrInfo | null => {
    const probe: Flight = { ...s, status: 'flying', position, node, edge, energy }
    const options = flightAlternatives(s, probe, s.config.destination).filter(p => p.reportedStatus === 'open')
    if (options.some(p => p.feasible)) return null
    const margin = options.length ? Math.max(...options.map(p => p.margin)) : -energy
    return { distanceKm: s.distance + travelled, position: { ...position }, isPast: travelled <= EPS, marginAtPnr: margin }
  }
  const initial = assess()
  if (initial) return initial
  for (const nextId of s.remaining) {
    const target = padById(nextId), start = { ...position }, length = distanceKm(start, target)
    if (node) edge = [node, nextId]
    const burn = legWind(s.config, legStart({ position: start, edge }, nextId), target).effectiveBurnPerKm
    const samples = Math.max(1, Math.ceil(length / 0.25))
    for (let i = 1; i <= samples; i++) {
      const amount = length / samples
      position = { lat: start.lat + (target.lat - start.lat) * i / samples, lng: start.lng + (target.lng - start.lng) * i / samples }
      energy -= amount * burn; travelled += amount
      node = i === samples ? nextId : null
      const pnr = assess()
      if (pnr) return pnr
    }
    edge = null
  }
  return null
}
export function createSimulation(config: Config = DEFAULT_CONFIG): SimState {
  validateConfig(config)
  const c = { ...config }
  const s: SimState = {
    ...makeFlight(c, c.origin, c.destination, c.initialBattery), config: c, time: 0, closureDone: false,
    actual: Object.fromEntries(PADS.map(p => [p.id, 'open'])),
    observations: Object.fromEntries(PADS.map(p => [p.id, { status: 'open', observedAt: 0, receivedAt: 0 }])),
    pending: [], events: [], updates: 0, nextHeartbeat: 10, pnr: null,
    fleet: createFleetVehicles(c), padReservations: Object.fromEntries(PADS.map(p => [p.id, []])),
  }
  s.pnr = calculatePnr(s)
  event(s, s.status === 'ready' ? 'info' : 'error', s.failure ??
    'Route planned: ' + padById(c.origin).name + ' to ' + padById(c.destination).name + '.')
  return s
}
function copyFlight<T extends Flight>(f: T): T {
  return { ...f, position: { ...f.position }, edge: f.edge ? [...f.edge] : null,
    remaining: [...f.remaining], plannedRoute: [...f.plannedRoute], history: [...f.history] }
}
function clone(s: SimState): SimState {
  return { ...copyFlight(s), config: { ...s.config }, actual: { ...s.actual }, observations: { ...s.observations },
    pending: [...s.pending], events: [...s.events], fleet: s.fleet.map(copyFlight),
    padReservations: Object.fromEntries(Object.entries(s.padReservations).map(([k, v]) => [k, [...v]])),
    pnr: s.pnr ? { ...s.pnr, position: { ...s.pnr.position } } : null }
}
function flights(s: SimState): Array<{ id: string; origin: string; destination: string; flight: Flight }> {
  return [{ id: PRIMARY, origin: s.config.origin, destination: s.config.destination, flight: s },
    ...(s.config.fleetMode ? s.fleet.filter(v => v.id !== PRIMARY).map(v => ({ id: v.id, origin: v.origin, destination: v.destination, flight: v })) : [])]
}
export function hasActiveFlights(s: SimState): boolean {
  return s.status === 'flying' || (s.config.fleetMode && s.fleet.some(v => v.id !== PRIMARY && v.status === 'flying'))
}
function syncPrimary(s: SimState) {
  const v = s.fleet.find(f => f.id === PRIMARY)
  if (!v) return
  for (const key of ['status', 'energy', 'distance', 'target', 'diverted', 'altitudeMeters',
    'groundSpeedKmh', 'effectiveBurnPerKm', 'headwindKmh', 'failure', 'node'] as const) Object.assign(v, { [key]: s[key] })
  v.position = { ...s.position }; v.edge = s.edge ? [...s.edge] : null
  v.remaining = [...s.remaining]; v.history = [...s.history]; v.plannedRoute = [...s.plannedRoute]
}
function release(s: SimState, id: string) {
  for (const pad of PADS) s.padReservations[pad.id] = s.padReservations[pad.id].filter(v => v !== id)
}
function slotAvailable(s: SimState, pad: string, id: string) {
  return !s.config.fleetMode || !s.padReservations[pad].some(v => v !== id)
}
function reserve(s: SimState, pad: string, id: string) {
  release(s, id); s.padReservations[pad].push(id)
}
function block(s: SimState, f: Flight, id: string, message: string) {
  f.status = 'blocked'; f.failure = message; f.groundSpeedKmh = 0
  release(s, id); event(s, 'error', id + ': ' + message)
}
function reconsider(s: SimState, f: Flight, id: string, destination: string): boolean {
  const options = flightAlternatives(s, f, destination, true)
  if (options.some(p => p.id === f.target && p.feasible) && slotAvailable(s, f.target, id)) {
    reserve(s, f.target, id); return false
  }
  const next = options.find(p => p.feasible && slotAvailable(s, p.id, id))
  if (!next) {
    block(s, f, id, 'No landing pad is feasible under the received information, energy model and available slots.')
    return true
  }
  recordPosition(f, true)
  f.remaining = next.path; f.target = next.id; f.diverted = true
  reserve(s, next.id, id)
  event(s, 'warning', id + ': Diverting to ' + padById(next.id).name + '; ' + next.distance.toFixed(1) + ' km, ' + next.margin.toFixed(1) + ' kWh above reserve.')
  return true
}
function land(s: SimState, f: Flight, id: string) {
  if (s.actual[f.target] === 'closed') {
    block(s, f, id, 'Reached unavailable pad ' + padById(f.target).name + ' before its closure was received.'); return
  }
  if (f.energy < s.config.landingKwh + s.config.reserveKwh - EPS) {
    block(s, f, id, 'Landing reserve cannot be maintained.'); return
  }
  f.energy -= s.config.landingKwh; f.status = 'landed'; f.altitudeMeters = 0; f.groundSpeedKmh = 0
  release(s, id)
  event(s, 'success', id + ': Landed at ' + padById(f.target).name + ' with ' + f.energy.toFixed(1) + ' kWh remaining.')
}
function setStatus(s: SimState, id: string, status: PadStatus) {
  padById(id)
  if (status !== 'open' && status !== 'closed') throw new Error('Invalid pad status.')
  if (s.actual[id] === status) return
  s.actual[id] = status
  s.pending.push({ pad: id, status, observedAt: s.time, deliverAt: s.time + s.config.notificationDelay })
  event(s, 'warning', 'Scenario: ' + padById(id).name + ' ' + status + '. Notification delay: ' + s.config.notificationDelay + 's.')
}
function receive(s: SimState): boolean {
  const due = s.pending.filter(m => m.deliverAt <= s.time + EPS).sort((a, b) => a.deliverAt - b.deliverAt)
  s.pending = s.pending.filter(m => m.deliverAt > s.time + EPS)
  let changed = false
  for (const m of due) {
    if (m.observedAt < s.observations[m.pad].observedAt) continue
    if (s.observations[m.pad].status !== m.status) {
      changed = true; event(s, 'info', 'Planner received: ' + padById(m.pad).name + ' ' + m.status + '.')
    }
    s.observations[m.pad] = { status: m.status, observedAt: m.observedAt, receivedAt: s.time }; s.updates++
  }
  return changed
}
function scheduled(s: SimState): boolean {
  if (s.config.scenario === 'closure' && !s.closureDone && s.time >= s.config.closureAt - EPS) {
    s.closureDone = true; setStatus(s, s.config.destination, 'closed')
  }
  while (s.time >= s.nextHeartbeat - EPS) {
    for (const p of PADS) s.pending.push({ pad: p.id, status: s.actual[p.id], observedAt: s.time, deliverAt: s.time + s.config.notificationDelay })
    s.nextHeartbeat += 10
  }
  return receive(s)
}
function prepare(s: SimState, observationChanged = false) {
  let primaryChanged = observationChanged
  for (const { id, destination, flight } of flights(s)) {
    if (flight.status !== 'flying') continue
    const changed = reconsider(s, flight, id, destination)
    if (id === PRIMARY) primaryChanged ||= changed
    if (flight.status === 'flying' && !flight.remaining.length) land(s, flight, id)
  }
  if (!['ready', 'flying'].includes(s.status)) s.pnr = null
  else if (primaryChanged) s.pnr = calculatePnr(s)
  else if (s.pnr) s.pnr.isPast = s.distance >= s.pnr.distanceKm - EPS
  syncPrimary(s)
}
export function startSimulation(state: SimState): SimState {
  if (state.status !== 'ready') return state
  const s = clone(state)
  scheduled(s)
  for (const { id, origin, flight } of flights(s)) {
    if (flight.status !== 'ready') {
      if (flight.failure) event(s, 'error', id + ': ' + flight.failure)
      continue
    }
    if (s.actual[origin] === 'closed') {
      block(s, flight, id, 'Departure pad ' + padById(origin).name + ' is closed.'); continue
    }
    flight.status = 'flying'; flight.energy -= s.config.takeoffKwh
    event(s, 'info', id + ': Departure. Take-off uses ' + s.config.takeoffKwh + ' kWh.')
  }
  prepare(s, true)
  return s
}
export function changePadStatus(state: SimState, id: string, status: PadStatus): SimState {
  padById(id)
  if (status !== 'open' && status !== 'closed') throw new Error('Invalid pad status.')
  if (state.status !== 'ready' && !hasActiveFlights(state)) return state
  const s = clone(state)
  setStatus(s, id, status); prepare(s, receive(s))
  return s
}
function recordPosition(f: Flight, force = false) {
  const distance = distanceKm(f.history[f.history.length - 1], f.position)
  if (distance > (force ? 1e-10 : 0.01)) f.history.push({ ...f.position })
}
function timeToNode(s: SimState, f: Flight): number {
  if (f.status !== 'flying' || !f.remaining.length) return Infinity
  const next = padById(f.remaining[0])
  return distanceKm(f.position, next) / legWind(s.config, legStart(f, next.id), next).groundSpeedKmh * 3600
}
function move(s: SimState, f: Flight, dt: number) {
  if (f.status !== 'flying' || !f.remaining.length) return
  const next = padById(f.remaining[0])
  if (f.node) { f.edge = [f.node, next.id]; f.node = null }
  const distance = distanceKm(f.position, next), effect = legWind(s.config, legStart(f, next.id), next)
  f.groundSpeedKmh = Math.round(effect.groundSpeedKmh)
  f.effectiveBurnPerKm = effect.effectiveBurnPerKm; f.headwindKmh = Math.round(effect.headwindKmh)
  // Split at the next arrival in the caller, never spend the same dt twice.
  const amount = Math.min(distance, effect.groundSpeedKmh * dt / 3600)
  const ratio = distance < EPS ? 1 : amount / distance
  f.position = { lat: f.position.lat + (next.lat - f.position.lat) * ratio, lng: f.position.lng + (next.lng - f.position.lng) * ratio }
  f.distance += amount; f.energy -= amount * effect.effectiveBurnPerKm
  if (amount >= distance - EPS) {
    f.position = { lat: next.lat, lng: next.lng }; f.node = next.id; f.edge = null
    f.remaining.shift(); recordPosition(f, true)
  }
  f.altitudeMeters = calculateAltitude(f.distance, f.distance + routeCost(s.config, f.position, f.remaining, f.edge).distance, f.status)
}
export function advanceSimulation(state: SimState, seconds: number): SimState {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600) throw new Error('Step must be between 0 and 3600 seconds.')
  if (!hasActiveFlights(state)) return state
  const s = clone(state), end = s.time + seconds
  prepare(s, scheduled(s))
  while (s.time < end - EPS && hasActiveFlights(s)) {
    let dt = Math.min(1, end - s.time, s.nextHeartbeat - s.time)
    if (s.config.scenario === 'closure' && !s.closureDone) dt = Math.min(dt, s.config.closureAt - s.time)
    for (const message of s.pending) dt = Math.min(dt, message.deliverAt - s.time)
    for (const { flight } of flights(s)) dt = Math.min(dt, timeToNode(s, flight))
    if (dt < EPS) {
      for (const { flight } of flights(s)) if (timeToNode(s, flight) < EPS) move(s, flight, EPS)
      prepare(s, scheduled(s))
      continue
    }
    s.time += dt
    for (const { flight } of flights(s)) move(s, flight, dt)
    // Process information at an arrival timestamp before attempting to land.
    prepare(s, scheduled(s))
  }
  for (const { flight } of flights(s)) recordPosition(flight, flight.status !== 'flying')
  syncPrimary(s)
  return s
}
export function runToCompletion(config: Config): SimState {
  let s = startSimulation(createSimulation(config))
  while (hasActiveFlights(s) && s.time < 3600 - EPS) s = advanceSimulation(s, Math.min(10, 3600 - s.time))
  if (hasActiveFlights(s)) {
    s = clone(s)
    for (const { id, flight } of flights(s)) if (flight.status === 'flying')
      block(s, flight, id, 'Scenario exceeded the one-hour evaluation horizon.')
    syncPrimary(s)
  }
  return s
}
export function routeCoordinates(s: SimState): Point[] { return [s.position, ...s.remaining.map(padById)] }
export const formatTime = (seconds: number) => Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + Math.floor(seconds % 60).toString().padStart(2, '0')
