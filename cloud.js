/* TR Accounts Cloud: Google sign-in, automatic sync, and conflict-safe uploads. Self-SMS is optional. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, reauthenticateWithPopup, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, runTransaction, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const btn=document.getElementById("cloudSetup"),notice=document.getElementById("moduleNotice");
const missing=!firebaseConfig||Object.values(firebaseConfig).some(v=>!v||String(v).includes("YOUR_"));
let auth,db,currentUser=null,syncing=false,timer,lastCloudJSON=null,conflictPaused=false,authReadyResolve,authReady=new Promise(resolve=>authReadyResolve=resolve);
async function waitForAuthUser(timeout=5000){if(auth?.currentUser)return auth.currentUser;await Promise.race([authReady,new Promise(resolve=>setTimeout(resolve,timeout))]);return auth?.currentUser||currentUser||null;}
function status(msg){if(notice)notice.textContent=msg;if(btn)btn.textContent=currentUser?"Sign out":"Google Login";}
function jsonData(d){return JSON.stringify(d||{});}

// Profile fields: Gmail is read-only from Google Auth; other fields are editable.
const PROFILE_KEY="tr_accounts_profile_v1";
function loadProfileLocal(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||"{}")}catch{return {}}}
function fillProfile(p={}){const el=id=>document.getElementById(id);if(el("profileEmail"))el("profileEmail").value=p.email||"";if(el("profileName"))el("profileName").value=p.name||"";if(el("profilePhone"))el("profilePhone").value=p.phone||"";if(el("profileDOB")){el("profileDOB").value=p.dob||"";el("profileDOB").dispatchEvent(new Event("change"));}if(el("profileGender"))el("profileGender").value=p.gender||"";}
function profileFromFields(){const dob=(document.getElementById("profileDOB")?.value||"").trim();let age="";if(dob){const d=new Date(dob+"T00:00:00"),t=new Date();age=t.getFullYear()-d.getFullYear();const m=t.getMonth()-d.getMonth();if(m<0||(m===0&&t.getDate()<d.getDate()))age--;if(age<0||age>120)age="";}return {name:(document.getElementById("profileName")?.value||"").trim(),phone:(document.getElementById("profilePhone")?.value||"").trim(),dob,age:String(age),gender:document.getElementById("profileGender")?.value||""};}
function profileStatus(s){const el=document.getElementById("profileStatus");if(el)el.textContent=s;}
function saveProfileLocal(p){localStorage.setItem(PROFILE_KEY,JSON.stringify(p));}

function updatePhoneStatus(msg){const el=document.getElementById("phoneVerifyStatus");if(el)el.textContent=msg;}
function normalizePhone(){let p=(document.getElementById("registerPhone")?.value||"").trim().replace(/[\\s-]/g,"");if(/^\\d{10}$/.test(p))p="+91"+p;else if(/^91\\d{10}$/.test(p))p="+"+p;return /^\\+91\\d{10}$/.test(p)?p:null;}
let selfSmsCode=null,selfSmsPhone=null;
function sendSelfSms(){const phone=normalizePhone();if(!phone){updatePhoneStatus("Enter a valid 10-digit Indian mobile number.");return;}selfSmsCode=String(Math.floor(100000+Math.random()*900000));selfSmsPhone=phone;const body="TR Accounts optional self-test code: "+selfSmsCode+". Send this SMS to your own number and enter the code.";updatePhoneStatus("Optional test: send SMS to yourself, then enter the received code.");window.location.href="sms:"+phone+"?body="+encodeURIComponent(body);}
function verifySelfSms(){const phone=normalizePhone(),code=(document.getElementById("phoneOTP")?.value||"").trim();if(!selfSmsCode||!selfSmsPhone){updatePhoneStatus("Tap Send Self-Test SMS first.");return;}if(phone!==selfSmsPhone){updatePhoneStatus("Number changed. Start the test again.");return;}if(code!==selfSmsCode){updatePhoneStatus("Code mismatch. Try again.");return;}localStorage.setItem("tr_accounts_self_sms_verified_phone",phone);selfSmsCode=null;selfSmsPhone=null;updatePhoneStatus("Optional self-SMS test passed. Google login and Cloud Sync do not depend on this.");}
if(document.getElementById("sendPhoneOTP"))document.getElementById("sendPhoneOTP").addEventListener("click",e=>{e.preventDefault();e.stopPropagation();sendSelfSms();});
if(document.getElementById("verifyPhoneOTP"))document.getElementById("verifyPhoneOTP").addEventListener("click",verifySelfSms);
if(document.getElementById("registerPhone"))document.getElementById("registerPhone").addEventListener("input",()=>{});
const SYNC_COL="syncEntries";
const SYNC_ARRAYS=["people","transactions","recycleBin","businesses","businessTransactions","partners","partnerRecords","customers","suppliers","inventory","sales","purchases","expenses","employees","cashAccounts","cashTransactions"];
function stableKey(kind,item,index){const raw=item?.id??item?.name??item?.person??item?.partner??item?.business??item?.date??index;return String(raw).replace(/[\\/\\.#$\\[\\]]/g,"_").slice(0,120);}
function entryMap(data){const out={};for(const kind of SYNC_ARRAYS){const arr=Array.isArray(data?.[kind])?data[kind]:[];arr.forEach((item,index)=>{const key=kind+"__"+stableKey(kind,item,index);out[key]={kind,key,item};});}for(const k of ["language","theme"]){out["settings__"+k]={kind:"settings",key:"settings__"+k,item:{[k]:data?.[k]||(k==="language"?"en":"dark")}};}for(const k of ["businessSuiteSettings","settingsByBusiness","cashAccountsByBusiness"]){if(data?.[k]&&typeof data[k]==="object")out["settings__"+k]={kind:"settings",key:"settings__"+k,item:{[k]:data[k]}};}return out;}
async function getEntryDocs(ref){const q=await getDocs(collection(ref,SYNC_COL));const out={};q.forEach(s=>out[s.id]=s.data());return out;}
async function writeEntrySet(ref,data){const entries=entryMap(data),remote=await getEntryDocs(ref);for(const [key,val] of Object.entries(entries)){const old=remote[key];if(!old||jsonData(old.item)!==jsonData(val.item)||old.deleted)await setDoc(doc(ref,SYNC_COL,key),{kind:val.kind,item:val.item,deleted:false,updatedAt:serverTimestamp()});}for(const [key,old] of Object.entries(remote)){if(!entries[key]&&!old.deleted)await setDoc(doc(ref,SYNC_COL,key),{kind:old.kind,item:null,deleted:true,updatedAt:serverTimestamp()});}return entries;}
function rebuildFromDocs(docs){const data={people:[],transactions:[],recycleBin:[],businesses:[],businessTransactions:[],partners:[],partnerRecords:[],customers:[],suppliers:[],inventory:[],sales:[],purchases:[],expenses:[],employees:[],cashAccounts:[],cashTransactions:[],businessSuiteSettings:{},language:"en",theme:"dark"};for(const docData of Object.values(docs)){if(!docData||docData.deleted||!docData.item)continue;if(docData.kind==="settings"){if(docData.item.language)data.language=docData.item.language;if(docData.item.theme)data.theme=docData.item.theme;for(const k of ["businessSuiteSettings","settingsByBusiness","cashAccountsByBusiness"])if(docData.item[k])data[k]=docData.item[k];}else if(SYNC_ARRAYS.includes(docData.kind))data[docData.kind].push(docData.item);}return data;}
function mergeDatasets(local,remote,remoteDocs={}){const out={...remote};const tombstones=new Set(Object.entries(remoteDocs).filter(([,d])=>d?.deleted).map(([key])=>key));for(const kind of SYNC_ARRAYS){const map=new Map();for(const item of (remote[kind]||[]))map.set(stableKey(kind,item),item);for(const item of (local[kind]||[])){const fullKey=kind+"__"+stableKey(kind,item);if(tombstones.has(fullKey))continue;map.set(stableKey(kind,item),item);}out[kind]=Array.from(map.values());}out.language=local.language||remote.language||"en";out.theme=local.theme||remote.theme||"dark";for(const k of ["businessSuiteSettings","settingsByBusiness","cashAccountsByBusiness"]){out[k]={...(remote[k]||{}),...(local[k]||{})};}return out;}
async function migrateLegacy(ref,legacy){if(!legacy||!SYNC_ARRAYS.some(k=>Array.isArray(legacy[k])))return;const existing=await getEntryDocs(ref);if(Object.keys(existing).length)return;await writeEntrySet(ref,legacy);}
async function syncData(){
 currentUser=await waitForAuthUser();if(!currentUser||syncing||!window.TRAccountsCloudData)return;
 syncing=true;status("Google login successful. Restoring and syncing…");
 try{const ref=doc(db,"trAccountsUsers",currentUser.uid),snap=await getDoc(ref),local=window.TRAccountsCloudData();if(snap.exists())await migrateLegacy(ref,snap.data().data);const remoteDocs=await getEntryDocs(ref),remote=rebuildFromDocs(remoteDocs);const merged=mergeDatasets(local,remote,remoteDocs);if(Object.keys(remoteDocs).length){window.dispatchEvent(new CustomEvent("tr-accounts-load-cloud",{detail:merged}));}else{await writeEntrySet(ref,local);}lastCloudJSON=jsonData(merged);await writeEntrySet(ref,merged);status("Cloud: automatic entry sync ready");}
 catch(err){console.error("Cloud sync:",err);status("Cloud sync failed. Local data remains safe.");}
 finally{syncing=false;}
}
async function guardedUpload(){
 currentUser=await waitForAuthUser();if(!currentUser||!window.TRAccountsCloudData){status("Google login session not detected. Tap Google Login again.");return false;}
 try{const ref=doc(db,"trAccountsUsers",currentUser.uid),local=window.TRAccountsCloudData();await writeEntrySet(ref,local);lastCloudJSON=jsonData(local);status("Cloud: entry sync complete");return true;}
 catch(err){console.error("Entry sync:",err);status("Cloud sync failed. Local data is safe.");return false;}
}
document.getElementById("profileSave")?.addEventListener("click",async()=>{const p=profileFromFields(),email=auth?.currentUser?.email||document.getElementById("profileEmail")?.value||"";if(p.age&&!/^\d+$/.test(p.age)||Number(p.age)>120){profileStatus("Please enter a valid age.");return;}p.email=email;saveProfileLocal(p);const user=auth?.currentUser;if(user&&db){try{await setDoc(doc(db,"trAccountsUsers",user.uid),{profile:{name:p.name,phone:p.phone,dob:p.dob,age:p.age,gender:p.gender,email:user.email||""},profileUpdatedAt:serverTimestamp()},{merge:true});profileStatus("Profile saved to this device and Google account.");}catch(e){console.error(e);profileStatus("Saved locally. Cloud profile update failed.");}}else profileStatus("Profile saved on this device. Sign in to sync profile to Google.");});
if(missing){status("Firebase configuration is missing. Data remains on this device.");}
else{
 try{
  const app=initializeApp(firebaseConfig);auth=getAuth(app);await setPersistence(auth,browserLocalPersistence);db=getFirestore(app);
  window.TRAccountsReverifyGoogle=async()=>{const user=auth?.currentUser;if(!user)return false;const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});const result=await reauthenticateWithPopup(user,provider);return !!result?.user;};
  onAuthStateChanged(auth,async user=>{currentUser=user||null;authReadyResolve(user||null);lastCloudJSON=null;conflictPaused=false;status(user?"Google account connected.":"Google Login");if(!user){fillProfile(loadProfileLocal());return;}try{const pRef=doc(db,"trAccountsUsers",user.uid),pSnap=await getDoc(pRef),cloudProfile=pSnap.exists()?(pSnap.data().profile||{}):{},localProfile=loadProfileLocal();fillProfile({email:user.email||"",name:cloudProfile.name||localProfile.name||user.displayName||"",phone:cloudProfile.phone||localProfile.phone||"",dob:cloudProfile.dob||localProfile.dob||"",gender:cloudProfile.gender||localProfile.gender||""});}catch(e){fillProfile({email:user.email||"",...loadProfileLocal()});}await syncData();});
  if(btn)btn.addEventListener("click",async()=>{
   if(currentUser){try{await signOut(auth);status("Signed out.");}catch(e){console.error(e);status("Sign out failed.");}return;}
   const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});
   try{await signInWithPopup(auth,provider);}
   catch(err){console.error("Google popup sign-in failed:",err);status("Google Login failed ("+(err.code||"unknown")+"). Please try again in Chrome or allow pop-ups.");}
  });
  document.getElementById("cloudSyncNow")?.addEventListener("click",async()=>{currentUser=auth?.currentUser||currentUser;if(!currentUser){status("Google login session not detected. Tap Google Login again.");return;}if(syncing){status("Sync already running.");return;}syncing=true;try{await guardedUpload();}finally{syncing=false;}});
  window.addEventListener("tr-accounts-data-updated",()=>{if(!currentUser)return;clearTimeout(timer);timer=setTimeout(async()=>{if(syncing)return;syncing=true;try{await guardedUpload();}finally{syncing=false;}},1200);});
  window.addEventListener("tr-accounts-load-cloud",e=>{const d=e.detail||{};if(!Array.isArray(d.people)||!Array.isArray(d.transactions)){status("Cloud data format invalid");return;}const payload={...d,pinHash:"",recoveryHash:""};if(window.TRAccountsApplyCloudData){window.TRAccountsApplyCloudData(payload);status("Cloud data loaded");}else{localStorage.setItem("tr_accounts_data_v1",JSON.stringify(payload));alert("Cloud data saved locally. Reload app to apply.");}});
 }catch(err){console.error(err);status("Firebase initialization failed: "+(err.code||err.message));}
}
