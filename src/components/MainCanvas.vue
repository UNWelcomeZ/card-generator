<template lang="pug">
#main-canvas(ref="mainCanvas")
  .canvas-stack(ref="canvasStack" :style="stackStyle")
</template>

<script setup>
import { useTemplateRef, onMounted, computed, watch, nextTick, inject } from 'vue'
import { useAppStore } from 'src/stores/app'
import { useToolsStore } from 'src/stores/tools'
import { useElementSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { Notify, Platform } from 'quasar'
import Undo from 'src/class/undo'
import Avatar from 'src/class/avatar'
import Brush from 'src/class/brush'
import { loadState, saveState, clearState } from 'src/class/autosave'

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
// 復原範圍額外保留的邊界，涵蓋抗鋸齒的半透明像素
const STROKE_PADDING = 2
// 名字最大字級
const NAME_FONT_SIZE_MAX = 300
// 調整頭像時，預覽用的描邊取樣數
const AVATAR_PREVIEW_SAMPLES = 12
// 停止調整頭像多久後重建完整品質的邊框（毫秒）
const AVATAR_COMMIT_DELAY = 200
// 停止調整多久後把背景色與名字的變更加入復原紀錄（毫秒）
const BG_COMMIT_DELAY = 500
const NAME_COMMIT_DELAY = 800

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
  DEFAULT_AVATAR,
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

// *********** 提示 ***********
const { t } = useI18n()
const AVATAR_HINT_KEY = 'hint.avatarDrag'

// 第一次切換到頭像工具時，提示可以直接拖曳
const showAvatarHint = () => {
  try {
    if (localStorage.getItem(AVATAR_HINT_KEY)) return
    localStorage.setItem(AVATAR_HINT_KEY, '1')
  } catch {
    // 無法使用 localStorage 時每次都提示
  }
  Notify.create({
    message: t('tools.avatar.dragHint'),
    icon: 'mdi-gesture-tap-hold',
    color: 'dark',
    position: 'center',
    timeout: 2500,
  })
}

// 切換工具時更新游標
watch(
  () => appStore.tool,
  (tool) => {
    p5Instance?.setToolCursor?.()
    p5Instance?.updateBrushCursor?.()
    if (tool === 'avatar') showAvatarHint()
  },
)

// 筆刷大小變化時更新游標預覽
watch([() => appStore.penSize, () => appStore.eraserSize], () => p5Instance?.updateBrushCursor?.())

// *********** 自動儲存 ***********
// 停止操作多久後儲存（毫秒）
const SAVE_DELAY = 1000
// 還原的手繪內容與頭像位置，在 p5 setup 時套用
let savedDraw = null
let savedAvatarPosition = null

// 預設圖片的網址每次部署都會改變，只儲存使用者裁切的圖片
const serializeAvatarImage = (image) => {
  if (image.startsWith('data:')) return image
  return image === DEFAULT_AVATAR ? 'none' : 'default'
}
const deserializeAvatarImage = (value) => {
  if (value === 'none') return DEFAULT_AVATAR
  return value === 'default' ? DEFAULT_AVATAR_IMAGE : value
}

const restoreState = async (saved) => {
  const { settings } = saved
  appStore.bgColor = settings.bgColor
  appStore.name = settings.name
  appStore.penSize = settings.penSize
  appStore.eraserSize = settings.eraserSize
  appStore.avatarSize = settings.avatarSize
  appStore.avatarBorderSize = settings.avatarBorderSize
  appStore.avatarImage = deserializeAvatarImage(settings.avatarImage)
  savedAvatarPosition = saved.avatarPosition
  if (saved.draw) {
    savedDraw = await createImageBitmap(saved.draw).catch(() => null)
  }
}

// 設定變更後自動儲存
watch(
  () => [
    appStore.bgColor,
    appStore.name,
    appStore.penSize,
    appStore.eraserSize,
    appStore.avatarSize,
    appStore.avatarBorderSize,
    appStore.avatarImage,
  ],
  () => p5Instance?.scheduleSave?.(),
)

// 頁面切到背景時立即儲存，手機上頁面可能隨時被系統回收
const onVisibilityChange = () => {
  if (document.visibilityState === 'hidden') p5Instance?.flushSave?.()
}

// *********** Canvas & p5 ***********
let p5Instance = null
let undo = null

const sketch = (p) => {
  // 圖層
  // 每個圖層都是獨立的 canvas，直接疊在 DOM 上由瀏覽器合成：
  // 主畫布（背景）→ 頭像 → 繪圖（mix-blend-mode: lighten）→ 文字
  const layers = {
    // 繪圖
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
  // 繪圖筆刷
  let brush = null
  // 滑鼠游標的筆刷大小預覽
  let brushCursor = null
  // 滑鼠在畫布上的位置（顯示座標），不在畫布上或使用觸控時為 null
  let cursorPosition = null
  // 頭像完整品質重建的計時器
  let avatarCommitTimer = null
  // 滑鼠是否在畫布內
  let mouseIn = false
  // 目前的筆畫
  const stroke = {
    active: false,
    pointerId: null,
    rect: null,
    // 上一個加入的點
    last: null,
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
    // 手機的像素密度過高會讓畫布尺寸過大並影響效能
    p.pixelDensity(1)
    // 所有圖層都在事件發生時才更新，不需要繪製循環
    p.noLoop()
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
    canvas.elt.addEventListener('pointermove', onCursorMove)
    canvas.elt.addEventListener('pointerleave', onCursorLeave)

    // *********** 頭像圖層 ***********
    avatar = new Avatar(CANVAS_SIZE, appStore.avatarSize / 100, appStore.avatarBorderSize)
    if (savedAvatarPosition) {
      avatar.x = savedAvatarPosition.x
      avatar.y = savedAvatarPosition.y
    }
    canvasStack.value.appendChild(avatar.canvas)
    updateDisplay()
    // 頭像被移除時會是預設的佔位圖
    if (appStore.avatarImage !== DEFAULT_AVATAR) {
      avatar.load(appStore.avatarImage)
    }

    // *********** 繪圖圖層 ***********
    // 建立繪圖圖層
    layers.draw = p.createGraphics(CANVAS_SIZE.WIDTH, CANVAS_SIZE.HEIGHT)
    layers.draw.background(0)
    if (savedDraw) {
      layers.draw.drawingContext.drawImage(savedDraw, 0, 0)
    } else {
      layers.draw.image(imgDefaultDraw, 0, 0, CANVAS_SIZE.WIDTH, CANVAS_SIZE.HEIGHT)
    }
    // 初始化繪圖筆刷
    brush = new Brush(layers.draw.drawingContext)
    mountLayer(layers.draw, 'layer-draw')
    // 初始化復原功能
    undo = new Undo(MAX_UNDO, layers.draw.elt)

    // *********** 文字圖層 ***********
    // 建立文字圖層
    layers.text = p.createGraphics(CANVAS_SIZE.WIDTH, CANVAS_SIZE.HEIGHT)
    layers.text.textAlign(p.CENTER, p.CENTER)
    mountLayer(layers.text, 'layer-text')

    // *********** 筆刷游標 ***********
    brushCursor = document.createElement('div')
    brushCursor.className = 'brush-cursor'
    canvasStack.value.appendChild(brushCursor)

    // 初始繪圖
    setCursor()
    drawBg()
    drawText()
    initCommittedState()
  }

  // *********** 繪圖處理 ***********
  // 筆畫直接在 pointer 事件中畫到繪圖圖層，不經過 p5 的繪製循環
  const toCanvasPoint = (e) => ({
    x: ((e.clientX - stroke.rect.left) * CANVAS_SIZE.WIDTH) / stroke.rect.width,
    y: ((e.clientY - stroke.rect.top) * CANVAS_SIZE.HEIGHT) / stroke.rect.height,
  })

  const onPointerDown = (e) => {
    if (!e.isPrimary || e.button !== 0) return
    if (appStore.tool !== 'pen' && appStore.tool !== 'eraser') return

    commitPendingStates()
    stroke.active = true
    stroke.pointerId = e.pointerId
    // 筆畫過程中版面不會變動，只取一次
    stroke.rect = canvas.elt.getBoundingClientRect()
    stroke.last = toCanvasPoint(e)

    const isPen = appStore.tool === 'pen'
    const size = isPen ? appStore.penSize : appStore.eraserSize
    brush.begin(stroke.last.x, stroke.last.y, size, isPen ? 'white' : 'black')

    // 手指移出畫布也能繼續追蹤這一筆
    try {
      canvas.elt.setPointerCapture(e.pointerId)
    } catch {
      // pointer 已失效時忽略
    }
  }

  const onPointerMove = (e) => {
    if (!stroke.active || e.pointerId !== stroke.pointerId) return

    // 取得兩次事件之間所有的觸控點，過濾掉過密的點
    const events = e.getCoalescedEvents?.() ?? []
    const points = []
    for (const event of events.length > 0 ? events : [e]) {
      const point = toCanvasPoint(event)
      const { x, y } = stroke.last
      if (Math.hypot(point.x - x, point.y - y) < MIN_STROKE_DISTANCE) continue
      points.push(point)
      stroke.last = point
    }
    brush.lineTo(points)
  }

  const onPointerUp = (e) => {
    if (!stroke.active || e.pointerId !== stroke.pointerId) return
    stroke.active = false
    stroke.pointerId = null

    const b = brush.end()
    if (b) {
      undo.capture({
        x: b.minX - STROKE_PADDING,
        y: b.minY - STROKE_PADDING,
        w: b.maxX - b.minX + STROKE_PADDING * 2,
        h: b.maxY - b.minY + STROKE_PADDING * 2,
      })
      syncHistory()
    }
  }

  // *********** 筆刷游標 ***********
  // 使用滑鼠時，以和筆刷相同大小的圓圈當作游標
  const updateBrushCursor = () => {
    if (!brushCursor) return
    const tool = appStore.tool
    const visible = cursorPosition && (tool === 'pen' || tool === 'eraser')
    brushCursor.style.display = visible ? 'block' : 'none'
    if (!visible) return

    const size = tool === 'pen' ? appStore.penSize : appStore.eraserSize
    const diameter = Math.max(4, (size * displaySize.value.width) / CANVAS_SIZE.WIDTH)
    brushCursor.style.width = `${diameter}px`
    brushCursor.style.height = `${diameter}px`
    brushCursor.style.transform = `translate(${cursorPosition.x - diameter / 2}px, ${cursorPosition.y - diameter / 2}px)`
  }
  p.updateBrushCursor = updateBrushCursor

  const onCursorMove = (e) => {
    cursorPosition = e.pointerType === 'mouse' ? { x: e.offsetX, y: e.offsetY } : null
    updateBrushCursor()
  }

  const onCursorLeave = () => {
    cursorPosition = null
    updateBrushCursor()
  }

  // 同步復原 / 重做的可用狀態到介面
  const syncHistory = () => {
    appStore.canUndo = undo.canUndo
    appStore.canRedo = undo.canRedo
    scheduleSave()
  }

  // *********** 狀態的復原紀錄 ***********
  // 頭像、背景色與名字的變更也納入復原。每類狀態記錄最後提交的值，
  // 操作結束時與目前的值比較，有差異才加入一筆紀錄
  const applyAvatarState = (state) => {
    clearTimeout(avatarCommitTimer)
    avatar.x = state.x
    avatar.y = state.y
    appStore.avatarSize = state.size
    appStore.avatarBorderSize = state.borderSize
    avatar.size = state.size / 100
    avatar.borderSize = state.borderSize
    if (state.image !== appStore.avatarImage) {
      appStore.avatarImage = state.image
      // 頭像被移除時會是預設的佔位圖
      if (state.image === DEFAULT_AVATAR) {
        avatar.remove()
      } else {
        avatar.load(state.image)
      }
    } else {
      avatar.build()
    }
  }

  const stateHandlers = {
    avatar: {
      read: () => ({
        x: avatar.x,
        y: avatar.y,
        size: appStore.avatarSize,
        borderSize: appStore.avatarBorderSize,
        image: appStore.avatarImage,
      }),
      apply: applyAvatarState,
    },
    bg: {
      read: () => appStore.bgColor,
      apply: (color) => {
        appStore.bgColor = color
        drawBg()
        drawText()
      },
    },
    name: {
      read: () => appStore.name,
      apply: (name) => {
        appStore.name = name
        drawText()
      },
    },
  }
  const committedState = {}
  const commitTimers = {}

  const isSameState = (a, b) =>
    typeof a === 'object' ? Object.keys(a).every((key) => a[key] === b[key]) : a === b

  // 記錄目前的狀態為已提交的值，作為之後比較的基準
  const initCommittedState = () => {
    for (const [key, handler] of Object.entries(stateHandlers)) {
      committedState[key] = handler.read()
    }
  }

  const commitState = (key) => {
    clearTimeout(commitTimers[key])
    delete commitTimers[key]
    const handler = stateHandlers[key]
    const before = committedState[key]
    const after = handler.read()
    if (isSameState(before, after)) return
    committedState[key] = after
    undo.captureState(before, after, (value) => {
      committedState[key] = value
      handler.apply(value)
    })
    syncHistory()
  }

  const commitStateLater = (key, delay) => {
    clearTimeout(commitTimers[key])
    commitTimers[key] = setTimeout(() => commitState(key), delay)
  }

  // 立即提交所有等待中的變更，確保紀錄順序正確
  const commitPendingStates = () => {
    for (const key of Object.keys(commitTimers)) commitState(key)
  }

  const undoStep = () => {
    commitPendingStates()
    undo.undo()
    syncHistory()
  }

  const redoStep = () => {
    commitPendingStates()
    undo.redo()
    syncHistory()
  }

  // *********** 自動儲存 ***********
  let saveTimer = null
  // 重新開始時停止儲存，避免把舊作品寫回去
  let resetting = false

  const save = async () => {
    clearTimeout(saveTimer)
    saveTimer = null
    if (resetting) return
    const draw = await toBlob(layers.draw.elt)
    if (resetting) return
    await saveState({
      settings: {
        bgColor: appStore.bgColor,
        name: appStore.name,
        penSize: appStore.penSize,
        eraserSize: appStore.eraserSize,
        avatarSize: appStore.avatarSize,
        avatarBorderSize: appStore.avatarBorderSize,
        avatarImage: serializeAvatarImage(appStore.avatarImage),
      },
      avatarPosition: { x: avatar.x, y: avatar.y },
      draw,
    })
  }

  const scheduleSave = () => {
    if (resetting) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(save, SAVE_DELAY)
  }
  p.scheduleSave = scheduleSave
  // 有尚未儲存的變更時立即儲存
  p.flushSave = () => {
    if (saveTimer) save()
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
    avatarCommitTimer = setTimeout(() => {
      avatar.build()
      commitState('avatar')
    }, AVATAR_COMMIT_DELAY)
  }

  // *********** 鍵盤處理 ***********
  p.keyPressed = () => {
    if (p.keyIsDown(p.CONTROL)) {
      if (p.keyIsDown(90)) {
        // Ctrl + Z
        undoStep()
      } else if (p.keyIsDown(89)) {
        // Ctrl + Y
        redoStep()
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
    if (avatar.dragging) commitState('avatar')
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
    if (avatar.dragging) commitState('avatar')
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
    updateBrushCursor()
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
    if (appStore.tool === 'pen' || appStore.tool === 'eraser') {
      // 由筆刷大小的圓圈取代
      p.cursor('none')
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

  // 手機使用系統分享面板，可以直接存到相簿或分享
  // 回傳 true 表示已處理（分享完成或使用者取消），false 表示需要改用下載
  const shareImage = async (blob, filename) => {
    if (!Platform.is.mobile) return false
    const file = new File([blob], filename, { type: blob.type })
    if (!navigator.canShare?.({ files: [file] })) return false
    try {
      await navigator.share({ files: [file] })
      return true
    } catch (e) {
      // 使用者取消就不再下載；其他錯誤（例如失去使用者操作的授權）改用下載
      return e.name === 'AbortError'
    }
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
  bus.on('undo', undoStep)
  bus.on('redo', redoStep)
  bus.on('clear', () => {
    layers.draw.clear()
    layers.draw.background(0)
    undo.capture()
    syncHistory()
  })
  bus.on('cropAvatar', () => {
    avatar.load(appStore.avatarImage)
    commitStateLater('avatar', 0)
  })
  bus.on('removeAvatar', () => {
    avatar.remove()
    // 介面會在事件之後才把頭像改成佔位圖，稍後再提交
    commitStateLater('avatar', 0)
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
    commitStateLater('bg', BG_COMMIT_DELAY)
  })
  bus.on('setName', () => {
    drawText()
    commitStateLater('name', NAME_COMMIT_DELAY)
  })
  bus.on('download', async () => {
    const blob = await toBlob(composeLayers())
    if (await shareImage(blob, 'result.png')) return
    downloadBlob(blob, 'result.png')
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
  bus.on('reset', async () => {
    resetting = true
    clearTimeout(saveTimer)
    await clearState()
    location.reload()
  })
}

onMounted(async () => {
  // p5 體積較大，延後載入讓介面先顯示；同時讀取自動儲存的作品
  const [{ default: P5 }, saved] = await Promise.all([import('p5'), loadState()])
  if (saved) await restoreState(saved)
  document.addEventListener('visibilitychange', onVisibilityChange)
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
  // 筆刷大小預覽，白框加深色外框在任何背景上都看得到
  :deep(.brush-cursor)
    display: none;
    position: absolute;
    left: 0;
    top: 0;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6);
    pointer-events: none;
    will-change: transform;
</style>
