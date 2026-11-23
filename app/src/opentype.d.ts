// opentype.js 2.0은 타입 정의를 제공하지 않아서, 쓰는 부분만 선언한다.
declare module 'opentype.js' {
  export interface PathCommand {
    type: 'M' | 'L' | 'Q' | 'C' | 'Z'
    x?: number
    y?: number
    x1?: number
    y1?: number
    x2?: number
    y2?: number
  }
  export interface Path {
    commands: PathCommand[]
  }
  export interface Glyph {
    advanceWidth?: number
    getPath(x: number, y: number, fontSize: number): Path
  }
  export interface Font {
    numGlyphs: number
    unitsPerEm: number
    charToGlyph(char: string): Glyph
    charToGlyphIndex(char: string): number
  }
  export function parse(buffer: ArrayBuffer, options?: object): Font
}
