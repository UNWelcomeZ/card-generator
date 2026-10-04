// 自動儲存
// 作品存在 IndexedDB，頁面被重新整理或被系統回收後可以還原
// 無法使用 IndexedDB 時（例如部分無痕模式）所有操作都會靜默失敗
const DB_NAME = 'unwz-generator'
const STORE_NAME = 'autosave'
const KEY = 'current'
const VERSION = 1

let dbPromise = null

const openDB = () => {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

const run = async (mode, action) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const request = action(tx.objectStore(STORE_NAME))
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

// 讀取儲存的作品，沒有或版本不符時回傳 null
export const loadState = async () => {
  try {
    const state = await run('readonly', (store) => store.get(KEY))
    return state?.version === VERSION ? state : null
  } catch (e) {
    console.warn('Failed to load autosave', e)
    return null
  }
}

export const saveState = async (state) => {
  try {
    await run('readwrite', (store) => store.put({ ...state, version: VERSION }, KEY))
  } catch (e) {
    console.warn('Failed to save autosave', e)
  }
}

export const clearState = async () => {
  try {
    await run('readwrite', (store) => store.delete(KEY))
  } catch (e) {
    console.warn('Failed to clear autosave', e)
  }
}
