"""외부 코드를 원본 그대로 두는 자리.

InstantID 파이프라인은 PyPI 패키지가 아니라 레포 파일을 직접 쓴다.
배포 환경에서 clone 에 의존하지 않으려고 여기에 사본을 둔다.

출처  https://github.com/InstantID/InstantID
라이선스  Apache 2.0 (LICENSE-InstantID)

CodeFormer 복원 모델의 arch 두 파일도 같은 이유로 둔다.
basicsr 전체를 의존성에 넣지 않으려고 import 3줄만 바꿨다. 바꾼 자리는
파일 안에 주석으로 표시했다. 그 외는 원본 그대로다.

출처  https://github.com/sczhou/CodeFormer
라이선스  S-Lab License 1.0 (LICENSE-CodeFormer)

이 폴더의 파일은 위에 적은 것외에 수정하지 않는다. ruff 검사에서도 제외한다.
업데이트가 필요하면 원본에서 다시 받는다.
"""
