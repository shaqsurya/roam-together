import {firebaseConfig as fileConfig} from './firebase-config.js';
import {uid,validateTrip} from './core.js';
export class Cloud {
  constructor(onChange,onStatus) {this.onChange=onChange;this.onStatus=onStatus;this.user=null;this.trip=null;this.meta=null;this.revision=0;this.unsub=[];this.config=fileConfig;this.receipts=[];this.generation=0;this.activeId=null;this.receiptsReady=false;}
  async init(config=this.config) {
    if(!config)return false;
    if(!config.apiKey||!config.projectId||!config.authDomain||!config.appId)throw Error('The Firebase web configuration needs apiKey, projectId, authDomain, and appId.');
    this.config=config;this.authUnsub?.();this.onStatus('Connecting…');
    const base='https://www.gstatic.com/firebasejs/13.2.0/';
    const [app,auth,fire]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
    this.a=auth;this.f=fire;const appName=config.projectId===fileConfig?.projectId?'roam':'roam-'+config.projectId;this.app=app.getApps().find(a=>a.name===appName)||app.initializeApp(config,appName);this.auth=auth.getAuth(this.app);this.db=fire.getFirestore(this.app);
    await auth.setPersistence(this.auth,auth.browserSessionPersistence);
    await new Promise(resolve=>{const unsub=auth.onAuthStateChanged(this.auth,user=>{this.user=user;if(!this.trip)this.onStatus(user?'Signed in':'Not signed in');this.onChange();resolve();});this.authUnsub=unsub;});
    return true;
  }
  async signIn(){if(!this.auth)throw Error('Cloud saving is still connecting. Try again in a moment.');await this.a.signInWithPopup(this.auth,new this.a.GoogleAuthProvider());this.user=this.auth.currentUser;}
  async signOut(){this.stop();if(this.auth)await this.a.signOut(this.auth);this.user=null;this.onChange();}
  stop(){this.generation++;this.unsub.forEach(f=>f());this.unsub=[];this.receipts=[];this.receiptsReady=false;this.trip=null;this.meta=null;this.activeId=null;this.revision=0;}
  get role(){if(!this.user||!this.meta)return null;return this.meta.ownerId===this.user.uid?'owner':this.meta.editors.includes(this.user.uid)?'editor':this.meta.viewers.includes(this.user.uid)?'viewer':null;}
  get traveler(){return Object.entries(this.meta?.accounts||{}).find(([,id])=>id===this.user?.uid)?.[0]||null;}
  get linkAccess(){return this.meta?.linkAccess===true;}
  get canEdit(){return this.linkAccess||['owner','editor'].includes(this.role);}
  get canManage(){return this.linkAccess||this.role==='owner';}
  publish(){if(this.trip){const t=structuredClone(this.trip);t.settlements=this.receipts;try{validateTrip(t);this.onChange(t);return true;}catch(e){console.warn('Roam shared-data validation:',e.message);this.stop();this.onStatus('Shared data needs review: '+e.message);this.onChange(null);return false;}}this.onChange();return false;}
  async create(trip,{onAllocated}={}){
    if(!this.user)await this.signIn();
    const data=structuredClone(validateTrip(trip));data.id=uid();data.settlements=[];
    if(trip.settlements.length)throw Error('Choose a trip without existing repayments for its first cloud upload. Export your existing records before migrating.');
    onAllocated?.({tripId:data.id,name:data.name,linkAccess:true});
    const ref=this.f.doc(this.db,'trips',data.id);
    const accounts={[data.me]:this.user.uid};
    await this.f.setDoc(ref,{ownerId:this.user.uid,editors:[],viewers:[],accounts,travelerIds:data.people.map(p=>p.id),revision:1,linkAccess:true,data,updatedAt:this.f.serverTimestamp()});
    // Indexing is a convenience: a failed index write must not hide an already-created trip.
    await this.index(data.id,data.name).catch(()=>{});return data.id;
  }
  async index(id,name){if(!this.user)return;await this.f.setDoc(this.f.doc(this.db,'users',this.user.uid,'trips',id),{name,tripId:id});}
  async list(){if(!this.user)return[];const s=await this.f.getDocs(this.f.collection(this.db,'users',this.user.uid,'trips'));return s.docs.map(d=>d.data());}
  async open(id){
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw Error('Invalid trip link.');
    if(!this.db)throw Error('Cloud saving is still connecting. Try again in a moment.');
    this.stop();const generation=this.generation;this.activeId=id;
    const current=()=>this.generation===generation&&this.activeId===id;
    const ref=this.f.doc(this.db,'trips',id);let initial;
    try{initial=await this.f.getDoc(ref);}catch(e){if(!current())return false;this.activeId=null;if(e.code==='permission-denied')throw Error('Trip unavailable or restricted. Check its link; for an older private trip, sign in as its owner.');throw Error('Could not connect to this trip. Check your connection and try again.');}
    if(!current())return false;
    if(!initial.exists()){this.activeId=null;throw Error('Trip not found. Check the link and try again.');}
    const apply=s=>{const next=s.data();validateTrip({...next.data,settlements:[]});this.meta=next;this.revision=next.revision;this.trip=structuredClone(next.data);this.trip.settlements=[];};
    try{apply(initial);}catch(e){this.stop();throw Error('The saved trip needs review: '+e.message);}
    this.unsub.push(this.f.onSnapshot(ref,{includeMetadataChanges:true},s=>{
      if(!current())return;
      if(!s.exists()){this.stop();this.onStatus('Trip unavailable');this.onChange(null);return;}
      try{apply(s);this.onStatus(s.metadata.fromCache?'Cached · reconnect to sync':'Live · saved to cloud');this.publish();}catch(e){this.stop();this.onStatus('Shared data needs review: '+e.message);this.onChange(null);}
    },()=>{if(!current())return;this.stop();this.onStatus('Access unavailable');this.onChange(null);}));
    this.unsub.push(this.f.onSnapshot(this.f.collection(ref,'settlements'),s=>{if(!current())return;this.receipts=s.docs.map(d=>({...d.data(),id:d.id}));this.receiptsReady=true;this.publish();},()=>{if(!current())return;this.receiptsReady=false;this.onStatus('Repayments could not sync');}));
    if(!this.publish())throw Error('The shared trip could not be displayed.');
    // Never make access depend on an optional per-account recent-trip index.
    this.index(id,this.trip.name).catch(()=>{});
    return true;
  }
  async save(trip,expectedRevision){
    if(!this.receiptsReady)throw Error('Wait for repayment history to finish syncing before saving changes.');
    if(!this.canEdit||trip.id!==this.activeId)throw Error('Open this shared trip before saving changes.');
    const generation=this.generation,canManage=this.canManage;
    const data=structuredClone(validateTrip(trip));data.settlements=[];
    const ref=this.f.doc(this.db,'trips',trip.id);
    await this.f.runTransaction(this.db,async tx=>{if(this.generation!==generation)throw Error('Trip changed before the save completed.');const snap=await tx.get(ref);if(this.generation!==generation)throw Error('Trip changed before the save completed.');if(!snap.exists())throw Error('Trip is no longer available.');if(snap.data().revision!==expectedRevision)throw Error('Someone updated this trip while you were editing. Your draft is kept on this device. Review the latest trip and try again.');const update={data,revision:expectedRevision+1,updatedAt:this.f.serverTimestamp()};if(canManage)update.travelerIds=data.people.map(p=>p.id);tx.update(ref,update);});
  }
  async enableLinkSharing(){if(this.role!=='owner')throw Error('Only the owner can enable a link for this older trip.');const ref=this.f.doc(this.db,'trips',this.activeId);await this.f.runTransaction(this.db,async tx=>{const snap=await tx.get(ref);tx.update(ref,{linkAccess:true,revision:snap.data().revision+1,updatedAt:this.f.serverTimestamp()});});if(this.meta)this.meta.linkAccess=true;this.onChange();}
  canConfirm(s){if(this.linkAccess)return true;const recipient=this.meta?.accounts?.[s.to];return recipient?this.user?.uid===recipient:this.role==='owner';}
  async addSettlement(s){if(!this.receiptsReady)throw Error('Wait for repayment history to finish syncing before recording another repayment.');if(!this.canEdit)throw Error('Only editors can record repayments.');const fromUid=this.meta.accounts[s.from];if(!this.linkAccess&&this.user?.uid!==fromUid&&this.role!=='owner')throw Error('You can record your own repayments. The owner can record payments for guests.');await this.f.setDoc(this.f.doc(this.db,'trips',this.activeId,'settlements',s.id),{...s,status:'pending',reversed:false,createdBy:this.user?.uid||'link-guest',confirmedBy:'',confirmedAt:null});}
  async confirmSettlement(s){if(!this.receiptsReady)throw Error('Repayment history is not ready. Reopen the trip and try again.');if(!this.canConfirm(s))throw Error('Only the recipient, or the owner for an unlinked guest, can confirm receipt.');await this.f.updateDoc(this.f.doc(this.db,'trips',this.activeId,'settlements',s.id),{status:'confirmed',confirmedBy:this.user?.uid||'link-guest',confirmedAt:this.f.serverTimestamp()});}
  async reverseSettlement(s){if(!this.receiptsReady)throw Error('Repayment history is not ready. Reopen the trip and try again.');if(!this.canConfirm(s))throw Error('Only the recipient, or owner for an unlinked guest, can reverse this receipt.');await this.f.updateDoc(this.f.doc(this.db,'trips',this.activeId,'settlements',s.id),{reversed:true});}
}
