var express = require('express');
var mongoose = require('mongoose'); 
var morgan = require('morgan');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var ECT = require('ect');
var twilio = require('twilio');
var csrf = require('csurf');

var app = express();

// Cookie
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'what do you plan to do?',
  resave: false,
  saveUninitialized: false
}));

// CSRF
app.use(csrf());

// Views
app.engine('ect', ECT({ watch: true, root: __dirname + '/views', ext: '.ect' }).render);
app.set('view engine', 'ect');
app.use(express['static'](__dirname + '/public'));

// Model
var Lottery = require('models/lottery');

// Logs
if (app.get('env') == 'production') {
  app.use(morgan("dev", {}));
} else {
  app.use(morgan("dev", { format: 'dev', immediate: true }));
}

// MongoDB
var connectionString = process.env.CUSTOMCONNSTR_MONGOLAB_URI;
mongoose.connect(connectionString);

// Application
//Auth TokenやAccoutn SIDを入力するトップページ
app.get('/', function (req, res) {
  res.render('index', { title: 'Twilio抽選アプリ', csrf: req.csrfToken(), message: "" });
});

//汎用エラーページ
app.get('/error', function(req, res){
  res.render('error', {title: 'Twilio抽選アプリ', message: req.session.message});
});

//電話番号を選択して利用開始するページ
app.post('/start', function(req, res){
  // Auth Token、Account SID認証がOKなら
  try{
    var sid = req.param('account_sid');
    var auth_token = req.param('auth_token');
    var client = new twilio.RestClient(sid, auth_token);
    var account = client.accounts(sid).get(function(err, account){
      if(err){
        // 認証エラーはトップページを表示
        res.render('index', {title: 'Twilio抽選アプリ', csrf: req.csrfToken(), message: '認証エラー'}); 
      }else{
        if(account.type != 'Full'){
          //トライアルアカウントはメッセージを表示
          res.render('error', {title: 'Twilio抽選アプリ', message: 'トライアルアカウント'}); 
        }else{
          //アップグレードアカウントなら認証情報をセッションに
          req.session.sid = sid;
          req.session.auth_token = auth_token;
          //アップグレードアカウントなら利用可能な電話番号リストを作成
          var option_data = [];
          client.availablePhoneNumbers('JP').local.get({voiceEnabled: true}, function(err, numbers){
            for(var key in numbers.available_phone_numbers){
              var number = numbers.available_phone_numbers[key];
              option_data.push('<option value="'+number.phone_number+'">' + number.phone_number + '</option>');
            }
            var options = option_data.join('');
            res.render('start', {title: 'Twilio抽選アプリ', options: options, csrf: req.csrfToken()}); 
          });
        }
      }
    });
  }catch(e){
    console.log(e);
    res.render('index', {title: 'Twilio抽選アプリ', csrf: req.csrfToken(), message: '認証エラー'}); 
  }
});

//選択された電話番号から電話番号別抽選ページを作成してリダイレクト
app.post('/number', function(req, res){
  var sid = req.session.sid;
  var auth_token = req.session.auth_token;
  var number = req.param('phone_number');
  var generated_token;
  function random(){
    return Math.random().toString(36).substr(2);
  }
  function generate(){
    var token = random() + random();
    Lottery.where({token: generated_token}).count(function(err, count){
      if(!err && count > 0){
        generate();
      }else{
        generated_token = token;
        //MongoDBに登録
        var lottery = new Lottery();
        lottery.sid = sid;
        lottery.auth_token = auth_token;
        lottery.createdAt = new Date();
        lottery.phone_number = number;
        lottery.token = generated_token;
        lottery.save(function(err){
          if(err){
            req.session.message = "エラーが発生しました";
            res.redirect('/error');
          }else{
            res.redirect('/l/' + generated_token);
          }
        });
      }
    });
  }
  generate();
});

//電話番号別抽選ページ
app.get('/l/:token', function(req, res){
  var lottery = new Lottery();
  Lottery.find({token: req.params.token}, function(err, docs){
    for(var i = 0, len = docs.length; i < len; i++){
      console.log(docs[i]);
    }
    var message;
    if(err){
      message = err.message;
    }else{
      message = "";
    }
    res.render('lottery', {title: 'Twilio抽選アプリ' + req.params.token, message: message});  
  });
});

//Twilioからのリクエストかチェック
function validateToken(sid, token, callback){
  Lottery.find({token: token, accound_sid: sid}, function(err, docs){
    if(err || docs.length <= 0){
      error();
    }else{
      var doc = dos[0];
      if (twilio.validateExpressRequest(sid, doc.auth_token)){
        callback();
      }else{
        error();
      }
    }
  });
}
//着電するとTwilioから呼び出される
app.post('/twiml/:token', function(req, res){
  validateToken(req.param('AccountSid'), req.params.token, function(e){

  }, function(e){

  });
});
//通話がエラーになった
app.post('/fallback/:token', function(req, res){

});
//Twilio通話OK
app.post('/status/:token', function(req, res){

});

// Here we go!
app.listen(process.env.PORT || 3000);
