/**
 * 얼굴이 바뀌었는지 확인시키는 화면.
 *
 * 이 도구가 파는 것은 "얼굴은 바뀌고 머리는 그대로"이고, 그것을 눈으로 확인하지 못하면
 * 결과를 믿고 올릴 수 없다. 그래서 두 가지를 같이 보여준다.
 *
 *   전체  — 머리 · 옷 · 배경이 그대로인지
 *   얼굴  — 경계가 뜨거나 피부톤이 목과 다른지
 *
 * 어색함은 전신 샷에서는 보이지 않는다. 폰에서는 더 그렇다. 그래서 얼굴을 따로 키운다.
 */
export function FaceCheck({
  originalUrl,
  resultUrl,
}: {
  originalUrl: string | null;
  resultUrl: string | null;
}) {
  // 복구된 작업은 원본이 없다(File 과 objectURL 은 새로고침을 넘기지 못한다).
  // 비교할 짝이 없으면 이 화면은 아무 것도 하지 못하므로 통째로 비운다.
  if (!originalUrl || !resultUrl) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Shot url={originalUrl} label="올린 사진" caption="손님 얼굴" />
        <Shot url={resultUrl} label="바꾼 결과" caption="가상 얼굴" ai />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium">얼굴만 크게</p>
        <div className="grid grid-cols-2 gap-3">
          <FaceCrop url={originalUrl} label="올린 사진" />
          <FaceCrop url={resultUrl} label="바꾼 결과" />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        손님을 알아볼 수 없고 머리 모양·색이 그대로면 쓸 수 있습니다. 얼굴 경계가 뜨거나
        피부톤이 목과 다르면 다시 만들어주세요.
      </p>
    </div>
  );
}

function Shot({
  url,
  label,
  caption,
  ai = false,
}: {
  url: string;
  label: string;
  caption: string;
  ai?: boolean;
}) {
  return (
    <figure className="m-0 space-y-1.5">
      <div className="relative overflow-hidden rounded-lg border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="aspect-[4/5] w-full object-cover" />
        {ai && (
          <span className="pointer-events-none absolute right-2 bottom-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
            AI 생성
          </span>
        )}
      </div>
      <figcaption className="text-center text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground"> · {caption}</span>
      </figcaption>
    </figure>
  );
}

/**
 * 얼굴 부분만 키워서 보여준다.
 *
 * 좌표를 잡아주는 얼굴 검출이 프론트에 없으므로, 인물 사진이 대체로 위쪽 가운데에
 * 얼굴을 둔다는 점에 기대어 그 지점을 확대한다. 정확한 검출은 아니지만
 * "경계가 떴는지"를 보기에는 충분하고, 서버에 좌표를 요구하지 않아도 된다.
 */
function FaceCrop({ url, label }: { url: string; label: string }) {
  return (
    <figure className="m-0 space-y-1.5">
      <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`${label}의 얼굴`}
          className="absolute h-full w-full origin-[50%_24%] scale-[2.5] object-cover object-[50%_20%]"
        />
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  );
}
