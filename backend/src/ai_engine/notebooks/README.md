# 실험 노트북 (R2 이미지 생성)

Colab 에서 실행한 실험 기록이다. 커밋 전에 셀 출력을 전부 삭제했다. 확정값과 판단 근거는 최종 보고서에 정리돼 있고, 각 노트북은 그 실험의 원본 코드다. 아래는 시간 순이자 의존 순서다. 초기 탐색·세부 튜닝 노트북은 드라이브에 보관하고 여기에는 최종 파이프라인의 근거가 된 것만 둔다.

| 노트북 | 주제 |
|---|---|
| `step1_combo2_3_instantid` | 조합 선정 - inswapper 제외, InstantID text2img→img2img 전환 |
| `step1_ref_faces` | 참조 얼굴 32장 생성, 참조 모드 재현 |
| `step2_upper_generate` | 실사용 구도 재현, 헤어 팽창 비율화, 정렬 이동량 측정 |
| `step2_face_restore` | 복원 모델 3종 비교, 정렬 제거, 눈썹 보존, 파라미터 적용 검증 |
| `step2_make_ref_faces` | 참조 2·3차 생성, 파라미터 스윕, 참조 풀 원인 규명 |
| `step2_fullres_check` | 후처리를 2048 저장본에서 실행하는 수정 검증 |
| `step3_combo5` | SDXL 레버 3종 실패, GPT 이미지 편집 전환, 후처리 확정 |
| `step2_make_ref_faces_v4` | 참조 4차(메이크업·표정 축) 생성 - ref-33~53 의 근거 |
| `step4_combo5_gpt_check` | GPT 경로 레포 코드 검증, 피부 클래스 재합성, 페더링 |

실행 환경은 Colab L4(GPT 경로는 CPU 런타임)다. 같은 시드에서 같은 결과를 얻으려면 당시 버전 고정(diffusers 0.39.0 / transformers 5.14.1)을 따라야 한다. OpenAI 키는 getpass 로 세션에만 넣는다. 노트북의 마스크 비율은 크롭 상자 폭 기준이라 레포 상수(InsightFace 얼굴 폭 기준)와 ×1.6 관계다.
