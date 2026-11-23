/* TR Accounts local persistence layer.
   This stores app data on this device/browser only. Cloud sync is a separate module. */
(() => {
  "use strict";
  const KEY = "tr_accounts_data_v1";
  const DEFAULTS = { people: [], transactions: [], recycleBin: [], language: "en", theme: "dark" };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw);
      return {
        people: Array.isArray(parsed.people) ? parsed.people : [],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        recycleBin: Array.isArray(parsed.recycleBin) ? parsed.recycleBin : [],
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
})();