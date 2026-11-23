/* TR Accounts Google Cloud module with conflict protection. Firebase client config is public. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, PhoneAuthProvider, RecaptchaVerifier, signInWithCredential } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, runTransaction, collection, addDoc, onSnapshot, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const btn=document.getElementById("cloudSetup");
const notice=document.getElementById("moduleNotice");
const missing=!firebaseConfig||Object.values(firebaseConfig).some(v=>!v||String(v).includes("YOUR_"));
let auth,db,currentUser,syncing=false,timer,lastCloudJSON=null,conflictPaused=false,dataOwnerUid=null,requestListener=null,ownerRequestsListener=null,phoneVerificationId=null,recaptchaVerifier=null,verifiedPhone=null;
function status(msg){if(notice)notice.textContent=msg;if(btn)btn.textContent=currentUser?"Sign out":"Google Login";}
function jsonData(d){return JSON.stringify(d||{});}
function phoneVerifiedForThisDevice(){
 if(!currentUser)return false;
 const saved=localStorage.getItem("tr_accounts_phone_verified_"+currentUser.uid);
 return !!saved;
}
function updatePhoneStatus(msg){const el=document.getElementById("phoneVerifyStatus");if(el)el.textContent=msg;}
async function sendPhoneOTP(){
 updatePhoneStatus("Checking mobile number…");
 const phone=(document.getElementById("registerPhone")?.value||"").trim();
 if(!/^\\+[1-9]\\d{7,14}$/.test(phone)){updatePhoneStatus("Enter mobile number with country code, e.g. +919876543210.");return;}
 try{
  if(!recaptchaVerifier)recaptchaVerifier=new RecaptchaVerifier(auth,"phoneRecaptcha", {size:"invisible"});
  phoneVerificationId=await new PhoneAuthProvider(auth).verifyPhoneNumber(phone,recaptchaVerifier);
  verifiedPhone=phone;updatePhoneStatus("OTP sent to "+phone+". Enter the 6-digit code.");
 }catch(err){console.error("Phone OTP send:",err);updatePhoneStatus("OTP send failed: "+(err.code||err.message||"Please try again."));if(recaptchaVerifier){try{recaptchaVerifier.clear();}catch{}recaptchaVerifier=null;}}
}
async function verifyPhoneOTP(){
 if(!phoneVerificationId||!verifiedPhone){updatePhoneStatus("Tap Send OTP first.");return;}
 const code=(document.getElementById("phoneOTP")?.value||"").trim();
 if(!/^\\d{6}$/.test(code)){updatePhoneStatus("Enter the 6-digit OTP.");return;}
 try{
  const credential=PhoneAuthProvider.credential(phoneVerificationId,code);
  const result=await signInWithCredential(auth,credential);
  currentUser=result.user;
  localStorage.setItem("tr_accounts_phone_verified_"+currentUser.uid,verifiedPhone);
  await currentUser.getIdToken(true);
  updatePhoneStatus("Mobile login successful. Cloud sync is ready.");
  status("Mobile Login successful.");
  listenForOwnerRequests();
  await syncData();
 }catch(err){console.error("Phone OTP verify:",err);updatePhoneStatus("Login failed: "+(err.code||err.message||"Check OTP and try again."));}
}
if(missing){status("Cloud: Firebase project config needed. App data remains local until configured.");}
else{
 try{
  const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
  onAuthStateChanged(auth,async user=>{
   currentUser=user||null;lastCloudJSON=null;conflictPaused=false;
   dataOwnerUid=localStorage.getItem("tr_accounts_owner_uid")||null;
   if(!user){status("Mobile OTP Login");return;}
   const uidEl=document.getElementById("ownerUidDisplay");if(uidEl)uidEl.textContent=user.uid;
   const phoneEl=document.getElementById("registerPhone");
   const savedPhone=localStorage.getItem("tr_accounts_phone_verified_"+user.uid);
   if(phoneEl&&savedPhone)phoneEl.value=savedPhone;
   if(phoneVerifiedForThisDevice()){
    updatePhoneStatus("Registered number verified on this device.");
    status("Mobile number verified. Cloud sync ready.");
    listenForOwnerRequests();
    await syncData();
   }else{
    status("Verify mobile OTP to enable Cloud Sync.");
    updatePhoneStatus("Phone verification is required on every device before Cloud Sync.");
   }
  });

  // Owner-approved second-device access. A second device requests access to the owner's UID.
  async function requestOwnerApproval(){
   if(!currentUser){status("Sign in first.");return;}
   const ownerUid=(document.getElementById("ownerUidInput")?.value||"").trim();
   if(!ownerUid||ownerUid===currentUser.uid){status("Enter the owner UID from the first device.");return;}
   try{const reqRef=doc(db,"trAccountsUsers",ownerUid,"deviceRequests",currentUser.uid);await setDoc(reqRef,{requesterUid:currentUser.uid,requesterEmail:currentUser.email||"",requesterName:currentUser.displayName||"",status:"pending",requestedAt:serverTimestamp()},{merge:true});
    const statusEl=document.getElementById("deviceRequestStatus");if(statusEl)statusEl.textContent="Approval request sent. Waiting for owner approval…";
    if(requestListener)requestListener();requestListener=onSnapshot(reqRef,snap=>{if(snap.exists()&&snap.data().status==="approved"){dataOwnerUid=ownerUid;localStorage.setItem("tr_accounts_owner_uid",ownerUid);lastCloudJSON=null;status("Second device approved. Connecting to owner's account…");syncData();}else if(snap.exists()&&snap.data().status==="rejected"){if(statusEl)statusEl.textContent="Owner rejected this device request.";}});
   }catch(err){console.error(err);status("Could not send approval request. Check Firestore rules and connection.");}
  }
  function listenForOwnerRequests(){
   if(!currentUser)return;const listEl=document.getElementById("deviceRequestsList");if(ownerRequestsListener)ownerRequestsListener();
   ownerRequestsListener=onSnapshot(collection(db,"trAccountsUsers",currentUser.uid,"deviceRequests"),snap=>{
    if(!listEl)return;const pending=snap.docs.filter(d=>d.data().status==="pending");
    listEl.innerHTML=pending.length?pending.map(d=>{const x=d.data();return '<div class="person"><div><b>'+String(x.requesterName||"New device").replace(/[&<>"]/g,"")+'</b><div class="person-sub">'+String(x.requesterEmail||"").replace(/[&<>"]/g,"")+'<br>UID: '+d.id+'</div></div><div class="person-tools"><button class="soft" data-device-approve="'+d.id+'">Approve</button><button class="soft danger" data-device-reject="'+d.id+'">Reject</button></div></div>';}).join(""):'<div class="person-sub">No pending device requests.</div>';
    listEl.querySelectorAll("[data-device-approve]").forEach(b=>b.onclick=()=>approveDevice(b.dataset.deviceApprove,true));listEl.querySelectorAll("[data-device-reject]").forEach(b=>b.onclick=()=>approveDevice(b.dataset.deviceReject,false));
   },err=>{console.warn("Device request listener:",err);if(listEl)listEl.textContent="Device requests unavailable. Check Firestore rules.";});
  }
  async function approveDevice(deviceUid,approved){
   if(!currentUser||!confirm((approved?"Approve":"Reject")+" this second-device request?"))return;
   try{const reqRef=doc(db,"trAccountsUsers",currentUser.uid,"deviceRequests",deviceUid);if(approved)await updateDoc(doc(db,"trAccountsUsers",currentUser.uid),{approvedDevices:arrayUnion(deviceUid)});await updateDoc(reqRef,{status:approved?"approved":"rejected",reviewedAt:serverTimestamp()});status(approved?"Device approved. It can now connect to this owner's cloud data.":"Device request rejected.");}
   catch(err){console.error(err);status("Approval failed. Publish updated Firestore rules first.");}
  }
  document.getElementById("requestDeviceBtn")?.addEventListener("click",requestOwnerApproval);
  document.getElementById("sendPhoneOTP")?.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();sendPhoneOTP();});
  document.getElementById("verifyPhoneOTP")?.addEventListener("click",verifyPhoneOTP);
  document.getElementById("registerPhone")?.addEventListener("input",e=>{const saved=localStorage.getItem("tr_accounts_phone_verified_"+(currentUser?.uid||""));if(saved&&e.target.value.trim()!==saved){localStorage.removeItem("tr_accounts_phone_verified_"+currentUser.uid);updatePhoneStatus("Number changed. Verify the new number again before syncing.");}});
  async function syncData(){
   if(!currentUser||!phoneVerifiedForThisDevice()||syncing||!window.TRAccountsCloudData)return;
   syncing=true;
   try{
    const ref=doc(db,"trAccountsUsers",dataOwnerUid||currentUser.uid),snap=await getDoc(ref),local=window.TRAccountsCloudData();
    if(!snap.exists()){
      await setDoc(ref,{data:local,updatedAt:serverTimestamp(),approvedDevices:[]},{merge:true});
      lastCloudJSON=jsonData(local);status("Cloud: initial upload complete");
    }else{
      const cloud=snap.data().data;
      if(cloud&&confirm("Cloud data found. OK = load Cloud data on this device; Cancel = upload this device data to Cloud.")){
       window.dispatchEvent(new CustomEvent("tr-accounts-load-cloud",{detail:cloud}));
       lastCloudJSON=jsonData(cloud);status("Cloud: data loaded");
      }else{
       await setDoc(ref,{data:local,updatedAt:serverTimestamp()},{merge:true});
       lastCloudJSON=jsonData(local);status("Cloud: local data uploaded");
      }
    }
   }catch(err){console.error(err);status("Cloud sync error. Check connection and Firestore rules.");}
   finally{syncing=false;}
  }
  async function guardedUpload(force=false){
   if(!currentUser||!phoneVerifiedForThisDevice()||!window.TRAccountsCloudData){status("Verify your registered phone number before syncing.");return false;}
   const ref=doc(db,"trAccountsUsers",dataOwnerUid||currentUser.uid),local=window.TRAccountsCloudData(),localJSON=jsonData(local);
   try{
    await runTransaction(db,async tx=>{
      const snap=await tx.get(ref);
      const remoteJSON=snap.exists()?jsonData(snap.data().data):null;
      if(!snap.exists()||remoteJSON===lastCloudJSON||force){
        tx.set(ref,{data:local,updatedAt:serverTimestamp()},{merge:true});
      }else throw new Error("TR_CONFLICT");
    });
    lastCloudJSON=localJSON;conflictPaused=false;status("Cloud: synced");
    return true;
   }catch(err){
    if(err.message==="TR_CONFLICT"){
      conflictPaused=true;status("Cloud conflict: review required");
      const remoteSnap=await getDoc(ref),remote=remoteSnap.exists()?remoteSnap.data().data:null;
      const useCloud=confirm("Cloud data changed on another device. OK = load the latest Cloud data (your local changes may be replaced); Cancel = keep this device data and choose whether to overwrite Cloud.");
      if(useCloud){
       if(remote)window.dispatchEvent(new CustomEvent("tr-accounts-load-cloud",{detail:remote}));
       lastCloudJSON=jsonData(remote);conflictPaused=false;status("Cloud: latest data loaded");
       return false;
      }
      if(confirm("Overwrite the latest Cloud data with THIS device's data? Make sure you want to replace the other device's changes.")){
       const ok=await guardedUpload(true);return ok;
      }
      status("Cloud sync paused: conflict. Local data remains on this device.");return false;
    }
    console.error(err);status("Cloud sync error; local copy saved.");return false;
   }
  }
  // Google sign-in temporarily disabled. Mobile OTP is the active login method.
  if(btn){btn.style.display="none";}
  const syncBtn=document.getElementById("cloudSyncNow");
  syncBtn?.addEventListener("click",async()=>{
   if(!phoneVerifiedForThisDevice()){status("Verify mobile OTP before Cloud Sync.");updatePhoneStatus("Verification required before Cloud Sync.");return;}
   if(syncing){status("Cloud sync is already running.");return;}
   syncing=true;status("Cloud: checking latest data…");
   try{await guardedUpload(false);}finally{syncing=false;}
  });
  window.addEventListener("tr-accounts-data-updated",()=>{
   if(!currentUser||conflictPaused)return;clearTimeout(timer);
   timer=setTimeout(async()=>{if(syncing)return;syncing=true;try{await guardedUpload(false);}finally{syncing=false;}},1200);
  });
  window.addEventListener("tr-accounts-load-cloud",e=>{
   const d=e.detail||{};
   if(!Array.isArray(d.people)||!Array.isArray(d.transactions)){status("Cloud data format invalid");return;}
   const payload={...d,pinHash:"",recoveryHash:""};
   if(window.TRAccountsApplyCloudData){window.TRAccountsApplyCloudData(payload);status("Cloud data loaded");}
   else{localStorage.setItem("tr_accounts_data_v1",JSON.stringify(payload));alert("Cloud data saved locally. Reload app to apply.");}
  });
 }catch(err){console.error(err);status("Firebase initialization failed.");}
}
