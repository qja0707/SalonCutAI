// 실제 인물 사진 없이 미팅에서 바로 시연할 수 있게 하는 합성 예시 자산.
// 인물은 생성 이미지, 스케치는 SVG이며 실존 인물의 원본 사진은 포함하지 않습니다.

// 팀이 사용 권한을 보유한 비실존 가상 인물 자산이며, 제공 사진 원본은 포함하지 않습니다.
const SAMPLE_AVATAR_PATH = "/sample-assets/sample-avatar-haired.jpg";

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
  const response = await fetch(SAMPLE_AVATAR_PATH);
  if (!response.ok) throw new Error("예시 이미지를 준비하지 못했습니다.");
  const blob = await response.blob();
  return new File([blob], "sample-avatar-haired.jpg", { type: blob.type || "image/jpeg" });
}

export async function sampleSketchFile(): Promise<File> {
  return dataUrlToFile(svgToDataUrl(SKETCH_SVG), "sample-sketch.svg", "image/svg+xml");
}

async function dataUrlToFile(dataUrl: string, filename: string, mime: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: mime });
}
