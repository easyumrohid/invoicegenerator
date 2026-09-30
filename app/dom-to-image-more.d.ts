declare module "dom-to-image-more" {
  interface Options {
    width?: number;
    height?: number;
    bgcolor?: string;
    style?: Record<string, string>;
    scale?: number;
    quality?: number;
  }

  function toPng(node: HTMLElement, options?: Options): Promise<string>;
  function toJpeg(node: HTMLElement, options?: Options): Promise<string>;
  function toSvg(node: HTMLElement, options?: Options): Promise<string>;
  function toBlob(node: HTMLElement, options?: Options): Promise<Blob>;
  function toPixelData(node: HTMLElement, options?: Options): Promise<Uint8ClampedArray>;

  const domtoimage: {
    toPng: typeof toPng;
    toJpeg: typeof toJpeg;
    toSvg: typeof toSvg;
    toBlob: typeof toBlob;
    toPixelData: typeof toPixelData;
  };
  export default domtoimage;
}