# README #

# 「Twilio 抽選アプリ」 #

### このレポジトリについて ###

* 「Twilio 抽選アプリ」とは？
* Excel2013から利用可能な「Officeストアアプリ」の仕組みを利用することで、Excelに電話に自動発信をする機能を追加できます。
* 公開されているソースを元にご自身で必要な機能を追加できます。
* 開発を行うことにより、Excel2013以外のオフィスアプリケーションでも動作が可能です。
* Office 365 や ローカルのファイルサーバーにマニフェスト(クライアント用設定ファイル)を設置することにより特定の組織内のみで使えるアプリにできます。
  
* Version 0.1
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
* Windows Azure Website + Mongolab(Marcket Place)
* いずれのプラン、無料期間内 でもご利用いただけます。
* [詳しくはこちら](http://azure.microsoft.com/ja-jp/services/websites/)

## はじめかた ##
* Windows Azure のサインアップ
Market Place
Windows Azure Websiteを1つ作成


config/database.yml.sampleをdatabase.ymlに変更してDBへの接続情報を記載
* config/application.yml.sampleをapplication.ymlに変更して設置するドメイン名などの設定を記載
* bundle、bundle exec rake db:create、bundle exec rake db:migrate
* Unicornを利用する場合はconfig/unicorn.rb.sampleを利用できます



### プロジェクトに参加するには ###
* 必ずテストを追加してください
* Pull Requestのレビューが完了したらmergeされます
* [その他ガイドラインはこちら](http://twilio.kddi-web.com/solutions/excel/use.html)

### ライセンス ###
* [MITライセンス](http://opensource.org/licenses/MIT)
