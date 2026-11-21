import type { Locale } from "./locale";

/** Display titles apply only to newly created sessions, never existing saves. */
const titles = {
  infinite: ["新工程", "新專案", "New Project", "新しいプロジェクト", "새 프로젝트"],
  sliding: ["新故事", "新故事", "New Story", "新しい物語", "새 이야기"],
  chat: ["新聊天", "新對話", "New Chat", "新しいチャット", "새 채팅"],
  novel: ["新小说", "新小說", "New Novel", "新しい小説", "새 소설"],
} as const;
export type NamedSessionMode = keyof typeof titles;
/** Visual-only unassigned Officina welcome; never send this message to a model. */
export function officinaUnassignedWelcome(locale: Locale): string {
  const messages: Record<Locale, string> = {
    "zh-CN": "欢迎来到 Shiorivia。请先从右侧栏选择一位角色工程师，再开始合作。",
    "zh-TW": "歡迎來到 Shiorivia。請先從右側欄選擇一位角色工程師，再開始合作。",
    en: "Welcome to Shiorivia. Choose a character engineer in the right sidebar to begin.",
    ja: "Shiorivia へようこそ。右側のサイドバーから一緒に作業するキャラクターを選んでください。",
    ko: "Shiorivia에 오신 것을 환영합니다. 오른쪽 사이드바에서 함께 작업할 캐릭터 엔지니어를 선택하세요.",
  };
  return messages[locale] || messages["zh-CN"];
}

/** Visual-only Umbra onboarding before a worldline and speaker are selected. */
export function umbraUnassignedWelcome(locale: Locale): string {
  const copy: Record<Locale, string> = {
    "zh-CN": "欢迎来到 Umbra。请先在左侧配置世界线，再在右侧选择聊天角色。",
    "zh-TW": "歡迎來到 Umbra。請先在左側配置世界線，再在右側選擇聊天角色。",
    en: "Welcome to Umbra. Choose a worldline on the left and a character on the right.",
    ja: "Umbraへようこそ。左側で世界線、右側で話すキャラクターを選んでください。",
    ko: "Umbra에 오신 것을 환영합니다. 왼쪽에서 세계선을, 오른쪽에서 대화할 캐릭터를 선택하세요.",
  };
  return copy[locale] || copy["zh-CN"];
}

/** Initial assistant greetings are generated only for brand-new sessions. */
export function sessionGreeting(mode: "infinite" | "chat", name: string, locale: Locale): string {
  const who = name || "Shiorivia";
  const greetings = mode === "infinite" ? {
    "zh-CN": `我是${who}。欢迎来到 Shiorivia。请告诉我你想做什么。`,
    "zh-TW": `我是${who}。歡迎來到 Shiorivia。想從哪裡開始呢？`,
    en: `I'm ${who}. Welcome to Shiorivia. What would you like to work on?`,
    ja: `${who}です。Shiorivia へようこそ。今日は何をしましょうか？`,
    ko: `저는 ${who}입니다. Shiorivia에 오신 것을 환영해요. 무엇을 도와드릴까요?`,
  } : {
    "zh-CN": `我是${who}。今天想聊些什么？`,
    "zh-TW": `我是${who}。今天想聊些什麼？`,
    en: `It's ${who}. What would you like to talk about today?`,
    ja: `${who}です。今日は何を話そうか？`,
    ko: `${who}예요. 오늘은 무슨 이야기를 나눌까요?`,
  };
  return greetings[locale];
}
const languages: Locale[] = ["zh-CN", "zh-TW", "en", "ja", "ko"];
export function defaultSessionTitle(mode: NamedSessionMode, locale: Locale): string {
  return titles[mode][Math.max(0, languages.indexOf(locale))];
}
/** Default titles across every locale; do not overwrite user-authored names. */
export function isDefaultSessionTitle(title: string, mode: string): boolean {
    return mode in titles && (titles[mode as NamedSessionMode] as readonly string[]).includes(title);
}
/** Read-only fallback used by Tela's first-chapter automatic naming. */
export function isUntitledNovel(title: string): boolean {
  return titles.novel.includes(title as (typeof titles.novel)[number]) ||
    ["New Dream", "未命名作品"].includes(title);
}
