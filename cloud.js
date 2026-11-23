/* TR Accounts Google Cloud module with conflict protection. Firebase client config is public. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const btn=document.getElementById("cloudSetup");
const notice=document.getElementById("moduleNotice");
const missing=!firebaseConfig||Object.values(firebaseConfig).some(v=>!v||String(v).includes("YOUR_"));
let auth,db,currentUser,syncing=false,timer,lastCloudJSON=null,conflictPaused=false;
function status(msg){if(btn)btn.textContent=msg;if(notice)notice.textContent=msg;}
function jsonData(d){return JSON.stringify(d||{});}
if(missing){status("Cloud: Firebase project config needed. App data remains local until configured.");}
else{
 try{
  const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
  onAuthStateChanged(auth,async user=>{
   currentUser=user||null;lastCloudJSON=null;conflictPaused=false;
   if(!user){status("Google Login");return;}
   status("Cloud connected: "+(user.displayName||user.email||"Google account"));
   await syncData();
  });
  async function syncData(){
   if(!currentUser||syncing||!window.TRAccountsCloudData)return;
   syncing=true;
   try{
    const ref=doc(db,"trAccountsUsers",currentUser.uid),snap=await getDoc(ref),local=window.TRAccountsCloudData();
    if(!snap.exists()){
      await setDoc(ref,{data:local,updatedAt:serverTimestamp()});
      lastCloudJSON=jsonData(local);status("Cloud: initial upload complete");
    }else{
      const cloud=snap.data().data;
      if(cloud&&confirm("Cloud data found. OK = load Cloud data on this device; Cancel = upload this device data to Cloud.")){
       window.dispatchEvent(new CustomEvent("tr-accounts-load-cloud",{detail:cloud}));
       lastCloudJSON=jsonData(cloud);status("Cloud: data loaded");
      }else{
       await setDoc(ref,{data:local,updatedAt:serverTimestamp()});
       lastCloudJSON=jsonData(local);status("Cloud: local data uploaded");
      }
    }
   }catch(err){console.error(err);status("Cloud sync error. Check connection and Firestore rules.");}
   finally{syncing=false;}
  }
  async function guardedUpload(force=false){
   if(!currentUser||!window.TRAccountsCloudData)return;
   const ref=doc(db,"trAccountsUsers",currentUser.uid),local=window.TRAccountsCloudData(),localJSON=jsonData(local);
   try{
    await runTransaction(db,async tx=>{
      const snap=await tx.get(ref);
      const remoteJSON=snap.exists()?jsonData(snap.data().data):null;
      if(!snap.exists()||remoteJSON===lastCloudJSON||force){
        tx.set(ref,{data:local,updatedAt:serverTimestamp()});
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
  btn?.addEventListener("click",async()=>{
   if(currentUser){if(confirm("Sign out of Google Cloud?"))await signOut(auth);}
   else try{await signInWithPopup(auth,new GoogleAuthProvider());}catch(err){console.error(err);status("Google sign-in failed. Check authorized domains.");}
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
