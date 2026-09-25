// A fixed-size 2D grid stored as a flat array. Out-of-bounds reads return null.
export class Grid {
  constructor(width, height, fill = 0) {
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height).fill(fill);
  }

  contains(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  index(x, y) {
    return y * this.width + x;
  }

  get(x, y) {
    return this.contains(x, y) ? this.cells[this.index(x, y)] : null;
  }

  // Returns false (and does nothing) when out of bounds.
  set(x, y, value) {
    if (!this.contains(x, y)) return false;
    this.cells[this.index(x, y)] = value;
    return true;
  }

  fill(value) {
    this.cells.fill(value);
    return this;
  }

  clone() {
    const copy = new Grid(this.width, this.height);
    copy.cells = this.cells.slice();
    return copy;
  }

  forEach(fn) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) fn(x, y, this.cells[this.index(x, y)]);
    }
  }
}
