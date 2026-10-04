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
import P5 from 'p5'
import * as brush from 'p5.brush'
import JSZip from 'jszip'

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
// 名字最大字級
const NAME_FONT_SIZE_MAX = 300

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

// 切換工具時更新游標
watch(
  () => appStore.tool,
  () => p5Instance?.setToolCursor?.(),
)

// *********** Canvas & p5 ***********
let p5Instance = null
let undo = null

const sketch = async (p) => {
  // 圖層
  // 主畫布只負責背景 + 頭像，繪圖圖層與文字圖層直接放在 DOM 上疊加，
  // 由瀏覽器合成，避免每幀把 1080x1800 的 WebGL 圖層複製回 2D 畫布
  const layers = {
    // 背景圖
    bg: null,
    // 繪圖（WebGL，直接顯示在 DOM，CSS mix-blend-mode: lighten）
    draw: null,
    // 頭像
    avatar: null,
    // 文字（直接顯示在 DOM）
    text: null,
  }
  // canvas 畫布
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
  // 主畫布（背景 + 頭像）是否需要重新合成
  let compositeDirty = true
  // 下一幀是否需要存復原快照
  let captureNext = false
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
  p.setup = async () => {
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

    // *********** 背景圖層 ***********
    // 建立背景圖層
    layers.bg = p.createGraphics(CANVAS_SIZE.WIDTH, CANVAS_SIZE.HEIGHT)

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

    // *********** 頭像圖層 ***********
    // 建立頭像圖層
    layers.avatar = p.createGraphics(CANVAS_SIZE.WIDTH, CANVAS_SIZE.HEIGHT)
    // 初始化頭像物件
    avatar = new Avatar(layers.avatar, CANVAS_SIZE, p, appStore.avatarSize / 100)
    avatar.image = p.createImg(DEFAULT_AVATAR_IMAGE, 'Avatar Image')
    avatar.image.hide()
    avatar.image.elt.onload = () => {
      avatar.set()
      avatar.draw()
      requestRedraw()
    }

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

  // 重繪
  // 注意 p.loop() 會同步執行一次 draw()，呼叫前要先設定好狀態
  const requestRedraw = () => {
    compositeDirty = true
    if (!p.isLooping()) {
      p.loop()
    }
  }

  // 繪製筆刷
  const drawStroke = () => {
    if (stroke.queue.length === 0) return

    brush.pick('rotring')
    if (stroke.tool === 'pen') {
      brush.strokeWeight(appStore.penSize * 2)
      brush.stroke('white')
    } else {
      brush.strokeWeight(appStore.eraserSize * 2)
      brush.stroke('black')
    }

    for (const point of stroke.queue) {
      const from = stroke.last ?? point
      brush.line(point.x, point.y, from.x, from.y)
      stroke.last = point
    }
    stroke.queue.length = 0
  }

  p.draw = () => {
    // 上一幀的筆畫已經由 p5.brush 寫入圖層，這時才存復原快照
    if (captureNext) {
      undo.capture()
      captureNext = false
    }

    drawStroke()
    if (stroke.ended) {
      stroke.ended = false
      captureNext = true
    }

    // 拖曳頭像
    if (avatar.image && avatar.dragging) {
      const x = p.touches.length > 0 ? p.touches[0].x : p.mouseX
      const y = p.touches.length > 0 ? p.touches[0].y : p.mouseY
      avatar.drag(x, y)
      avatar.draw()
      compositeDirty = true
    }

    // 只有背景或頭像變動時才重新合成主畫布
    if (compositeDirty) {
      p.clear()
      p.image(layers.bg, 0, 0)
      if (avatar.image) {
        p.image(layers.avatar, 0, 0)
      }
      compositeDirty = false
    }

    // 沒有進行中的操作時暫停繪製循環
    if (!stroke.active && !captureNext && !avatar.dragging) {
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
    stroke.queue.push(toCanvasPoint(e))
    requestRedraw()
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
    requestRedraw()
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
      const pixel = layers.avatar.get(p.mouseX, p.mouseY)
      if (pixel[3] > 0) {
        avatar.dragging = true
        avatar.dragOffsetX = avatar.x - p.mouseX
        avatar.dragOffsetY = avatar.y - p.mouseY
      }
      // p.loop() 會同步執行一次 draw()，必須在設定拖曳狀態之後才呼叫
      requestRedraw()
    }
  }

  p.mouseReleased = () => {
    if (appStore.tool === 'avatar' && avatar.dragging) {
      avatar.dragging = false
      requestRedraw()
    }
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
            avatar.draw()
            requestRedraw()
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
            avatar.draw()
            requestRedraw()
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
      const pixel = layers.avatar.get(p.touches[0].x, p.touches[0].y)
      if (pixel[3] > 0) {
        avatar.dragging = true
        avatar.dragOffsetX = avatar.x - p.touches[0].x
        avatar.dragOffsetY = avatar.y - p.touches[0].y
      }
      // p.loop() 會同步執行一次 draw()，必須在設定拖曳狀態之後才呼叫
      requestRedraw()
    }
  }

  p.touchEnded = () => {
    if (appStore.tool === 'avatar' && avatar.dragging) {
      avatar.dragging = false
      // 拖曳結束時重繪
      requestRedraw()
    }
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

    // iOS 阻止頁面捲動
    return false
  }

  // *********** 繪製圖層 ***********
  // 繪製背景圖層
  const drawBg = () => {
    layers.bg.clear()
    layers.bg.background(appStore.bgColor)
    layers.bg.blendMode(p.MULTIPLY)
    layers.bg.image(imgBg, 0, 0, CANVAS_SIZE.WIDTH, CANVAS_SIZE.HEIGHT)
    layers.bg.blendMode(p.BLEND)
    requestRedraw()
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
  // 合成所有圖層，與畫面上的 DOM 疊加結果相同
  const composeLayers = () => {
    const output = document.createElement('canvas')
    output.width = CANVAS_SIZE.WIDTH
    output.height = CANVAS_SIZE.HEIGHT
    const ctx = output.getContext('2d')
    ctx.drawImage(canvas.elt, 0, 0)
    ctx.globalCompositeOperation = 'lighten'
    ctx.drawImage(layers.draw.elt, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(layers.text.elt, 0, 0)
    return output
  }

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
    if (avatar.image) {
      avatar.image.remove()
    }
    avatar.image = p.createImg(appStore.avatarImage, 'Avatar Image')
    avatar.image.hide()
    avatar.image.elt.onload = () => {
      avatar.set()
      avatar.draw()
      requestRedraw()
    }
  })
  bus.on('removeAvatar', () => {
    if (avatar.image) {
      avatar.image.remove()
      avatar.image = null
      avatar.layer.clear()
    }
    avatar.draw()
    requestRedraw()
  })
  bus.on('setAvatarBorderSize', () => {
    avatar.borderSize = appStore.avatarBorderSize
    avatar.draw()
    requestRedraw()
  })
  bus.on('setAvatarSize', () => {
    avatar.size = appStore.avatarSize / 100
    avatar.draw()
    requestRedraw()
  })
  bus.on('setBgColor', () => {
    drawBg()
    drawText()
  })
  bus.on('setName', () => {
    drawText()
  })
  bus.on('download', () => {
    composeLayers().toBlob((blob) => downloadBlob(blob, 'result.png'), 'image/png')
  })
  bus.on('downloadLayer', () => {
    const zip = new JSZip()
    zip.file('bg.png', layers.bg.canvas.toDataURL('image/png').split(',')[1], { base64: true })
    zip.file('draw.png', layers.draw.canvas.toDataURL('image/png').split(',')[1], { base64: true })
    zip.file('avatar.png', layers.avatar.canvas.toDataURL('image/png').split(',')[1], {
      base64: true,
    })
    zip.file('text.png', layers.text.canvas.toDataURL('image/png').split(',')[1], { base64: true })
    zip.generateAsync({ type: 'blob' }).then((content) => {
      downloadBlob(content, 'layers.zip')
    })
  })
}

onMounted(async () => {
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
  :deep(.layer-draw),
  :deep(.layer-text)
    pointer-events: none;
  :deep(.layer-draw)
    mix-blend-mode: lighten;
</style>
