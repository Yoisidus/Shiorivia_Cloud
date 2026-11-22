<div align="center">

![Shiorivia · Star Road](public/branding/shiorivia-banner.svg)

# Shiorivia · Cloud Edition ☁️

**Where Stories Find Their Way.**

A browser-first AI conversation and interactive storytelling studio — based on [Shiorivia Local](https://github.com/Yoisidus/Shiorivia).

[![AGPL-3.0](https://img.shields.io/badge/Code-AGPL--3.0-536b61)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-242f2b)](package.json)
[![Cloud Edition](https://img.shields.io/badge/Edition-Cloud-729cbd)](docs/development.md)

**[简体中文](#简体中文) · [繁體中文](#繁體中文) · [English](#english) · [日本語](#日本語) · [한국어](#한국어)**

**[Launch Cloud](https://app.shiorivia.com)** · [Local Edition](https://github.com/Yoisidus/Shiorivia) · [Cloud guides](docs/README.md) · [Security](SECURITY.md) · [Branding](BRANDING.md)

</div>

---

<a id="简体中文"></a>
## 简体中文

Shiorivia Cloud 是一个**以浏览器为中心的 AI 对话与互动叙事工作室**。延续本地版的多模式设计，但不需要安装本地文件服务，也不会把每个人的会话放进共用的云端账户。

### 探索不同空间

| 空间 | 用途 |
| --- | --- |
| **Officina** | 工程、编程与日常问答；内置浏览器虚拟 IDE，可导出项目 ZIP。 |
| **Via Lata** | 角色状态、世界线与剧情交互。 |
| **Umbra** | 自定义世界线内的角色聊天与独立记忆。 |
| **Tela** | 小说、章节、剧情预设与文稿导出。 |
| **VIAE** | Semita / Compitum 多角色道路与多视角叙事。 |
| **Charta** | 管理角色、自设、世界线与文字设定。 |

支持**简体中文、繁体中文、English、日本語、한국어**。切换界面语言不会翻译或改写已有聊天、小说和个人设定。

### 开始使用

1. 打开 **[app.shiorivia.com](https://app.shiorivia.com)**，进入设置中心 → AI 与模型。
2. 创建至少 12 字符的保险箱口令，填写自己的 DeepSeek、OpenRouter 或 Google Gemini API Key（以及支持的 URL），点击 **「加密保存并锁定」**。
3. 保险箱保存后，使用下方独立的 **「解密密钥」**，输入一次口令将已保存的 Key 加载到本标签页内存。之后选模型、选择空间即可开始。
4. 建议在模型供应商后台设置**消费上限**；模型请求与必要对话内容会发送到所选供应商。

会话、Charta 和 12 个存档槽保存在**当前网站来源的浏览器 IndexedDB**，不是跨设备同步的账号。首次打开时系统会自动建立并保存一条 Officina 欢迎会话。建议手动保存重要更改，并定期导出项目、小说和资料；清除网站数据可能导致资料丢失。

**Cloud 与 Local 的区别：** Cloud 不扫描你电脑的文件或音乐；Officina IDE 是浏览器内的文字项目，ZIP 可解压到 Local 的 `IDE/`。Cloud 不提供本机 ComfyUI、服务器上传立绘或本机音乐扫描。自定义任意模型 URL 目前默认禁用，不能保证可连接。每个浏览器配置文件一次只运行一个 Cloud 标签页。

**本地运行 Cloud 源码：** 安装 Node.js 24 与 npm，运行 `npm ci`、`npm run dev`，然后访问 `http://localhost:3000`；**Cloud 的 API Key 在浏览器设置中心配置，而不是 `.env.local`**。

---

<a id="繁體中文"></a>
## 繁體中文

Shiorivia Cloud 是一款**以瀏覽器為核心的 AI 對話與互動敘事工作室**。沿用本機版的多種模式，但不需要本機檔案伺服器，也沒有共用的雲端帳號存檔。

### 探索各個空間

| 空間 | 功能 |
| --- | --- |
| **Officina** | 工程、程式設計、一般問答，及可匯出 ZIP 的瀏覽器虛擬 IDE。 |
| **Via Lata** | 世界線、角色狀態與互動劇情。 |
| **Umbra** | 世界線內的角色對話與獨立記憶。 |
| **Tela** | 小說、章節、故事預設與文稿匯出。 |
| **VIAE** | Semita / Compitum 多角色路徑與多視角敘事。 |
| **Charta** | 角色、自設、世界線與文字設定。 |

介面支援**簡體中文、繁體中文、英文、日文、韓文**；切換語言不會翻譯或覆蓋既有對話、小說與使用者設定。

### 開始使用

1. 開啟 **[app.shiorivia.com](https://app.shiorivia.com)**，進入設定中心 → AI 與模型。
2. 設定至少 12 字元的保險箱口令，輸入自己的 DeepSeek、OpenRouter 或 Google Gemini API Key（及支援的 URL），按下**「加密儲存並鎖定」**。
3. 已儲存密鑰後，在下方獨立的**「解密金鑰」**區輸入口令一次，將密鑰載入目前分頁記憶體，再選擇模型和空間。
4. 建議在模型供應商後台設定**消費上限**；相關請求與對話會送往選定的供應商。

對話、Charta 與 12 個存檔槽保存在此網站的**瀏覽器 IndexedDB**，不是跨裝置同步的帳號。首次造訪會建立並儲存 Officina 歡迎對話。請手動儲存重要更改並定期匯出；清除網站資料可能導致內容遺失。

**Cloud 與 Local 的差異：** Cloud 不掃描本機檔案或音樂；Officina 虛擬 IDE 儲存文字專案，可將 ZIP 解壓至 Local 的 `IDE/`。不支援本機 ComfyUI、伺服器立繪上傳或本機曲庫掃描。任意自訂模型 URL 預設停用；同一瀏覽器設定檔一次只允許一個 Cloud 分頁。

**本機啟動 Cloud 原始碼：** 安裝 Node.js 24，執行 `npm ci`、`npm run dev`，開啟 `http://localhost:3000`。**Cloud API Key 請在瀏覽器設定中心輸入，無須編輯 `.env.local`。**

---

<a id="english"></a>
## English

Shiorivia Cloud is a **browser-first studio for AI conversations and interactive storytelling**. It adapts the multi-space experience of [Shiorivia Local](https://github.com/Yoisidus/Shiorivia) without a trusted local file server or shared hosted save account.

### Find your space

| Space | What it offers |
| --- | --- |
| **Officina** | Coding, engineering and everyday questions; browser-only virtual IDE with project ZIP export. |
| **Via Lata** | Worldlines, character states and interactive stories. |
| **Umbra** | Character conversations with per-character memory. |
| **Tela** | Immersive writing, chapters, story presets and manuscript exports. |
| **VIAE** | Semita / Compitum multi-character paths and viewpoints. |
| **Charta** | Characters, selves, worldlines and text-based lore. |

The interface supports **Simplified Chinese, Traditional Chinese, English, Japanese and Korean**. Changing the UI language never rewrites existing conversations, prose or user-created lore.

### Getting started

1. Open **[app.shiorivia.com](https://app.shiorivia.com)**, then Settings Center → AI & Models.
2. Create a vault passphrase of at least 12 characters, enter your own DeepSeek, OpenRouter or Google Gemini API key (and URL where supported), then select **Encrypt, save and lock**.
3. Once a vault exists, use the separate **Decrypt keys for AI use** section and enter your passphrase once to load your saved credentials into this tab's memory. Choose a model and a space to begin.
4. **Set a spending limit** in your model provider's dashboard. AI requests and relevant prompts are sent to your selected provider.

Sessions, Charta profiles and 12 save slots are stored in this site's **origin-scoped browser IndexedDB**, not an account synced across devices. The initial Officina greeting is saved automatically. Save meaningful changes and export important material regularly; clearing site data can erase your work.

**Cloud versus Local:** Cloud does not scan files or music on your computer. Officina's text-only IDE can export a ZIP for extraction into Local's `IDE/` directory. Local ComfyUI, server-hosted uploads and music scanning are unavailable. Arbitrary custom provider URLs are disabled by default. One Cloud tab at a time can be active in each browser profile.

**Run the Cloud code locally:** Install Node.js 24 and npm, run `npm ci`, then `npm run dev`; open `http://localhost:3000`. **Configure Cloud API keys in the browser Settings Center, not in `.env.local`.**

---

<a id="日本語"></a>
## 日本語

Shiorivia Cloud は、**ブラウザ中心の AI 会話・インタラクティブ物語制作スタジオ**です。[Local Edition](https://github.com/Yoisidus/Shiorivia) の多彩な空間を引き継ぎながら、ローカルのファイルサーバーや共有クラウド保存アカウントを必要としません。

### 物語の空間

| 空間 | 機能 |
| --- | --- |
| **Officina** | 技術相談、プログラミング、日常的な質問、ZIP 書き出し対応のブラウザ仮想 IDE。 |
| **Via Lata** | 世界線、キャラクターの状態とインタラクティブな物語。 |
| **Umbra** | キャラクターとの会話と個別の記憶管理。 |
| **Tela** | 小説執筆、章管理、物語のプリセットと原稿書き出し。 |
| **VIAE** | Semita / Compitum の複数キャラクター・視点による物語。 |
| **Charta** | キャラクター、自作設定、世界線、テキスト設定の管理。 |

**簡体字中国語、繁体字中国語、英語、日本語、韓国語**に対応。表示言語を変更しても、保存済みの会話や小説、ユーザーの設定は書き換えられません。

### はじめに

1. **[app.shiorivia.com](https://app.shiorivia.com)** の設定センター → AI とモデルを開きます。
2. 12 文字以上の保管庫パスフレーズを作成し、DeepSeek・OpenRouter・Google Gemini の API キー（対応する URL）を入力して、**暗号化して保存・ロック**します。
3. 保存後に表示される独立した**AI 用のキーを復号**エリアで一度パスフレーズを入力すると、このタブのメモリにキーが読み込まれます。モデルと空間を選んで開始してください。
4. モデル提供元の管理画面で**利用金額の上限**を設定することをおすすめします。AI リクエストと必要な会話内容は選択した提供元に送られます。

会話、Charta、12 個の保存スロットはサイト固有の**ブラウザ IndexedDB**に保存され、端末間の同期アカウントではありません。最初の Officina メッセージは自動保存されます。大切な内容は保存・書き出しを行ってください。サイトデータを消去すると失われる可能性があります。

**Local 版との違い：** 端末のファイルや音楽を自動スキャンしません。Officina の仮想 IDE はテキスト専用で、ZIP を Local の `IDE/` に展開できます。ローカル ComfyUI、サーバー画像アップロード、音楽スキャンは利用できません。任意のカスタム接続 URL は初期状態では無効。同じブラウザプロファイルで利用できる Cloud タブは一つだけです。

**Cloud ソースのローカル起動：** Node.js 24 を用意し、`npm ci`、`npm run dev` を実行して `http://localhost:3000` を開きます。**API キーは `.env.local` ではなくブラウザの設定センターで登録します。**

---

<a id="한국어"></a>
## 한국어

Shiorivia Cloud는 **브라우저 중심의 AI 대화 및 인터랙티브 스토리 제작 스튜디오**입니다. [Local Edition](https://github.com/Yoisidus/Shiorivia)의 여러 모드를 제공하지만 로컬 파일 서버나 공용 클라우드 저장 계정이 필요하지 않습니다.

### 이야기를 위한 공간

| 공간 | 기능 |
| --- | --- |
| **Officina** | 코딩, 엔지니어링, 일반 질문 및 ZIP 내보내기를 지원하는 브라우저 가상 IDE. |
| **Via Lata** | 세계선과 캐릭터 상태를 활용한 상호작용 스토리. |
| **Umbra** | 캐릭터별 기억을 유지하는 대화. |
| **Tela** | 소설 집필, 챕터 관리, 이야기 프리셋 및 원고 내보내기. |
| **VIAE** | Semita / Compitum의 다중 캐릭터 경로와 시점. |
| **Charta** | 캐릭터, 자작 설정, 세계선 및 텍스트 설정 관리. |

UI는 **중국어 간체·번체, 영어, 일본어, 한국어**를 지원합니다. 언어를 바꿔도 기존 채팅, 소설 또는 사용자가 작성한 설정은 덮어쓰지 않습니다.

### 시작하기

1. **[app.shiorivia.com](https://app.shiorivia.com)** 에서 설정 센터 → AI 및 모델을 엽니다.
2. 최소 12자의 보관함 암호문구를 만들고 DeepSeek, OpenRouter 또는 Google Gemini API 키(지원되는 URL 포함)를 입력한 후 **암호화 저장 및 잠금**을 누릅니다.
3. 암호화 저장 후 나타나는 별도의 **AI 사용을 위한 키 복호화** 영역에 암호문구를 한 번 입력하여 현재 탭 메모리에 키를 로드합니다. 모델과 공간을 선택하세요.
4. 모델 제공업체의 관리 페이지에서 **지출 한도**를 설정하세요. AI 요청과 관련 대화 내용은 선택한 제공업체로 전송됩니다.

세션, Charta 및 12개 저장 슬롯은 장치 간 동기화 계정이 아니라 이 사이트의 **브라우저 IndexedDB**에 저장됩니다. 초기 Officina 인사 메시지는 자동 저장됩니다. 중요한 변경 사항을 저장하고 주기적으로 내보내세요. 사이트 데이터를 삭제하면 콘텐츠가 사라질 수 있습니다.

**Local과의 차이:** Cloud는 컴퓨터의 파일이나 음악을 검색하지 않습니다. Officina의 텍스트 전용 가상 IDE는 ZIP으로 내보내 Local의 `IDE/` 폴더에 압축 해제할 수 있습니다. 로컬 ComfyUI, 서버 업로드, 음악 스캔은 지원하지 않습니다. 임의의 사용자 지정 모델 URL은 기본적으로 비활성화되어 있으며, 같은 브라우저 프로필에서는 Cloud 탭 하나만 활성화됩니다.

**Cloud 소스 로컬 실행:** Node.js 24 설치 후 `npm ci` 및 `npm run dev`를 실행하고 `http://localhost:3000`을 여세요. **Cloud API 키는 `.env.local`이 아닌 브라우저 설정 센터에서 입력합니다.**

---

## Development & documentation

- **Branches:** develop on `dev`, run automated checks, then promote reviewed changes to `main`; `main` deploys the public Cloud site.
- **Cloud beta:** same-origin API guard and bounded request bodies; client-only sessions and virtual IDE. No shared authenticated server-side user storage.
- **Tests:** `npm ci`, `npm run test:cloud-bootstrap`, `npm run test:cloud-ide`, `npm run test:cloud-api`, `npm run test:cloud-vault`, `npm run test:cloud-single-tab`, `npx tsc --noEmit`, `npm run build`. GitHub Actions runs the suite for `dev`, `main` and pull requests to `main`.
- **Guides:** [Cloud documentation index](docs/README.md) · [Development](docs/development.md) · [API keys](docs/cloud-provider-setup.md) · [Browser storage](docs/cloud-data-and-backups.md) · [Virtual IDE](docs/cloud-virtual-ide.md) · [Five-language QA](docs/localization.md) · [Security](SECURITY.md).
- **Scope:** hosted AI requests require network access; Cloud is not offline inference. The five-language UI has not yet received complete real-device end-to-end acceptance.
- **Rights:** the code is [AGPL-3.0](LICENSE); official visual identity follows [BRANDING.md](BRANDING.md) and [TRADEMARKS.md](TRADEMARKS.md). This is an unofficial fan project; third-party characters and works belong to their respective rights holders.

