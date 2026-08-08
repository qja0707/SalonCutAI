import "server-only";

export type ApiMode = "mock" | "proxy";

export function getApiMode(): ApiMode {
  return process.env.SALON_API_MODE === "proxy" ? "proxy" : "mock";
}
