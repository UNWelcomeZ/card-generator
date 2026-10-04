// 復原 / 重作
// 每筆紀錄只存被修改的範圍，復原與重作時把該範圍的像素互換
export default class Undo {
  constructor(amount = 10, canvas) {
    this.amount = amount
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.width = canvas.width
    this.height = canvas.height

    // 已提交內容的副本，用來取得變更前的像素
    this.mirror = document.createElement('canvas')
    this.mirror.width = this.width
    this.mirror.height = this.height
    this.mirrorCtx = this.mirror.getContext('2d')
    this.mirrorCtx.drawImage(canvas, 0, 0)

    // 紀錄 { x, y, w, h, image }
    // current 之前的 image 是變更前的像素，之後的是變更後的像素
    this.history = []
    this.current = 0
  }

  // 複製指定範圍
  copyRegion(source, { x, y, w, h }) {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(source, x, y, w, h, 0, 0, w, h)
    return canvas
  }

  // 把圖片寫入指定範圍（取代原本的像素）
  putRegion(ctx, image, { x, y, w, h }) {
    ctx.clearRect(x, y, w, h)
    ctx.drawImage(image, x, y)
  }

  // 釋放紀錄的 canvas 記憶體
  release(entries) {
    for (const entry of entries) {
      entry.image.width = 0
      entry.image.height = 0
    }
  }

  // 記錄圖層變更，rect 為變更範圍，省略時為整張圖層
  capture(rect) {
    const x = Math.max(0, Math.floor(rect?.x ?? 0))
    const y = Math.max(0, Math.floor(rect?.y ?? 0))
    const w = Math.min(this.width, Math.ceil((rect?.x ?? 0) + (rect?.w ?? this.width))) - x
    const h = Math.min(this.height, Math.ceil((rect?.y ?? 0) + (rect?.h ?? this.height))) - y
    if (w <= 0 || h <= 0) return
    const region = { x, y, w, h }

    const before = this.copyRegion(this.mirror, region)
    this.mirrorCtx.clearRect(x, y, w, h)
    this.mirrorCtx.drawImage(this.canvas, x, y, w, h, x, y, w, h)

    // 丟棄目前位置之後的重作紀錄
    this.release(this.history.splice(this.current))
    this.history.push({ ...region, image: before })
    if (this.history.length > this.amount) {
      this.release(this.history.splice(0, 1))
    }
    this.current = this.history.length
  }

  get canUndo() {
    return this.current > 0
  }

  get canRedo() {
    return this.current < this.history.length
  }

  undo() {
    if (this.current > 0) {
      this.current--
      this.swap(this.history[this.current])
    }
  }

  redo() {
    if (this.current < this.history.length) {
      this.swap(this.history[this.current])
      this.current++
    }
  }

  // 把紀錄的像素寫回圖層，並把目前的像素存進紀錄
  swap(entry) {
    const current = this.copyRegion(this.mirror, entry)
    this.putRegion(this.mirrorCtx, entry.image, entry)
    this.putRegion(this.ctx, entry.image, entry)
    this.release([entry])
    entry.image = current
  }
}
