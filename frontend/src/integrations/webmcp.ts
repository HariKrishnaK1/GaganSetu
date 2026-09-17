import type { SimState } from '@backend/model/simulator'
import { PADS } from '@backend/model/network'
import { changePadStatus, hasActiveFlights } from '@backend/model/simulator'

type Tool={name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown}
export function registerMissionTools(read:()=>SimState,write:(s:SimState)=>void){
  const doc=document as Document&{modelContext?:{registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>}}
  if(!doc.modelContext?.registerTool)return
  const lifecycle=new AbortController()
  const register=(tool:Tool)=>{try{void Promise.resolve(doc.modelContext!.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{/* Optional browser API. */}}
  register({name:'read_gagansetu_mission',description:'Read the current simulated mission and latest planner observations.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>{const s=read();return {status:s.status,time:s.time,target:s.target,energyKwh:s.energy,altitudeMeters:s.altitudeMeters,groundSpeedKmh:s.groundSpeedKmh,headwindKmh:s.headwindKmh,pnr:s.pnr,fleet:s.config.fleetMode?s.fleet:undefined,observations:s.observations}}})
  register({name:'set_simulated_pad_status',description:'Change a hypothetical pad status in this simulation. Does not affect a real landing site.',inputSchema:{type:'object',properties:{padId:{type:'string',enum:PADS.map(p=>p.id)},status:{type:'string',enum:['open','closed']}},required:['padId','status'],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input:unknown)=>{
    if(!input||typeof input!=='object')throw new Error('Expected padId and status.')
    const d=input as {padId?:string;status?:string}
    if(!PADS.some(p=>p.id===d.padId)||!['open','closed'].includes(d.status??''))throw new Error('Invalid pad or status.')
    if(read().status!=='ready'&&!hasActiveFlights(read()))throw new Error('Reset the scenario before changing pads.')
    const next=changePadStatus(read(),d.padId!,d.status as 'open'|'closed');write(next)
    return {padId:d.padId,actualStatus:next.actual[d.padId!],receivedStatus:next.observations[d.padId!].status}
  }})
  return ()=>lifecycle.abort()
}
