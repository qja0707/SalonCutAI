/**
 * 얼굴이 바뀌었는지 확인시키는 화면.
 *
 * 이 도구가 파는 것은 "얼굴은 바뀌고 머리는 그대로"이고, 그것을 눈으로 확인하지 못하면
 * 결과를 믿고 올릴 수 없다. 한 프레임을 손잡이로 갈라 같은 자리를 겹쳐 비교한다 —
 * 손잡이를 얼굴 위에서 좌우로 움직이면 경계·피부톤 차이가 그대로 드러나므로,
 * 얼굴만 따로 확대하는 보조 화면은 두지 않는다(8/15 원장님 결정: 산출물과 확인은
 * 단순하게, 최종 산출물은 SNS 3규격이 중심이다).
 */
import { BeforeAfterSlider } from "@/components/before-after";

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
    <div className="space-y-3">
      <div>
        <BeforeAfterSlider beforeUrl={originalUrl} afterUrl={resultUrl} />
        <p className="mt-2 text-center text-xs text-muted-foreground">
          가운데 손잡이를 좌우로 움직여 머리 모양·색이 그대로인지 확인하세요
        </p>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        손님을 알아볼 수 없고 머리 모양·색이 그대로면 쓸 수 있습니다. 얼굴 경계가 뜨거나
        피부톤이 목과 다르면 다시 만들어주세요.
      </p>
    </div>
  );
}
