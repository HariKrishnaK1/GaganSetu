import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Navigation, Play, Pause, RotateCcw, Download, ArrowRight, Route, Radio, Battery, CircleCheck, TriangleAlert, SlidersHorizontal, Map as MapIcon, Network, FlaskConical, X, ChevronRight, Activity, CircleHelp, PanelLeftClose, PanelLeftOpen, Sun, Moon, Wind, Mountain, Users, Cloud, Database, Trash2 } from 'lucide-react'
import MissionMap from './components/MissionMap'
import { registerMissionTools } from './integrations/webmcp'
import { fetchHealth, saveMissionToCloud, fetchCloudRuns, deleteCloudRun } from './integrations/api'
import type { CloudDbStatus, SavedCloudRun } from './integrations/api'
import { PADS, padById, shortestRoute } from '@backend/model/network'
import { DEFAULT_CONFIG, createSimulation, startSimulation, advanceSimulation, changePadStatus, alternatives, formatTime, runToCompletion, hasActiveFlights } from '@backend/model/simulator'
import type { Config, SimState } from '@backend/model/simulator'
import './styles/App.css'
import './styles/Theme.css'

type Trial={label:string;run:SimState}
const statusLabel=(s:SimState)=>s.status!=='flying'&&hasActiveFlights(s)?'Fleet en route':({ready:'Ready for departure',flying:s.diverted?'Diverting':'En route',landed:s.diverted?'Alternative reached':'Destination reached',blocked:'Scenario stopped',infeasible:'Route infeasible'}[s.status])

export default function App(){
  const [config,setConfig]=useState<Config>({...DEFAULT_CONFIG})
  const [state,setState]=useState<SimState>(()=>createSimulation(DEFAULT_CONFIG))
  const [playbackRequested,setRunning]=useState(false)
  const [speed,setSpeed]=useState(20)
  const [selected,setSelected]=useState(DEFAULT_CONFIG.destination)
  const [schematic,setSchematic]=useState(false)
  const [tab,setTab]=useState<'mission'|'results'>('mission')
  const [sidebarOpen,setSidebarOpen]=useState(true)
  const [showMetrics,setShowMetrics]=useState(false)
  const [showControls,setShowControls]=useState(false)
  const [showOptions,setShowOptions]=useState(false)
  const [showEvents,setShowEvents]=useState(false)
  const [showAltitude,setShowAltitude]=useState(false)
  const [activeFleetId,setActiveFleetId]=useState('GS-01')
  const [theme,setTheme]=useState<'light'|'dark'>(()=>{
    try{return localStorage.getItem('gagansetu_theme')==='dark'?'dark':'light'}catch{return 'light'}
  })
  const [trials,setTrials]=useState<Trial[]>([])
  const [notice,setNotice]=useState('')
  const [cloudDb,setCloudDb]=useState<CloudDbStatus | null>(null)
  const [cloudRuns,setCloudRuns]=useState<SavedCloudRun[]>([])
  const [cloudLoading,setCloudLoading]=useState(false)
  const [savingCloud,setSavingCloud]=useState(false)
  const [resultsSubTab,setResultsSubTab]=useState<'scenarios'|'atlas'>('scenarios')
  const stateRef=useRef(state)
  useLayoutEffect(()=>{stateRef.current=state},[state])
  const active=hasActiveFlights(state)
  const running=playbackRequested&&active
  const candidates=alternatives(state),viable=candidates.filter(p=>p.feasible)
  const route=shortestRoute(config.origin,config.destination)
  const locked=active
  const selectedPad=padById(selected),observed=state.observations[selected]
  const selectedCandidate=alternatives(state,true).find(p=>p.id===selected)!

  const refreshCloudStatus=()=>{
    void fetchHealth().then(h=>{
      if(h)setCloudDb(h.database)
      else setCloudDb({status:'disconnected',message:'API server not connected. Run npm run dev:all to start backend.'})
    })
  }
  const loadCloudRuns=()=>{
    setCloudLoading(true)
    void fetchCloudRuns().then(res=>{
      if(res.ok)setCloudRuns(res.runs)
      if(res.dbStatus)setCloudDb(res.dbStatus)
      setCloudLoading(false)
    })
  }

  useEffect(()=>{
    refreshCloudStatus()
    const timer=window.setInterval(refreshCloudStatus,12000)
    return ()=>window.clearInterval(timer)
  },[])

  useEffect(()=>{
    if(tab==='results'&&resultsSubTab==='atlas'){
      void fetchCloudRuns().then(res=>{
        if(res.ok)setCloudRuns(res.runs)
        if(res.dbStatus)setCloudDb(res.dbStatus)
      })
    }
  },[tab,resultsSubTab])

  useEffect(()=>{
    document.documentElement.setAttribute('data-theme',theme)
    try{localStorage.setItem('gagansetu_theme',theme)}catch{/* Theme still works when storage is unavailable. */}
  },[theme])

  useEffect(()=>{
    if(!running)return
    const timer=window.setInterval(()=>setState(prev=>advanceSimulation(prev,speed/10)),100)
    return ()=>window.clearInterval(timer)
  },[running,speed])
  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),5000);return ()=>window.clearTimeout(timer)},[notice])
  useEffect(()=>registerMissionTools(()=>stateRef.current,s=>flushSync(()=>setState(s))),[])

  function configure(patch:Partial<Config>){
    const next={...config,...patch}
    if(next.origin===next.destination){setNotice('Departure and destination must be different.');return}
    setConfig(next);setRunning(false);setState(createSimulation(next));setTrials([])
    if(patch.destination)setSelected(patch.destination)
  }
  function reset(){setRunning(false);setState(createSimulation(config));setNotice('Scenario reset. All hypothetical pads start open.')}
  function play(){
    if(running){setRunning(false);return}
    if(state.status==='ready'){setState(startSimulation(state));setRunning(true)}
    else if(active)setRunning(true)
  }
  function exportRun(){
    const body={project:'GaganSetu',version:'0.1.0',dataType:'synthetic',model:'fixed speed; distance-based energy; bidirectional corridors; zero turn penalty',config:state.config,outcome:{status:state.status,target:state.target,timeSeconds:state.time,distanceKm:state.distance,energyKwh:state.energy,diverted:state.diverted,failure:state.failure},events:state.events,observations:state.observations,history:state.history,trials:trials.map(t=>({scenario:t.label,config:t.run.config,status:t.run.status,target:t.run.target,distanceKm:t.run.distance,timeSeconds:t.run.time,energyKwh:t.run.energy,diverted:t.run.diverted,updates:t.run.updates,failure:t.run.failure}))}
    const url=URL.createObjectURL(new Blob([JSON.stringify(body,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='gagansetu-run.json';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Run exported with its parameters and event history.')
  }
  async function handleSaveToAtlas(){
    if(savingCloud)return
    setSavingCloud(true)
    setNotice('Connecting to MongoDB Atlas to archive mission...')
    const res = await saveMissionToCloud(state)
    setSavingCloud(false)
    if(res.ok){
      setNotice('✓ Mission successfully archived in MongoDB Atlas cluster!')
      loadCloudRuns()
    } else {
      setNotice(`❌ ${res.error || 'Failed to archive mission to MongoDB Atlas.'}`)
    }
  }

  async function handleDeleteCloudRun(id: string){
    const res = await deleteCloudRun(id)
    if(res.ok){
      setCloudRuns(prev=>prev.filter(r=>r._id!==id))
      setNotice('Mission removed from MongoDB Atlas.')
    } else {
      setNotice(`❌ ${res.error || 'Failed to delete mission from Atlas.'}`)
    }
  }

  function compare(){
    const scenarios=[{label:'Normal flight',scenario:'normal' as const,notificationDelay:0},{label:'Closure · immediate update',scenario:'closure' as const,notificationDelay:0},{label:'Closure · 30s delay',scenario:'closure' as const,notificationDelay:30},{label:'Closure · 90s delay',scenario:'closure' as const,notificationDelay:90}]
    setTrials(scenarios.map(s=>({label:s.label,run:runToCompletion({...config,...s})})));setTab('results')
  }

  return <div className={`app-shell ${sidebarOpen ? '' : 'sidebar-closed'}`}>
    <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`} aria-expanded={sidebarOpen}>
      <div className="sidebar-inner">
        <div className="brand-header"><a href="#" className="brand" aria-label="GaganSetu home" onClick={e=>{e.preventDefault();setTab('mission')}}><span className="brand-icon"><Route size={23}/></span><span>GaganSetu<small>AIR MOBILITY LAB</small></span></a><button className="sidebar-close-btn" title="Collapse control bar" aria-label="Collapse control bar" onClick={()=>setSidebarOpen(false)}><PanelLeftClose size={18}/></button></div>
        <div className="sidebar-divider"/><div className="section-eyebrow">WORKSPACE</div>
        <nav aria-label="Workspace"><button className={tab==='mission'?'nav-item active':'nav-item'} onClick={()=>setTab('mission')}><Navigation size={18}/> Flight simulation <ChevronRight size={15}/></button><button className={tab==='results'?'nav-item active':'nav-item'} onClick={()=>setTab('results')}><FlaskConical size={18}/> Scenario results {trials.length>0&&<span className="count">{trials.length}</span>}</button></nav>
        
        <div className="setup-title"><span>Mission setup</span><SlidersHorizontal size={16}/></div>
        <div className="range-heading"><span>Fleet Operations</span><strong>{config.fleetMode ? '3 eVTOLs' : 'GS-01'}</strong></div>
        <div className="segmented-toggle">
          <button type="button" className={!config.fleetMode ? 'active' : ''} disabled={locked} onClick={() => configure({ fleetMode: false })}>Single (GS-01)</button>
          <button type="button" className={config.fleetMode ? 'active' : ''} disabled={locked} onClick={() => configure({ fleetMode: true })}>Fleet (3 eVTOLs)</button>
        </div>

        <div className="route-inputs" style={{ marginTop: '12px' }}>
          <label htmlFor="origin">Departure pad</label>
          <select id="origin" value={config.origin} disabled={locked} onChange={e=>configure({origin:e.target.value})}>{PADS.map(p=><option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}</select>
          <div className="route-connector"><span/><ArrowRight size={15}/></div>
          <label htmlFor="destination">Destination pad</label>
          <select id="destination" value={config.destination} disabled={locked} onChange={e=>configure({destination:e.target.value})}>{PADS.map(p=><option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}</select>
        </div>

        <label className="field-label" htmlFor="scenario">Scenario</label>
        <select id="scenario" value={config.scenario} disabled={locked} onChange={e=>configure({scenario:e.target.value as Config['scenario']})}>
          <option value="closure">Destination closes in flight</option>
          <option value="normal">Normal flight</option>
        </select>

        <div className="range-heading"><label htmlFor="battery">Starting battery</label><strong>{config.initialBattery}%</strong></div>
        <input id="battery" type="range" min="20" max="100" step="5" value={config.initialBattery} disabled={locked} onChange={e=>configure({initialBattery:Number(e.target.value)})}/>

        <div className="range-heading"><label htmlFor="delay">Notification delay</label><strong>{config.notificationDelay}s</strong></div>
        <input id="delay" type="range" min="0" max="120" step="5" value={config.notificationDelay} disabled={locked} onChange={e=>configure({notificationDelay:Number(e.target.value)})}/>

        {config.scenario==='closure'&&<div className="compact-field"><label htmlFor="closure">Close destination at</label><div><input id="closure" type="number" min="10" max="1800" step="5" value={config.closureAt} disabled={locked} onChange={e=>configure({closureAt:Math.min(1800,Math.max(10,Number(e.target.value)||10))})}/><span>sec</span></div></div>}

        <div className="range-heading"><label htmlFor="wind">Wind speed</label><strong>{config.windSpeedKmh} km/h</strong></div>
        <input id="wind" type="range" min="0" max="40" step="5" value={config.windSpeedKmh} disabled={locked} onChange={e => configure({ windSpeedKmh: Number(e.target.value) })} />

        <label className="field-label" htmlFor="windDir">Wind direction (blowing from)</label>
        <select id="windDir" value={config.windDirectionDeg} disabled={locked} onChange={e => configure({ windDirectionDeg: Number(e.target.value) })}>
          <option value={0}>North (0° - Southerly flow)</option>
          <option value={90}>East (90° - Westerly flow)</option>
          <option value={180}>South (180° - Northerly flow)</option>
          <option value={270}>West (270° - Easterly flow)</option>
        </select>

        <details className="model-settings"><summary>Aircraft model <CircleHelp size={14}/></summary><dl><div><dt>Capacity</dt><dd>38 kWh</dd></div><div><dt>Cruise speed</dt><dd>120 km/h</dd></div><div><dt>Cruise energy</dt><dd>1 kWh/km</dd></div><div><dt>Take-off / landing</dt><dd>1.5 / 1.5 kWh</dd></div><div><dt>Landing reserve</dt><dd>5 kWh</dd></div></dl><p>Illustrative parameters. Fixed speed, instantaneous turns and bidirectional corridors.</p></details>
        <div className="sidebar-bottom"><span className="version-badge">v0.2</span><span>Software simulation<small>Hypothetical operational data</small></span></div>
      </div>
    </aside>
    <main className="workspace">
      <header className="topbar">
        <div className="topbar-left">
          <button className="icon-button sidebar-toggle-btn" title={sidebarOpen ? 'Collapse control bar' : 'Expand control bar'} aria-label={sidebarOpen ? 'Collapse control bar' : 'Expand control bar'} onClick={() => setSidebarOpen(prev => !prev)}>
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <div className="breadcrumb">Workspace <ChevronRight size={13}/><strong>{tab === 'mission' ? 'Flight simulation' : 'Scenario results'}</strong></div>
        </div>

        {tab === 'mission' && (
          <div className="topbar-panel-symbols" aria-label="Toggle GIS overlay panels">
            <button className={`symbol-btn ${showMetrics ? 'active' : ''}`} title="Toggle Metrics Panel" aria-label="Toggle Metrics Panel" onClick={() => setShowMetrics(prev => !prev)}>
              <Activity size={16} />
            </button>
            <button className={`symbol-btn ${showControls ? 'active' : ''}`} title="Toggle Playback Toolbar" aria-label="Toggle Playback Toolbar" onClick={() => setShowControls(prev => !prev)}>
              <Play size={16} />
            </button>
            <button className={`symbol-btn ${showAltitude ? 'active' : ''}`} title="Toggle Vertical Altitude Profile HUD" aria-label="Toggle Vertical Altitude Profile HUD" onClick={() => setShowAltitude(prev => !prev)}>
              <Mountain size={16} />
            </button>
            <button className={`symbol-btn ${showOptions ? 'active' : ''}`} title="Toggle Landing Options Panel" aria-label="Toggle Landing Options Panel" onClick={() => setShowOptions(prev => !prev)}>
              <SlidersHorizontal size={16} />
            </button>
            <button className={`symbol-btn ${showEvents ? 'active' : ''}`} title="Toggle Mission Events Log" aria-label="Toggle Mission Events Log" onClick={() => setShowEvents(prev => !prev)}>
              <Radio size={16} />
            </button>
            <div className="symbol-divider" />
            <button className={`symbol-btn ${theme === 'dark' ? 'active' : ''}`} title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'} aria-label={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'} onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        )}

        <div className="top-actions">
          <div className="cloud-status-chip" title={cloudDb?.message || 'Connecting to backend...'}>
            <Cloud size={14} className={cloudDb?.status === 'connected' ? 'cloud-icon-active' : 'cloud-icon-muted'} />
            <span>{cloudDb?.status === 'connected' ? 'Atlas Online' : cloudDb?.status === 'unconfigured' ? 'Atlas Setup' : 'Atlas Offline'}</span>
            <span className={`cloud-pulse-dot ${cloudDb?.status || 'disconnected'}`} />
          </div>
          <button className="button mobile-tab" onClick={() => setTab(tab === 'mission' ? 'results' : 'mission')}>{tab === 'mission' ? 'Results' : 'Mission'}</button>
          <button className="button button-white" onClick={handleSaveToAtlas} disabled={savingCloud} title="Archive this simulation flight to MongoDB Atlas">
            <Cloud size={16}/><span>{savingCloud ? 'Archiving...' : 'Save to Atlas'}</span>
          </button>
          <button className="button button-white" onClick={exportRun}><Download size={16}/><span>Export JSON</span></button>
        </div>
      </header>
      <div className="page-content">
        {tab === 'mission' ? (
          <div className="gis-workspace">
            {/* FULL SCREEN MAP BACKDROP */}
            <div className="gis-map-canvas">
              <MissionMap state={state} selected={selected} onSelect={setSelected} schematic={schematic} theme={theme}/>
              <div className="map-caption"><span className="legend-line"/> Route <span className="legend-dot"/> Open <span className="legend-dot closed"/> Closed <span className="legend-pnr-badge">PNR</span> Boundary</div>
              <div className="map-wind-badge">
                <Wind size={13} />
                <span>{state.config.windSpeedKmh} km/h</span>
                <span className="wind-dir-arrow" style={{ transform: `rotate(${state.config.windDirectionDeg}deg)` }}>↓</span>
                <span className="wind-head-label">
                  {state.headwindKmh > 2 ? `+${state.headwindKmh} km/h headwind` : state.headwindKmh < -2 ? `${Math.abs(state.headwindKmh)} km/h tailwind` : 'Crosswind'}
                </span>
              </div>
            </div>

            {/* FLOATING TOP-LEFT TITLE & METRICS OVERLAY */}
            {showMetrics && (
              <div className="gis-overlay-top-left">
                <div className="gis-heading-card">
                  <div className="gis-heading-info">
                    <span className="overline">HYDERABAD STUDY AREA</span>
                    <h1>Flight simulation</h1>
                  </div>
                  <div className="gis-status-group">
                    <span className={`status-pill ${state.status==='blocked'||state.status==='infeasible'?'error':state.diverted?'amber':''}`}><span/>{statusLabel(state)}</span>
                    <span className="aircraft-id">{config.fleetMode ? 'FLEET ACTIVE' : 'GS-01'}</span>
                    <button className="panel-close-btn" title="Close metrics panel" onClick={() => setShowMetrics(false)}><X size={14}/></button>
                  </div>
                </div>
                <div className="gis-metrics-bar">
                  <div className="metric"><span className="metric-label"><Route size={13}/> Planned</span><div>{route?.distance.toFixed(1)??'—'} <small>km</small></div></div>
                  <div className="metric-divider"/>
                  <div className="metric"><span className="metric-label"><Battery size={13}/> Battery</span><div>{state.energy.toFixed(1)} <small>kWh</small></div></div>
                  <div className="metric-divider"/>
                  <div className="metric"><span className="metric-label"><Wind size={13}/> Speed</span><div>{state.groundSpeedKmh} <small>km/h</small></div></div>
                  <div className="metric-divider"/>
                  <div className="metric"><span className="metric-label"><Mountain size={13}/> Altitude</span><div>{state.altitudeMeters} <small>m</small></div></div>
                  <div className="metric-divider"/>
                  {state.pnr && (
                    <>
                      <div className="metric">
                        <span className="metric-label">PNR</span>
                        <div style={{ color: state.pnr.isPast ? 'var(--ui-danger)' : 'var(--ui-success)' }}>
                          {state.pnr.isPast ? 'PASSED' : `${state.pnr.distanceKm.toFixed(1)} km`}
                        </div>
                      </div>
                      <div className="metric-divider"/>
                    </>
                  )}
                  <div className="metric"><span className="metric-label"><CircleCheck size={13}/> Options</span><div>{viable.length.toString().padStart(2,'0')} <small>/ {PADS.length-1}</small></div></div>
                  <div className="metric-divider"/>
                  <div className="metric"><span className="metric-label"><Activity size={13}/> Clock</span><div>{formatTime(state.time)}</div></div>
                </div>
              </div>
            )}

            {/* FLOATING TOP CONTROL TOOLBAR */}
            {showControls && (
              <div className="gis-overlay-toolbar">
                <div className="flight-strip-mini">
                  <div className="endpoint"><span>DEP</span><strong>{padById(config.origin).name}</strong></div>
                  <div className="flight-progress"><Navigation size={14}/><span>{state.diverted?'DIVERTED':'ROUTE'}</span></div>
                  <div className="endpoint right"><span>{state.diverted?'DIV':'DEST'}</span><strong>{padById(state.target).name}</strong></div>
                </div>
                <div className="toolbar-divider"/>
                <div className="playback-mini">
                  <button className="button button-primary button-sm" onClick={play} disabled={state.status!=='ready'&&!active}>
                    {running?<Pause size={15}/>:<Play size={15}/>} {running?'Pause':active?'Resume':'Start'}
                  </button>
                  <button className="icon-button icon-button-sm" title="Reset scenario" onClick={reset}><RotateCcw size={15}/></button>
                  <select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))} className="speed-select-mini">
                    <option value={1}>1×</option>
                    <option value={10}>10×</option>
                    <option value={20}>20×</option>
                    <option value={60}>60×</option>
                  </select>
                </div>
                <div className="toolbar-divider"/>
                <div className="map-toggle" aria-label="Map view">
                  <button title="Geographic map" className={!schematic?'selected':''} onClick={()=>setSchematic(false)}><MapIcon size={15}/></button>
                  <button title="Offline corridor view" className={schematic?'selected':''} onClick={()=>setSchematic(true)}><Network size={15}/></button>
                </div>
                <button className="panel-close-btn" title="Close toolbar" onClick={() => setShowControls(false)}><X size={14}/></button>
              </div>
            )}

            {/* FLOATING RIGHT ANALYTICS SIDEBAR */}
            {showOptions && (
              <div className="gis-overlay-right-panel">
                <section className="panel options-panel">
                  <div className="panel-heading">
                    <h2>Landing options</h2>
                    <div className="heading-right">
                      <span className="small-count">{viable.length} feasible</span>
                      <button className="panel-close-btn" title="Close panel" onClick={() => setShowOptions(false)}><X size={14}/></button>
                    </div>
                  </div>
                  <p className="panel-subtitle">Ranked by corridor distance.</p>
                  <div className="option-list">
                    {candidates.map((p,i)=>(
                      <button key={p.id} className={`option-row ${selected===p.id?'selected':''}`} onClick={()=>setSelected(p.id)}>
                        <span className={`option-rank ${!p.feasible?'muted':''}`}>{i+1}</span>
                        <span className="option-name"><strong>{padById(p.id).name}</strong><small>{p.reportedStatus==='closed'?'Reported closed':p.feasible?`${p.margin.toFixed(1)} kWh margin`:'Insufficient energy'}</small></span>
                        <span className="option-distance">{p.distance.toFixed(1)}<small>km</small></span>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="panel selected-panel">
                  <div className="pad-detail-title"><div><span className="overline">SELECTED PAD · {selected}</span><h2>{selectedPad.name}</h2></div><span className={`pad-state ${observed.status}`}>{observed.status}</span></div>
                  <div className="detail-line"><span>Observation age</span><strong>{Math.floor(state.time-observed.observedAt)}s</strong></div>
                  <div className="detail-line"><span>Energy incl. reserve</span><strong>{selectedCandidate.required.toFixed(1)} kWh</strong></div>
                  <div className="scenario-control">
                    <span>Scenario control · actual state</span>
                    <button disabled={state.status!=='ready'&&!active} className={`button ${state.actual[selected]==='closed'?'button-white':'button-danger'}`} onClick={()=>setState(prev=>changePadStatus(prev,selected,prev.actual[selected]==='closed'?'open':'closed'))}>
                      {state.actual[selected]==='closed'?<RotateCcw size={14}/>:<X size={14}/>} {state.actual[selected]==='closed'?'Reopen pad':'Close pad'}
                    </button>
                    <small>Actual state: {state.actual[selected]}. Planner receives updates after delay.</small>
                  </div>
                </section>
              </div>
            )}

            {/* FLOATING BOTTOM-LEFT MISSION EVENTS */}
            {showEvents && (
              <div className="gis-overlay-bottom-left">
                <section className="panel event-panel">
                  <div className="panel-heading">
                    <h2><Radio size={15}/> Mission events</h2>
                    <div className="heading-right">
                      <span className="secondary">{state.updates} status deliveries</span>
                      <button className="panel-close-btn" title="Close log" onClick={() => setShowEvents(false)}><X size={14}/></button>
                    </div>
                  </div>
                  <div className="event-list" aria-live="polite">
                    {state.events.slice(-4).reverse().map(e=>(
                      <div key={e.id} className="event-row">
                        <time>{formatTime(e.time)}</time>
                        <span className={`event-dot ${e.type}`}/>
                        <p>{e.message}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* FLOATING VERTICAL ALTITUDE PROFILE HUD */}
            {showAltitude && (
              <div className="gis-overlay-altitude">
                <section className="panel altitude-panel">
                  <div className="panel-heading">
                    <h2><Mountain size={15}/> Vertical flight profile (2.5D)</h2>
                    <div className="heading-right">
                      <span className="small-count">{state.altitudeMeters}m AGL</span>
                      <button className="panel-close-btn" title="Close altitude profile" onClick={() => setShowAltitude(false)}><X size={14}/></button>
                    </div>
                  </div>
                  <div className="altitude-body">
                    <svg viewBox="0 0 380 115" className="altitude-svg" aria-label="Vertical corridor profile">
                      <defs>
                        <linearGradient id="corridorGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--ui-accent)" stopOpacity="0.3"/>
                          <stop offset="100%" stopColor="var(--ui-accent)" stopOpacity="0.02"/>
                        </linearGradient>
                      </defs>
                      <line x1="30" y1="92" x2="360" y2="92" stroke="var(--border-symbol-bar)" strokeWidth="1.5"/>
                      <line x1="30" y1="35" x2="360" y2="35" stroke="var(--border-symbol-bar)" strokeDasharray="3 3"/>
                      <text x="5" y="95" fill="var(--text-muted)" fontSize="9">0m</text>
                      <text x="5" y="38" fill="var(--text-muted)" fontSize="9">300m</text>
                      <text x="195" y="22" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Cruise Corridor · 300m AGL (Urban obstacle clearance)</text>
                      
                      {/* Geometric flight path */}
                      <path d="M 40 92 L 85 35 L 305 35 L 350 92" fill="none" stroke="var(--ui-accent)" strokeWidth="2.5" strokeLinejoin="round"/>
                      <polygon points="40,92 85,35 305,35 350,92" fill="url(#corridorGrad)"/>

                      {/* Live aircraft indicator dot */}
                      {(() => {
                        const totalEst = (route?.distance ?? 1) + (state.diverted ? 2.5 : 0)
                        const pct = Math.min(1, Math.max(0, totalEst > 0 ? state.distance / totalEst : 0))
                        const acX = 40 + pct * 310
                        const acY = 92 - (state.altitudeMeters / 300) * 57
                        return (
                          <g transform={`translate(${acX}, ${acY})`}>
                            <circle r="6" fill="var(--ui-accent)" stroke="var(--surface-raised)" strokeWidth="2"/>
                            <text x="0" y="-10" textAnchor="middle" fill="var(--text-heading)" fontSize="9" fontWeight="700">{state.altitudeMeters}m</text>
                          </g>
                        )
                      })()}
                    </svg>
                    <div className="altitude-footer">
                      <div><small>DEPARTURE</small><strong>{padById(config.origin).name}</strong></div>
                      <div>
                        <small>FLIGHT PHASE</small>
                        <strong style={{ color: 'var(--ui-accent)' }}>
                          {state.altitudeMeters === 0 ? (state.status === 'landed' ? 'Touchdown' : 'On Pad') : state.altitudeMeters < 290 ? (state.distance < 1.0 ? 'Vertical Climb' : 'Approach Descent') : 'Level Cruise (300m)'}
                        </strong>
                      </div>
                      <div><small>DESTINATION</small><strong>{padById(state.target).name}</strong></div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* FLEET MODE ACTIVE STRIP */}
            {config.fleetMode && (
              <div className="gis-overlay-fleet-strip">
                <div className="fleet-strip-label"><Users size={14}/> Fleet Operations ({state.fleet.length} eVTOLs active):</div>
                <div className="fleet-chips">
                  {state.fleet.map(v => (
                    <button key={v.id} className={`fleet-chip ${activeFleetId === v.id ? 'active' : ''}`} style={{ borderColor: v.color }} onClick={() => { setActiveFleetId(v.id); setSelected(v.target) }}>
                      <span className="fleet-dot" style={{ background: v.color }}/>
                      <strong>{v.id}</strong>
                      <span>{v.status === 'flying' ? `${v.altitudeMeters}m · ${v.energy.toFixed(1)} kWh` : v.status}</span>
                      {v.diverted && <small className="chip-divert">DIVERT</small>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {state.failure&&<div className="failure-toast" role="alert"><TriangleAlert size={17}/>{state.failure}</div>}
          </div>
        ) : (
          <div className="results-wrapper">
            <div className="results-subtabs">
              <button type="button" className={`subtab-btn ${resultsSubTab === 'scenarios' ? 'active' : ''}`} onClick={() => setResultsSubTab('scenarios')}>
                <FlaskConical size={14}/> Scenario Benchmarks {trials.length > 0 && <span className="count">{trials.length}</span>}
              </button>
              <button type="button" className={`subtab-btn ${resultsSubTab === 'atlas' ? 'active' : ''}`} onClick={() => { setResultsSubTab('atlas'); loadCloudRuns() }}>
                <Cloud size={14}/> MongoDB Atlas Archive {cloudRuns.length > 0 && <span className="count">{cloudRuns.length}</span>}
              </button>
            </div>

            {resultsSubTab === 'scenarios' ? (
              <section className="panel results-panel">
                <div className="results-heading">
                  <div>
                    <h2>Scenario comparison</h2>
                    <p>One reactive planner. Identical aircraft and route; different closure and notification conditions.</p>
                  </div>
                  <button className="button button-primary" onClick={compare}><Play size={16}/> Run four scenarios</button>
                </div>
                {trials.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead><tr><th>Scenario</th><th>Outcome</th><th>Landing pad</th><th>Duration</th><th>Distance</th><th>Energy left</th></tr></thead>
                      <tbody>{trials.map(t=><tr key={t.label}><td>{t.label}</td><td><span className={`result-tag ${t.run.status==='landed'?'good':'bad'}`}>{t.run.status==='landed'?(t.run.diverted?'Diverted & landed':'Landed'):'Infeasible / stopped'}</span></td><td>{t.run.status==='landed'?padById(t.run.target).name:'—'}</td><td>{formatTime(t.run.time)}</td><td>{t.run.distance.toFixed(1)} km</td><td>{t.run.energy.toFixed(1)} kWh</td></tr>)}</tbody>
                    </table>
                    <p className="results-note">Computed outcomes for this synthetic model. Equal outcomes are valid; delay does not necessarily change the result. This version does not compare a deadline-aware algorithm.</p>
                  </div>
                ) : (
                  <div className="empty-results">
                    <FlaskConical size={38}/>
                    <h3>Put the route through four conditions</h3>
                    <p>Compare a normal flight with a destination closure reported immediately, after 30 seconds and after 90 seconds.</p>
                    <button className="button button-white" onClick={compare}>Run scenario checks <ArrowRight size={15}/></button>
                  </div>
                )}
              </section>
            ) : (
              <section className="panel results-panel">
                <div className="results-heading">
                  <div>
                    <h2><Cloud size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }}/> MongoDB Atlas Mission Archive</h2>
                    <p>
                      {cloudDb?.status === 'connected'
                        ? `Connected to database "${cloudDb.dbName}" (${cloudRuns.length} cloud missions stored).`
                        : cloudDb?.message || 'Database not connected.'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="button button-white button-sm" onClick={loadCloudRuns} disabled={cloudLoading}>
                      <RotateCcw size={14} className={cloudLoading ? 'spin' : ''}/> Refresh
                    </button>
                    <button className="button button-primary button-sm" onClick={handleSaveToAtlas} disabled={savingCloud}>
                      <Cloud size={14}/> Save Current Flight
                    </button>
                  </div>
                </div>

                {cloudDb?.status === 'unconfigured' && (
                  <div className="atlas-setup-banner">
                    <Database size={22}/>
                    <div>
                      <strong>MongoDB Atlas Connection String Required</strong>
                      <p>Open <code>.env</code> in the project directory and set your <code>MONGODB_URI</code> to your MongoDB Atlas cluster URI.</p>
                    </div>
                  </div>
                )}

                {cloudRuns.length > 0 ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Date / Time</th>
                          <th>Mission Title</th>
                          <th>Route</th>
                          <th>Outcome</th>
                          <th>Duration</th>
                          <th>Distance</th>
                          <th>Energy Left</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cloudRuns.map(r => (
                          <tr key={r._id}>
                            <td>{new Date(r.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</td>
                            <td>{r.title}</td>
                            <td>{r.config.origin} → {r.outcome.target || r.config.destination}</td>
                            <td>
                              <span className={`result-tag ${r.outcome.status === 'landed' ? 'good' : 'bad'}`}>
                                {r.outcome.status === 'landed' ? (r.outcome.diverted ? 'Diverted & Landed' : 'Landed') : r.outcome.status}
                              </span>
                            </td>
                            <td>{formatTime(r.outcome.durationSeconds)}</td>
                            <td>{r.outcome.distanceKm.toFixed(1)} km</td>
                            <td>{r.outcome.energyLeftKwh.toFixed(1)} kWh</td>
                            <td>
                              <button
                                className="icon-button icon-button-sm delete-btn"
                                title="Delete from MongoDB Atlas"
                                onClick={() => handleDeleteCloudRun(r._id)}
                              >
                                <Trash2 size={14}/>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-results">
                    <Database size={38}/>
                    <h3>No mission runs archived in Atlas yet</h3>
                    <p>
                      {cloudDb?.status === 'connected'
                        ? 'Fly a mission and click "Save to Atlas" to populate your cloud database.'
                        : 'Connect your MongoDB Atlas cluster in .env to start persisting flights.'}
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </main>
    {notice&&<div className="toast" role="status"><CircleCheck size={17}/>{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss notification"><X size={15}/></button></div>}
  </div>
}
