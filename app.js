var express = require('express');
var mongoose = require('mongoose'); 
var morgan = require('morgan');
var bodyParser = require('body-parser');
//var busboy = require('connect-busboy');
var multer  = require('multer');
//var formidable = require('formidable');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var ECT = require('ect');
var twilio = require('twilio');
var csrf = require('csurf');
var path = require('path');
var fs = require('fs-extra');

var app = express();

// Cookie
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'what do you plan to do?',
  resave: false,
  saveUninitialized: false
}));

// CSRF
var csrfExc = ['/twilio', '/fallback', '/status', '/l', '/deb']; //API calls
app.use(function(req, res, next){
console.log(req.path);
  if(csrfExc.indexOf(req.path) !== -1){
    next();
  }else{
    csrf()(req, res, next);
  }
});

// Views
app.engine('ect', ECT({ watch: true, root: __dirname + '/views', ext: '.ect' }).render);
app.set('view engine', 'ect');
app.use(express['static'](__dirname + '/public'));

// Model
var Lottery = require(__dirname + '/models/lottery');
var Phone = require(__dirname + '/models/phone');

// Logs
if (app.get('env') == 'production') {
  app.use(morgan("dev", {}));
} else {
  app.use(morgan("dev", { format: 'dev', immediate: true }));
}

// MongoDB
var connectionString = process.env.CUSTOMCONNSTR_MONGOLAB_URI;
mongoose.connect(connectionString);

// File upload
//app.use(busboy());
app.use(multer({
  dest: "./public/files/"
}));

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
          res.redirect('/start');
        }
      }
    });
  }catch(e){
    console.log(e);
    res.render('index', {title: 'Twilio抽選アプリ', csrf: req.csrfToken(), message: '認証エラー'}); 
  }
});

app.get('/start', function(req, res){
  //アップグレードアカウントなら利用可能な電話番号リストを作成
  var option_data = [];
  var sid = req.session.sid;
  var auth_token = req.session.auth_token;
  var client = new twilio.RestClient(sid, auth_token);
  client.incomingPhoneNumbers.list(function(err, numbers){
    if(!err){
      numbers.incomingPhoneNumbers.forEach(function(number){
        option_data.push('<option value="'+number.phone_number+'">' + number.phone_number + '</option>');
      });
      var options = option_data.join('');
      res.render('start', {title: 'Twilio抽選アプリ', options: options, csrf: req.csrfToken()}); 
    }else{
      res.render('error', {title: 'Twilio抽選アプリ', message: err.message}); 
    }
  });
});

function saveAndRedirect(req, res, sid, auth_token, number, generated_token, voice_text, file_path, mode){
  var lottery = new Lottery();
  lottery.account_sid = sid;
  lottery.auth_token = auth_token;
  lottery.createdAt = new Date();
  lottery.phone_number = format_phone_number(number);
  lottery.token = generated_token;
  lottery.voice_file = file_path;
  lottery.voice_text = voice_text;
  lottery.mode = mode;
console.log(lottery);
  lottery.save(function(err){
console.log(mode);
    if(err){
      res.json({success: false, message: 'データを保存できませんでした'});
    }else{
      switch(mode){
        case "trial":
          res.json({success: true, message: number + 'に電話をかけてください', debug: lottery});
          break;
        default:
          res.json({success: true, message: number + 'に電話をかけてください', url: '/l/' + generated_token});
          break;
      }
    }
  });
}

//選択された電話番号から電話番号別抽選ページを作成してリダイレクト
//modeがtrialの場合はJSONを返す
app.post('/number', function(req, res){
  var sid = req.session.sid;
  var auth_token = req.session.auth_token;
  var number = req.param('phone_number');
  var voice_text = req.param('voice_text');
  var voice_file = req.param('voice_file');
  var mode = req.param('mode');
  var generated_token;

  function random(){
    return Math.random().toString(36).substr(2);
  }
  function generate(){
    var token = random() + random();
    Lottery.where({token: generated_token}).count(function(err, count){
      if(!err && count > 0){
        generate();
        return;
      }else{
        generated_token = token;
        //MongoDBに登録
        var save_path = "";
        save_path = __dirname + "files";
        if(req.files.voice_file){
          fs.exists(req.files.voice_file.path, function(exists){
            if(exists){
              saveAndRedirect(req, res, sid, auth_token, number, generated_token, voice_text, req.files.voice_file.path, mode);
            }else{
              saveAndRedirect(req, res, sid, auth_token, number, generated_token, voice_text, req.files.voice_file.path, mode);
            }
          });
        }else{
            saveAndRedirect(req, res, sid, auth_token, number, generated_token, voice_text, null, mode);
        }
      }
    });
  }
  //同じ電話番号が登録されていたらTrialなら消して本番ならエラー
  Lottery.find({phone_number: format_phone_number(number)}, function(err, docs){
    var data =[];
    if(docs.length > 0){
      for(var i = 0, len = docs.length; i < len; i++){
        if(docs[i].mode === "trial"){
          docs[i].remove();
        }else{
          data.push(docs[i]);
        }
      }
      if(data.length > 0){
        //同じ番号で本番データがある
        res.json({error: true, message: "この番号は現在既に利用されています"});
      }else{
        generate();
      }
    }else{
      generate();
    }
  });
});

app.get('/token', function(req, res){
  if(req.xhr){
    res.json({csrf: req.csrfToken()});  
  }
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
    getCandidateCount({token: docs[0].token}, function(num){
      res.render('lottery', {title: 'Twilio抽選アプリ', message: message, num: num, token: docs[0].token, csrf: req.csrfToken()});  
    });
  });
});

function getCandidateCount(args, callback){
  var num = 0;
  Phone.where(args).count(function(err, count){
    if(count){
      num = count;
    }
    callback(num);
  });
}
function getCandidates(args, callback){
  Phone.find(args, callback);
}

// 応募者数
app.get('/candidates', function(req, res){
  getCandidateCount({token: req.param('id')}, function(num){
    res.json({num: num});
  });
});
//当選者数
app.get('/winners', function(req, res){
  getCandidateCount({status: 'win', token: req.param('id')}, function(num){
    res.json({num: num});
  });
});

function shuffle(array) {
  var counter = array.length, temp, index;
  while (counter > 0) {
      index = Math.floor(Math.random() * counter);
      counter--;
      temp = array[counter];
      array[counter] = array[index];
      array[index] = temp;
  }
  return array;
}
//当選実行
app.post('/select', function(req, res){
  Lottery.find({token: req.param('token')}, function(err, lotteries){
    if(!err && lotteries[0]){
      var num = parseInt(req.param('num'), 10);
      if(num <= 0){
        res.json({success: false, message: '当選者数を1以上の数値で指定してください'});  
      }else{
        var args = {token: req.param('token')};
        if(req.param('no_dup')){
          args.status = null;
        }
        Phone.find(args, function(err, docs){
          if(err){
            res.json({success: false, message: "データベースにエラーが発生しました"});
          }else{
            if(docs.length <= 0){
              res.json({success: false, message: "応募者が見つかりませんでした"});
            }else if(docs.length < num){
              res.json({success: false, message: "応募者数が当選者数より少ないため実行できません"});
            }else{
              // 当選処理開始
              lotteries[0].status = 'calling';
              lotteries[0].save(function(e){
                if(e){
console.log(e);
                  res.json({success: false, message: "データベースにエラーが発生しました"});
                }else{
                  var data = shuffle(docs);
                  for(var i = 0, len = data.length; i < len; i++){
                    data[i].status = 'calling';
                    phoneCall(req, {data: data[i], lottery: lotteries[0]});
                  }
                }
              });
            }
          }
        });
      }
    }else{
      res.json({success: false, message: '抽選は終了しています'});
    }
  });
});

// 当選者に電話をかける
function phoneCall(req, args){
  var client = new twilio.RestClient(args.lottery.account_sid, args.lottery.auth_token);
  client.makeCall({
    to: '+' + args.data.phone_number,
    from: '+' + args.lottery.phone_number,
    url: req.protocol + "://" + req.hostname + '/call/' + args.lottery.token + "?_csrf=" + req.csrfToken()
  }, function(err, call){
console.log(err);
console.log(args.lottery);
console.log(args.data);
    if(err){
      args.data.status = 'error';
    }else{
      args.data.status = 'won';
    }
    args.data.save();
  });
}

app.post('/call/:token', function(req, res){
  var resp = new twilio.TwimlResponse();
  validateToken(req, req.param('AccountSid'), req.param('To'), function(e){
    Lottery.find({token: req.param('token')}, function(err, docs){
      if(err){
        speakErrorMessage(res, "エラーが発生しました。通話を終了します");
      }else{
        var l = docs[0];
        if(l.voice_file){
          sendXml(res, resp.play("/" + l.voice_file));
          sendXml(res, resp.play(req.protocol + "://" + req.hostname + "" + l.voice_file.replace(/public/, '').replace(/\\/g, '/')));
        }else{
          speakErrorMessage(res, l.voice_text);
        }
      }
    });
  });
});

//Ajaxで当選者情報を受け取る
app.get('/s/:token', function(req, res){
  Phone.where('token', req.param('token')).where('status', 'calling').where('status', 'won').where('status', error).exec(function(err, docs){
    var data = [];
    for(var i = 0, l = docs.length; i < l; i++){
      data.push({status: docs[i].status, phone_number: docs[i].phone_number});
    }
    res.json(data);
  });
});

// 終了
app.post('/destroy/:token', function(req, res){
  // 抽選データ削除
  Lottery.find({token: req.param('token')}, function(err, docs){
    if(!err){
      for(var i = 0, len = docs.length; i < len; i++){
        docs[i].remove();
      }
    }
  });
  // 番号データ削除
  Phone.find({token: req.param('token')}, function(err, docs){
    if(!err){
      for(var i = 0, len = docs.length; i < len; i++){
        docs[i].remove();
      }
    }
  });
  res.json({success: true});
});

function format_phone_number(number){
  var num;
  if(number){
    num = number.replace(/[^\d]/g, '');
  }else{
    num = "";
  }
  return num;
}
//Twilioからのリクエストかチェック
function validateToken(req, sid, to, callback, error){
  //callback();
  Lottery.find({phone_number: format_phone_number(to)}, function(err, docs){
    if(err || docs.length <= 0){
      error("指定された番号("+format_phone_number(to)+")が見つかりませんでした");
    }else{
      var doc = docs[0];
      callback();
      //if (twilio.validateExpressRequest(req, doc.auth_token)){
      //  callback();
      //}else{
      //  error('エラーが発生しました');
      //}
    }
  });
}

//Twilioでエラーメッセージを話す
function speakErrorMessage(res, message){
  var resp = new twilio.TwimlResponse();
  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(resp.say(message, {language: 'ja-jp'}).toString());
}
function sendXml(res, resp){
  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(resp.toString());
}

//着電するとTwilioから呼び出される
app.post('/twilio', function(req, res){
  //speakErrorMessage(res, "こんにちは");
  validateToken(req, req.param('AccountSid'), req.param('To'), function(e){
    //Toからアプリケーションとユーザを検索
    Lottery.find({phone_number: format_phone_number(req.param('To'))}, function(err, docs){
      if(err || docs.length <= 0){
        //見つからなかったらエラー処理
        speakErrorMessage(res, 'おかけになった電話番号は既に抽選が終了しているか、登録されていないためご利用できません');
      }else{
        //見つかったら通話履歴チェック
        var lottery_data = docs[0];
//console.log(lottery_data);
        Phone.find({phone_number: format_phone_number(req.param('To'))}, function(err, p_docs){
          if(err || p_docs.length <= 0){
            //履歴が見つからなければ履歴保存
            var phone = new Phone();
            phone.phone_number = format_phone_number(req.param('To'));
            if(docs[0].mode == 'trial'){
              phone.status = 'trial';
            }
            phone.token = lottery_data.token;
//speakErrorMessage(res, "テスト"+lottery_data.token);
            phone.save();
            //指定された方法で返信を開始
            var resp = new twilio.TwimlResponse();
            if(lottery_data.voice_file){
              sendXml(res, resp.play(req.protocol + "://" + req.hostname + "" + lottery_data.voice_file.replace(/public/, '').replace(/\\/g, '/')));
            }else{
              sendXml(res, resp.say(lottery_data.voice_text));
            }
          }else{
            //２回目ならキャンセル処理（過去の履歴は削除）
            console.log(p_docs);
            for(var k = 0, l = p_docs.length; k < l; k++){
              if(p_docs[k].status == 'trial'){
                p_docs[k].remove();
              }
            }
            speakErrorMessage(res, 'お申し込みをキャンセルしました');
          }
        });
      }
    });
  }, function(e){
    speakErrorMessage(res, e);
  });
});
//通話がエラーになった
app.post('/fallback', function(req, res){

});
//Twilio通話OK
app.post('/status', function(req, res){

});

app.get('/debug', function(req, res){
  var message = "";
  var client = new twilio.RestClient('AC9f7b0b7ee516c2fa051478118208b1fc', '7a7fb4c0a1dec149fa6ad09282c98bc6');
  client.makeCall({
    to: '+' + '818054694667',
    from: '+' + '815031596333',
    url: 'http://twilio-lottery.azurewebsites.net/deb'
  }, function(err, call){
    if(err){
      message = "エラー";
    }else{
      message = 'ok';
    }
    res.json({message: message});
  });
});

app.post('/deb', function(req, res){
  speakErrorMessage(res, "テストです");
});

// Here we go!
app.listen(process.env.PORT || 3000);
