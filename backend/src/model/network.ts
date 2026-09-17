export type Point = { lat: number; lng: number }
export type Pad = Point & { id: string; name: string; district: string }
export type Corridor = { from: string; to: string }

// Hypothetical pads near Hyderabad. These are not approved vertiport locations.
export const PADS: Pad[] = [
  { id: 'P01', name: 'Gachibowli', district: 'West', lat: 17.4401, lng: 78.3489 },
  { id: 'P02', name: 'HITEC City', district: 'West', lat: 17.4484, lng: 78.3788 },
  { id: 'P03', name: 'Kondapur', district: 'Northwest', lat: 17.4738, lng: 78.3552 },
  { id: 'P04', name: 'Jubilee Hills', district: 'Central', lat: 17.4301, lng: 78.4071 },
  { id: 'P05', name: 'Banjara Hills', district: 'Central', lat: 17.4126, lng: 78.4483 },
  { id: 'P06', name: 'Begumpet', district: 'North', lat: 17.4530, lng: 78.4640 },
  { id: 'P07', name: 'Secunderabad', district: 'Northeast', lat: 17.4353, lng: 78.4974 },
  { id: 'P08', name: 'Uppal', district: 'East', lat: 17.4058, lng: 78.5596 },
  { id: 'P09', name: 'Mehdipatnam', district: 'Southwest', lat: 17.3959, lng: 78.4308 },
  { id: 'P10', name: 'Southern Hub', district: 'South', lat: 17.3520, lng: 78.4210 },
]

export const RESTRICTED: Point[] = [
  { lat: 17.414, lng: 78.464 }, { lat: 17.437, lng: 78.464 },
  { lat: 17.437, lng: 78.480 }, { lat: 17.414, lng: 78.480 },
]

const pairs = [
  ['P01','P02'], ['P01','P03'], ['P01','P09'], ['P02','P03'], ['P02','P04'],
  ['P03','P06'], ['P04','P05'], ['P04','P06'], ['P04','P09'], ['P05','P09'],
  ['P05','P07'], ['P06','P07'], ['P07','P08'], ['P09','P10'], ['P10','P08'],
]
export const CORRIDORS: Corridor[] = pairs.map(([from,to]) => ({from,to}))
export const padById = (id: string): Pad => {
  const pad = PADS.find(p => p.id === id)
  if (!pad) throw new Error(`Unknown pad: ${id}`)
  return pad
}

export function distanceKm(a: Point, b: Point): number {
  const rad = Math.PI / 180
  const dLat = (b.lat-a.lat)*rad, dLng = (b.lng-a.lng)*rad
  const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2
  return 6371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function pointInside(p: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j]
    if ((a.lat>p.lat)!==(b.lat>p.lat) && p.lng < (b.lng-a.lng)*(p.lat-a.lat)/(b.lat-a.lat)+a.lng) inside=!inside
  }
  return inside
}
function intersects(a:Point,b:Point,c:Point,d:Point):boolean {
  const cross=(p:Point,q:Point,r:Point)=>(q.lng-p.lng)*(r.lat-p.lat)-(q.lat-p.lat)*(r.lng-p.lng)
  const on=(p:Point,q:Point,r:Point)=>Math.abs(cross(p,q,r))<1e-12 && r.lng>=Math.min(p.lng,q.lng)-1e-12 && r.lng<=Math.max(p.lng,q.lng)+1e-12 && r.lat>=Math.min(p.lat,q.lat)-1e-12 && r.lat<=Math.max(p.lat,q.lat)+1e-12
  return (cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) || on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b)
}
export function corridorAllowed(c:Corridor):boolean {
  const a=padById(c.from),b=padById(c.to)
  if(pointInside(a,RESTRICTED)||pointInside(b,RESTRICTED))return false
  return !RESTRICTED.some((p,i)=>intersects(a,b,p,RESTRICTED[(i+1)%RESTRICTED.length]))
}
export const ACTIVE_CORRIDORS=CORRIDORS.filter(corridorAllowed)

export function shortestRoute(from:string,to:string):{path:string[];distance:number}|null {
  padById(from);padById(to)
  const costs=new Map(PADS.map(p=>[p.id,Infinity])),prev=new Map<string,string>()
  costs.set(from,0)
  const remaining=new Set(PADS.map(p=>p.id))
  while(remaining.size){
    const u=[...remaining].sort((a,b)=>costs.get(a)!-costs.get(b)! || a.localeCompare(b))[0]
    if(!Number.isFinite(costs.get(u)!))break
    remaining.delete(u)
    if(u===to)break
    for(const e of ACTIVE_CORRIDORS){
      const v=e.from===u?e.to:e.to===u?e.from:null
      if(!v||!remaining.has(v))continue
      const next=costs.get(u)!+distanceKm(padById(u),padById(v))
      if(next<costs.get(v)!){costs.set(v,next);prev.set(v,u)}
    }
  }
  if(!Number.isFinite(costs.get(to)!))return null
  const path=[to]
  while(path[0]!==from)path.unshift(prev.get(path[0])!)
  return {path,distance:costs.get(to)!}
}

export function bearingDegrees(from: Point, to: Point): number {
  const rad = Math.PI / 180
  const lat1 = from.lat * rad, lat2 = to.lat * rad
  const dLng = (to.lng - from.lng) * rad
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  const brng = Math.atan2(y, x) * 180 / Math.PI
  return (brng + 360) % 360
}

export function windAdjustment(bearingDeg: number, windSpeedKmh: number, windDirDeg: number, cruiseSpeedKmh: number, nominalBurnPerKm: number): { groundSpeedKmh: number; effectiveBurnPerKm: number; headwindKmh: number } {
  if (windSpeedKmh <= 0) {
    return { groundSpeedKmh: cruiseSpeedKmh, effectiveBurnPerKm: nominalBurnPerKm, headwindKmh: 0 }
  }
  const rad = Math.PI / 180
  // Relative angle between flight bearing and direction wind is blowing towards
  // Wind direction is traditionally "blowing from", so wind vector points to (windDirDeg + 180) % 360
  const windVectorDir = (windDirDeg + 180) % 360
  const angleDiff = (bearingDeg - windVectorDir) * rad
  // Tail component along flight path: positive = tailwind, negative = headwind
  const tailwindKmh = windSpeedKmh * Math.cos(angleDiff)
  const headwindKmh = -tailwindKmh
  const groundSpeedKmh = Math.max(40, cruiseSpeedKmh + tailwindKmh)
  const effectiveBurnPerKm = Math.max(0.6, Math.min(2.0, nominalBurnPerKm * (cruiseSpeedKmh / groundSpeedKmh)))
  return { groundSpeedKmh, effectiveBurnPerKm, headwindKmh }
}
