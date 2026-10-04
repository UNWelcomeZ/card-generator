// 復原 / 重作
// 快照存在 2D canvas，用 drawImage 從 WebGL 圖層複製，避免 layer.get() 觸發同步 readPixels
export default class Undo {
  constructor(amount = 10, layer, center, p5) {
    this.amount = amount
    this.layer = layer
    this.center = center

    // 目前使用中的快照
    this.snapshots = []
    // 可重複使用的 canvas，避免一直建立新的大圖
    this.pool = []
    this.current = 0

    // 還原時用來上傳到 WebGL 的暫存圖層，只會有一張 texture
    this.restoreBuffer = p5.createGraphics(layer.width, layer.height)

    this.capture()
  }

  createSnapshotCanvas() {
    const canvas = document.createElement('canvas')
    canvas.width = this.layer.elt.width
    canvas.height = this.layer.elt.height
    return canvas
  }

  capture() {
    // 丟棄目前位置之後的重作紀錄
    this.pool.push(...this.snapshots.splice(this.current + 1))

    const snapshot = this.pool.pop() ?? this.createSnapshotCanvas()
    const ctx = snapshot.getContext('2d')
    ctx.clearRect(0, 0, snapshot.width, snapshot.height)
    ctx.drawImage(this.layer.elt, 0, 0)
    this.snapshots.push(snapshot)

    if (this.snapshots.length > this.amount) {
      this.pool.push(this.snapshots.shift())
    }
    this.current = this.snapshots.length - 1
  }

  undo() {
    if (this.current > 0) {
      this.current--
      this.show()
    }
  }

  redo() {
    if (this.current < this.snapshots.length - 1) {
      this.current++
      this.show()
    }
  }

  show() {
    const snapshot = this.snapshots[this.current]
    const ctx = this.restoreBuffer.drawingContext
    ctx.clearRect(0, 0, snapshot.width, snapshot.height)
    ctx.drawImage(snapshot, 0, 0)

    this.layer.clear()
    // WebGL 的 0, 0 是畫布的中心點
    this.layer.image(this.restoreBuffer, -this.center.x, -this.center.y)
  }
}
