/* TR Accounts local persistence layer.
   This stores app data on this device/browser only. Cloud sync is a separate module. */
(() => {
  "use strict";
  const KEY = "tr_accounts_data_v1";
  const DEFAULTS = { people: [], transactions: [], recycleBin: [], pinHash: "", recoveryHash: "", language: "en", theme: "dark" };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw);
      return {
        people: Array.isArray(parsed.people) ? parsed.people : [],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        recycleBin: Array.isArray(parsed.recycleBin) ? parsed.recycleBin : [],
        pinHash: typeof parsed.pinHash === "string" ? parsed.pinHash : "",
        recoveryHash: typeof parsed.recoveryHash === "string" ? parsed.recoveryHash : "",
        language: parsed.language === "te" ? "te" : "en",
        theme: parsed.theme === "light" ? "light" : "dark"
      };
    } catch (error) {
      console.warn("TR Accounts: local data could not be read", error);
      return { ...DEFAULTS };
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        people: Array.isArray(data.people) ? data.people : [],
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        recycleBin: Array.isArray(data.recycleBin) ? data.recycleBin : [],
        pinHash: typeof data.pinHash === "string" ? data.pinHash : "",
        recoveryHash: typeof data.recoveryHash === "string" ? data.recoveryHash : "",
        language: data.language === "te" ? "te" : "en",
        theme: data.theme === "light" ? "light" : "dark",
        updatedAt: new Date().toISOString()
      }));
      return true;
    } catch (error) {
      console.warn("TR Accounts: local save failed", error);
      return false;
    }
  }

  window.TRStorage = { load, save };
  window.TRFiles = { saveProof, getProof, deleteProof };
  const FILE_DB = "tr_accounts_files_v1";
  function fileDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(FILE_DB,1);req.onupgradeneeded=()=>req.result.createObjectStore("proofs",{keyPath:"id"});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function saveProof(id,file){const db=await fileDb();return new Promise((resolve,reject)=>{const tx=db.transaction("proofs","readwrite");tx.objectStore("proofs").put({id,name:file.name,type:file.type,blob:file,createdAt:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error)};});}
  async function getProof(id){const db=await fileDb();return new Promise((resolve,reject)=>{const tx=db.transaction("proofs","readonly");const req=tx.objectStore("proofs").get(id);req.onsuccess=()=>{db.close();resolve(req.result||null)};req.onerror=()=>{db.close();reject(req.error)};});}
  async function deleteProof(id){const db=await fileDb();return new Promise((resolve,reject)=>{const tx=db.transaction("proofs","readwrite");tx.objectStore("proofs").delete(id);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error)};});}

})();