import ColorThief from 'colorthief'

export default class Avatar {
  constructor(layer, CANVAS_SIZE, p5) {
    this.layer = layer
    this.ctx = this.layer.canvas.getContext('2d')
    // Position
    this.x = 0
    this.y = 0
    // Resize ratio
    this.ratio = 0
    // Image
    this.image = null
    // Border size
    this.borderSize = 20
    // Size
    this.size = 1
    // Dominant color
    this.color = null
    this.colorPalette = null
    // Drag moving offset
    this.dragging = false
    this.dragOffsetX = 0
    this.dragOffsetY = 0
    // 邊框快取
    this.borderCache = null
    this.lastBorderSize = -1
    this.lastSize = -1

    this.layer.imageMode(p5.CENTER)
    this.CANVAS_SIZE = CANVAS_SIZE
    this.x = this.CANVAS_SIZE.WIDTH / 2
    this.y = this.CANVAS_SIZE.HEIGHT / 2

    this.scale = 1

    this.p5 = p5
  }

  set() {
    // 取得圖片主色
    const colorThief = new ColorThief()
    this.color = colorThief.getColor(this.image.elt)
    this.colorPalette = colorThief.getPalette(this.image.elt)

    // 計算顯示的縮放比例
    this.ratio = Math.min(
      this.CANVAS_SIZE.WIDTH / this.image.width,
      this.CANVAS_SIZE.HEIGHT / this.image.height,
    )

    // 重置邊框快取
    this.borderCache = null
    this.lastBorderSize = -1
    this.lastSize = -1

    this.draw()
  }

  // 建立邊框快取
  createBorderCache() {
    if (!this.image) return

    // 如果設置沒變，使用現有快取
    if (
      this.borderCache &&
      this.lastBorderSize === this.borderSize &&
      this.lastSize === this.size
    ) {
      return
    }

    const w = this.image.width * this.ratio * this.size
    const h = this.image.height * this.ratio * this.size

    // 建立快取圖層
    this.borderCache = this.p5.createGraphics(
      Math.ceil(w + this.borderSize * 2),
      Math.ceil(h + this.borderSize * 2),
    )

    const thickness = this.borderSize
    const samples = 36
    const centerX = this.borderCache.width / 2
    const centerY = this.borderCache.height / 2

    // 畫邊框
    for (let angle = 0; angle < 360; angle += 360 / samples) {
      const offsetX = thickness * Math.sin((Math.PI * 2 * angle) / 360)
      const offsetY = thickness * Math.cos((Math.PI * 2 * angle) / 360)

      this.borderCache.push()
      this.borderCache.imageMode(this.p5.CENTER)
      this.borderCache.image(this.image, centerX + offsetX, centerY + offsetY, w, h)
      this.borderCache.pop()
    }

    const originalComposite = this.borderCache.canvas.getContext('2d').globalCompositeOperation
    this.borderCache.canvas.getContext('2d').globalCompositeOperation = 'source-in'
    this.borderCache.fill('white')
    this.borderCache.noStroke()
    this.borderCache.rect(0, 0, this.borderCache.width, this.borderCache.height)

    this.borderCache.canvas.getContext('2d').globalCompositeOperation = 'source-over'
    this.borderCache.push()
    this.borderCache.imageMode(this.p5.CENTER)
    this.borderCache.image(this.image, centerX, centerY, w, h)
    this.borderCache.pop()

    this.borderCache.canvas.getContext('2d').globalCompositeOperation = originalComposite

    // 保存目前設置以便比較
    this.lastBorderSize = this.borderSize
    this.lastSize = this.size
  }

  draw() {
    this.layer.clear()

    // 如果沒有圖片，則不繪製
    if (!this.image) return

    // 建立圖片邊框快取
    this.createBorderCache()

    if (this.borderCache) {
      // 使用預先繪製的邊框快取
      this.layer.imageMode(this.p5.CENTER)
      this.layer.image(this.borderCache, this.x, this.y)
    }
  }

  drag(x, y) {
    // 計算拖曳位置
    this.x = x + this.dragOffsetX
    this.y = y + this.dragOffsetY

    // 限制頭像不要超出畫布範圍
    // const borderWidth = this.borderCache ? this.borderCache.width / 2 : 0
    // const borderHeight = this.borderCache ? this.borderCache.height / 2 : 0

    // this.x = Math.max(borderWidth, Math.min(this.CANVAS_SIZE.WIDTH - borderWidth, this.x))
    // this.y = Math.max(borderHeight, Math.min(this.CANVAS_SIZE.HEIGHT - borderHeight, this.y))
  }
}
