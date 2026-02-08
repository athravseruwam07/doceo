import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

export interface MathJaxSvgAsset {
  svg: string;
  width: number;
  height: number;
}

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

const inputJax = new TeX({ packages: AllPackages });
const outputJax = new SVG({ fontCache: "none" });
const html = mathjax.document("", { InputJax: inputJax, OutputJax: outputJax });

const svgCache = new Map<string, Promise<MathJaxSvgAsset>>();

function parseDimensions(svg: string): { width: number; height: number } {
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  if (viewBoxMatch) {
    const values = viewBoxMatch[1].split(/\s+/).map((v) => Number(v));
    if (values.length === 4 && Number.isFinite(values[2]) && Number.isFinite(values[3])) {
      return { width: values[2], height: values[3] };
    }
  }

  const widthMatch = svg.match(/width="([^"]+)"/);
  const heightMatch = svg.match(/height="([^"]+)"/);
  const width = widthMatch ? Number.parseFloat(widthMatch[1]) : 320;
  const height = heightMatch ? Number.parseFloat(heightMatch[1]) : 96;
  return {
    width: Number.isFinite(width) ? width : 320,
    height: Number.isFinite(height) ? height : 96,
  };
}

async function createSvgAsset(
  latex: string,
  display: boolean,
  scale: number
): Promise<MathJaxSvgAsset> {
  const node = html.convert(latex, {
    display,
    em: 16 * scale,
    ex: 8 * scale,
    containerWidth: 1600,
  });
  const svg = adaptor.outerHTML(node);
  const { width, height } = parseDimensions(svg);
  return { svg, width, height };
}

export function getMathJaxSvg(
  latex: string,
  display = true,
  scale = 1
): Promise<MathJaxSvgAsset> {
  const key = `${display ? "d" : "i"}|${scale}|${latex}`;
  if (!svgCache.has(key)) {
    svgCache.set(key, createSvgAsset(latex, display, scale));
  }
  return svgCache.get(key)!;
}
