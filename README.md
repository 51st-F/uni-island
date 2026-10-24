# 統一金融島 UNI ISLAND.

一格一項服務，一座相連的金融城。

這是一張 3D 互動地圖，用一座六角格小島介紹統一綜合證券的服務與公司沿革：15 座島、62 項服務，以及跟著「一位投資人的一生」走一遍的導覽。

🔗 https://51st-f.github.io/uni-island/

> **非官方個人作品。** 本站與統一綜合證券及其關係企業沒有任何隸屬或授權關係，內容整理自[官方網站](https://www.pscnet.com.tw/pscnetStock/index.do)的公開資訊，僅供認識公司與服務之用，不構成投資建議或商品推介。商品條件、費率與最新公告，請以官網為準。資料查核日期：2026-10-24。

靈感來自 [HEART 政策島](https://puma.taipei/heart-island) 與 [恐怖島](https://taiwan-no.one/lumama/)。

## 功能

- **全景**：three.js 低多邊形 3D 島嶼，點一格就能進入那座島，查看說明、服務連結、動線與出處
- **細部介紹**：部分島嶼有「怎麼開始、注意事項、小知識」三段，每段都附官網出處
- **清單**：依五個類別（交易下單、投資商品、財富管理、專業服務、公司與永續）列出所有島
- **時間**：公司沿革時間軸，每一筆事件都附官網出處
- **導覽**：「一位投資人的一生」，共 13 站，可以暫停、切換上下站、重播（鍵盤 ← → 也能切換）
- **動線**：島與島之間的投資人動線，每一條都附一句理由
- 網址 hash 可以直接連到某座島，例如 `#port`
- 瀏覽器不支援 WebGL 時，自動改用清單呈現

## 本機執行

不需要安裝或建置，任何靜態伺服器都可以：

```bash
python3 -m http.server 8000
```

然後打開 http://localhost:8000 。資料檔用 `fetch` 載入，所以不能直接用 `file://` 開啟。

## 專案結構

```
index.html          頁面骨架、importmap（three.js 0.169.0，從 jsDelivr 載入）
css/style.css       樣式（含手機版）
js/app.js           介面、視圖切換、面板、導覽
js/scene.js         3D 場景：地形、六角格、動線、標籤、鏡頭
js/models.js        15 個程序化場景模型，不使用任何外部素材
data/island.json    所有內容：島、服務、動線、時間軸、導覽、出處
SPEC.md             規格決策與查證紀錄
```

## 修改內容

所有文字都在 [data/island.json](data/island.json)，改完重新整理頁面就能看到。

| 區塊 | 用途 |
|---|---|
| `meta` | 標題、hero 文案、免責聲明、查核日期 |
| `sources` | 出處清單，其他區塊用 `id` 引用 |
| `categories` | 五個類別與顏色 |
| `islands` | 每座島：`hex` 是六角格座標 `[q, r]`（往西 q 變小，往南 r 變大），`model` 指定 3D 模型，`items` 是服務清單，`url` 可以省略；`details`（選填）是細部介紹，含 `start`、`caution`（各為 `points` 陣列加 `sources`）與 `tip`（`title`、`body`、選填的 `table`、`sources`） |
| `edges` | 動線 `{ a, b, reason }`；`kind: "history"` 表示公司沿革線，會用紫色細線畫出 |
| `timeline` | 時間軸事件，`source` 指向 `sources` |
| `tour` | 導覽步驟，依陣列順序播放 |

新增一座島時，`model` 必須是 [js/models.js](js/models.js) 裡已有的 builder：`pier`、`bridge`、`port`、`kiosk`、`vault`、`lighthouse`、`park`、`river`、`airport`、`manor`、`umbrella`、`tower`、`postoffice`、`forest`、`orchard`。島周圍的海、沙灘、草地和東邊山脈，會依島的位置自動生成。

## 部署

推送到 `main` 後，GitHub Pages 會自動部署（Settings → Pages → Deploy from a branch → `main` / `(root)`）。根目錄的 `.nojekyll` 讓 Pages 直接提供原始檔案，不經過 Jekyll 處理。

頁面設定了 `noindex, nofollow`，不會被搜尋引擎收錄。
