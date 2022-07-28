# Tweets-collector

## これは何？

特定のTwitterアカウントのツイート履歴をjsonファイルに保存するスクリプト

## 使い方

1. `yarn install`
1. `cp .env.placeholder .env`
1. `TWITTER_OAUTH2_CLIENT_ID`、`TWITTER_OAUTH2_CLIENT_SECRET`、`CALLBACK_URL`、`PORT`に任意の値をセット
1. `yarn node --loader ts-node/esm index.ts` or `tsc && node ./dist/index.js`
1. `Authorize by visiting this URL:` で表示されるURLでOAuth認証
1. `Type twitter username:` にTwitterのユーザー名（@から始まるもの）を入力

## 出力

`tweets/[YYYY]-[MM]-[DD]_[HH]-[mm]-[ss]_[Twitter_username].json` に保存

|プロパティ|値|
|---|---|
|`user`|ユーザーのプロフィール。|
|`tweets`|ユーザーのツイートのリスト。|

## 例

![example.gif](assets/example.gif)
