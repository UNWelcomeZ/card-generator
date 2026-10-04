// 頭像
// 帶邊框的頭像畫在一張獨立的 canvas 上，直接疊在 DOM 裡顯示，
// 拖曳時只更新 CSS transform，不需要重繪任何畫布
export default class Avatar {
  constructor(CANVAS_SIZE, size, borderSize) {
    this.CANVAS_SIZE = CANVAS_SIZE
    // Position（畫布座標，頭像中心）
    this.x = CANVAS_SIZE.WIDTH / 2
    this.y = CANVAS_SIZE.HEIGHT / 2
    // Resize ratio
    this.ratio = 0
    // Image
    this.image = null
    // Border size
    this.borderSize = borderSize
    // Size
    this.size = size
    // Drag moving offset
    this.dragging = false
    this.dragOffsetX = 0
    this.dragOffsetY = 0

    // 顯示用的 canvas（含邊框）
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'layer-avatar'
    this.canvas.style.display = 'none'
    this.ctx = this.canvas.getContext('2d')
    // 建立 canvas 時使用的大小，預覽時用來計算縮放
    this.builtSize = size
    // 預先縮放好的頭像，描邊時不用每次都從原圖縮放
    this.source = null
    // 點擊判斷用的 alpha 遮罩，第一次需要時才建立
    this.hitMask = null
    // 畫布座標 → 顯示像素的比例
    this.displayScale = 1
    // 目前正在載入的圖片
    this.pendingImage = null
  }

  // 載入圖片
  load(url) {
    const image = new Image()
    this.pendingImage = image
    image.onload = () => {
      // 載入期間又換了別張圖
      if (this.pendingImage !== image) return
      this.pendingImage = null
      this.image = image
      this.source = null
      // 計算顯示的縮放比例
      this.ratio = Math.min(
        this.CANVAS_SIZE.WIDTH / image.naturalWidth,
        this.CANVAS_SIZE.HEIGHT / image.naturalHeight,
      )
      this.build()
    }
    image.src = url
  }

  // 移除圖片
  remove() {
    this.pendingImage = null
    this.image = null
    this.source = null
    this.hitMask = null
    this.dragging = false
    // 釋放 canvas 記憶體
    this.canvas.width = 0
    this.canvas.height = 0
    this.update()
  }

  // 建立帶邊框的頭像
  // samples 為描邊取樣數，預覽時可以用較少的數量加快速度
  build(samples = 36) {
    if (!this.image) return

    const w = Math.max(1, Math.round(this.image.naturalWidth * this.ratio * this.size))
    const h = Math.max(1, Math.round(this.image.naturalHeight * this.ratio * this.size))

    if (!this.source) {
      this.source = document.createElement('canvas')
    }
    if (this.source.width !== w || this.source.height !== h) {
      this.source.width = w
      this.source.height = h
      this.source.getContext('2d').drawImage(this.image, 0, 0, w, h)
    }

    const thickness = this.borderSize
    this.canvas.width = Math.ceil(w + thickness * 2)
    this.canvas.height = Math.ceil(h + thickness * 2)
    const ctx = this.ctx

    // 畫邊框：往各方向偏移繪製，再把形狀填成白色
    for (let i = 0; i < samples; i++) {
      const angle = (Math.PI * 2 * i) / samples
      ctx.drawImage(
        this.source,
        thickness + thickness * Math.sin(angle),
        thickness + thickness * Math.cos(angle),
      )
    }
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // 畫頭像本體
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(this.source, thickness, thickness)

    this.builtSize = this.size
    this.hitMask = null
    this.update()
  }

  // 目前在畫布上的尺寸（預覽時依 size 縮放已建立的 canvas）
  get displayWidth() {
    return (this.canvas.width * this.size) / this.builtSize
  }

  get displayHeight() {
    return (this.canvas.height * this.size) / this.builtSize
  }

  setDisplayScale(scale) {
    this.displayScale = scale
    this.update()
  }

  // 更新顯示尺寸與位置
  update() {
    const style = this.canvas.style
    if (!this.image || this.canvas.width === 0) {
      style.display = 'none'
      return
    }
    style.display = 'block'
    style.width = `${this.displayWidth * this.displayScale}px`
    style.height = `${this.displayHeight * this.displayScale}px`
    this.updatePosition()
  }

  updatePosition() {
    const left = (this.x - this.displayWidth / 2) * this.displayScale
    const top = (this.y - this.displayHeight / 2) * this.displayScale
    this.canvas.style.transform = `translate(${left}px, ${top}px)`
  }

  // 判斷畫布座標是否點在頭像上（不透明的像素）
  hitTest(x, y) {
    if (!this.image || this.canvas.width === 0) return false

    const k = this.size / this.builtSize
    const u = Math.floor((x - (this.x - this.displayWidth / 2)) / k)
    const v = Math.floor((y - (this.y - this.displayHeight / 2)) / k)
    const { width, height } = this.canvas
    if (u < 0 || v < 0 || u >= width || v >= height) return false

    // 只讀取一次像素，之後重複使用
    if (!this.hitMask) {
      const data = this.ctx.getImageData(0, 0, width, height).data
      this.hitMask = new Uint8Array(width * height)
      for (let i = 0; i < this.hitMask.length; i++) {
        this.hitMask[i] = data[i * 4 + 3]
      }
    }
    return this.hitMask[v * width + u] > 0
  }

  // 繪製到輸出用的畫布
  renderTo(ctx) {
    if (!this.image || this.canvas.width === 0) return
    const w = this.displayWidth
    const h = this.displayHeight
    ctx.drawImage(this.canvas, this.x - w / 2, this.y - h / 2, w, h)
  }

  drag(x, y) {
    // 計算拖曳位置
    this.x = x + this.dragOffsetX
    this.y = y + this.dragOffsetY
    this.updatePosition()
  }
}
