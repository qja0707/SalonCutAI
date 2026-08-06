// 실제 인물 사진 없이 미팅에서 바로 시연할 수 있게 하는 합성 예시 자산.
// 전부 SVG로 그린 추상 아바타/스케치라 실존 인물이 아니며 초상권 원칙에 걸리지 않습니다.

const AVATAR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
  <rect width="640" height="640" fill="#d6e0e2"/>
  <text x="20" y="34" font-family="sans-serif" font-size="15" fill="#465254">예시용 합성 인물 (실존 인물 아님)</text>
  <rect x="170" y="470" width="300" height="170" rx="0" fill="#78829a"/>
  <ellipse cx="320" cy="220" rx="130" ry="190" fill="#46302c"/>
  <ellipse cx="320" cy="270" rx="108" ry="120" fill="#e0c4ac"/>
  <ellipse cx="284" cy="255" rx="15" ry="12" fill="#5a3c32"/>
  <ellipse cx="356" cy="255" rx="15" ry="12" fill="#5a3c32"/>
  <path d="M290 300 Q320 330 350 300" stroke="#966450" stroke-width="4" fill="none"/>
</svg>`.trim();

const SKETCH_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
  <rect width="640" height="640" fill="#ffffff"/>
  <text x="20" y="34" font-family="sans-serif" font-size="15" fill="#5a5a5a">예시용 스케치 (앞머리 라인 · 길이감 표시)</text>
  <path d="M200 260 A120 120 0 0 1 440 260" stroke="#1e1e1e" stroke-width="5" fill="none"/>
  <line x1="200" y1="220" x2="225" y2="350" stroke="#1e1e1e" stroke-width="5"/>
  <line x1="440" y1="220" x2="415" y2="350" stroke="#1e1e1e" stroke-width="5"/>
  <line x1="260" y1="140" x2="280" y2="210" stroke="#1e1e1e" stroke-width="4"/>
  <line x1="330" y1="135" x2="345" y2="215" stroke="#1e1e1e" stroke-width="4"/>
</svg>`.trim();

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function sampleAvatarFile(): Promise<File> {
  return dataUrlToFile(svgToDataUrl(AVATAR_SVG), "sample-avatar.svg", "image/svg+xml");
}

export async function sampleSketchFile(): Promise<File> {
  return dataUrlToFile(svgToDataUrl(SKETCH_SVG), "sample-sketch.svg", "image/svg+xml");
}

async function dataUrlToFile(dataUrl: string, filename: string, mime: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: mime });
}
