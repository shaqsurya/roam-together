export const uid = () => globalThis.crypto.randomUUID();
export const currencies = ['EUR','USD','GBP','HUF','IDR','JPY','CHF','CZK','PLN','THB','SGD','AUD','CAD','KRW','KWD'];
export function precision(currency) { return new Intl.NumberFormat('en', { style:'currency', currency }).resolvedOptions().maximumFractionDigits; }
export function minor(value, currency='EUR') {
  const number = Number(value), factor=10**precision(currency);
  if(!Number.isFinite(number) || number<0 || number>1e10) throw Error('Enter a valid positive amount.');
  const result=Math.round((number+Number.EPSILON)*factor);
  if(!Number.isSafeInteger(result)) throw Error('This amount is too large.');
  return result;
}
export const major = (value, currency='EUR') => value / 10**precision(currency);
export function money(value, currency='EUR') { return new Intl.NumberFormat('en-GB',{style:'currency', currency, maximumFractionDigits:precision(currency)}).format(major(value,currency)); }
export function convert(value, from, to, rate=1) {
  if(!(rate>0) || !Number.isFinite(rate)) throw Error('Enter the exchange rate: one original currency unit in the trip currency.');
  const converted=Math.round(major(value,from)*rate*10**precision(to));
  if(!Number.isSafeInteger(converted) || converted<0) throw Error('The converted amount is too large.');
  return converted;
}
export function allocate(total, weights) {
  if(!Number.isSafeInteger(total)||total<0) throw Error('Invalid allocation total.');
  const entries=Object.entries(weights).sort(([a],[b])=>a.localeCompare(b));
  if(!entries.length||entries.some(([,w])=>!Number.isFinite(w)||w<0)) throw Error('Choose participants and valid shares.');
  const sum=entries.reduce((s,[,w])=>s+w,0);
  if(sum<=0) throw Error('At least one share must be greater than zero.');
  const rows=entries.map(([id,w])=>({id,value:Math.floor(total*w/sum),remainder:(total*w/sum)%1}));
  let left=total-rows.reduce((s,r)=>s+r.value,0);
  const ranked=[...rows].sort((a,b)=>b.remainder-a.remainder||a.id.localeCompare(b.id));
  for(let i=0;i<left;i++) ranked[i%ranked.length].value++;
  return Object.fromEntries(rows.map(r=>[r.id,r.value]));
}
export function split(total, participants, mode='equal', values={}, currency='EUR') {
  if(!participants.length) throw Error('Choose at least one person to share this cost.');
  if(mode==='exact') {
    const shares=Object.fromEntries(participants.map(id=>[id,minor(values[id]??0,currency)]));
    if(Object.values(shares).reduce((a,b)=>a+b,0)!==total) throw Error('Exact shares must add up to the total.');
    return shares;
  }
  if(mode==='percentage') {
    const weights=Object.fromEntries(participants.map(id=>[id,Number(values[id]??0)]));
    if(Math.abs(Object.values(weights).reduce((a,b)=>a+b,0)-100)>0.00001) throw Error('Percentages must add up to 100.');
    return allocate(total,weights);
  }
  return allocate(total,Object.fromEntries(participants.map(id=>[id,1])));
}
// Legacy records are classified without rewriting their amounts or participants.
export function expenseScope(e) {
  if(e.scope)return e.scope;
  const beneficiaries=Object.keys(e.shares),payers=Object.keys(e.payers);
  return beneficiaries.length===1&&payers.length===1&&beneficiaries[0]===payers[0]?'personal':'shared';
}
export function planScope(p) {return p.scope||(p.participants.length===1&&p.participants[0]===p.payer?'personal':'shared');}
export function workspaceExpenses(trip,personId=null,section='personal') {
  return trip.expenses.filter(e=>personId?(section==='shared'?expenseScope(e)==='shared'&&(personId in e.shares||personId in e.payers):expenseScope(e)==='personal'&&personId in e.shares):expenseScope(e)==='shared');
}
export function workspacePlans(trip,personId=null) {
  return trip.plans.filter(p=>personId?(p.participants.includes(personId)||p.payer===personId):planScope(p)==='shared');
}
export function workspaceSummary(trip,personId=null) {
  const sign=e=>e.kind==='refund'?-1:1;
  const personalSpent=trip.expenses.filter(e=>expenseScope(e)==='personal').reduce((n,e)=>n+sign(e)*(personId?(e.baseShares[personId]||0):e.baseAmount),0);
  const sharedCost=trip.expenses.filter(e=>expenseScope(e)==='shared').reduce((n,e)=>n+sign(e)*(personId?(e.baseShares[personId]||0):e.baseAmount),0);
  let personalPlanned=0,sharedPlanned=0;
  for(const p of trip.plans){const left=planProgress(trip,p).remaining;const amount=personId?(allocate(left,Object.fromEntries(p.participants.map(id=>[id,1])))[personId]||0):left;if(planScope(p)==='personal')personalPlanned+=amount;else sharedPlanned+=amount;}
  return {personalSpent,sharedCost,personalPlanned,sharedPlanned,cost:personalSpent+sharedCost,forecast:personalSpent+sharedCost+personalPlanned+sharedPlanned,net:personId?balances(trip)[personId]?.net||0:0};
}
export function expenseFrom(form,trip) {
  const currency=form.currency||trip.currency, amount=minor(form.amount,currency);
  if(amount<=0) throw Error('The amount must be greater than zero.');
  const personal=form.scope==='personal';
  if(personal&&!trip.people.some(p=>p.id===form.personalPerson))throw Error('Choose the traveler for this personal expense.');
  const shares=personal?{[form.personalPerson]:amount}:split(amount,form.participants,form.mode,form.values,currency);
  const payers=personal?{[form.personalPerson]:amount}:form.payers||{[form.payer]:amount};
  if(Object.values(payers).some(x=>!Number.isSafeInteger(x)||x<0)||Object.values(payers).reduce((a,b)=>a+b,0)!==amount) throw Error('Upfront payments must add up to the total.');
  const rate=currency===trip.currency?1:Number(form.rate);
  const baseAmount=convert(amount,currency,trip.currency,rate);
  return {id:form.id||uid(),scope:personal?'personal':'shared',title:form.title.trim(),category:form.category||'Other',date:form.date,currency,amount,rate,baseAmount,shares,payers,baseShares:allocate(baseAmount,shares),basePayers:allocate(baseAmount,payers),activityId:form.activityId||'',planId:form.planId||'',kind:form.kind||'expense',refundOf:form.refundOf||'',note:form.note||'',createdAt:new Date().toISOString()};
}
export function balances(trip) {
  const rows=Object.fromEntries(trip.people.map(p=>[p.id,{id:p.id,name:p.name,paid:0,cost:0,sent:0,received:0,net:0}]));
  for(const e of trip.expenses) {
    const sign=e.kind==='refund'?-1:1;
    for(const [id,amount] of Object.entries(e.basePayers)) { if(!rows[id]) throw Error('Unknown payer.'); rows[id].paid+=amount*sign; }
    for(const [id,amount] of Object.entries(e.baseShares)) { if(!rows[id]) throw Error('Unknown participant.'); rows[id].cost+=amount*sign; }
  }
  for(const s of trip.settlements.filter(s=>s.status==='confirmed'&&!s.reversed)) { rows[s.from].sent+=s.baseAmount;rows[s.to].received+=s.baseAmount; }
  for(const r of Object.values(rows)) r.net=r.paid-r.cost+r.sent-r.received;
  return rows;
}
export function transfers(trip) {
  const rows=Object.values(balances(trip)), debt=rows.filter(p=>p.net<0).map(p=>({...p,left:-p.net})).sort((a,b)=>b.left-a.left||a.id.localeCompare(b.id));
  const credit=rows.filter(p=>p.net>0).map(p=>({...p,left:p.net})).sort((a,b)=>b.left-a.left||a.id.localeCompare(b.id));
  const result=[];let i=0,j=0;
  while(i<debt.length&&j<credit.length) {const amount=Math.min(debt[i].left,credit[j].left);if(amount)result.push({from:debt[i].id,to:credit[j].id,amount});debt[i].left-=amount;credit[j].left-=amount;if(!debt[i].left)i++;if(!credit[j].left)j++;}
  return result;
}
export function planProgress(trip,plan) {
  const paid=trip.expenses.filter(e=>e.planId===plan.id).reduce((s,e)=>s+e.baseAmount*(e.kind==='refund'?-1:1),0);
  return {paid,remaining:plan.cancelled?0:Math.max(0,plan.amount-paid)};
}
export function totals(trip) {
  const spent=trip.expenses.reduce((s,e)=>s+e.baseAmount*(e.kind==='refund'?-1:1),0);
  const remaining=trip.plans.reduce((s,p)=>s+planProgress(trip,p).remaining,0);
  return {spent,remaining,forecast:spent+remaining,budgetLeft:trip.budget-spent};
}
const text=(v,n=2000)=>typeof v==='string'&&v.length<=n;
function validDate(s) { return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s; }
const validId=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(s);
export function validateTrip(t) {
  if(!t||!validId(t.id)||!text(t.name,120)||!t.name.trim()||!text(t.destination,200)||!validDate(t.start)||!validDate(t.end)||t.start>t.end||new Date(t.end)-new Date(t.start)>59*86400000)throw Error('Check the trip name, destination, and dates (up to 60 days).');
  try { if(!text(t.timezone,100))throw Error();new Intl.DateTimeFormat('en',{timeZone:t.timezone}); } catch {throw Error('Invalid trip time zone.');}
  if(!currencies.includes(t.currency)||!Number.isSafeInteger(t.budget)||t.budget<0)throw Error('Invalid trip currency or budget.');
  if(!Array.isArray(t.people)||t.people.length<1||t.people.length>20)throw Error('A trip supports 1–20 travelers.');
  const ids=t.people.map(p=>p.id);
  if(new Set(ids).size!==ids.length||t.people.some(p=>!validId(p.id)||!text(p.name,80)||!p.name.trim()))throw Error('Invalid traveler details.');
  if(!ids.includes(t.me)||!ids.includes(t.defaultPayer))throw Error('Choose a valid traveler.');
  for(const [key,limit] of [['activities',300],['expenses',400],['plans',300],['settlements',400],['tasks',200]]) {
    if(!Array.isArray(t[key])||t[key].length>limit||t[key].some(x=>!x||!validId(x.id))||new Set(t[key].map(x=>x.id)).size!==t[key].length)throw Error('Invalid or oversized '+key+'.');
  }
  const sum=m=>Object.values(m).reduce((s,n)=>s+n,0);
  const map=(m,total)=>m&&typeof m==='object'&&!Array.isArray(m)&&Object.keys(m).length>0&&Object.keys(m).every(id=>ids.includes(id))&&Object.values(m).every(n=>Number.isSafeInteger(n)&&n>=0)&&sum(m)===total;
  for(const e of t.expenses) {
    if(e.scope!==undefined&&!['personal','shared'].includes(e.scope))throw Error('Invalid expense workspace.');
    if(e.scope==='personal'&&(Object.keys(e.shares).length!==1||Object.keys(e.payers).length!==1||Object.keys(e.shares)[0]!==Object.keys(e.payers)[0]))throw Error('A personal expense must belong to one traveler who paid it.');
    if(!text(e.id,100)||!text(e.title,160)||!e.title.trim()||!['expense','refund'].includes(e.kind)||!currencies.includes(e.currency)||!Number.isSafeInteger(e.amount)||e.amount<=0||!validDate(e.date)||!text(e.note)||!text(e.category,80)) throw Error('An expense contains invalid details.');
    if(convert(e.amount,e.currency,t.currency,e.rate)!==e.baseAmount||!map(e.shares,e.amount)||!map(e.payers,e.amount)||!map(e.baseShares,e.baseAmount)||!map(e.basePayers,e.baseAmount))throw Error('An expense has inconsistent amounts or shares.');
    const sameAmounts=(a,b)=>Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([id,value])=>b[id]===value);
    if(!sameAmounts(allocate(e.baseAmount,e.shares),e.baseShares)||!sameAmounts(allocate(e.baseAmount,e.payers),e.basePayers))throw Error('Converted expense shares do not match.');
    if(e.planId&&!t.plans.some(p=>p.id===e.planId)||e.activityId&&!t.activities.some(a=>a.id===e.activityId))throw Error('An expense refers to a missing activity or planned cost.');
    if(e.kind==='refund') { const original=t.expenses.find(x=>x.id===e.refundOf&&x.kind==='expense');if(!original)throw Error('A refund must link to the original expense.'); }
  }
  for(const e of t.expenses.filter(e=>e.kind==='expense')) {const refunds=t.expenses.filter(x=>x.kind==='refund'&&x.refundOf===e.id);if(refunds.some(r=>r.currency!==e.currency)||refunds.reduce((s,r)=>s+r.amount,0)>e.amount)throw Error('Refunds cannot exceed the original payment or change its currency.');}
  for(const s of t.settlements)if(!ids.includes(s.from)||!ids.includes(s.to)||s.from===s.to||!Number.isSafeInteger(s.baseAmount)||s.baseAmount<=0||!validDate(s.date)||!text(s.note,300)||!['pending','confirmed'].includes(s.status)||s.reversed!==undefined&&typeof s.reversed!=='boolean')throw Error('A repayment is invalid.');
  for(const p of t.plans)if(p.scope!==undefined&&!['personal','shared'].includes(p.scope)||p.scope==='personal'&&(p.participants.length!==1||p.participants[0]!==p.payer)||!text(p.id,100)||!text(p.title,160)||!p.title.trim()||!Number.isSafeInteger(p.amount)||p.amount<0||!ids.includes(p.payer)||!Array.isArray(p.participants)||!p.participants.length||!p.participants.every(id=>ids.includes(id))||new Set(p.participants).size!==p.participants.length||p.due&&!validDate(p.due)||p.activityId&&!t.activities.some(a=>a.id===p.activityId))throw Error('A planned cost is invalid.');
  const time=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  for(const a of t.activities)if(!text(a.id,100)||!text(a.title,160)||!a.title.trim()||!validDate(a.date)||a.date<t.start||a.date>t.end||!text(a.address,500)||!text(a.notes)||!Array.isArray(a.participants)||!a.participants.every(id=>ids.includes(id))||!time(a.time)||!time(a.endTime)||a.time>a.endTime||a.cancelBy&&!validDate(a.cancelBy)||a.bookingUrl&&!/^https?:\/\//.test(a.bookingUrl))throw Error('An activity is invalid.');
  for(const task of t.tasks)if(!text(task.id,100)||!text(task.title,160)||typeof task.done!=='boolean'||task.assignee&&!ids.includes(task.assignee))throw Error('A checklist task is invalid.');
  if(Math.abs(Object.values(balances(t)).reduce((s,p)=>s+p.net,0))!==0)throw Error('The trip balances do not reconcile.');
  if(JSON.stringify(t).length>600000)throw Error('This trip is too large. Export it and start another trip.');
  return t;
}
export function dates(start,end) {const result=[];let d=new Date(start+'T12:00:00Z');while(d.toISOString().slice(0,10)<=end&&result.length<60){result.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1);}return result;}
export const csvCell = x => '"'+String(/^[=+\-@\t\r]/.test(String(x))?"'"+x:x).replaceAll('"','""')+'"';
export function csv(trip) {
  const header=['Date','Description','Type','Category','Currency','Original amount','Exchange rate','Trip currency','Trip amount','Paid upfront by','Shared by','Notes'];
  const name=id=>trip.people.find(p=>p.id===id)?.name||id;
  return '\uFEFF'+[header,...trip.expenses.map(e=>[e.date,e.title,e.kind,e.category,e.currency,major(e.amount,e.currency),e.rate,trip.currency,major(e.baseAmount,trip.currency),Object.entries(e.payers).map(([id,v])=>name(id)+': '+major(v,e.currency)).join('; '),Object.entries(e.shares).map(([id,v])=>name(id)+': '+major(v,e.currency)).join('; '),e.note])].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export function newTrip({name,destination,start,end,currency='EUR',budget=0,person='You'}) {
  const me=uid();return {id:uid(),name,destination,start,end,currency,budget:minor(budget,currency),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,people:[{id:me,name:person}],me,defaultPayer:me,activities:[],plans:[],expenses:[],settlements:[],tasks:[],archived:false,sample:false};
}
export function sampleTrip() {
  const t={id:'sample-vienna',name:'Vienna, together.',destination:'Vienna, Austria',start:'2026-12-12',end:'2026-12-14',currency:'EUR',budget:90000,timezone:'Europe/Vienna',people:[{id:'you',name:'You'},{id:'ben',name:'Ben'},{id:'cara',name:'Cara'}],me:'you',defaultPayer:'you',sample:true,archived:false,activities:[],plans:[],expenses:[],settlements:[],tasks:[]};
  t.activities=[
    {id:'arrival',title:'Hello, Vienna',date:t.start,time:'10:00',endTime:'11:00',category:'Transport',address:'Wien Hauptbahnhof, Vienna',meeting:'Main station entrance',notes:'Meet up, grab a coffee, and head into the city.',participants:['you','ben','cara'],bookingUrl:'',bookedBy:'you',bookingStatus:'Planned',travelMode:'Public transport'},
    {id:'hotel',title:'Drop bags & settle in',date:t.start,time:'12:00',endTime:'13:00',category:'Stay',address:'Vienna city centre, Austria',meeting:'Choose your hotel and add its exact address',notes:'Sample accommodation. Replace with your own booking.',participants:['you','ben','cara'],bookingUrl:'',bookedBy:'you',bookingStatus:'Planned',travelMode:'Walk'},
    {id:'walk',title:'Old town, slow afternoon',date:t.start,time:'14:00',endTime:'16:00',category:'Explore',address:'Stephansplatz, 1010 Wien, Austria',meeting:'Outside the cathedral',notes:'A relaxed walk through the old town. Leave time to get a little lost.',participants:['you','ben','cara'],bookingUrl:'',bookedBy:'you',bookingStatus:'Planned',travelMode:'Walk'},
    {id:'dinner',title:'Dinner with the whole crew',date:t.start,time:'19:00',endTime:'20:30',category:'Food',address:'Vienna, Austria',meeting:'Pick a restaurant together',notes:'Sample dinner cost, split three ways.',participants:['you','ben','cara'],bookingUrl:'',bookedBy:'ben',bookingStatus:'Planned',travelMode:'Walk'},
    {id:'museum',title:'A morning at the museum',date:'2026-12-13',time:'10:00',endTime:'12:00',category:'Explore',address:'MuseumsQuartier, Museumsplatz 1, Vienna',meeting:'Main courtyard',notes:'Ben and Cara are joining. Sample price, not a live ticket quote.',participants:['ben','cara'],bookingUrl:'',bookedBy:'cara',bookingStatus:'Planned',travelMode:'Public transport'},
    {id:'coffee',title:'One more coffee before we go',date:'2026-12-14',time:'10:00',endTime:'11:00',category:'Food',address:'Vienna city centre, Austria',meeting:'Choose a café',notes:'Slow morning, then onwards.',participants:['you','ben','cara'],bookingUrl:'',bookedBy:'you',bookingStatus:'Planned',travelMode:'Walk'}
  ];
  t.plans=[{id:'p-hotel',title:'Accommodation',amount:24000,payer:'you',participants:['you','ben','cara'],activityId:'hotel',due:'2026-12-12',provider:'Your hotel',cancelled:false},{id:'p-dinner',title:'Group dinner',amount:6000,payer:'ben',participants:['you','ben','cara'],activityId:'dinner',due:'2026-12-12',provider:'Restaurant',cancelled:false},{id:'p-museum',title:'Museum tickets',amount:4000,payer:'cara',participants:['ben','cara'],activityId:'museum',due:'2026-12-13',provider:'Museum',cancelled:false},{id:'p-coffee',title:'Coffee & breakfast',amount:4500,payer:'you',participants:['you','ben','cara'],activityId:'coffee',due:'2026-12-14',provider:'Café',cancelled:false}];
  for(const [title,amount,payer,participants,planId,activityId,category] of [['Hotel payment',240,'you',['you','ben','cara'],'p-hotel','hotel','Stay'],['Dinner',60,'ben',['you','ben','cara'],'p-dinner','dinner','Food'],['Museum tickets',40,'cara',['ben','cara'],'p-museum','museum','Explore']])t.expenses.push(expenseFrom({title,amount,payer,participants,planId,activityId,category,date:t.start,currency:'EUR',mode:'equal'},t));
  t.tasks=[{id:'t1',title:'Book accommodation',done:true,assignee:'you'},{id:'t2',title:'Check train times',done:false,assignee:'ben'},{id:'t3',title:'Choose a dinner spot',done:false,assignee:'cara'},{id:'t4',title:'Download offline maps',done:false,assignee:''}];
  return validateTrip(t);
}
