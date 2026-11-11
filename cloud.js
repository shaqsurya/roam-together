import {firebaseConfig as fileConfig} from './firebase-config.js';
import {uid,validateTrip} from './core.js';
export class Cloud {
  constructor(onChange,onStatus) {this.onChange=onChange;this.onStatus=onStatus;this.user=null;this.trip=null;this.meta=null;this.revision=0;this.unsub=[];this.config=fileConfig;this.requests=[];this.receipts=[];}
  async init(config=this.config) {
    if(!config)return false;
    if(!config.apiKey||!config.projectId||!config.authDomain||!config.appId)throw Error('The Firebase web configuration needs apiKey, projectId, authDomain, and appId.');
    this.config=config;this.onStatus('Connecting…');
    const base='https://www.gstatic.com/firebasejs/13.2.0/';
    const [app,auth,fire]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
    this.a=auth;this.f=fire;this.app=app.getApps().find(a=>a.name==='roam')||app.initializeApp(config,'roam');this.auth=auth.getAuth(this.app);this.db=fire.getFirestore(this.app);
    await auth.setPersistence(this.auth,auth.browserSessionPersistence);
    await new Promise(resolve=>{const unsub=auth.onAuthStateChanged(this.auth,user=>{this.user=user;this.onStatus(user?'Signed in':'Not signed in');this.onChange();resolve();});this.authUnsub=unsub;});
    return true;
  }
  async signIn(){if(!this.auth)throw Error('Connect a free Firebase project first.');await this.a.signInWithPopup(this.auth,new this.a.GoogleAuthProvider());}
  async signOut(){this.stop();if(this.auth)await this.a.signOut(this.auth);this.trip=null;this.meta=null;this.onChange();}
  stop(){this.unsub.forEach(f=>f());this.unsub=[];this.requests=[];this.receipts=[];}
  get role(){if(!this.user||!this.meta)return null;return this.meta.ownerId===this.user.uid?'owner':this.meta.editors.includes(this.user.uid)?'editor':this.meta.viewers.includes(this.user.uid)?'viewer':null;}
  get traveler(){return Object.entries(this.meta?.accounts||{}).find(([,id])=>id===this.user?.uid)?.[0]||null;}
  get canEdit(){return ['owner','editor'].includes(this.role);}
  publish(){if(this.trip){const t=structuredClone(this.trip);t.settlements=this.receipts;try{validateTrip(t);this.onChange(t);return true;}catch(e){console.warn('Roam shared-data validation:',e.message);this.onStatus('Shared data needs review: '+e.message);return false;}}this.onChange();return false;}
  async create(trip){
    if(!this.user)await this.signIn();
    const data=structuredClone(validateTrip(trip));data.id=uid();data.settlements=[];
    if(trip.settlements.length)throw Error('Choose a trip without existing repayments for its first cloud upload. Export your existing records before migrating.');
    const ref=this.f.doc(this.db,'trips',data.id);
    const accounts={[data.me]:this.user.uid};
    await this.f.setDoc(ref,{ownerId:this.user.uid,editors:[],viewers:[],accounts,travelerIds:data.people.map(p=>p.id),revision:1,data,updatedAt:this.f.serverTimestamp()});
    await this.index(data.id,data.name);await this.open(data.id);return data.id;
  }
  async index(id,name){await this.f.setDoc(this.f.doc(this.db,'users',this.user.uid,'trips',id),{name,tripId:id});}
  async list(){if(!this.user)return[];const s=await this.f.getDocs(this.f.collection(this.db,'users',this.user.uid,'trips'));return s.docs.map(d=>d.data());}
  async open(id){
    if(!this.user)await this.signIn();
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw Error('Invalid trip link.');
    const ref=this.f.doc(this.db,'trips',id);let initial;
    try{initial=await this.f.getDoc(ref);}catch{throw Error('You do not have access yet. Ask the trip owner to approve your request.');}
    if(!initial.exists())throw Error('Trip unavailable. Check the link with its owner.');
    this.stop();this.meta=initial.data();this.revision=this.meta.revision;this.trip=this.meta.data;this.trip.settlements=[];this.activeId=id;
    this.unsub.push(this.f.onSnapshot(ref,{includeMetadataChanges:true},s=>{
      if(!s.exists()){this.trip=null;this.onStatus('Trip unavailable');this.onChange();return;}
      const next=s.data();this.meta=next;this.revision=next.revision;this.trip=next.data;this.onStatus(s.metadata.fromCache?'Cached · reconnect to sync':'Live · saved to cloud');this.publish();
    },()=>{this.stop();this.trip=null;this.meta=null;this.onStatus('Access unavailable');this.onChange(null);}));
    this.unsub.push(this.f.onSnapshot(this.f.collection(ref,'settlements'),s=>{this.receipts=s.docs.map(d=>({...d.data(),id:d.id}));this.publish();},()=>this.onStatus('Repayments could not sync')));
    if(this.role==='owner')this.unsub.push(this.f.onSnapshot(this.f.collection(ref,'requests'),s=>{this.requests=s.docs.map(d=>({...d.data(),uid:d.id}));this.publish();}));
    await this.index(id,this.trip.name);if(!this.publish())throw Error('The shared trip could not be displayed. Check the connection message before retrying.');
  }
  async save(trip,expectedRevision){
    if(!this.canEdit)throw Error('Only trip owners and editors can make changes.');
    if(!navigator.onLine)throw Error('You are offline. Your changes were saved as a local draft; reconnect before sharing them.');
    const data=structuredClone(validateTrip(trip));data.settlements=[];
    const ref=this.f.doc(this.db,'trips',trip.id);
    await this.f.runTransaction(this.db,async tx=>{const snap=await tx.get(ref);if(snap.data().revision!==expectedRevision)throw Error('Someone updated this trip while you were editing. Your draft is kept on this device. Review the latest trip and try again.');const update={data,revision:expectedRevision+1,updatedAt:this.f.serverTimestamp()};if(snap.data().ownerId===this.user.uid)update.travelerIds=data.people.map(p=>p.id);tx.update(ref,update);});
  }
  async request(id){if(!this.user)await this.signIn();if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw Error('Invalid trip ID.');await this.f.setDoc(this.f.doc(this.db,'trips',id,'requests',this.user.uid),{name:this.user.displayName||'Traveler',email:this.user.email||'',createdAt:this.f.serverTimestamp()});}
  async approve(request,role,travelerId){
    if(this.role!=='owner')throw Error('Only the owner can approve access.');
    const ref=this.f.doc(this.db,'trips',this.activeId);
    await this.f.runTransaction(this.db,async tx=>{const snap=await tx.get(ref);const d=snap.data(),accounts={...d.accounts};
      if(travelerId){if(accounts[travelerId]&&accounts[travelerId]!==request.uid)throw Error('That traveler is already linked to an account.');for(const k of Object.keys(accounts))if(accounts[k]===request.uid)delete accounts[k];accounts[travelerId]=request.uid;}
      const editors=d.editors.filter(id=>id!==request.uid),viewers=d.viewers.filter(id=>id!==request.uid);(role==='editor'?editors:viewers).push(request.uid);
      tx.update(ref,{editors,viewers,accounts,revision:d.revision+1});tx.delete(this.f.doc(ref,'requests',request.uid));
    });
  }
  async revoke(id){if(this.role!=='owner')throw Error('Only the owner can remove access.');const accounts={...this.meta.accounts};for(const key of Object.keys(accounts))if(accounts[key]===id)delete accounts[key];await this.f.updateDoc(this.f.doc(this.db,'trips',this.activeId),{editors:this.meta.editors.filter(x=>x!==id),viewers:this.meta.viewers.filter(x=>x!==id),accounts,revision:this.revision+1});}
  canConfirm(s){const recipient=this.meta?.accounts?.[s.to];return recipient?this.user?.uid===recipient:this.role==='owner';}
  async addSettlement(s){if(!this.canEdit)throw Error('Only editors can record repayments.');const fromUid=this.meta.accounts[s.from];if(this.user.uid!==fromUid&&this.role!=='owner')throw Error('You can record your own repayments. The owner can record payments for guests.');await this.f.setDoc(this.f.doc(this.db,'trips',this.activeId,'settlements',s.id),{...s,status:'pending',reversed:false,createdBy:this.user.uid,confirmedBy:'',confirmedAt:null});}
  async confirmSettlement(s){if(!this.canConfirm(s))throw Error('Only the recipient, or the owner for an unlinked guest, can confirm receipt.');await this.f.updateDoc(this.f.doc(this.db,'trips',this.activeId,'settlements',s.id),{status:'confirmed',confirmedBy:this.user.uid,confirmedAt:this.f.serverTimestamp()});}
  async reverseSettlement(s){if(!this.canConfirm(s))throw Error('Only the recipient, or owner for an unlinked guest, can reverse this receipt.');await this.f.updateDoc(this.f.doc(this.db,'trips',this.activeId,'settlements',s.id),{reversed:true});}
}
