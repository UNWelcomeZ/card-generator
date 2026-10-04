<template lang="pug">
#main-canvas(ref="mainCanvas")
  .canvas-stack(ref="canvasStack" :style="stackStyle")
</template>

<script setup>
import { useTemplateRef, onMounted, computed, watch, nextTick, inject } from 'vue'
import { useAppStore } from 'src/stores/app'
import { useToolsStore } from 'src/stores/tools'
import { useElementSize } from '@vueuse/core'
import Undo from 'src/class/undo'
import Avatar from 'src/class/avatar'

// *********** Constants ***********
const FONT_URL = new URL('src/assets/fonts/SedgwickAveDisplay-Regular.ttf', import.meta.url).href
const BACKGROUND_IMAGE = new URL('src/assets/images/bg.png', import.meta.url).href
const TEXT_BACKGROUND_IMAGE = new URL('src/assets/images/textbg.png', import.meta.url).href
const DEFAULT_DRAW_IMAGE = new URL('src/assets/images/default-draw.png', import.meta.url).href
const DEFAULT_AVATAR_IMAGE = new URL('src/assets/images/default-avatar.png', import.meta.url).href
const TEXT_BACKGROUND_IMAGE_SIZE = {
  WIDTH: 1088,
  HEIGHT: 407,
}
const CANVAS_SIZE = {
  WIDTH: 1080,
  HEIGHT: 1800,
  PADDING: 50,
}
const MAX_UNDO = 20
// 筆畫取樣點的最小間距（畫布像素），過濾掉高頻觸控產生的過密點
const MIN_STROKE_DISTANCE = 1.5
// 復原範圍額外保留的邊界，涵蓋 p5.brush 筆觸的隨機抖動
const STROKE_PADDING = 8
// 名字最大字級
const NAME_FONT_SIZE_MAX = 300
// 調整頭像時，預覽用的描邊取樣數
const AVATAR_PREVIEW_SAMPLES = 12
// 停止調整頭像多久後重建完整品質的邊框（毫秒）
const AVATAR_COMMIT_DELAY = 200

// *********** Store & Event ***********
const appStore = useAppStore()
const toolsStore = useToolsStore()
const {
  PEN_SIZE_MIN,
  PEN_SIZE_MAX,
  ERASER_SIZE_MIN,
  ERASER_SIZE_MAX,
  AVATAR_SIZE_MAX,
  AVATAR_SIZE_MIN,
} = toolsStore
const bus = inject('bus')

// *********** 顯示 ***********
const mainCanvas = useTemplateRef('mainCanvas')
const canvasStack = useTemplateRef('canvasStack')
const { width: elWidth, height: elHeight } = useElementSize(mainCanvas)

// 計算顯示尺寸，保持畫布的寬高比
const displaySize = computed(() => {
  const maxWidth = elWidth.value - CANVAS_SIZE.PADDING
  const maxHeight = elHeight.value - CANVAS_SIZE.PADDING
  const aspectRatio = CANVAS_SIZE.WIDTH / CANVAS_SIZE.HEIGHT

  let width = Math.min(maxWidth, 540)
  let height = width / aspectRatio

  if (height > maxHeight) {
    height = maxHeight
    width = height * aspectRatio
  }

  return {
    width: Math.max(0, Math.floor(width)),
    height: Math.max(0, Math.floor(height)),
  }
})

// 所有圖層 canvas 疊在同一個容器內，由容器控制顯示尺寸
const stackStyle = computed(() => ({
  width: `${displaySize.value.width}px`,
  height: `${displaySize.value.height}px`,
}))

// 顯示尺寸變化時，更新頭像的顯示位置
watch(displaySize, () => p5Instance?.updateDisplay?.(), { deep: true })

// 切換工具時更新游標
watch(
  () => appStore.tool,
  () => p5Instance?.setToolCursor?.(),
)

// *********** Canvas & p5 ***********
let p5Instance = null
let undo = null
// p5.brush 模組，與 p5 一起延後載入
let brush = null

const sketch = (p) => {
  // 圖層
  // 每個圖層都是獨立的 canvas，直接疊在 DOM 上由瀏覽器合成：
  // 主畫布（背景）→ 頭像 → 繪圖（mix-blend-mode: lighten）→ 文字
  const layers = {
    // 繪圖（WebGL）
    draw: null,
    // 文字
    text: null,
  }
  // canvas 畫布，只畫背景
  let canvas = null
  // 字體
  let font = null
  // 背景圖片
  let imgBg = null
  // 文字背景圖片
  let imgTextBg = null
  // 預設繪圖圖片
  let imgDefaultDraw = null
  // 頭像物件
  let avatar = null
  // 下一幀要存進復原紀錄的範圍
  let pendingCapture = null
  // 頭像完整品質重建的計時器
  let avatarCommitTimer = null
  // 滑鼠是否在畫布內
  let mouseIn = false
  // 目前的筆畫
  const stroke = {
    active: false,
    ended: false,
    pointerId: null,
    tool: null,
    rect: null,
    // 上一個已繪製的點
    last: null,
    // 尚未繪製的點
    queue: [],
    // 已繪製範圍（WebGL 座標）
    bounds: null,
    // 這一筆用過的最大筆刷粗細
    maxWeight: 0,
  }
  // 中心點座標
  // WebGL 的 0, 0 在畫布中間
  const center = {
    x: CANVAS_SIZE.WIDTH / 2,
    y: CANVAS_SIZE.HEIGHT / 2,
  }

  // 預先載入
  p.preload = () => {
    font = p.loadFont(FONT_URL)
    imgBg = p.loadImage(BACKGROUND_IMAGE)
    imgDefaultDraw = p.loadImage(DEFAULT_DRAW_IMAGE)
    imgTextBg = p.loadImage(TEXT_BACKGROUND_IMAGE)
  }

  // 把圖層 canvas 放進疊加容器
  const mountLayer = (el, className) => {
    el.parent(canvasStack.value)
    el.addClass(className)
    el.show()
    el.elt.style.width = '100%'
    el.elt.style.height = '100%'
  }

  // 初始化 p5.js
  p.setup = () => {
    // 建立 canvas
    canvas = p.createCanvas(CANVAS_SIZE.WIDTH, CANVAS_SIZE.HEIGHT)
    // 限制像素密度
    // 手機的像素密度過高可能會超出 WebGL 尺寸限制並影響效能
    p.pixelDensity(1)
    mountLayer(canvas, 'layer-base')

    // 偵測滑鼠是否在畫布內
    canvas.mouseOut(() => {
      mouseIn = false
    })
    canvas.mouseOver(() => {
      mouseIn = true
    })

    // 繪圖改用 pointer events，可以取得兩幀之間所有的觸控點
    canvas.elt.addEventListener('pointerdown', onPointerDown)
    canvas.elt.addEventListener('pointermove', onPointerMove)
    canvas.elt.addEventListener('pointerup', onPointerUp)
    canvas.elt.addEventListener('pointercancel', onPointerUp)

    // *********** 頭像圖層 ***********
    avatar = new Avatar(CANVAS_SIZE, appStore.avatarSize / 100, appStore.avatarBorderSize)
    canvasStack.value.appendChild(avatar.canvas)
    updateDisplay()
    avatar.load(DEFAULT_AVATAR_IMAGE)

    // *********** 繪圖圖層 ***********
    // 建立繪圖圖層
    layers.draw = p.createGraphics(CANVAS_SIZE.WIDTH, CANVAS_SIZE.HEIGHT, p.WEBGL)
    layers.draw.background(0)
    layers.draw.image(imgDefaultDraw, -center.x, -center.y, CANVAS_SIZE.WIDTH, CANVAS_SIZE.HEIGHT)
    // 初始化繪圖筆刷
    brush.instance(p)
    brush.load(layers.draw)
    mountLayer(layers.draw, 'layer-draw')
    // 初始化復原功能
    undo = new Undo(MAX_UNDO, layers.draw, center, p)

    // *********** 文字圖層 ***********
    // 建立文字圖層
    layers.text = p.createGraphics(CANVAS_SIZE.WIDTH, CANVAS_SIZE.HEIGHT)
    layers.text.textAlign(p.CENTER, p.CENTER)
    mountLayer(layers.text, 'layer-text')

    // 初始繪圖
    setCursor()
    drawBg()
    drawText()
  }

  // 開始繪製循環
  // 注意 p.loop() 會同步執行一次 draw()，呼叫前要先設定好狀態
  const startLoop = () => {
    if (!p.isLooping()) {
      p.loop()
    }
  }

  // 繪製筆刷
  const drawStroke = () => {
    if (stroke.queue.length === 0) return

    const weight = (stroke.tool === 'pen' ? appStore.penSize : appStore.eraserSize) * 2
    stroke.maxWeight = Math.max(stroke.maxWeight, weight)

    brush.pick('rotring')
    brush.strokeWeight(weight)
    brush.stroke(stroke.tool === 'pen' ? 'white' : 'black')

    for (const point of stroke.queue) {
      const from = stroke.last ?? point
      brush.line(point.x, point.y, from.x, from.y)
      stroke.last = point

      const b = stroke.bounds
      if (b) {
        b.minX = Math.min(b.minX, point.x)
        b.minY = Math.min(b.minY, point.y)
        b.maxX = Math.max(b.maxX, point.x)
        b.maxY = Math.max(b.maxY, point.y)
      } else {
        stroke.bounds = { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y }
      }
    }
    stroke.queue.length = 0
  }

  // 這一筆影響的範圍（畫布座標）
  const getStrokeRect = () => {
    const b = stroke.bounds
    if (!b) return null
    const pad = stroke.maxWeight + STROKE_PADDING
    return {
      x: b.minX + center.x - pad,
      y: b.minY + center.y - pad,
      w: b.maxX - b.minX + pad * 2,
      h: b.maxY - b.minY + pad * 2,
    }
  }

  // draw() 只負責筆刷，其他圖層都是事件發生時才更新
  p.draw = () => {
    // 上一幀的筆畫已經由 p5.brush 寫入圖層，這時才存進復原紀錄
    if (pendingCapture) {
      undo.capture(pendingCapture)
      pendingCapture = null
    }

    drawStroke()
    if (stroke.ended) {
      stroke.ended = false
      pendingCapture = getStrokeRect()
    }

    // 沒有進行中的筆畫時暫停繪製循環
    if (!stroke.active && !pendingCapture) {
      p.noLoop()
    }
  }

  // *********** 繪圖處理 ***********
  // 轉換成繪圖圖層座標（WebGL 中心為原點）
  const toCanvasPoint = (e) => ({
    x: ((e.clientX - stroke.rect.left) * CANVAS_SIZE.WIDTH) / stroke.rect.width - center.x,
    y: ((e.clientY - stroke.rect.top) * CANVAS_SIZE.HEIGHT) / stroke.rect.height - center.y,
  })

  const queuePoint = (e) => {
    const point = toCanvasPoint(e)
    const prev = stroke.queue.at(-1) ?? stroke.last
    if (prev && Math.hypot(point.x - prev.x, point.y - prev.y) < MIN_STROKE_DISTANCE) return
    stroke.queue.push(point)
  }

  const onPointerDown = (e) => {
    if (!e.isPrimary || e.button !== 0) return
    if (appStore.tool !== 'pen' && appStore.tool !== 'eraser') return

    stroke.active = true
    stroke.ended = false
    stroke.pointerId = e.pointerId
    stroke.tool = appStore.tool
    // 筆畫過程中版面不會變動，只取一次
    stroke.rect = canvas.elt.getBoundingClientRect()
    stroke.last = null
    stroke.bounds = null
    stroke.maxWeight = 0
    stroke.queue.push(toCanvasPoint(e))
    startLoop()
    // 手指移出畫布也能繼續追蹤這一筆
    try {
      canvas.elt.setPointerCapture(e.pointerId)
    } catch {
      // pointer 已失效時忽略
    }
  }

  const onPointerMove = (e) => {
    if (!stroke.active || e.pointerId !== stroke.pointerId) return
    const events = e.getCoalescedEvents?.() ?? []
    for (const event of events.length > 0 ? events : [e]) {
      queuePoint(event)
    }
  }

  const onPointerUp = (e) => {
    if (!stroke.active || e.pointerId !== stroke.pointerId) return
    stroke.active = false
    stroke.ended = true
    stroke.pointerId = null
    startLoop()
  }

  // *********** 頭像處理 ***********
  // 開始拖曳頭像
  const startAvatarDrag = (x, y) => {
    if (!avatar.hitTest(x, y)) return
    avatar.dragging = true
    avatar.dragOffsetX = avatar.x - x
    avatar.dragOffsetY = avatar.y - y
  }

  // 調整頭像時先快速預覽，停止調整後才重建完整品質的邊框
  const previewAvatar = (rebuildBorder) => {
    if (rebuildBorder) {
      avatar.build(AVATAR_PREVIEW_SAMPLES)
    } else {
      // 只改大小時，直接縮放現有的頭像
      avatar.update()
    }
    clearTimeout(avatarCommitTimer)
    avatarCommitTimer = setTimeout(() => avatar.build(), AVATAR_COMMIT_DELAY)
  }

  // *********** 鍵盤處理 ***********
  p.keyPressed = () => {
    if (p.keyIsDown(p.CONTROL)) {
      if (p.keyIsDown(90)) {
        // Ctrl + Z
        undo.undo()
      } else if (p.keyIsDown(89)) {
        // Ctrl + Y
        undo.redo()
      }
    }
  }

  // *********** 滑鼠處理 ***********
  p.mousePressed = () => {
    if (mouseIn && appStore.tool === 'avatar') {
      startAvatarDrag(p.mouseX, p.mouseY)
    }
  }

  p.mouseDragged = () => {
    if (avatar.dragging) {
      avatar.drag(p.mouseX, p.mouseY)
    }
  }

  p.mouseReleased = () => {
    avatar.dragging = false
  }

  p.mouseWheel = (e) => {
    if (e.delta > 0) {
      switch (appStore.tool) {
        case 'pen':
          if (appStore.penSize < PEN_SIZE_MAX) {
            appStore.penSize++
          }
          break
        case 'eraser':
          if (appStore.eraserSize < ERASER_SIZE_MAX) {
            appStore.eraserSize++
          }
          break
        case 'avatar':
          if (appStore.avatarSize < AVATAR_SIZE_MAX) {
            appStore.avatarSize++
            avatar.size = appStore.avatarSize / 100
            previewAvatar(false)
          }
          break
      }
    } else if (e.delta < 0) {
      switch (appStore.tool) {
        case 'pen':
          if (appStore.penSize > PEN_SIZE_MIN) {
            appStore.penSize--
          }
          break
        case 'eraser':
          if (appStore.eraserSize > ERASER_SIZE_MIN) {
            appStore.eraserSize--
          }
          break
        case 'avatar':
          if (appStore.avatarSize > AVATAR_SIZE_MIN) {
            appStore.avatarSize--
            avatar.size = appStore.avatarSize / 100
            previewAvatar(false)
          }
          break
      }
    }
    return false
  }

  // *********** 觸控處理 ***********
  // 繪圖由 pointer events 處理，這裡只處理頭像拖曳
  p.touchStarted = () => {
    mouseIn =
      p.touches[0].x >= 0 &&
      p.touches[0].x <= CANVAS_SIZE.WIDTH &&
      p.touches[0].y >= 0 &&
      p.touches[0].y <= CANVAS_SIZE.HEIGHT
    if (mouseIn && appStore.tool === 'avatar') {
      startAvatarDrag(p.touches[0].x, p.touches[0].y)
    }
  }

  p.touchEnded = () => {
    avatar.dragging = false
    mouseIn = false
  }

  p.touchMoved = () => {
    // 避免處理滑鼠拖動事件
    if (p.touches.length === 0) return

    mouseIn =
      p.touches[0].x >= 0 &&
      p.touches[0].x <= CANVAS_SIZE.WIDTH &&
      p.touches[0].y >= 0 &&
      p.touches[0].y <= CANVAS_SIZE.HEIGHT

    if (avatar.dragging) {
      avatar.drag(p.touches[0].x, p.touches[0].y)
    }

    // iOS 阻止頁面捲動
    return false
  }

  // *********** 顯示尺寸 ***********
  // p5 還在 preload 時頭像尚未建立，setup 會再呼叫一次
  const updateDisplay = () => {
    avatar?.setDisplayScale(displaySize.value.width / CANVAS_SIZE.WIDTH)
  }
  p.updateDisplay = updateDisplay

  // *********** 繪製圖層 ***********
  // 繪製背景（主畫布）
  const drawBg = () => {
    p.clear()
    p.background(appStore.bgColor)
    p.blendMode(p.MULTIPLY)
    p.image(imgBg, 0, 0, CANVAS_SIZE.WIDTH, CANVAS_SIZE.HEIGHT)
    p.blendMode(p.BLEND)
  }

  // 繪製文字圖層
  const drawText = () => {
    layers.text.clear()

    // 儲存目前的變換矩陣
    layers.text.push()

    // 移動到畫布中心進行旋轉
    layers.text.translate(CANVAS_SIZE.WIDTH / 2, CANVAS_SIZE.HEIGHT / 2)

    // 旋轉 0.5 弧度
    layers.text.rotate(0.15)

    // 文字背景圖
    layers.text.image(
      imgTextBg,
      -250 - CANVAS_SIZE.WIDTH / 2,
      1200 - CANVAS_SIZE.HEIGHT / 2,
      TEXT_BACKGROUND_IMAGE_SIZE.WIDTH * 1.6,
      TEXT_BACKGROUND_IMAGE_SIZE.HEIGHT * 1,
    )

    // 文字內容
    layers.text.fill(appStore.bgColor)
    const ctx = layers.text.canvas.getContext('2d')
    ctx.textBaseline = 'middle'
    const range = CANVAS_SIZE.WIDTH - 20
    const measure = (size) => {
      layers.text.textFont(font, size)
      return ctx.measureText(appStore.name).width
    }
    // 文字寬度與字級成正比，先依比例算出字級，再以 0.5 為單位微調
    let size = NAME_FONT_SIZE_MAX
    const maxWidth = measure(size)
    if (maxWidth > range) {
      size = Math.floor(((NAME_FONT_SIZE_MAX * range) / maxWidth) * 2) / 2
      while (measure(size) > range && size > 1) {
        size -= 0.5
      }
    }
    layers.text.text(appStore.name, 80, 1390 - CANVAS_SIZE.HEIGHT / 2)
    layers.text.blendMode(p.MULTIPLY)
    layers.text.fill(170)
    layers.text.textAlign(p.CENTER, p.CENTER)
    layers.text.text(appStore.name, 80, 1390 - CANVAS_SIZE.HEIGHT / 2)
    layers.text.blendMode(p.BLEND)
    // 恢復變換矩陣
    layers.text.pop()
  }

  const setCursor = () => {
    if (appStore.tool === 'pen') {
      p.cursor('crosshair')
    } else if (appStore.tool === 'eraser') {
      p.cursor('crosshair')
    } else if (appStore.tool === 'avatar') {
      p.cursor('move')
    } else {
      p.cursor('default')
    }
  }
  p.setToolCursor = setCursor

  // *********** 輸出 ***********
  const createOutputCanvas = () => {
    const output = document.createElement('canvas')
    output.width = CANVAS_SIZE.WIDTH
    output.height = CANVAS_SIZE.HEIGHT
    return output
  }

  // 合成所有圖層，與畫面上的 DOM 疊加結果相同
  const composeLayers = () => {
    const output = createOutputCanvas()
    const ctx = output.getContext('2d')
    ctx.drawImage(canvas.elt, 0, 0)
    avatar.renderTo(ctx)
    ctx.globalCompositeOperation = 'lighten'
    ctx.drawImage(layers.draw.elt, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(layers.text.elt, 0, 0)
    return output
  }

  // 單獨輸出頭像圖層
  const renderAvatarLayer = () => {
    const output = createOutputCanvas()
    avatar.renderTo(output.getContext('2d'))
    return output
  }

  const toBlob = (source) => new Promise((resolve) => source.toBlob(resolve, 'image/png'))

  const downloadBlob = (blob, filename) => {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  // *********** 事件處理 ***********
  // 事件監聽處理
  bus.on('undo', () => {
    undo.undo()
  })
  bus.on('redo', () => {
    undo.redo()
  })
  bus.on('clear', () => {
    layers.draw.clear()
    layers.draw.background(0)
    undo.capture()
  })
  bus.on('cropAvatar', () => {
    avatar.load(appStore.avatarImage)
  })
  bus.on('removeAvatar', () => {
    avatar.remove()
  })
  bus.on('setAvatarBorderSize', () => {
    avatar.borderSize = appStore.avatarBorderSize
    previewAvatar(true)
  })
  bus.on('setAvatarSize', () => {
    avatar.size = appStore.avatarSize / 100
    previewAvatar(false)
  })
  bus.on('setBgColor', () => {
    drawBg()
    drawText()
  })
  bus.on('setName', () => {
    drawText()
  })
  bus.on('download', async () => {
    downloadBlob(await toBlob(composeLayers()), 'result.png')
  })
  bus.on('downloadLayer', async () => {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    const [bg, draw, avatarLayer, text] = await Promise.all([
      toBlob(canvas.elt),
      toBlob(layers.draw.elt),
      toBlob(renderAvatarLayer()),
      toBlob(layers.text.elt),
    ])
    zip.file('bg.png', bg)
    zip.file('draw.png', draw)
    zip.file('avatar.png', avatarLayer)
    zip.file('text.png', text)
    downloadBlob(await zip.generateAsync({ type: 'blob' }), 'layers.zip')
  })
}

onMounted(async () => {
  // p5 與 p5.brush 體積較大，延後載入讓介面先顯示
  const [{ default: P5 }, brushModule] = await Promise.all([import('p5'), import('p5.brush')])
  brush = brushModule
  await nextTick()
  P5.disableFriendlyErrors = true
  p5Instance = new P5(sketch)
})
</script>

<style lang="sass" scoped>
#main-canvas
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  touch-action: none;
.canvas-stack
  position: relative;
  flex: none;
  overflow: hidden;
  // 讓 mix-blend-mode 只和容器內的圖層混合
  isolation: isolate;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  :deep(canvas)
    position: absolute;
    inset: 0;
    display: block;
    touch-action: none;
  // 上層只負責顯示，事件交給最底層的主畫布
  :deep(.layer-avatar),
  :deep(.layer-draw),
  :deep(.layer-text)
    pointer-events: none;
  // 頭像依 transform 定位，尺寸由 Avatar 設定
  :deep(.layer-avatar)
    inset: auto;
    left: 0;
    top: 0;
    will-change: transform;
  :deep(.layer-draw)
    mix-blend-mode: lighten;
</style>
