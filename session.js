import {sampleTrip,validateTrip} from './core.js';
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id);
export const localKey=id=>'device:'+id;
export const cloudKey=id=>'cloud:'+id;
export function parseTripKey(key){const match=/^(device|cloud):([A-Za-z0-9_-]{1,100})$/.exec(String(key));return match?{kind:match[1],id:match[2]}:null;}
export function rememberShared(state,entry){
  if(!validId(entry?.tripId))return false;
  state.sharedTrips??=[];
  const old=state.sharedTrips.find(t=>t.tripId===entry.tripId),name=typeof entry.name==='string'&&entry.name.trim()?entry.name.trim().slice(0,120):old?.name||'Shared trip';
  const next={tripId:entry.tripId,name,...(typeof entry.linkAccess==='boolean'?{linkAccess:entry.linkAccess}:old&&typeof old.linkAccess==='boolean'?{linkAccess:old.linkAccess}:{})};
  if(old&&JSON.stringify(old)===JSON.stringify(next))return false;
  state.sharedTrips=old?state.sharedTrips.map(t=>t.tripId===entry.tripId?next:t):[...state.sharedTrips,next];return true;
}
export function tripEntries(state){return [...(state.sharedTrips||[]).map(t=>({key:cloudKey(t.tripId),id:t.tripId,name:t.name,kind:'cloud',label:t.name+' · cloud'})),...state.trips.map(t=>({key:localKey(t.id),id:t.id,name:t.name,kind:'device',label:t.name+(t.sample?' · sample':' · device')}))];}
export function recoverSession(raw,bookmarks=[]){
  const rejected=[];let source;
  try{source=typeof raw==='string'?JSON.parse(raw):raw;}catch{rejected.push('Unreadable saved data');}
  if(!source||typeof source!=='object')source={version:1,trips:[]};else if(source.version!==1)rejected.push('Unrecognized saved-data version');
  const trips=[];for(const t of Array.isArray(source.trips)?source.trips:[]){try{validateTrip(t);if(!trips.some(x=>x.id===t.id))trips.push(t);}catch{rejected.push(typeof t?.name==='string'?t.name:'Damaged trip');}}
  if(!trips.length)trips.push(sampleTrip());
  const selected=trips.some(t=>t.id===source.selected)?source.selected:trips[0].id;
  const state={version:1,trips,selected,selection:localKey(selected),sharedTrips:[],view:['home','plan','money','trip'].includes(source.view)?source.view:'home',day:typeof source.day==='string'?source.day:'',moneyTab:typeof source.moneyTab==='string'?source.moneyTab:'shared',personViews:source.personViews&&typeof source.personViews==='object'&&!Array.isArray(source.personViews)?source.personViews:{},workspaceViews:source.workspaceViews&&typeof source.workspaceViews==='object'&&!Array.isArray(source.workspaceViews)?source.workspaceViews:{}};
  for(const t of Array.isArray(source.sharedTrips)?source.sharedTrips:[])rememberShared(state,t);
  for(const t of Array.isArray(bookmarks)?bookmarks:[])if(!state.sharedTrips.some(x=>x.tripId===t?.tripId))rememberShared(state,t);
  if(tripEntries(state).some(t=>t.key===source.selection))state.selection=source.selection;
  return {state,rejected};
}
export const deviceStamp=trip=>JSON.stringify(trip);
export function mergeDeviceSave(state,latest,next,expected){
  const existing=latest.trips.find(t=>t.id===next.id);
  if(existing&&expected!==null&&deviceStamp(existing)!==expected)throw Error('This device trip changed in another tab. Your draft is kept on this device. Close this form and review the latest trip.');
  const result={...state,trips:latest.trips.map(t=>t.id===next.id?next:t),sharedTrips:[...state.sharedTrips]};
  for(const t of state.trips)if(!result.trips.some(x=>x.id===t.id))result.trips.push(t.id===next.id?next:t);
  for(const t of latest.sharedTrips)rememberShared(result,t);
  return result;
}
