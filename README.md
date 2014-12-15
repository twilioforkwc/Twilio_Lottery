# README #

# 「Twilio 抽選アプリ」 #

### このレポジトリについて ###

* 「Twilio 抽選アプリ」とは？
* イベントシーズンに最適な、電話での抽選が簡単に行えるアプリケーションです。
* Twilio のアカウントがあれば、たったの 3 ステップで開始できます。
* 
* GitHubにソースコードをアップ致しましたので、ご自身で好きなように変更してご利用下さい。
* 
* 現在ご利用いただけるパッケージの詳しい使い方は、下記URLをご覧ください。ご利用いただくためにはTwilioのアカウントが必要です。 
* [詳しい使い方](hhttp://twilio.kddi-web.com/solutions/lottery/)

### 制限事項 ###
* 本アプリではTwilioのサービスを使っているため発信・受信等はTwilioの制限事項に準拠します。
* 詳しくは[Twilio FAQ](https://twilioforkwc.zendesk.com/entries/23660047-Twilio%E3%81%8B%E3%82%89%E7%99%BA%E4%BF%A1%E3%81%A7%E3%81%8D%E3%81%AA%E3%81%84%E9%9B%BB%E8%A9%B1%E7%95%AA%E5%8F%B7%E3%81%AF%E3%81%82%E3%82%8A%E3%81%BE%E3%81%99%E3%81%8B-)をご覧ください。
* We don't support non-Japanese language at this point, if you'd like to change the language please do it by yourself.

### Twilioとは ###
* Twilio はたった数行のコードでネットと電話・SMSをつなげる API です。
* 電話の発信・受信、SMSの送受信、アプリ（iPhone/Android）・ブラウザ からの音声受信・発信を組み合わせていろいろなサービスに組み込めます。
* 初期費用・保守費用はなく、使った分だけのお支払いなので余分な費用は必要ありません。

### Twilioアカウントの取得方法 ###
* 下記URLの「Twilioアカウントの取得」をご覧ください。
* (http://twilio.kddi-web.com/solutions/excel/use.html)

### 動作環境 ###
* Windows Azure Website + Mongolab(MARKETPLACE) + Node.js
* いずれのプラン、無料期間内 でもご利用いただけます。
* Mongolab の設定が必要です
* [詳しくはこちら](http://azure.microsoft.com/ja-jp/services/websites/)

## はじめかた ##
* Github - twilioforkwcの[Twilio_Lottery](https://github.com/twilioforkwc/Twilio_Lottery) のクローンをご自身のGithubにCloneを作成
* Windows Azure のサインアップ
* MARKETPLACE から MongoLab Sandbox 0 INR/month を契約(執筆時は無料)
* "mongodb://"から始まる接続文字列を取得
* Windows Azure Websiteを1つ作成
* 構成 > 接続文字列 > 名前 > MONGOLAB_URI を入力
* 構成 > 接続文字列 > 値 > 先ほど取得した"mongodb://"から始まる接続文字列 を入力
* 保存
* ダッシュボード > ソール管理からのデプロイ設定 > GitHub を選択
* ご自身のGitHubアカウント 認証情報を入力
* Twilio_Lottery のソースを選択
* デプロイ完了
* 再起動
* 該当のウェブサイトを開く

### 連絡先 ###
* [Twilio For KDDI Web Communications ウェブサイト](http://twilio.kddi-web.com/)からお問い合わせ下さい。

### プロジェクトに参加するには ###
* 必ずテストを追加してください
* Pull Requestのレビューが完了したらmergeされます
* [その他ガイドラインはこちら](http://twilio.kddi-web.com/solutions/excel/use.html)

### ライセンス ###
* [MITライセンス](http://opensource.org/licenses/MIT)
