// provider별 API 키 해석: 클라이언트가 보낸 키가 있으면 그걸 쓰고,
// 없으면 서버 .env(.local)에 설정된 키로 대체한다. Google/HuggingFace는
// 아직 서버 키를 지원하지 않고 클라이언트 입력만 받는다.
export function resolveApiKey(provider: "openai" | "google", clientApiKey?: string) {
  if (clientApiKey) return clientApiKey;
  if (provider === "openai") return process.env.OPENAI_API_KEY || "";
  return "";
}

// 키를 못 찾았을 때 보여줄 메시지. 화면에 키 입력란이 없는 provider(openai)는
// 배포 환경변수 누락이 원인이므로, 팀원이 원인을 바로 알 수 있게 구분해서 알린다.
export function missingApiKeyMessage(provider: "openai" | "google") {
  if (provider === "openai") {
    return "서버에 OPENAI_API_KEY가 설정되지 않았습니다. 배포 환경변수를 확인해주세요.";
  }
  return "API 키가 필요합니다.";
}
