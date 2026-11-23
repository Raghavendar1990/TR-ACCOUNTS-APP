/* TR Accounts Google Cloud module: Firebase Auth + Firestore sync. Firebase config is public client config, not a private key. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const btn = document.getElementById("cloudSetup");
const notice = document.getElementById("moduleNotice");
const missing = !firebaseConfig || Object.values(firebaseConfig).some(v=>!v || String(v).includes("YOUR_"));
let auth, db, currentUser, syncing=false, timer;
function status(msg){ if(btn) btn.textContent=msg; if(notice) notice.textContent=msg; }
if(missing){ status("Cloud: Firebase project config needed. App data remains local until configured."); }
else {
  try {
    const app=initializeApp(firebaseConfig); auth=getAuth(app); db=getFirestore(app);
    onAuthStateChanged(auth,async user=>{
      currentUser=user||null;
      if(!user){status("Google Login");return;}
      status("Cloud connected: "+(user.displayName||user.email||"Google account"));
      await syncData();
    });
    async function syncData(){
      if(!currentUser||syncing||!window.TRAccountsCloudData)return;
      syncing=true;
      try{
        const ref=doc(db,"trAccountsUsers",currentUser.uid);
        const snap=await getDoc(ref);
        if(!snap.exists()){
          await setDoc(ref,{data:window.TRAccountsCloudData(),updatedAt:serverTimestamp()});
          status("Cloud: initial upload complete");
        } else {
          const cloud=snap.data().data;
          const local=window.TRAccountsCloudData();
          if(cloud && confirm("Cloud data found. OK = load Cloud data on this device; Cancel = upload this device data to Cloud.")){
            window.dispatchEvent(new CustomEvent("tr-accounts-load-cloud",{detail:cloud}));
          } else {
            await setDoc(ref,{data:local,updatedAt:serverTimestamp()});
            status("Cloud: local data uploaded");
          }
        }
      }catch(err){console.error(err);status("Cloud sync error. Check connection and Firestore rules.");}
      finally{syncing=false;}
    }
    btn?.addEventListener("click",async()=>{
      if(currentUser){if(confirm("Sign out of Google Cloud?"))await signOut(auth);}
      else try{await signInWithPopup(auth,new GoogleAuthProvider());}catch(err){console.error(err);status("Google sign-in failed. Check authorized domains.");}
    });
    window.addEventListener("tr-accounts-data-updated",()=>{
      if(!currentUser)return; clearTimeout(timer);
      timer=setTimeout(async()=>{
        if(syncing)return;
        try{await setDoc(doc(db,"trAccountsUsers",currentUser.uid),{data:window.TRAccountsCloudData(),updatedAt:serverTimestamp()},{merge:true});status("Cloud: synced");}
        catch(err){console.error(err);status("Cloud sync error; local copy saved.");}
      },1200);
    });
    window.addEventListener("tr-accounts-load-cloud",e=>{
      const d=e.detail||{};
      if(!Array.isArray(d.people)||!Array.isArray(d.transactions)){status("Cloud data format invalid");return;}
      const payload={...d,pinHash:"",recoveryHash:""};
      if(window.TRAccountsApplyCloudData){window.TRAccountsApplyCloudData(payload);status("Cloud data loaded");}else{localStorage.setItem("tr_accounts_data_v1",JSON.stringify(payload));alert("Cloud data saved locally. Reload app to apply.");}
    });
  }catch(err){console.error(err);status("Firebase initialization failed.");}
}
