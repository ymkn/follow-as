# AGENTS.md

## OVERVIEW

Chrome拡張(MV3) + Native Messaging Host。X.comプロフィールページにサブアカウントとしてのフォローボタンを注入し、xurl CLI経由でX APIを叩く。

## STRUCTURE

```
follow-as/
├── extension/           # Chrome拡張本体 (MV3)
│   ├── manifest.json    # permissions: nativeMessaging, storage
│   ├── background.js    # Service Worker: Native Host通信 + フォローキャッシュ
│   ├── content.js       # X.comプロフィールにボタン注入 (DOM操作)
│   ├── content.css      # 注入ボタンのスタイル
│   └── popup/           # 拡張ポップアップUI
│       ├── popup.html
│       └── popup.js
├── native-host/         # Native Messaging Host (Node.js)
│   ├── manifest.json    # NMH登録マニフェスト (allowed_origins に拡張ID)
│   ├── host.js          # stdin/stdout JSON通信 → xurl実行
│   ├── host.bat         # Node.js起動ラッパー
│   └── install.bat      # Windowsレジストリ登録スクリプト
└── README.md
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| ボタンUI変更 | `extension/content.js` + `extension/content.css` |
| API通信ロジック | `extension/background.js` (chrome.runtime.connectNative) |
| xurl呼び出し | `native-host/host.js` (child_process.execFile) |
| 権限追加 | `extension/manifest.json` |
| NMH設定 | `native-host/manifest.json` (path, allowed_origins) |

## CONVENTIONS

- ビルドツールなし。生JS/CSS直書き
- バンドラー不使用。各ファイルが最終成果物
- Node.js依存はnative-hostのみ（標準ライブラリのみ使用、npm不使用）

## ANTI-PATTERNS

- `node_modules` 導入禁止（native-hostは標準ライブラリのみ）
- content scriptで直接API呼び出し禁止（必ずbackground.js経由）
- manifest.jsonのhost_permissionsにワイルドカード禁止

## COMMANDS

```bash
# Native Host登録 (Windows, 管理者不要)
cd native-host && install.bat

# 拡張読み込み: chrome://extensions → デベロッパーモード → extension/ を選択
```

## NOTES

- Windows専用（.bat + レジストリ）
- `native-host/manifest.json` の `path` はフルパス。環境移動時に更新必須
- `allowed_origins` の拡張IDはChromeに読み込むたびに変わりうる
- X API レートリミット: Follow/Unfollow 50req/15min/user
