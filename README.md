# Follow As

X.com のプロフィールページに「@サブアカウント としてフォロー」ボタンを追加する Chrome 拡張機能。メインアカウントでブラウジングしながら、サブアカウントとしてフォロー/アンフォローをワンクリックで実行できる。

## 仕組み

```
Chrome拡張 (content script)
  ↓ chrome.runtime.sendMessage
Service Worker (background.js)
  ↓ chrome.runtime.connectNative
Native Messaging Host (Node.js)
  ↓ child_process.execFile
xurl (X公式CLI) → X API
```

- **Chrome拡張 (MV3)**: X.com のプロフィールページにフォローボタンを注入
- **Native Messaging Host**: Chrome拡張から xurl コマンドを呼び出す中継
- **xurl**: X Developer Platform 公式 CLI。OAuth 1.0a でサブアカウントとして API 実行

## セットアップ

### 前提

- Node.js
- [xurl](https://github.com/xdevplatform/xurl) インストール済み・パスが通っていること
- X Developer Portal でアプリ作成済み（OAuth 1.0a のキー4つ取得済み）

### 1. xurl 認証

```bash
xurl auth oauth1 \
  --consumer-key YOUR_CONSUMER_KEY \
  --consumer-secret YOUR_CONSUMER_SECRET \
  --access-token YOUR_ACCESS_TOKEN \
  --token-secret YOUR_TOKEN_SECRET
```

動作確認:

```bash
xurl /2/users/me
```

### 2. Native Messaging Host 登録

```bat
cd native-host
install.bat
```

`HKCU\Software\Google\Chrome\NativeMessagingHosts\com.follow_as.host` にマニフェストパスが登録される。

### 3. Chrome 拡張読み込み

1. `chrome://extensions` を開く
2. 「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」→ `extension/` フォルダを選択
4. 表示される拡張 ID をコピー

### 4. allowed_origins 更新

`native-host/manifest.json` の `allowed_origins` を自分の拡張 ID に書き換える:

```json
"allowed_origins": ["chrome-extension://YOUR_EXTENSION_ID/"]
```

書き換え後、Chrome 拡張をリロード。

## 構成

```
extension/
  manifest.json      # Chrome拡張マニフェスト (MV3)
  background.js      # Service Worker: Native Host通信 + フォローキャッシュ管理
  content.js         # X.comプロフィールにボタン注入
  content.css        # ボタンスタイル
  popup/
    popup.html       # ポップアップUI
    popup.js

native-host/
  manifest.json      # Native Messaging Host マニフェスト
  host.js            # stdin/stdout JSON通信 → xurl実行
  host.bat           # Node.js起動ラッパー
  install.bat        # Windowsレジストリ登録
```

## 制約・注意

- Windows 専用（Native Host が `.bat` + レジストリ登録）
- サブアカウントは1つ固定（xurl の認証情報に紐づく）
- フォローリストは拡張起動時に1回取得してキャッシュ（ポップアップから手動リフレッシュ可）
- X API レートリミット: Follow/Unfollow は 50 リクエスト / 15分 / ユーザー
