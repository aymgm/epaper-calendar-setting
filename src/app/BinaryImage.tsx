'use client';

export interface BinaryImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  getPixel(x: number, y: number): boolean;
  setPixel(x: number, y: number, isWhite: boolean): void;
}

export class PackedBinaryImage implements BinaryImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height >> 3);
  }

  static from(other: BinaryImage): PackedBinaryImage {
    const img = new PackedBinaryImage(other.width, other.height);
    for (let y = 0; y < other.height; y++) {
      for (let x = 0; x < other.width; x++) {
        img.setPixel(x, y, other.getPixel(x, y));
      }
    }
    return img;
  }

  getPixel(x: number, y: number): boolean {
    const idx = (x * this.height + y) >> 3;
    return ((this.data[idx] >> (y & 7)) & 1) !== 0;
  }

  setPixel(x: number, y: number, isWhite: boolean): void {
    const idx = (x * this.height + y) >> 3;
    if (isWhite) {
      this.data[idx] |= 1 << (y & 7);
    } else {
      this.data[idx] &= ~(1 << (y & 7));
    }
  }
}

export class RGBA32Image implements BinaryImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  static from(other: BinaryImage): RGBA32Image {
    const img = new RGBA32Image(other.width, other.height);
    for (let y = 0; y < other.height; y++) {
      for (let x = 0; x < other.width; x++) {
        img.setPixel(x, y, other.getPixel(x, y));
      }
    }
    return img;
  }

  static fromImageData(imageData: ImageData): RGBA32Image {
    const img = new RGBA32Image(imageData.width, imageData.height);
    img.data.set(imageData.data);
    return img;
  }
  toImageData(): ImageData {
    return new ImageData(this.data, this.width, this.height);
  }

  getPixel(x: number, y: number): boolean {
    const idx = (y * this.width + x) * 4;
    return Math.min(Math.round(0.299 * this.data[idx + 0] + 0.587 * this.data[idx + 1] + 0.114 * this.data[idx + 2]), 255) > 128;
  }

  setPixel(x: number, y: number, isWhite: boolean): void {
    const idx = (y * this.width + x) * 4;
    if (isWhite) {
      this.data[idx + 0] = 255;
      this.data[idx + 1] = 255;
      this.data[idx + 2] = 255;
      this.data[idx + 3] = 255;
    } else {
      this.data[idx + 0] = 0;
      this.data[idx + 1] = 0;
      this.data[idx + 2] = 0;
      this.data[idx + 3] = 255;
    }
  }
}

export type AdjustmentParams = {gamma: number, black: number, white: number}
export function convertToGrayscale(src: ImageData, dst: ImageData, adjustmentParams: AdjustmentParams = {gamma: 1.0, black: 0, white: 255}) {
  if (src.width !== dst.width || src.height !== dst.height) {
    throw new Error("image size mismatch");
  }
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const idx = (y * src.width + x) * 4;
      const rawGray = Math.min(Math.round(0.299 * src.data[idx + 0] + 0.587 * src.data[idx + 1] + 0.114 * src.data[idx + 2]), 255);
      const gammaed = 255 * Math.pow(rawGray / 255, 1 / adjustmentParams.gamma)
      const gray = gammaed <= adjustmentParams.black? 0: (adjustmentParams.white <= gammaed? 255: gammaed);
      dst.data[idx + 0] = gray;
      dst.data[idx + 1] = gray;
      dst.data[idx + 2] = gray;
      dst.data[idx + 3] = 255;
    }
  }
}


export function adaptiveBinarize(src: ImageData, dst: BinaryImage) {
  if (src.width !== dst.width || src.height !== dst.height) {
    throw new Error("image size mismatch");
  }
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      let sample_no = 0;
      let sum = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const x2 = x + i;
          const y2 = y + j;
          if (0 <= x2 && x2 < src.width &&
            0 <= y2 && y2 < src.height) {
            sample_no++;
            sum += src.data[(y2 * src.width + x2) * 4]; // Expecting grayscale image
          }
        }
      }
      const avg = Math.round(sum / sample_no);

      dst.setPixel(x, y, src.data[(y * src.width + x) * 4] > (avg + 128) >> 1);
    }
  }
}

export type DitherParamElem = {
  dx: number;
  dy: number;
  magnitude: number;
};
export type DitherParam = {
  denominator: number;
  elements: DitherParamElem[];
};

export function binarizeWithDither(
  src: ImageData,
  dst: BinaryImage,
  ditherParam: DitherParam
) {
  if (src.width !== dst.width || src.height !== dst.height) {
    throw new Error("image size mismatch");
  }
  const dithered = new Int32Array(src.height * src.width);
  const avgs = new Int32Array(src.height * src.width);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      dithered[y * src.width + x] = src.data[(y * src.width + x) * 4];
    }
  }
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      let sample_no = 0;
      let sum = 0;
      for (let j = -2; j <= 2; j++) {
        for (let i = -2; i <= 2; i++) {
          const x2 = x + i;
          const y2 = y + j;
          if (0 <= x2 && x2 < src.width &&
            0 <= y2 && y2 < src.height) {
            sample_no++;
            sum += src.data[(y2 * src.width + x2) * 4]; // Expecting grayscale image
          }
        }
      }
      const avg = Math.round(sum / sample_no);
      avgs[y * src.width + x] = avg;
      const orig = dithered[y * src.width + x];
      const isWhite = orig > (avg + 128) >> 1;
      const quantized = isWhite ? 255 : 0;
      const error = (orig - quantized) / ditherParam.denominator;
      ditherParam.elements.forEach(e => {
        const x2 = x + e.dx;
        const y2 = y + e.dy;
        dithered[y2 * src.width + x2] += e.magnitude * error;
      });
    }
  }
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      dst.setPixel(x, y, dithered[y * src.width + x] > (128 + avgs[y * src.width + x]) >> 1);
    }
  }
}

