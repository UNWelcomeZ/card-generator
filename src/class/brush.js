// 手繪筆刷
// 沿路徑密集蓋上實心圓點，半徑隨距離平滑地小幅變化，
// 模擬麥克筆 / 粉筆邊緣的不規則感，筆畫本身保持不透明
export default class Brush {
  // 半徑平滑變化的幅度（相對於半徑）
  static WOBBLE = 0.08
  // 每個圓點半徑的隨機變化幅度（相對於半徑）
  static JITTER = 0.06
  // 每個圓點位置的隨機偏移幅度（相對於半徑）
  static OFFSET = 0.08
  // 圓點間距（相對於半徑）
  static SPACING = 0.3

  constructor(ctx) {
    this.ctx = ctx
    this.radius = 1
    this.last = null
    // 已經畫過的長度，用來計算平滑的半徑變化
    this.distance = 0
    this.seed = 0
    // 這一筆影響的範圍
    this.bounds = null
  }

  // 開始一筆
  begin(x, y, diameter, color) {
    this.radius = diameter / 2
    this.ctx.fillStyle = color
    this.seed = Math.random() * 1000
    this.distance = 0
    this.last = { x, y }
    this.bounds = null
    this.ctx.beginPath()
    this.addStamp(x, y)
    this.ctx.fill()
  }

  // 畫到下一個點，points 為同一幀內的所有點
  lineTo(points) {
    if (!this.last) return
    const ctx = this.ctx
    const spacing = Math.max(0.75, this.radius * Brush.SPACING)
    ctx.beginPath()
    for (const { x, y } of points) {
      const { x: x0, y: y0 } = this.last
      const length = Math.hypot(x - x0, y - y0)
      const steps = Math.floor(length / spacing)
      for (let i = 1; i <= steps; i++) {
        const t = (i * spacing) / length
        this.addStamp(x0 + (x - x0) * t, y0 + (y - y0) * t, this.distance + i * spacing)
      }
      // 不足一個間距的部分留到下一個點
      if (steps > 0) {
        const t = (steps * spacing) / length
        this.last = { x: x0 + (x - x0) * t, y: y0 + (y - y0) * t }
        this.distance += steps * spacing
      }
    }
    ctx.fill()
  }

  // 結束一筆，回傳影響的範圍
  end() {
    this.last = null
    return this.bounds
  }

  addStamp(x, y, distance = 0) {
    const r = this.radius
    const d = distance / r
    // 兩個不同頻率的正弦波疊加，邊緣起伏比單一頻率自然
    const wobble = Math.sin(d * 0.9 + this.seed) * 0.6 + Math.sin(d * 2.3 + this.seed * 2) * 0.4
    const radius = r * (1 + wobble * Brush.WOBBLE + (Math.random() - 0.5) * Brush.JITTER)
    const cx = x + (Math.random() - 0.5) * r * Brush.OFFSET
    const cy = y + (Math.random() - 0.5) * r * Brush.OFFSET

    this.ctx.moveTo(cx + radius, cy)
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)

    const b = this.bounds
    if (b) {
      b.minX = Math.min(b.minX, cx - radius)
      b.minY = Math.min(b.minY, cy - radius)
      b.maxX = Math.max(b.maxX, cx + radius)
      b.maxY = Math.max(b.maxY, cy + radius)
    } else {
      this.bounds = { minX: cx - radius, minY: cy - radius, maxX: cx + radius, maxY: cy + radius }
    }
  }
}
