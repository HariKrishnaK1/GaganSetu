import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, Polygon, Marker, Tooltip, ZoomControl, useMap } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { PADS, ACTIVE_CORRIDORS, RESTRICTED, padById } from '@backend/model/network'
import type { Point } from '@backend/model/network'
import { routeCoordinates } from '@backend/model/simulator'
import type { SimState } from '@backend/model/simulator'
import 'leaflet/dist/leaflet.css'

const ll=(p:Point):[number,number]=>[p.lat,p.lng]

// Keep tiles aligned when responsive panels or the sidebar resize the map.
function MapResizeSync(){
  const map=useMap()
  useEffect(()=>{
    let frame=0
    const observer=new ResizeObserver(()=>{
      cancelAnimationFrame(frame)
      frame=requestAnimationFrame(()=>map.invalidateSize({animate:false,debounceMoveend:true}))
    })
    observer.observe(map.getContainer())
    return ()=>{observer.disconnect();cancelAnimationFrame(frame)}
  },[map])
  return null
}

export default function MissionMap({state,selected,onSelect,schematic,theme}:{state:SimState;selected:string;onSelect:(id:string)=>void;schematic:boolean;theme:'light'|'dark'}){
  const route=routeCoordinates(state)
  const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  const tileAttr = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

  if(schematic){
    const x=(p:Point)=>55+(p.lng-78.335)/0.24*820
    const y=(p:Point)=>470-(p.lat-17.345)/0.145*410
    const pts=(list:Point[])=>list.map(p=>`${x(p)},${y(p)}`).join(' ')
    return <div className="network-map"><svg viewBox="0 0 950 540" role="img" aria-label="Corridor network with route and landing pads">
      <defs><pattern id="grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M 38 0 L 0 0 0 38" fill="none" stroke="var(--map-grid)" strokeWidth=".7"/></pattern></defs>
      <rect width="950" height="540" fill="url(#grid)"/>
      <polygon points={pts(RESTRICTED)} fill="var(--map-zone)" stroke="var(--map-zone-line)" strokeDasharray="5 4"/>
      <text x={x(RESTRICTED[0])-25} y={y(RESTRICTED[0])+20} className="map-note">Restricted zone</text>
      {ACTIVE_CORRIDORS.map(e=><line key={e.from+e.to} x1={x(padById(e.from))} y1={y(padById(e.from))} x2={x(padById(e.to))} y2={y(padById(e.to))} stroke="var(--map-corridor)" strokeWidth="2"/>)}
      <polyline points={pts(state.history)} fill="none" stroke="var(--map-history)" strokeWidth="3" strokeDasharray="6 5"/>
      <polyline points={pts(route)} fill="none" stroke={state.diverted?'var(--map-divert)':'var(--map-route)'} strokeWidth="5" strokeLinejoin="round"/>
      {state.pnr && (
        <g className="svg-pnr">
          <circle cx={x(state.pnr.position)} cy={y(state.pnr.position)} r="7" fill={state.pnr.isPast?'var(--ui-danger)':'var(--map-divert)'} stroke="var(--surface-raised)" strokeWidth="2"/>
          <text x={x(state.pnr.position)} y={y(state.pnr.position)-12} textAnchor="middle" fill={state.pnr.isPast?'var(--ui-danger)':'var(--map-divert)'} fontSize="10" fontWeight="700">PNR</text>
        </g>
      )}
      {PADS.map(p=><g key={p.id} role="button" tabIndex={0} aria-label={`Select ${p.name}`} onClick={()=>onSelect(p.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(p.id)}}} className="svg-pad">
        <circle cx={x(p)} cy={y(p)} r={selected===p.id?13:10} fill={state.observations[p.id].status==='closed'?'var(--ui-danger)':'var(--surface-raised)'} stroke={selected===p.id?'var(--ui-accent)':'var(--ui-success)'} strokeWidth="3"/>
        <text x={x(p)} y={y(p)-21} textAnchor="middle" fill="var(--ink-title)">{p.name}</text><text x={x(p)} y={y(p)+31} textAnchor="middle" className="map-note">{p.id}</text>
      </g>)}
      <circle cx={x(state.position)} cy={y(state.position)} r="8" fill="var(--ui-accent)" stroke="var(--surface-raised)" strokeWidth="3"/>
      <text x="32" y="516" className="map-note">SCHEMATIC · Wind {state.config.windSpeedKmh} km/h · Ground Speed {state.groundSpeedKmh} km/h</text>
    </svg></div>
  }

  return <MapContainer center={[17.416,78.443]} zoom={11} minZoom={10} maxZoom={18} scrollWheelZoom={true} doubleClickZoom={true} touchZoom={true} zoomControl={false} className={`leaflet-map ${theme === 'dark' ? 'dark-map' : ''}`}>
    <MapResizeSync/>
    <TileLayer attribution={tileAttr} url={tileUrl} minZoom={10} maxZoom={18}/><ZoomControl position="topright"/>
    <Polygon positions={RESTRICTED.map(ll)} pathOptions={{color:'var(--map-zone-line)',weight:1.5,fillColor:'var(--map-zone-line)',fillOpacity: theme==='dark'? 0.22 : .27,dashArray:'5 5'}}><Tooltip>Hypothetical restricted zone</Tooltip></Polygon>
    {ACTIVE_CORRIDORS.map(e=><Polyline key={e.from+e.to} positions={[ll(padById(e.from)),ll(padById(e.to))]} pathOptions={{color:'var(--map-corridor)',weight:2,opacity: theme==='dark'? 0.65 : .45}}/>)}
    
    {/* Primary Route History & Active Route */}
    <Polyline positions={state.history.map(ll)} pathOptions={{color:'var(--map-history)',weight:3,opacity: theme==='dark'? 0.75 : .6,dashArray:'6 6'}}/>
    <Polyline positions={route.map(ll)} pathOptions={{color:state.diverted?'var(--map-divert)':'var(--map-route)',weight:5,opacity:.95}}/>

    {/* Fleet Mode Routes */}
    {state.config.fleetMode && state.fleet.map(v => v.id !== 'GS-01' ? (
      <Polyline key={`fleet-hist-${v.id}`} positions={v.history.map(ll)} pathOptions={{color: v.color, weight: 2.5, opacity: 0.7, dashArray: '4 4'}}/>
    ) : null)}

    {/* Point of No Return (PNR) Marker */}
    {state.pnr && (
      <Marker position={ll(state.pnr.position)} zIndexOffset={800} icon={divIcon({className:'',html:`<div class="pnr-pin ${state.pnr.isPast?'past':''}"><span class="pnr-dot"></span><span>PNR</span></div>`,iconSize:[42,22],iconAnchor:[21,11]})}>
        <Tooltip direction="top" offset={[0,-12]}>
          <strong>Point of No Return (PNR)</strong><br/>
          {state.pnr.distanceKm.toFixed(1)} km along corridor<br/>
          <span style={{color: state.pnr.isPast ? 'var(--ui-danger)' : 'var(--ui-success)', fontWeight: 600}}>
            {state.pnr.isPast ? '⚠ Passed: Diversion no longer feasible' : '✓ Safe divert zone'}
          </span>
        </Tooltip>
      </Marker>
    )}

    {/* Landing Pads */}
    {PADS.map(p=><Marker key={p.id} position={ll(p)} eventHandlers={{click:()=>onSelect(p.id)}} icon={divIcon({className:'',html:`<div class="pad-pin ${state.observations[p.id].status==='closed'?'closed':''} ${selected===p.id?'selected':''}">${p.id.slice(1)}</div>`,iconSize:[30,30],iconAnchor:[15,15]})}><Tooltip direction="top" offset={[0,-16]}><strong>{p.name}</strong><br/>{p.id} · Last reported {state.observations[p.id].status}{state.config.fleetMode && state.padReservations[p.id]?.length ? `<br/>Reserved by: ${state.padReservations[p.id].join(', ')}` : ''}</Tooltip></Marker>)}
    
    {/* Fleet Aircraft Markers */}
    {state.config.fleetMode ? (
      state.fleet.map(v => (
        <Marker key={v.id} position={ll(v.position)} zIndexOffset={1000} icon={divIcon({className:'',html:`<div class="aircraft-pin fleet-marker" style="border-color:${v.color};">▲<span class="fleet-badge" style="background:${v.color};">${v.id.slice(3)}</span></div>`,iconSize:[34,34],iconAnchor:[17,17]})}>
          <Tooltip>
            <strong>{v.callsign}</strong><br/>
            Target: {padById(v.target).name}<br/>
            Altitude: {v.altitudeMeters}m · Energy: {v.energy.toFixed(1)} kWh
          </Tooltip>
        </Marker>
      ))
    ) : (
      <Marker position={ll(state.position)} zIndexOffset={1000} icon={divIcon({className:'',html:'<div class="aircraft-pin">▲</div>',iconSize:[34,34],iconAnchor:[17,17]})}>
        <Tooltip>
          <strong>GS-01</strong> · {state.energy.toFixed(1)} kWh<br/>
          Altitude: {state.altitudeMeters}m · Speed: {state.groundSpeedKmh} km/h
        </Tooltip>
      </Marker>
    )}
  </MapContainer>
}
