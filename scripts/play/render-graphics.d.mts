/** Types of scripts/play/render-graphics.mjs for the TypeScript tests that import it. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}
export interface PngInfo {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlace: number;
}
export declare const ROOT: string;
export declare const SOURCE_ICON: string;
export declare const DEFAULT_OUT_DIR: string;
export declare const ICON: { file: string; width: number; height: number; maxBytes: number };
export declare const FEATURE: { file: string; width: number; height: number };
export declare const BRAND_GRADIENT: { from: number[]; to: number[] };
export declare function pngInfo(buf: Buffer): PngInfo;
export declare function decodePng(buf: Buffer): RgbaImage;
export declare function encodePng(img: RgbaImage, options: { alpha: boolean }): Buffer;
export declare function gradientAt(t: number): number[];
export declare function artworkOf(icon: RgbaImage): RgbaImage;
export declare function resample(src: RgbaImage, width: number, height: number): RgbaImage;
export declare function renderIcon(icon: RgbaImage): RgbaImage;
export declare function renderFeature(icon: RgbaImage): RgbaImage;
export declare function render(outDir?: string, sourceIcon?: string): { iconPath: string; featurePath: string };
