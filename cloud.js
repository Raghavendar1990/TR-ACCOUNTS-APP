/* TR Accounts Cloud: Gmail sign-in, automatic sync, and conflict-safe uploads. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, reauthenticateWithPopup, setPersistence, browserLocalPersistence, signInWithCredential } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, runTransaction, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const btn=document.getElementById("cloudSetup"),notice=document.getElementById("moduleNotice");document.getElementById("profileGmailLogin")?.addEventListener("click",()=>btn?.click());
const loginGate=document.getElementById("trLoginGate"),loginStatus=document.getElementById("trLoginStatus"),googleLoginBtn=document.getElementById("trGoogleLogin");function loginMsg(s){if(loginStatus)loginStatus.textContent=s;}function showLoginGate(show){if(loginGate)loginGate.style.display=show?"flex":"none";if(show){document.querySelector(".app").style.display="none";document.querySelector(".nav").style.display="none";}}

const missing=!firebaseConfig||Object.values(firebaseConfig).some(v=>!v||String(v).includes("YOUR_"));
let auth,db,currentUser=null,syncing=false,timer,lastCloudJSON=null,conflictPaused=false,authReadyResolve,authReady=new Promise(resolve=>authReadyResolve=resolve);
async function waitForAuthUser(timeout=5000){if(auth?.currentUser)return auth.currentUser;await Promise.race([authReady,new Promise(resolve=>setTimeout(resolve,timeout))]);return auth?.currentUser||currentUser||null;}
function status(msg){if(notice)notice.textContent=msg;if(btn)btn.textContent=currentUser?"Gmail Logout":"Gmail Login";const pb=document.getElementById("profileGmailLogin");if(pb)pb.textContent=currentUser?"🚪 Gmail Logout":"📧 Gmail Login";}
function jsonData(d){return JSON.stringify(d||{});}
window.TRAccountsLogout=async()=>{if(!auth)throw new Error("Authentication is not initialized.");if(auth.currentUser)await signOut(auth);currentUser=null;status("Logged out. Local account data is kept on this device.");return true;};

// Profile fields: Gmail is read-only from Google Auth; other fields are editable.
const PROFILE_KEY="tr_accounts_profile_v1";
const isNativeApp=()=>!!window.Capacitor?.isNativePlatform?.();
async function nativeGoogleSignIn(){const {FirebaseAuthentication}=await import("@capacitor-firebase/authentication");const result=await FirebaseAuthentication.signInWithGoogle({skipNativeAuth:false});const idToken=result?.credential?.idToken;if(!idToken)throw new Error("Google ID token missing. Check Firebase Android SHA-1 and OAuth setup.");await signInWithCredential(auth,GoogleAuthProvider.credential(idToken));}
function loadProfileLocal(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||"{}")}catch{return {}}}
function fillProfile(p={}){const el=id=>document.getElementById(id);if(el("profileEmail"))el("profileEmail").value=p.email||"";if(el("profileName"))el("profileName").value=p.name||"";if(el("profilePhone"))el("profilePhone").value=p.phone||"";if(el("profileDOB")){el("profileDOB").value=p.dob||"";el("profileDOB").dispatchEvent(new Event("change"));}if(el("profileGender"))el("profileGender").value=p.gender||"";}
function profileFromFields(){const dob=(document.getElementById("profileDOB")?.value||"").trim();let age="";if(dob){const d=new Date(dob+"T00:00:00"),t=new Date();age=t.getFullYear()-d.getFullYear();const m=t.getMonth()-d.getMonth();if(m<0||(m===0&&t.getDate()<d.getDate()))age--;if(age<0||age>120)age="";}const phone=(document.getElementById("profilePhone")?.value||"").trim();return {name:(document.getElementById("profileName")?.value||"").trim(),phone,dob,age:String(age),gender:document.getElementById("profileGender")?.value||""};}
function profileStatus(s){const el=document.getElementById("profileStatus");if(el)el.textContent=s;}
function saveProfileLocal(p){localStorage.setItem(PROFILE_KEY,JSON.stringify(p));}

const SYNC_COL="syncEntries";
const SYNC_ARRAYS=["people","transactions","recycleBin","businesses","businessTransactions","partners","partnerRecords","customers","suppliers","inventory","sales","purchases","expenses","payments","employees","payroll","cashAccounts","cashTransactions"];
function stableKey(kind,item,index){const raw=item?.id??item?.name??item?.person??item?.partner??item?.business??item?.date??index;return String(raw).replace(/[\\/\\.#$\\[\\]]/g,"_").slice(0,120);}
function entryMap(data){const out={};for(const kind of SYNC_ARRAYS){const arr=Array.isArray(data?.[kind])?data[kind]:[];arr.forEach((item,index)=>{const key=kind+"__"+stableKey(kind,item,index);out[key]={kind,key,item};});}for(const k of ["language","theme"]){out["settings__"+k]={kind:"settings",key:"settings__"+k,item:{[k]:data?.[k]||(k==="language"?"en":"dark")}};}for(const k of ["businessSuiteSettings","settingsByBusiness","cashAccountsByBusiness"]){if(data?.[k]&&typeof data[k]==="object")out["settings__"+k]={kind:"settings",key:"settings__"+k,item:{[k]:data[k]}};}return out;}
const KEY_COL="keyRecovery",KEY_DOC="dataKey";
async function cloudDataKey(ref){const keyRef=doc(ref,KEY_COL,KEY_DOC);let snap=await getDoc(keyRef),raw=snap.exists()?snap.data()?.keyRaw:null;if(!raw){const bytes=crypto.getRandomValues(new Uint8Array(32));raw=btoa(String.fromCharCode(...bytes));await setDoc(keyRef,{keyRaw:raw,createdAt:serverTimestamp(),algorithm:"AES-GCM-256"});snap=await getDoc(keyRef);raw=snap.data()?.keyRaw;}if(!raw)throw new Error("Cloud encryption key record unavailable.");const bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));return crypto.subtle.importKey("raw",bytes,{name:"AES-GCM"},false,["encrypt","decrypt"]);}
async function encryptCloudItem(key,item){const iv=crypto.getRandomValues(new Uint8Array(12)),plain=new TextEncoder().encode(JSON.stringify(item)),cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,plain);return {encrypted:true,iv:btoa(String.fromCharCode(...iv)),payload:btoa(String.fromCharCode(...new Uint8Array(cipher)))};}
window.TRAccountsCloudBackupEncrypt=async payload=>{const user=auth?.currentUser||currentUser;if(!user||!db)return null;const ref=doc(db,"trAccountsUsers",user.uid),key=await cloudDataKey(ref),iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(JSON.stringify(payload)));return {app:"TR Accounts",backupFormat:"TR-CLOUD-ENC-1",encryption:"AES-GCM-256",iv:btoa(String.fromCharCode(...iv)),ciphertext:btoa(String.fromCharCode(...new Uint8Array(cipher))),ownerUid:user.uid,createdAt:new Date().toISOString()};};
window.TRAccountsCloudBackupDecrypt=async envelope=>{const user=await waitForAuthUser();if(!user||!db)throw new Error("Sign in with the Gmail account that owns this backup.");if(envelope.ownerUid&&envelope.ownerUid!==user.uid)throw new Error("This backup belongs to a different Gmail account.");const key=await cloudDataKey(doc(db,"trAccountsUsers",user.uid)),iv=Uint8Array.from(atob(envelope.iv),c=>c.charCodeAt(0)),cipher=Uint8Array.from(atob(envelope.ciphertext),c=>c.charCodeAt(0)),plain=await crypto.subtle.decrypt({name:"AES-GCM",iv},key,cipher);return JSON.parse(new TextDecoder().decode(plain));};
async function decryptCloudItem(key,record){if(!record?.encrypted)return record?.item;const iv=Uint8Array.from(atob(record.iv),c=>c.charCodeAt(0)),cipher=Uint8Array.from(atob(record.payload),c=>c.charCodeAt(0)),plain=await crypto.subtle.decrypt({name:"AES-GCM",iv},key,cipher);return JSON.parse(new TextDecoder().decode(plain));}
async function getEntryDocs(ref){const q=await getDocs(collection(ref,SYNC_COL)),key=await cloudDataKey(ref),out={};for(const s of q.docs){const raw=s.data();out[s.id]={...raw,item:raw.deleted?null:await decryptCloudItem(key,raw)};}return out;}
async function writeEntrySet(ref,data){const entries=entryMap(data),remote=await getEntryDocs(ref),key=await cloudDataKey(ref);for(const [entryId,val] of Object.entries(entries)){const old=remote[entryId];if(!old||!old.encrypted||jsonData(old.item)!==jsonData(val.item)||old.deleted){const encrypted=await encryptCloudItem(key,val.item);await setDoc(doc(ref,SYNC_COL,entryId),{kind:val.kind,...encrypted,deleted:false,updatedAt:serverTimestamp()});}}for(const [entryId,old] of Object.entries(remote)){if(!entries[entryId]&&!old.deleted)await setDoc(doc(ref,SYNC_COL,entryId),{kind:old.kind,deleted:true,updatedAt:serverTimestamp()});}return entries;}
function rebuildFromDocs(docs){const data={people:[],transactions:[],recycleBin:[],businesses:[],businessTransactions:[],partners:[],partnerRecords:[],customers:[],suppliers:[],inventory:[],sales:[],purchases:[],expenses:[],employees:[],cashAccounts:[],cashTransactions:[],payments:[],payroll:[],businessSuiteSettings:{},language:"en",theme:"dark"};for(const docData of Object.values(docs)){if(!docData||docData.deleted||!docData.item)continue;if(docData.kind==="settings"){if(docData.item.language)data.language=docData.item.language;if(docData.item.theme)data.theme=docData.item.theme;for(const k of ["businessSuiteSettings","settingsByBusiness","cashAccountsByBusiness"])if(docData.item[k])data[k]=docData.item[k];}else if(SYNC_ARRAYS.includes(docData.kind))data[docData.kind].push(docData.item);}return data;}
function mergeDatasets(local,remote,remoteDocs={}){const out={...remote};const tombstones=new Set(Object.entries(remoteDocs).filter(([,d])=>d?.deleted).map(([key])=>key));for(const kind of SYNC_ARRAYS){const map=new Map();for(const item of (remote[kind]||[]))map.set(stableKey(kind,item),item);for(const item of (local[kind]||[])){const fullKey=kind+"__"+stableKey(kind,item);if(tombstones.has(fullKey))continue;const key=stableKey(kind,item),existing=map.get(key);if(!existing){map.set(key,item);continue;}if(jsonData(existing)===jsonData(item))continue;const conflictId="sync-conflict-"+kind+"-"+key;const copy={...item,id:conflictId,syncConflict:true,syncConflictOf:existing.id??key};map.set(conflictId,copy);}out[kind]=Array.from(map.values());}out.language=local.language||remote.language||"en";out.theme=local.theme||remote.theme||"dark";for(const k of ["businessSuiteSettings","settingsByBusiness","cashAccountsByBusiness"]){out[k]={...(remote[k]||{}),...(local[k]||{})};}return out;}
async function migrateLegacy(ref,legacy){if(!legacy||!SYNC_ARRAYS.some(k=>Array.isArray(legacy[k])))return;const existing=await getEntryDocs(ref);if(Object.keys(existing).length)return;await writeEntrySet(ref,legacy);}
async function verifyEntrySet(ref,entries,beforeDocs={}){
 const actual=await getEntryDocs(ref);let verified=0;
 for(const [entryId,val] of Object.entries(entries)){
  const record=actual[entryId];
  if(!record||record.deleted||jsonData(record.item)!==jsonData(val.item))throw new Error("Cloud verification failed for "+entryId);
  verified++;
 }
 for(const [entryId,old] of Object.entries(beforeDocs)){
  if(!entries[entryId]&&!old.deleted&&(!actual[entryId]||!actual[entryId].deleted))throw new Error("Cloud deletion verification failed for "+entryId);
 }
 return verified;
}
async function syncData(){
 currentUser=await waitForAuthUser();if(!currentUser||syncing||!window.TRAccountsCloudData)return false;
 syncing=true;status("Restoring and syncing…");
 try{
  const ref=doc(db,"trAccountsUsers",currentUser.uid),snap=await getDoc(ref),local=window.TRAccountsCloudData();
  if(snap.exists())await migrateLegacy(ref,snap.data().data);
  const remoteDocs=await getEntryDocs(ref),remote=rebuildFromDocs(remoteDocs),merged=mergeDatasets(local,remote,remoteDocs);
  if(Object.keys(remoteDocs).length){window.TRStorage?.unlockAfterRestore?.();window.dispatchEvent(new CustomEvent("tr-accounts-load-cloud",{detail:merged}));}
  const entries=entryMap(merged);await writeEntrySet(ref,merged);const verifiedCount=await verifyEntrySet(ref,entries,remoteDocs);
  lastCloudJSON=jsonData(merged);if(window.TRStorage?.autoBackup)await window.TRStorage.autoBackup(true);
  status("Cloud: sync verified — "+verifiedCount+" entries");return true;
 }catch(err){console.error("Cloud sync:",err);status("Cloud sync failed ("+(err.code||"error")+"): "+(err.message||"Unknown error").slice(0,140)+" — local data remains safe.");return false;}
 finally{syncing=false;}
}
async function guardedUpload(){
 currentUser=await waitForAuthUser();if(!currentUser||!window.TRAccountsCloudData){status("Gmail login session not detected. Tap Gmail Login again.");return false;}
 const local=window.TRAccountsCloudData(),localCount=SYNC_ARRAYS.reduce((n,k)=>n+(Array.isArray(local?.[k])?local[k].length:0),0);
 if(localCount===0)return syncData();
 if(syncing)return false;syncing=true;
 try{
  const ref=doc(db,"trAccountsUsers",currentUser.uid),beforeDocs=await getEntryDocs(ref),entries=entryMap(local);
  await writeEntrySet(ref,local);const verifiedCount=await verifyEntrySet(ref,entries,beforeDocs);
  lastCloudJSON=jsonData(local);if(window.TRStorage?.autoBackup)await window.TRStorage.autoBackup(true);
  status("Cloud: upload verified — "+verifiedCount+" entries");return true;
 }catch(err){console.error("Entry sync:",err);status("Cloud sync failed ("+(err.code||"error")+"): "+(err.message||"Unknown error").slice(0,140)+" — local data remains safe.");return false;}
 finally{syncing=false;}
}
document.getElementById("profileSave")?.addEventListener("click",async()=>{const p=profileFromFields(),email=auth?.currentUser?.email||document.getElementById("profileEmail")?.value||"";if(p.age&&!/^\d+$/.test(p.age)||Number(p.age)>120){profileStatus("Please enter a valid age.");return;}p.email=email;saveProfileLocal(p);const user=auth?.currentUser;if(user&&db){try{await setDoc(doc(db,"trAccountsUsers",user.uid),{profile:{name:p.name,phone:p.phone,phoneVerified:!!p.phoneVerified,dob:p.dob,age:p.age,gender:p.gender,email:user.email||""},profileUpdatedAt:serverTimestamp()},{merge:true});profileStatus("Profile saved to this device and Google account.");}catch(e){console.error(e);profileStatus("Saved locally. Cloud profile update failed.");}}else profileStatus("Profile saved on this device. Sign in to sync profile to Google.");});
if(missing){status("Firebase configuration is missing. Data remains on this device.");const regDone=(()=>{try{return !!JSON.parse(localStorage.getItem("tr_accounts_registration_v1")||"{}").completed}catch{return false}})();const splash=document.getElementById("trSplash");if(splash)splash.remove();document.querySelector(".app").style.display="none";document.querySelector(".nav").style.display="none";if(regDone){if(window.TRLoginPinGate?.has())window.TRLoginPinGate.showEnter();else window.TRLoginPinGate?.showSet();}else{const rg=document.getElementById("registrationGate");if(rg)rg.style.display="flex";}}
else{
 try{
  const app=initializeApp(firebaseConfig);auth=getAuth(app);await setPersistence(auth,browserLocalPersistence);db=getFirestore(app);
  window.TRAccountsGoogleRecovery=async()=>{const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});let user;if(isNativeApp()){await nativeGoogleSignIn();user=auth.currentUser;}else{const result=await signInWithPopup(auth,provider);user=result.user;}if(!user?.email)throw new Error("Google account email unavailable.");return {email:user.email,uid:user.uid};};window.TRAccountsReverifyGoogle=async()=>{const user=auth?.currentUser;if(!user)return false;const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});if(isNativeApp()){await nativeGoogleSignIn();return true;}const result=await reauthenticateWithPopup(user,provider);return !!result?.user;};
  onAuthStateChanged(auth,async user=>{currentUser=user||null;window.TRAuthUser=user||null;if(btn)btn.textContent=user?"Logout":"Login";authReadyResolve(user||null);lastCloudJSON=null;conflictPaused=false;status(user?"Gmail connected.":"Gmail Login");if(!user){showLoginGate(false);window.TRLoginPinGate?.hide();document.querySelector(".app").style.display="none";document.querySelector(".nav").style.display="none";const regDone=(()=>{try{return !!JSON.parse(localStorage.getItem("tr_accounts_registration_v1")||"{}").completed}catch{return false}})();if(regDone){if(window.TRLoginPinGate?.has())window.TRLoginPinGate.showEnter();else window.TRLoginPinGate?.showSet();}else{const rg=document.getElementById("registrationGate");if(rg)rg.style.display="flex";}fillProfile(loadProfileLocal());const splash=document.getElementById("trSplash");if(splash)splash.remove();return;}showLoginGate(false);const regDone=(()=>{try{return !!JSON.parse(localStorage.getItem("tr_accounts_registration_v1")||"{}").completed}catch{return false}})();if(regDone){document.querySelector(".app").style.display="none";document.querySelector(".nav").style.display="none";if(window.TRLoginPinGate?.has())window.TRLoginPinGate.showEnter();else window.TRLoginPinGate?.showSet();}else{document.querySelector(".app").style.display="none";document.querySelector(".nav").style.display="none";const rg=document.getElementById("registrationGate");if(rg)rg.style.display="flex";}const splash=document.getElementById("trSplash");if(splash)splash.remove();try{const pRef=doc(db,"trAccountsUsers",user.uid),pSnap=await getDoc(pRef),cloudProfile=pSnap.exists()?(pSnap.data().profile||{}):{},localProfile=loadProfileLocal();fillProfile({email:user.email||"",name:cloudProfile.name||localProfile.name||user.displayName||"",phone:cloudProfile.phone||localProfile.phone||"",dob:cloudProfile.dob||localProfile.dob||"",gender:cloudProfile.gender||localProfile.gender||""});}catch(e){fillProfile({email:user.email||"",...loadProfileLocal()});}await syncData();});
  const regGoogleBtn=document.getElementById("regGmailLogin"),regGoogleStatus=document.getElementById("regGmailStatus");if(regGoogleBtn)regGoogleBtn.addEventListener("click",async()=>{if(regGoogleStatus)regGoogleStatus.textContent="Opening Gmail / Google sign-in…";const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});try{if(isNativeApp()){await nativeGoogleSignIn();}else{await signInWithPopup(auth,provider);}if(regGoogleStatus)regGoogleStatus.textContent="Gmail login successful."; }catch(err){console.error(err);if(regGoogleStatus)regGoogleStatus.textContent="Login failed: "+(err.code||err.message);}});if(googleLoginBtn)googleLoginBtn.addEventListener("click",async()=>{loginMsg("Opening Gmail / Google sign-in…");const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});try{if(isNativeApp()){await nativeGoogleSignIn();}else{await signInWithPopup(auth,provider);}loginMsg("Login successful.");}catch(err){console.error(err);loginMsg("Google login failed: "+(err.code||err.message));}});
    if(btn)btn.addEventListener("click",async()=>{
   if(currentUser){try{await signOut(auth);status("Signed out.");}catch(e){console.error(e);status("Sign out failed.");}return;}
   const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});
   try{
    if(isNativeApp()){
      await nativeGoogleSignIn();
      currentUser=auth.currentUser||currentUser;
      if(!currentUser) throw new Error("Firebase Auth user session was not created after native Google sign-in.");
      status("Google account connected. Starting cloud sync…");
      await syncData();
    }else{
      const credential=await signInWithPopup(auth,provider);
      currentUser=credential.user||auth.currentUser;
      if(currentUser) await syncData();
    }
   }
   catch(err){console.error("Google sign-in failed:",err);status("Google Login failed ("+(err.code||err.message||"unknown")+"). Please try again.");}
  });
  document.getElementById("cloudSyncNow")?.addEventListener("click",async()=>{currentUser=auth?.currentUser||currentUser;if(!currentUser){status("Gmail login session not detected. Tap Gmail Login again.");return;}if(syncing){status("Sync already running.");return;}await syncData();});
  window.addEventListener("tr-accounts-data-updated",()=>{if(!currentUser)return;clearTimeout(timer);timer=setTimeout(async()=>{if(syncing)return;await guardedUpload();},1200);});
  window.addEventListener("tr-accounts-load-cloud",e=>{const d=e.detail||{};if(!Array.isArray(d.people)||!Array.isArray(d.transactions)){status("Cloud data format invalid");return;}const payload={...d,pinHash:"",recoveryHash:""};if(window.TRAccountsApplyCloudData){window.TRAccountsApplyCloudData(payload);status("Cloud data loaded");}else{localStorage.setItem("tr_accounts_data_v1",JSON.stringify(payload));alert("Cloud data saved locally. Reload app to apply.");}});
 }catch(err){console.error(err);status("Firebase initialization failed: "+(err.code||err.message));}
}
