// 참조 얼굴을 부르는 이름.
//
// 백엔드 label 은 "한국인 20대 여성 A" 처럼 국적·연령대·성별이 다 들어 있다. 그런데
// 원장님은 그 글자를 읽고 고르는 게 아니라 마음에 드는 얼굴을 보고 고른다(8/27 확정).
// 격자에서 이름은 고른 뒤 무엇을 골랐는지 확인하는 용도라 짧을수록 좋고, 성별·연령대·
// 국적은 위쪽 필터가 이미 담당하므로 이름에서 뺀다.
//
// 한국인은 그 연령대가 실제로 많이 쓰는 이름, 그 외 국적은 해당 문화권에서 흔한 이름이다.
// label 은 alt 텍스트와 필터에서 계속 쓰므로 지우지 않는다 — 여기는 표시용 이름만 얹는다.
//
// 이름을 백엔드가 아니라 프론트에서 얹는 이유는 배포를 하나로 줄이려는 것이다.
// 백엔드가 label 자체를 닉네임으로 바꾸는 날이 오면 이 파일을 지우면 된다.

/** id → 화면에 보일 이름. 여기 없는 id 는 label 을 그대로 쓴다. */
export const FACE_NICKNAMES: Readonly<Record<string, string>> = {
  "ref-01": "서연",
  "ref-02": "지우",
  "ref-03": "하은",
  "ref-04": "예린",
  "ref-05": "민준",
  "ref-06": "도현",
  "ref-07": "지호",
  "ref-08": "지원",
  "ref-09": "유진",
  "ref-10": "수빈",
  "ref-11": "준영",
  "ref-12": "태현",
  "ref-13": "지혜",
  "ref-14": "은정",
  "ref-15": "상현",
  "ref-16": "진우",
  "ref-17": "미경",
  "ref-18": "현주",
  "ref-19": "영수",
  "ref-20": "종민",
  "ref-21": "사쿠라",
  "ref-22": "팅팅",
  "ref-23": "엠마",
  "ref-24": "린",
  "ref-25": "이마니",
  "ref-26": "레일라",
  "ref-27": "하루토",
  "ref-28": "하오란",
  "ref-29": "리암",
  "ref-30": "민",
  "ref-31": "말릭",
  "ref-32": "오마르",
  // 8/27 추가분(ref-33~53). 백엔드 label 은 "한국인 20대 여성 E~Y" 로 서로 구분되지 않아
  // 얼굴을 보고 이름을 붙였다(#201).
  "ref-33": "서윤",
  "ref-34": "지민",
  "ref-35": "채원",
  "ref-36": "다은",
  "ref-37": "수아",
  "ref-38": "유나",
  "ref-39": "소율",
  "ref-40": "아린",
  "ref-41": "시은",
  "ref-42": "나윤",
  "ref-43": "하린",
  "ref-44": "예나",
  "ref-45": "은서",
  "ref-46": "다인",
  "ref-47": "서아",
  "ref-48": "지안",
  "ref-49": "세은",
  "ref-50": "유하",
  "ref-51": "하윤",
  "ref-52": "윤서",
  "ref-53": "가을",
};

/**
 * 목록 맨 앞에 둘 얼굴. 배열에 쓴 순서가 화면 순서다.
 *
 * 비워 두는 것이 기본이다 — 8/27 추가분은 백엔드가 이미 목록 앞에 배치했고(#201),
 * 순서를 양쪽에서 관리하면 어느 한쪽만 바뀌었을 때 어긋난다. 백엔드가 못 미루는
 * 사정이 생겼을 때만 여기에 쓴다.
 */
export const PRIORITY_FACE_IDS: readonly string[] = [];

/** 화면에 보일 이름. 매핑에 없으면 label 을 쓴다 — 백엔드가 얼굴을 더해도 칸이 비지 않는다. */
export function faceNickname(face: { id: string; label: string }): string {
  return FACE_NICKNAMES[face.id] ?? face.label;
}

/**
 * 우선 배치를 적용한다. Array.prototype.sort 는 안정 정렬이라
 * 우선 목록에 없는 얼굴들끼리는 백엔드가 준 순서가 그대로 남는다.
 */
export function orderFaces<T extends { id: string }>(faces: readonly T[]): T[] {
  const rank = (id: string) => {
    const index = PRIORITY_FACE_IDS.indexOf(id);
    return index < 0 ? PRIORITY_FACE_IDS.length : index;
  };
  return [...faces].sort((a, b) => rank(a.id) - rank(b.id));
}
