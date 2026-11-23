/* TR Accounts Cloud: Google sign-in, automatic sync, and conflict-safe uploads. Self-SMS is optional. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const btn=document.getElementById("cloudSetup"),notice=document.getElementById("moduleNotice");
const missing=!firebaseConfig||Object.values(firebaseConfig).some(v=>!v||String(v).includes("YOUR_"));
let auth,db,currentUser=null,syncing=false,timer,lastCloudJSON=null,conflictPaused=false;
function status(msg){if(notice)notice.textContent=msg;if(btn)btn.textContent=currentUser?"Sign out":"Google Login";}
function jsonData(d){return JSON.stringify(d||{});}

// Profile fields: Gmail is read-only from Google Auth; other fields are editable.
const PROFILE_KEY="tr_accounts_profile_v1";
function loadProfileLocal(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||"{}")}catch{return {}}}
function fillProfile(p={}){const el=id=>document.getElementById(id);if(el("profileEmail"))el("profileEmail").value=p.email||"";if(el("profileName"))el("profileName").value=p.name||"";if(el("profilePhone"))el("profilePhone").value=p.phone||"";if(el("profileAge"))el("profileAge").value=p.age||"";if(el("profileGender"))el("profileGender").value=p.gender||"";}
function profileFromFields(){return {name:(document.getElementById("profileName")?.value||"").trim(),phone:(document.getElementById("profilePhone")?.value||"").trim(),age:(document.getElementById("profileAge")?.value||"").trim(),gender:document.getElementById("profileGender")?.value||""};}
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
async function syncData(){
 currentUser=auth?.currentUser||currentUser;if(!currentUser||syncing||!window.TRAccountsCloudData)return;
 syncing=true;status("Google login successful. Syncing cloud data…");
 try{
  const ref=doc(db,"trAccountsUsers",currentUser.uid),snap=await getDoc(ref),local=window.TRAccountsCloudData();
  if(!snap.exists()){await setDoc(ref,{data:local,updatedAt:serverTimestamp()},{merge:true});lastCloudJSON=jsonData(local);status("Cloud: initial upload complete");}
  else{
   const cloud=snap.data().data;
   if(cloud&&confirm("Cloud data found. OK = load Cloud data on this device; Cancel = upload this device data to Cloud.")){
    window.dispatchEvent(new CustomEvent("tr-accounts-load-cloud",{detail:cloud}));lastCloudJSON=jsonData(cloud);status("Cloud: data loaded");
   }else{await setDoc(ref,{data:local,updatedAt:serverTimestamp()},{merge:true});lastCloudJSON=jsonData(local);status("Cloud: local data uploaded");}
  }
 }catch(err){console.error("Cloud sync:",err);status("Cloud sync failed. Local data is safe. Check connection and Firestore rules.");}
 finally{syncing=false;}
}
async function guardedUpload(force=false){
 currentUser=auth?.currentUser||currentUser;if(!currentUser||!window.TRAccountsCloudData){status("Google login session not detected. Tap Google Login again.");return false;}
 const ref=doc(db,"trAccountsUsers",currentUser.uid),local=window.TRAccountsCloudData(),localJSON=jsonData(local);
 try{
  await runTransaction(db,async tx=>{const snap=await tx.get(ref);const remoteJSON=snap.exists()?jsonData(snap.data().data):null;if(!snap.exists()||remoteJSON===lastCloudJSON||force)tx.set(ref,{data:local,updatedAt:serverTimestamp()},{merge:true});else throw new Error("TR_CONFLICT");});
  lastCloudJSON=localJSON;conflictPaused=false;status("Cloud: synced");return true;
 }catch(err){
  if(err.message==="TR_CONFLICT"){
   conflictPaused=true;status("Cloud conflict: review required");const snap=await getDoc(ref),remote=snap.exists()?snap.data().data:null;
   const useCloud=confirm("Cloud data changed on another device. OK = load Cloud data (local changes may be replaced); Cancel = keep local and choose whether to overwrite Cloud.");
   if(useCloud){if(remote)window.dispatchEvent(new CustomEvent("tr-accounts-load-cloud",{detail:remote}));lastCloudJSON=jsonData(remote);conflictPaused=false;status("Cloud: latest data loaded");return false;}
   if(confirm("Overwrite Cloud with THIS device's data?")){return await guardedUpload(true);}
   status("Sync paused. Local data remains safe.");return false;
  }
  console.error(err);status("Cloud sync failed. Local data is safe.");return false;
 }
}
document.getElementById("profileSave")?.addEventListener("click",async()=>{const p=profileFromFields(),email=auth?.currentUser?.email||document.getElementById("profileEmail")?.value||"";if(p.age&&!/^\d+$/.test(p.age)||Number(p.age)>120){profileStatus("Please enter a valid age.");return;}p.email=email;saveProfileLocal(p);const user=auth?.currentUser;if(user&&db){try{await setDoc(doc(db,"trAccountsUsers",user.uid),{profile:{name:p.name,phone:p.phone,age:p.age,gender:p.gender,email:user.email||""},profileUpdatedAt:serverTimestamp()},{merge:true});profileStatus("Profile saved to this device and Google account.");}catch(e){console.error(e);profileStatus("Saved locally. Cloud profile update failed.");}}else profileStatus("Profile saved on this device. Sign in to sync profile to Google.");});
if(missing){status("Firebase configuration is missing. Data remains on this device.");}
else{
 try{
  const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
  // Process a pending mobile redirect result as well as popup sign-in.
  getRedirectResult(auth).catch(e=>{if(e&&e.code!=="auth/no-auth-event")console.warn("Google redirect result:",e);});
  onAuthStateChanged(auth,async user=>{currentUser=user||null;lastCloudJSON=null;conflictPaused=false;status(user?"Google account connected.":"Google Login");if(!user){fillProfile(loadProfileLocal());return;}try{const pRef=doc(db,"trAccountsUsers",user.uid),pSnap=await getDoc(pRef),cloudProfile=pSnap.exists()?(pSnap.data().profile||{}):{},localProfile=loadProfileLocal();fillProfile({email:user.email||"",name:cloudProfile.name||localProfile.name||user.displayName||"",phone:cloudProfile.phone||localProfile.phone||"",age:cloudProfile.age||localProfile.age||"",gender:cloudProfile.gender||localProfile.gender||""});}catch(e){fillProfile({email:user.email||"",...loadProfileLocal()});}await syncData();});
  if(btn)btn.addEventListener("click",async()=>{
   if(currentUser){try{await signOut(auth);status("Signed out.");}catch(e){console.error(e);status("Sign out failed.");}return;}
   const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});
   try{await signInWithPopup(auth,provider);}
   catch(err){console.warn("Popup sign-in fallback:",err);try{await signInWithRedirect(auth,provider);}catch(e){console.error(e);status("Google sign-in failed: "+(e.code||e.message));}}
  });
  document.getElementById("cloudSyncNow")?.addEventListener("click",async()=>{currentUser=auth?.currentUser||currentUser;if(!currentUser){status("Google login session not detected. Tap Google Login again.");return;}if(syncing){status("Sync already running.");return;}syncing=true;try{await guardedUpload(false);}finally{syncing=false;}});
  window.addEventListener("tr-accounts-data-updated",()=>{if(!currentUser||conflictPaused)return;clearTimeout(timer);timer=setTimeout(async()=>{if(syncing)return;syncing=true;try{await guardedUpload(false);}finally{syncing=false;}},1200);});
  window.addEventListener("tr-accounts-load-cloud",e=>{const d=e.detail||{};if(!Array.isArray(d.people)||!Array.isArray(d.transactions)){status("Cloud data format invalid");return;}const payload={...d,pinHash:"",recoveryHash:""};if(window.TRAccountsApplyCloudData){window.TRAccountsApplyCloudData(payload);status("Cloud data loaded");}else{localStorage.setItem("tr_accounts_data_v1",JSON.stringify(payload));alert("Cloud data saved locally. Reload app to apply.");}});
 }catch(err){console.error(err);status("Firebase initialization failed: "+(err.code||err.message));}
}
