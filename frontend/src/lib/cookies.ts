export const setCookie = (name: string, value: string, expireMs: number) => {
  // 1. SSR(서버 사이드) 환경 방어 코드
  if (typeof window === "undefined") return;

  const date = new Date();
  date.setTime(date.getTime() + expireMs);

  // 2. 프로토콜 체크 조건식을 가독성 있게 변수로 분리
  const isSecure = window.location.protocol === "https:" ? "; Secure" : "";

  // 3. 문자열 조립 및 적용
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/; SameSite=Lax${isSecure}`;
};

export const getCookie = (name: string): string | null => {
  // 1. SSR(서버 사이드) 환경 방어 코드
  if (typeof window === "undefined") return null;

  // 2. 쿠키 문자열에서 해당 이름의 쿠키 찾기
  const cookieValue = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];

  // 3. 쿠키가 존재하면 인코딩된 값을 디코딩하여 반환, 없으면 null 반환
  return cookieValue ? decodeURIComponent(cookieValue) : null;
};

export const deleteCookie = (name: string) => {
  // 1. SSR(서버 사이드) 환경 방어 코드
  if (typeof window === "undefined") return;

  // 2. 프로토콜 체크 조건식을 가독성 있게 변수로 분리 (setCookie와 동일하게 맞춤)
  const isSecure = window.location.protocol === "https:" ? "; Secure" : "";

  // 3. max-age=0을 사용하여 쿠키를 즉시 만료 및 삭제
  // 주의: 생성할 때 적용한 path, SameSite, Secure 옵션이 삭제할 때도 일치해야 합니다.
  document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax${isSecure}`;
};
