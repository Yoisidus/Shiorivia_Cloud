import type { Locale } from "./locale";

/**
 * Display-only localization for known Charta parser messages.
 * The validators, generated lore, and JSON wire formats are intentionally unchanged.
 */
const exact = new Map<string, readonly [string, string, string, string, string]>([
  ["Invalid character names or language.", ["角色名称或语言无效。", "角色名稱或語言無效。", "Invalid character names or language.", "キャラクター名または言語が無効です。", "캐릭터 이름 또는 언어가 올바르지 않습니다."]],
  ["Invalid language entry.", ["语言名称条目无效。", "語言名稱項目無效。", "Invalid language entry.", "言語別の名前が無効です。", "언어별 이름 항목이 올바르지 않습니다."]],
  ["A primary name is required.", ["请填写主要名称。", "請填寫主要名稱。", "A primary name is required.", "基本の名前を入力してください。", "기본 이름을 입력하세요."]],
  ["A theme color and avatar are required.", ["请填写有效主题色和头像。", "請填寫有效主題色與頭像。", "A valid theme color and avatar are required.", "有効なテーマカラーとアイコンが必要です。", "올바른 테마 색상과 프로필 이미지가 필요합니다."]],
  ["Character notes exceed the limit.", ["角色设定不能超过 20,000 字。", "角色設定不得超過 20,000 字。", "Character notes must not exceed 20,000 characters.", "キャラクター設定は20,000文字以内にしてください。", "캐릭터 설정은 20,000자를 넘길 수 없습니다."]],
  ["请先填写角色简介（必填）；其他四类设定均为选填", ["请先填写角色简介，其余项目选填。", "請先填寫角色簡介，其餘項目選填。", "Character introduction is required; other sections are optional.", "キャラクター紹介は必須で、他の項目は任意です。", "캐릭터 소개는 필수이며 다른 항목은 선택입니다."]],
  ["A custom gender description is required.", ["请填写自定义性别说明。", "請填寫自訂性別說明。", "Describe the custom gender.", "カスタムの性別設定を入力してください。", "사용자 지정 성별을 설명해 주세요."]],
  ["Invalid character world binding.", ["角色绑定的世界观无效。", "角色綁定的世界觀無效。", "Invalid character world binding.", "キャラクターの所属世界観が無効です。", "캐릭터의 세계관 연결이 올바르지 않습니다."]],
  ["角色 ID 必填，必须以字母开头，使用 2–64 位字母、数字、下划线或短横线。", ["角色 ID 必须以字母开头，长度为 2–64 位。", "角色 ID 須以字母開頭，長度為 2–64 碼。", "Character ID must start with a letter and be 2–64 characters long.", "キャラクター ID は英字で始まる2～64文字にしてください。", "캐릭터 ID는 영문자로 시작하는 2~64자여야 합니다."]],
  ["Not a Charta character JSON v1/v2 file.", ["这不是有效的 Charta 角色 JSON v1/v2 文件。", "這不是有效的 Charta 角色 JSON v1/v2 檔案。", "Not a valid Charta character JSON v1/v2 file.", "有効な Charta キャラクター JSON v1/v2 ファイルではありません。", "올바른 Charta 캐릭터 JSON v1/v2 파일이 아닙니다."]],
  ["Invalid self profile", ["自设档案无效。", "自設檔案無效。", "Invalid self profile.", "自作キャラのプロフィールが無効です。", "자작 캐릭터 프로필이 올바르지 않습니다."]],
  ["Invalid language", ["语言代码无效。", "語言代碼無效。", "Invalid language code.", "言語コードが無効です。", "언어 코드가 올바르지 않습니다."]],
  ["Names are required", ["请填写名称。", "請填寫名稱。", "Names are required.", "名前を入力してください。", "이름을 입력하세요."]],
  ["Invalid name", ["名称条目无效。", "名稱項目無效。", "Invalid name entry.", "名前が無効です。", "이름 항목이 잘못되었습니다."]],
  ["A primary name is required (up to 12 languages)", ["请填写主要名称（最多 12 种语言）。", "請填寫主要名稱（最多 12 種語言）。", "A primary name is required (up to 12 languages).", "基本の名前を入力してください（最大12言語）。", "기본 이름을 입력하세요(최대 12개 언어)."]],
  ["Invalid gender", ["性别选项无效。", "性別選項無效。", "Invalid gender selection.", "性別の選択が無効です。", "성별 선택이 올바르지 않습니다."]],
  ["Please describe the custom gender", ["请填写自定义性别说明。", "請填寫自訂性別說明。", "Describe the custom gender.", "カスタムの性別設定を入力してください。", "사용자 지정 성별을 설명해 주세요."]],
  ["Invalid theme color", ["主题色无效。", "主題色無效。", "Invalid theme color.", "テーマカラーが無効です。", "테마 색상이 올바르지 않습니다."]],
  ["Description too long", ["描述不能超过 20,000 字。", "描述不得超過 20,000 字。", "Description must not exceed 20,000 characters.", "説明は20,000文字以内にしてください。", "설명은 20,000자를 넘길 수 없습니다."]],
  ["自设的简介为必填项", ["自设简介为必填项。", "自設簡介為必填項目。", "A self introduction is required.", "自作キャラの紹介を入力してください。", "자작 캐릭터 소개는 필수입니다."]],
  ["自设所属世界观无效", ["自设所属世界观无效。", "自設所屬世界觀無效。", "The self's linked world is invalid.", "自作キャラの所属世界観が無効です。", "자작 캐릭터의 세계관 연결이 올바르지 않습니다."]],
  ["Invalid self ID", ["自设 ID 无效。", "自設 ID 無效。", "Invalid self ID.", "自作キャラの ID が無効です。", "자작 캐릭터 ID가 올바르지 않습니다."]],
  ["不是有效的 Charta 自设 JSON 文件（应为 shiorivia-self）", ["这不是有效的 Charta 自设 JSON 文件。", "這不是有效的 Charta 自設 JSON 檔案。", "Not a valid Charta self JSON file.", "有効な Charta 自作キャラ JSON ではありません。", "올바른 Charta 자작 캐릭터 JSON 파일이 아닙니다."]],
  ["不是有效的 Charta 世界观 JSON 文件（应为 shiorivia-world）", ["这不是有效的 Charta 世界观 JSON 文件。", "這不是有效的 Charta 世界觀 JSON 檔案。", "Not a valid Charta world JSON file.", "有効な Charta 世界観 JSON ではありません。", "올바른 Charta 세계관 JSON 파일이 아닙니다."]],
  ["无效的世界观资料", ["世界观资料无效。", "世界觀資料無效。", "Invalid world data.", "世界観データが無効です。", "세계관 자료가 올바르지 않습니다."]],
  ["无效的世界观 ID", ["世界观 ID 无效。", "世界觀 ID 無效。", "Invalid world ID.", "世界観 ID が無効です。", "세계관 ID가 올바르지 않습니다."]],
  ["世界观名称不能为空（最多 100 字）", ["请填写世界观名称（最多 100 字）。", "請填寫世界觀名稱（最多 100 字）。", "Enter a world name (up to 100 characters).", "世界観の名前を入力してください（最大100文字）。", "세계관 이름을 입력하세요(최대 100자)."]],
  ["世界观设定过长", ["世界观设定不能超过 20,000 字。", "世界觀設定不得超過 20,000 字。", "World description must not exceed 20,000 characters.", "世界観設定は20,000文字以内にしてください。", "세계관 설정은 20,000자를 넘길 수 없습니다."]],
  ["原作时间线最多 80 个时期", ["原作时间线最多可有 80 个时期。", "原作時間線最多可有 80 個時期。", "The canon timeline can have at most 80 stages.", "原作の時間軸は最大80の時期まで登録できます。", "원작 타임라인은 최대 80개 시기까지 등록할 수 있습니다."]],
  ["原作时间线的 ERA 和 PERIOD 必须填写（各最多 100 字）", ["ERA 和 PERIOD 均必填（各最多 100 字）。", "ERA 與 PERIOD 均必填（各最多 100 字）。", "ERA and PERIOD are required (up to 100 characters each).", "ERA と PERIOD は必須です（それぞれ最大100文字）。", "ERA와 PERIOD는 필수입니다(각 최대 100자)."]],
  ["时间线简述每种语言最多 500 字", ["每种语言的时间线简述最多 500 字。", "每種語言的時間線簡述最多 500 字。", "Timeline descriptions are limited to 500 characters per language.", "時間軸の説明は各言語500文字以内です。", "타임라인 설명은 언어별 최대 500자입니다."]],
  ["原作时间线的 PERIOD 不能重复", ["原作时间线的 PERIOD 不能重复。", "原作時間線的 PERIOD 不得重複。", "Canon timeline PERIOD values must be unique.", "原作の時間軸で PERIOD を重複できません。", "원작 타임라인 PERIOD 값은 중복될 수 없습니다."]],
  ["无效的分段人物设定", ["人物设定资料无效。", "人物設定資料無效。", "Invalid character lore profile.", "人物設定データが無効です。", "인물 설정 자료가 올바르지 않습니다."]],
  ["每个角色最多可建立100条关系、100段经历", ["每个角色最多可建立 100 条关系和 100 段经历。", "每個角色最多可建立 100 條關係與 100 段經歷。", "Up to 100 relationships and 100 experiences per character.", "人物関係と経験はそれぞれ最大100件までです。", "관계와 경험은 각각 최대 100개까지 등록할 수 있습니다."]],
  ["关联时间线数据无效", ["关联时间线数据无效。", "關聯時間線資料無效。", "Invalid linked timeline data.", "関連する時間軸データが無効です。", "연결된 타임라인 자료가 올바르지 않습니다."]],
  ["关联时间线不能重复或为空", ["关联时间线不能重复或为空。", "關聯時間線不得重複或為空。", "Linked periods cannot be empty or duplicated.", "関連する時期は空欄や重複にできません。", "연결된 시기는 비워 두거나 중복할 수 없습니다."]],
  ["无效的人物关系", ["人物关系条目无效。", "人物關係項目無效。", "Invalid relationship entry.", "人物関係の項目が無効です。", "인물 관계 항목이 올바르지 않습니다."]],
  ["无效的经历条目", ["经历条目无效。", "經歷項目無效。", "Invalid experience entry.", "経験の項目が無効です。", "경험 항목이 올바르지 않습니다."]],
  ["关联时间线必须属于角色绑定的世界观", ["关联时期必须属于角色绑定的世界观。", "關聯時期必須屬於角色綁定的世界觀。", "Linked periods must belong to the character's world.", "関連する時期は所属世界観内から選んでください。", "연결된 시기는 캐릭터의 세계관에 포함되어야 합니다."]],
  ["关联的时间线必须按时间顺序连续，不能跳过中间时期", ["关联时间线必须连续，不能跳过中间时期。", "關聯時間線必須連續，不得跳過中間時期。", "Linked periods must be consecutive in chronological order.", "関連する時期は途中を飛ばさず連続して指定してください。", "연결된 시기는 건너뛰지 않고 시간순으로 이어져야 합니다."]],
  ["关联角色必须属于当前角色的世界观；如需跨世界的人物，请手动填写名称", ["关联角色必须属于当前世界观；跨世界人物请手动填写名称。", "關聯角色必須屬於目前世界觀；跨世界人物請手動輸入名稱。", "Linked characters must share the same world; enter cross-world names manually.", "関連キャラクターは同じ世界観に属する必要があります。別世界の人物は名前を直接入力してください。", "연결된 캐릭터는 같은 세계관에 속해야 합니다. 다른 세계 인물은 이름을 직접 입력하세요."]],
]);
const fieldLabels = new Map<string, readonly [string, string, string, string, string]>([
  ["简介", ["简介", "簡介", "Introduction", "紹介", "소개"]],
  ["关系对象名称", ["关系对象名称", "關係對象名稱", "Relationship target", "関係する相手の名前", "관계 대상 이름"]],
  ["人物关系描述", ["人物关系描述", "人物關係描述", "Relationship description", "人物関係の説明", "인물 관계 설명"]],
  ["主要经历描述", ["主要经历描述", "主要經歷描述", "Experience description", "主な経験の説明", "경험 설명"]],
  ["无关联人物关系", ["未关联关系", "未關聯關係", "Unlinked relationships", "期間に紐づかない関係", "기간 미연결 관계"]],
  ["无关联经历", ["未关联经历", "未關聯經歷", "Unlinked experiences", "期間に紐づかない経験", "기간 미연결 경험"]],
  ["性格与行为逻辑", ["性格与行为逻辑", "性格與行為邏輯", "Personality and behavior", "性格・行動原理", "성격과 행동 논리"]],
  ["AI还原注意事项", ["AI 还原注意事项", "AI 還原注意事項", "AI portrayal guidance", "AI 再現時の注意", "AI 재현 주의사항"]],
  ["别号", ["别号", "別號", "Aliases", "別名", "별명"]],
  ["发色", ["发色", "髮色", "Hair color", "髪色", "머리색"]],
  ["瞳色", ["瞳色", "瞳色", "Eye color", "瞳の色", "눈동자 색"]],
  ["身高", ["身高", "身高", "Height", "身長", "키"]],
  ["生日", ["生日", "生日", "Birthday", "誕生日", "생일"]],
  ["星座", ["星座", "星座", "Zodiac", "星座", "별자리"]],
  ["萌点", ["萌点", "萌點", "Traits", "萌えポイント", "매력 포인트"]],
  ["人物关系", ["人物关系", "人物關係", "Relationships", "人物関係", "인물 관계"]],
  ["经历", ["经历", "經歷", "Experiences", "経験", "경험"]],
]);
const index: Record<Locale, number> = { "zh-CN": 0, "zh-TW": 1, en: 2, ja: 3, ko: 4 };
const pick = (locale: Locale, values: readonly [string, string, string, string, string]) => values[index[locale]];
const f = (locale: Locale, raw: string) => fieldLabels.has(raw) ? pick(locale, fieldLabels.get(raw)!) : raw;

export function localizeChartaError(locale: Locale, raw: string): string {
  if (!raw) return raw;
  const direct = exact.get(raw);
  if (direct) return pick(locale, direct);
  const max = /^(.+?)不能超过(\d+)字$/.exec(raw);
  if (max && fieldLabels.has(max[1])) {
    const field = f(locale, max[1]), n = max[2];
    switch (locale) {
      case "zh-CN": return `${field}不能超过 ${n} 字。`;
      case "zh-TW": return `${field}不得超過 ${n} 字。`;
      case "en": return `${field} must not exceed ${n} characters.`;
      case "ja": return `${field}は${n}文字以内にしてください。`;
      case "ko": return `${field}은(는) ${n}자를 넘길 수 없습니다.`;
    }
  }
  const relation = /^第(\d+)条人物关系必须填写对应角色名称$/.exec(raw);
  if (relation) {
    const n = relation[1];
    switch (locale) {
      case "zh-CN": return `第${n}条人物关系必须填写对应角色名称。`;
      case "zh-TW": return `第${n}條人物關係必須填寫對應角色名稱。`;
      case "en": return `Relationship ${n} requires a character name.`;
      case "ja": return `人物関係 ${n} の対象キャラクター名を入力してください。`;
      case "ko": return `인물 관계 ${n}번에는 상대 캐릭터 이름이 필요합니다.`;
    }
  }
  const dup = /^(人物关系|经历)的条目ID不能重复$/.exec(raw);
  if (dup) {
    const field = f(locale, dup[1]);
    switch (locale) {
      case "zh-CN": return `${field}中的条目 ID 不能重复。`;
      case "zh-TW": return `${field}中的項目 ID 不得重複。`;
      case "en": return `Entry IDs in ${field} must be unique.`;
      case "ja": return `${field}の項目 ID は重複できません。`;
      case "ko": return `${field}의 항목 ID는 중복될 수 없습니다.`;
    }
  }
  const tag = /^(别号|萌点)格式不正确（最多50个，每个100字）$/.exec(raw);
  if (tag) {
    const field = f(locale, tag[1]);
    switch (locale) {
      case "zh-CN": return `${field}最多 50 项，每项 100 字。`;
      case "zh-TW": return `${field}最多 50 項，每項 100 字。`;
      case "en": return `${field}: up to 50 entries, 100 characters each.`;
      case "ja": return `${field}は最大50件、各100文字までです。`;
      case "ko": return `${field}은(는) 최대 50개, 각 100자까지입니다.`;
    }
  }
  return raw;
}
