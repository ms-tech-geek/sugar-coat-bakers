/* Sugar Coat Bakers — Firestore sync layer */
const SugarCoatDb = (() => {
  const CUSTOMERS_COL = 'customers';
  const LEGACY_STORAGE_KEY = 'sugar-coat-customers';
  const MIGRATION_FLAG = 'sugar-coat-firestore-migrated';

  let db = null;
  let customersCache = [];
  let syncReady = false;
  let online = navigator.onLine;
  const listeners = new Set();

  function isConfigured() {
    return (
      typeof FIREBASE_CONFIG !== 'undefined' &&
      FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY' &&
      FIREBASE_CONFIG.projectId &&
      FIREBASE_CONFIG.projectId !== 'YOUR_PROJECT_ID'
    );
  }

  function notify() {
    listeners.forEach((fn) => {
      try {
        fn(customersCache, { online, ready: syncReady });
      } catch (err) {
        console.error(err);
      }
    });
  }

  function docToCustomer(doc) {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || '',
      phone: data.phone || '',
      amount: data.amount ?? 0,
      notes: data.notes || '',
      createdAt: data.createdAt || new Date().toISOString(),
    };
  }

  async function migrateLocalStorageIfNeeded() {
    if (localStorage.getItem(MIGRATION_FLAG)) return;

    let legacy = [];
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY)) || [];
    } catch {
      legacy = [];
    }

    if (!legacy.length) {
      localStorage.setItem(MIGRATION_FLAG, '1');
      return;
    }

    const col = db.collection(CUSTOMERS_COL);
    const batch = db.batch();
    legacy.forEach((c) => {
      const ref = col.doc(c.id || col.doc().id);
      batch.set(ref, {
        name: c.name,
        phone: c.phone,
        amount: c.amount ?? 0,
        notes: c.notes || '',
        createdAt: c.createdAt || new Date().toISOString(),
      });
    });
    await batch.commit();
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.setItem(MIGRATION_FLAG, '1');
  }

  async function init() {
    if (!isConfigured()) {
      throw new Error('Firebase config missing — copy firebase-config.example.js to firebase-config.js');
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    await firebase.auth().signInAnonymously();
    db = firebase.firestore();

    try {
      await db.enablePersistence({ synchronizeTabs: true });
    } catch (err) {
      if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
        console.warn('Firestore persistence:', err);
      }
    }

    await migrateLocalStorageIfNeeded();

    window.addEventListener('online', () => {
      online = true;
      notify();
    });
    window.addEventListener('offline', () => {
      online = false;
      notify();
    });

    return new Promise((resolve, reject) => {
      let resolved = false;
      db.collection(CUSTOMERS_COL)
        .orderBy('createdAt', 'asc')
        .onSnapshot(
          (snapshot) => {
            customersCache = snapshot.docs.map(docToCustomer);
            syncReady = true;
            notify();
            if (!resolved) {
              resolved = true;
              resolve();
            }
          },
          (err) => {
            console.error(err);
            if (!resolved) reject(err);
          }
        );
    });
  }

  function onCustomersUpdated(callback) {
    listeners.add(callback);
    if (syncReady) callback(customersCache, { online, ready: syncReady });
    return () => listeners.delete(callback);
  }

  function getCustomers() {
    return customersCache;
  }

  function findByPhone(phone, excludeId = null) {
    return customersCache.find((c) => c.phone === phone && c.id !== excludeId) || null;
  }

  async function addCustomer(customer) {
    const ref = db.collection(CUSTOMERS_COL).doc(customer.id);
    await ref.set({
      name: customer.name,
      phone: customer.phone,
      amount: customer.amount ?? 0,
      notes: customer.notes || '',
      createdAt: customer.createdAt,
    });
  }

  async function updateCustomer(id, data) {
    await db
      .collection(CUSTOMERS_COL)
      .doc(id)
      .update({
        name: data.name,
        phone: data.phone,
        amount: data.amount ?? 0,
        notes: data.notes || '',
      });
  }

  async function deleteCustomer(id) {
    await db.collection(CUSTOMERS_COL).doc(id).delete();
  }

  async function clearAllCustomers() {
    const snapshot = await db.collection(CUSTOMERS_COL).get();
    if (snapshot.empty) return;

    const chunks = [];
    let batch = db.batch();
    let count = 0;

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      count += 1;
      if (count >= 450) {
        chunks.push(batch.commit());
        batch = db.batch();
        count = 0;
      }
    });

    if (count > 0) chunks.push(batch.commit());
    await Promise.all(chunks);
  }

  return {
    init,
    isConfigured,
    onCustomersUpdated,
    getCustomers,
    findByPhone,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    clearAllCustomers,
    isReady: () => syncReady,
    isOnline: () => online,
  };
})();
