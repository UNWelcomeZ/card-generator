// https://editor.p5js.org/inoon/sketches/7yoo0zW6X
export default class Undo {
  constructor(amountOfImages = 10, layer, center) {
    this.images = new UndoImages(amountOfImages, layer, center)
  }

  undo() {
    this.images.prev()
    this.images.show()
  }

  redo() {
    this.images.next()
    this.images.show()
  }

  capture() {
    this.images.capture()
  }
}

class UndoImages {
  constructor(amountOfImages, layer, center) {
    this.amount = amountOfImages // for eg. = 10
    this.layer = layer // p5.instance
    this.center = center

    this.img = []
    this.current = 0

    this.img[0] = this.layer.get()
  }

  capture() {
    this.img.splice(this.current + 1) // Makes array length of (value) (?)

    // e.g this img[2] = p5.instance.get()
    this.img[this.img.length] = this.layer.get()

    if (this.img.length > this.amount) {
      //remove first item
      this.img.shift()
    }
    //refers to last item
    this.current = this.img.length - 1
  }

  prev() {
    if (this.current > 0) {
      // so that we don't break the array
      this.current--
    }
  }

  next() {
    if (this.current < this.img.length - 1) {
      // so that we don't break the array
      this.current++
    }
  }

  show() {
    this.layer.clear()
    // WebGL 的 0, 0 是畫布的中心點
    this.layer.image(this.img[this.current], -this.center.x, -this.center.y)

    // 確保復原/重作操作後的圖層變更正確顯示
    this.layer.redraw()
  }
}
