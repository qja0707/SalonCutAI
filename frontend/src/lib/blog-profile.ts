// 블로그 폼의 매장 프로필 저장 — 브라우저 쿠키
//
// 규범님 결정(Discussion #44, 8/11): 이 단계에서 DB 테이블을 추가하지 않고 프론트에서 쿠키로 저장한다.
//
// 쿠키 제약 두 가지를 코드에서 처리한다.
//   1) 값에 ASCII 만 담을 수 있어 한글은 encodeURIComponent 로 감싼다.
//   2) 4KB 상한이 있어 제품 목록 개수를 제한한다.

export type BlogProfile = {
  /** 디자이너 이름 — 프롬프트가 마무리 문단에서 이름을 부른다. */
  designerName: string;
  /** 지역 (예: 성수동) */
  regionArea: string;
  /** 업종·시술 (예: 미용실) — regionArea 와 합쳐 region_keyword 한 문자열이 된다. */
  regionBusiness: string;
  /**
   * 매장 취급 제품 목록.
   * 자동 채움용이 아니다. 글을 쓸 때 이 목록에서 이번 시술에 실제로 쓴 제품을 고른다.
   * (규범님: 라인업이 고정이어도 이번 시술에 쓴 제품은 다를 수 있음)
   */
  specialProducts: string[];
};

export const EMPTY_BLOG_PROFILE: BlogProfile = {
  designerName: "",
  regionArea: "",
  regionBusiness: "",
  specialProducts: [],
};

const COOKIE_NAME = "salon_blog_profile";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1년
export const MAX_SPECIAL_PRODUCTS = 20;

function readRawCookie(name: string): string | null {
  // 서버 렌더 중에는 document 가 없다. 폼은 클라이언트 컴포넌트지만 첫 렌더에서 호출될 수 있다.
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const hit = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

/** 저장된 프로필을 읽는다. 없거나 형식이 깨졌으면 빈 프로필을 준다. */
export function readBlogProfile(): BlogProfile {
  const raw = readRawCookie(COOKIE_NAME);
  if (!raw) return EMPTY_BLOG_PROFILE;

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (!parsed || typeof parsed !== "object") return EMPTY_BLOG_PROFILE;
    const value = parsed as Partial<BlogProfile>;
    return {
      designerName: typeof value.designerName === "string" ? value.designerName : "",
      regionArea: typeof value.regionArea === "string" ? value.regionArea : "",
      regionBusiness: typeof value.regionBusiness === "string" ? value.regionBusiness : "",
      specialProducts: Array.isArray(value.specialProducts)
        ? value.specialProducts.filter((item): item is string => typeof item === "string")
        : [],
    };
  } catch {
    // 손상된 쿠키 때문에 화면이 깨지지 않도록 빈 값으로 되돌린다.
    return EMPTY_BLOG_PROFILE;
  }
}

/** 프로필을 저장한다. 제품 목록은 쿠키 용량을 넘지 않도록 개수를 자른다. */
export function writeBlogProfile(profile: BlogProfile): void {
  if (typeof document === "undefined") return;
  const trimmed: BlogProfile = {
    ...profile,
    specialProducts: profile.specialProducts
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_SPECIAL_PRODUCTS),
  };
  const value = encodeURIComponent(JSON.stringify(trimmed));
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
  listeners.forEach((listener) => listener());
}

// ── useSyncExternalStore 용 어댑터 ────────────────────────────────────────────
// 쿠키는 React 밖에 있는 저장소다. useEffect 안에서 setState 로 끌어오면
// 첫 렌더 뒤에 한 번 더 렌더가 돌고(cascading render), 서버 렌더 결과와도 어긋난다.
// React 가 외부 저장소를 읽으라고 만든 API 를 쓴다.

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedRaw: string | null = null;
let cachedProfile: BlogProfile = EMPTY_BLOG_PROFILE;

export function subscribeBlogProfile(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 현재 프로필. React 는 반환값을 Object.is 로 비교하므로,
 * 쿠키 문자열이 그대로면 같은 객체를 돌려줘야 무한 렌더에 빠지지 않는다.
 */
export function getBlogProfileSnapshot(): BlogProfile {
  const raw = readRawCookie(COOKIE_NAME);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedProfile = readBlogProfile();
  }
  return cachedProfile;
}

/** 서버 렌더에는 쿠키가 없다. 클라이언트 첫 렌더와 같은 값이어야 hydration 이 어긋나지 않는다. */
export function getBlogProfileServerSnapshot(): BlogProfile {
  return EMPTY_BLOG_PROFILE;
}
