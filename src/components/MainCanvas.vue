<template lang="pug">
#main-canvas(ref="mainCanvas")
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
  HEIGHT: 1700,
  PADDING: 50,
}
const MAX_UNDO = 20

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
    width: Math.floor(width),
    height: Math.floor(height),
  }
})

// 監聽顯示尺寸變化，更新畫布大小
watch(
  displaySize,
  async () => {
    if (p5Instance && p5Instance.updateDisplay) {
      await nextTick()
      p5Instance.updateDisplay()
    }
  },
  { deep: true },
)

// *********** Canvas & p5 ***********
let p5Instance = null
let undo = null

const sketch = async (p) => {
  // 圖層
  const layers = {
    // 背景圖
    bg: null,
    // 繪圖
    draw: null,
    // 頭像
    avatar: null,
    // 文字
    text: null,
    // 游標
    // cursor: null,
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
  // 控制是否需要重繪
  let needsUpdate = true
  // 滑鼠是否在畫布內
  let mouseIn = false
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

  // 初始化 p5.js
  p.setup = async () => {
    // 建立 canvas
    canvas = p.createCanvas(CANVAS_SIZE.WIDTH, CANVAS_SIZE.HEIGHT)
    canvas.parent(mainCanvas.value)
    p.background(100)
    // 限制像素密度
    // 手機的像素密度過高可能會超出 WebGL 尺寸限制並影響效能
    p.pixelDensity(1)

    // 偵測滑鼠是否在畫布內
    canvas.mouseOut(() => {
      mouseIn = false
    })
    canvas.mouseOver(() => {
      mouseIn = true
    })

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
    // 初始化復原功能
    undo = new Undo(MAX_UNDO, layers.draw, center)

    // *********** 頭像圖層 ***********
    // 建立頭像圖層
    layers.avatar = p.createGraphics(CANVAS_SIZE.WIDTH, CANVAS_SIZE.HEIGHT)
    // 初始化頭像物件
    avatar = new Avatar(layers.avatar, CANVAS_SIZE, p)
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

    // *********** 游標圖層 ***********
    // 建立游標圖層
    // layers.cursor = p.createGraphics(CANVAS_SIZE.WIDTH, CANVAS_SIZE.HEIGHT)

    // 初始繪圖
    drawBg()
    drawText()
    updateCanvasDisplay()
  }

  // 重繪
  const requestRedraw = () => {
    needsUpdate = true
    if (!p.isLooping()) {
      p.loop()
    }
  }

  p.draw = () => {
    // 僅在需要時更新畫面
    if (!needsUpdate && !avatar.dragging) return

    // 清除畫布
    p.clear()

    // 繪製背景
    p.image(layers.bg, 0, 0)

    // 繪製筆刷
    if (p.mouseIsPressed) {
      if (appStore.tool === 'pen') {
        brush.pick('rotring')
        brush.strokeWeight(appStore.penSize * 2)
        brush.stroke('white')
        brush.line(
          p.mouseX - center.x,
          p.mouseY - center.y,
          p.pmouseX - center.x,
          p.pmouseY - center.y,
        )
      } else if (appStore.tool === 'eraser') {
        brush.pick('rotring')
        brush.strokeWeight(appStore.eraserSize * 2)
        brush.stroke('black')
        brush.line(
          p.mouseX - center.x,
          p.mouseY - center.y,
          p.pmouseX - center.x,
          p.pmouseY - center.y,
        )
      }
    }

    // 繪製頭像（動態圖層）
    if (avatar.image) {
      if (avatar.dragging) {
        const x = p.touches.length > 0 ? p.touches[0].x : p.mouseX
        const y = p.touches.length > 0 ? p.touches[0].y : p.mouseY
        avatar.drag(x, y)
        avatar.draw()
      }
      p.image(layers.avatar, 0, 0)
    }

    // 繪製繪圖圖層
    p.blendMode(p.LIGHTEST)
    p.image(layers.draw, 0, 0)
    p.blendMode(p.BLEND)

    // 繪製文字圖層
    p.image(layers.text, 0, 0)

    // 繪製游標
    setCursor()
    // 繪製游標圖層
    // drawCursor()
    // p.image(layers.cursor, 0, 0)

    // 如果沒有正在拖曳，下一幀不需要更新
    needsUpdate = avatar.dragging || p.mouseIsPressed || mouseIn
    if (!needsUpdate) {
      p.noLoop() // 暫停繪製循環
    }
  }

  // *********** 鍵盤處理 ***********
  p.keyPressed = () => {
    if (p.keyIsDown(p.CONTROL)) {
      if (p.keyIsDown(90)) {
        // Ctrl + Z
        undo.undo()
        requestRedraw()
      } else if (p.keyIsDown(89)) {
        // Ctrl + Y
        undo.redo()
        requestRedraw()
      }
    }
  }

  // *********** 滑鼠處理 ***********
  p.mousePressed = () => {
    if (mouseIn && appStore.tool === 'avatar') {
      requestRedraw()
      const pixel = layers.avatar.get(p.mouseX, p.mouseY)
      if (pixel[3] > 0) {
        avatar.dragging = true
        avatar.dragOffsetX = avatar.x - p.mouseX
        avatar.dragOffsetY = avatar.y - p.mouseY
      }
    }
  }

  p.mouseReleased = () => {
    if (mouseIn && (appStore.tool === 'pen' || appStore.tool === 'eraser')) {
      undo.capture()
      requestRedraw()
    } else if (appStore.tool === 'avatar' && avatar.dragging) {
      avatar.dragging = false
      requestRedraw()
    }
  }

  p.mouseMoved = () => {
    if (mouseIn) {
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
  p.touchStarted = () => {
    mouseIn =
      p.touches[0].x >= 0 &&
      p.touches[0].x <= CANVAS_SIZE.WIDTH &&
      p.touches[0].y >= 0 &&
      p.touches[0].y <= CANVAS_SIZE.HEIGHT
    if (mouseIn) {
      requestRedraw()
      if (appStore.tool === 'avatar') {
        const pixel = layers.avatar.get(p.touches[0].x, p.touches[0].y)
        if (pixel[3] > 0) {
          avatar.dragging = true
          avatar.dragOffsetX = avatar.x - p.touches[0].x
          avatar.dragOffsetY = avatar.y - p.touches[0].y
        }
      }
    }
  }

  p.touchEnded = () => {
    if (mouseIn) {
      if (appStore.tool === 'pen' || appStore.tool === 'eraser') {
        undo.capture()
        requestRedraw()
      } else if (appStore.tool === 'avatar' && avatar.dragging) {
        avatar.dragging = false
        // 拖曳結束時重繪
        requestRedraw()
      }
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

    if (mouseIn) {
      // 觸控移動時重繪
      if (avatar.dragging) {
        requestRedraw()
      }
    }

    // iOS 阻止頁面捲動
    return false
  }

  // *********** 顯示尺寸 ***********
  // 更新畫布顯示尺寸
  const updateCanvasDisplay = () => {
    p.noLoop()
    if (canvas) {
      canvas.elt.style.width = `${displaySize.value.width}px`
      canvas.elt.style.height = `${displaySize.value.height}px`
    }
    requestRedraw()
  }
  p.updateDisplay = updateCanvasDisplay

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
    let size = 300
    const range = CANVAS_SIZE.WIDTH - 20
    layers.text.textFont(font, size)
    let textWidth = ctx.measureText(appStore.name).width
    while (textWidth > range && size > 1) {
      size -= 0.5
      layers.text.textFont(font, size)
      textWidth = ctx.measureText(appStore.name).width
    }
    layers.text.text(appStore.name, 80, 1390 - CANVAS_SIZE.HEIGHT / 2)
    layers.text.blendMode(p.MULTIPLY)
    layers.text.fill(170)
    layers.text.textAlign(p.CENTER, p.CENTER)
    layers.text.text(appStore.name, 80, 1390 - CANVAS_SIZE.HEIGHT / 2)
    layers.text.blendMode(p.BLEND)
    // 恢復變換矩陣
    layers.text.pop()

    // 更新靜態圖層並重繪
    requestRedraw()
  }

  // 繪製游標圖層
  // const drawCursor = () => {
  //   // layers.cursor.clear()
  //   if (appStore.tool === 'pen') {
  //     p.cursor('none')
  //     layers.cursor.fill('rgba(255, 255, 255, 0.5)')
  //     layers.cursor.stroke(255)
  //     layers.cursor.ellipse(p.mouseX, p.mouseY, appStore.penSize)
  //   } else if (appStore.tool === 'eraser') {
  //     p.cursor('none')
  //     layers.cursor.fill('rgba(0, 0, 0, 0.5)')
  //     layers.cursor.stroke(0)
  //     layers.cursor.ellipse(p.mouseX, p.mouseY, appStore.eraserSize)
  //   } else if (appStore.tool === 'avatar') {
  //     p.cursor('move')
  //   } else {
  //     p.cursor('default')
  //   }
  // }

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

  // *********** 事件處理 ***********
  // 事件監聽處理
  bus.on('undo', () => {
    undo.undo()
    requestRedraw()
  })
  bus.on('redo', () => {
    undo.redo()
    requestRedraw()
  })
  bus.on('clear', () => {
    layers.draw.clear()
    layers.draw.background(0)
    undo.capture()
    requestRedraw()
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
    p.saveCanvas('result.png')
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
      const link = document.createElement('a')
      link.href = URL.createObjectURL(content)
      link.download = 'layers.zip'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
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
canvas
  display: block;
  margin: 0 auto;
  touch-action: none;
  will-change: transform;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  -webkit-tap-highlight-color: transparent;
</style>
