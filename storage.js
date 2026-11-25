/* TR Accounts local persistence layer.
   Data stays on this device/browser. Cloud sync is handled by cloud.js.
   Proof attachments are stored separately in IndexedDB to keep ledger data lightweight. */
(() => {
  "use strict";
  const KEY = "tr_accounts_data_v1";
  const BACKUP_KEY = "tr_accounts_data_backup_v1";
  const DEFAULTS = {
    people: [], transactions: [], recycleBin: [], businesses: [],
    businessTransactions: [], partners: [], partnerRecords: [],
    pinHash: "", recoveryHash: "", language: "en", theme: "dark"
  };

  function load() {
    const parseStore = raw => {
      if (!raw) return null;
      try { const parsed=JSON.parse(raw); return parsed && typeof parsed === "object" ? parsed : null; }
      catch { return null; }
    };
    let primary=parseStore(localStorage.getItem(KEY));
    let backup=parseStore(localStorage.getItem(BACKUP_KEY));
    const populated=data=>!!data&&((Array.isArray(data.people)&&data.people.length)||(Array.isArray(data.transactions)&&data.transactions.length)||(Array.isArray(data.recycleBin)&&data.recycleBin.length)||(Array.isArray(data.businesses)&&data.businesses.length)||(Array.isArray(data.businessTransactions)&&data.businessTransactions.length)||(Array.isArray(data.partners)&&data.partners.length)||(Array.isArray(data.partnerRecords)&&data.partnerRecords.length)||(data.pinHash||data.recoveryHash));
    let parsed=primary;
    // Recover a populated backup when the primary store is valid but unexpectedly empty.
    if(primary&&!populated(primary)&&backup&&populated(backup)) parsed=backup;
    if(!parsed) parsed=backup;
    if(!parsed) return { ...DEFAULTS };
    return {
      people: Array.isArray(parsed.people) ? parsed.people : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      recycleBin: Array.isArray(parsed.recycleBin) ? parsed.recycleBin : [],
      businesses: Array.isArray(parsed.businesses) ? parsed.businesses : [],
      businessTransactions: Array.isArray(parsed.businessTransactions) ? parsed.businessTransactions : [],
      partners: Array.isArray(parsed.partners) ? parsed.partners : [],
      partnerRecords: Array.isArray(parsed.partnerRecords) ? parsed.partnerRecords : [],
      pinHash: typeof parsed.pinHash === "string" ? parsed.pinHash : "",
      recoveryHash: typeof parsed.recoveryHash === "string" ? parsed.recoveryHash : "",
      language: parsed.language === "te" ? "te" : "en",
      theme: parsed.theme === "light" ? "light" : "dark"
    };
  }

  function save(data) {
    try {
      const serialized = JSON.stringify({
        people: Array.isArray(data.people) ? data.people : [],
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        recycleBin: Array.isArray(data.recycleBin) ? data.recycleBin : [],
        businesses: Array.isArray(data.businesses) ? data.businesses : [],
        businessTransactions: Array.isArray(data.businessTransactions) ? data.businessTransactions : [],
        partners: Array.isArray(data.partners) ? data.partners : [],
        partnerRecords: Array.isArray(data.partnerRecords) ? data.partnerRecords : [],
        pinHash: typeof data.pinHash === "string" ? data.pinHash : "",
        recoveryHash: typeof data.recoveryHash === "string" ? data.recoveryHash : "",
        language: data.language === "te" ? "te" : "en",
        theme: data.theme === "light" ? "light" : "dark",
        updatedAt: new Date().toISOString()
      });
      localStorage.setItem(KEY, serialized);
      localStorage.setItem(BACKUP_KEY, serialized);
      return true;
    } catch (error) {
      console.warn("TR Accounts: local save failed", error);
      return false;
    }
  }

  const FILE_DB = "tr_accounts_files_v1";
  const FILE_STORE = "proofs";
  const MAX_PROOF_BYTES = 700 * 1024;
  const ALLOWED_PROOF_TYPES = ["application/pdf"];

  function fileDb() {
    if (!window.indexedDB) return Promise.reject(new Error("IndexedDB is not supported on this device/browser."));
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(FILE_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Could not open proof storage."));
      req.onblocked = () => reject(new Error("Proof storage upgrade is blocked by another open tab."));
    });
  }

  function validateProof(id, file) {
    if (!id || typeof id !== "string") throw new Error("Proof attachment ID is required.");
    if (!file || typeof file.size !== "number") throw new Error("Select a proof file.");
    if (file.size > MAX_PROOF_BYTES) throw new Error("Proof file must be 700 KB or smaller.");
    const isImage = typeof file.type === "string" && file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) throw new Error("Only image or PDF proof files are allowed.");
  }

  async function saveProof(id, file) {
    validateProof(id, file);
    const db = await fileDb();
    return new Promise((resolve, reject) => {
      let settled = false;
      const tx = db.transaction(FILE_STORE, "readwrite");
      tx.objectStore(FILE_STORE).put({
        id, name: String(file.name || id), type: file.type || "application/octet-stream",
        blob: file, size: file.size, createdAt: new Date().toISOString()
      });
      tx.oncomplete = () => { if (!settled) { settled = true; db.close(); resolve(true); } };
      tx.onerror = () => { if (!settled) { settled = true; db.close(); reject(tx.error || new Error("Proof save failed.")); } };
      tx.onabort = () => { if (!settled) { settled = true; db.close(); reject(tx.error || new Error("Proof save was cancelled.")); } };
    });
  }

  async function getProof(id) {
    if (!id) return null;
    const db = await fileDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, "readonly");
      const req = tx.objectStore(FILE_STORE).get(id);
      req.onsuccess = () => { db.close(); resolve(req.result || null); };
      req.onerror = () => { db.close(); reject(req.error || new Error("Proof read failed.")); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error("Proof read was cancelled.")); };
    });
  }

  async function deleteProof(id) {
    if (!id) return false;
    const db = await fileDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, "readwrite");
      tx.objectStore(FILE_STORE).delete(id);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error("Proof delete failed.")); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error("Proof delete was cancelled.")); };
    });
  }

  window.TRStorage = { load, save };
  window.TRFiles = { saveProof, getProof, deleteProof, maxProofBytes: MAX_PROOF_BYTES };
})();