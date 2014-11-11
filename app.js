var express = require('express');
var mongoose = require('mongoose'); 
var morgan = require('morgan');
var bodyParser = require('body-parser');
var multer  = require('multer');
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
var csrfExc = ['/twilio', '/fallback', '/status', '/l', '/select', '/call', '/deb']; //API calls
app.use(function(req, res, next){
console.log(req.path);
  if(csrfExc.indexOf(req.path) !== -1){
    next();
  }else if(req.path.match(/^\/(call|fallback|status)\//)){
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

function display_phone_number(number){
  return number.replace(/\+81/, '0').replace(/^0120/, '0120-').replace(/0120-([\d][\d][\d])([\d][\d][\d])/, function(str, p1, p2, offset, s){return '0120-' + p1 + '-' + p2;}).replace(/^050/, '050-').replace(/050-([\d][\d][\d][\d])([\d][\d][\d][\d])$/, function(str, p1, p2, offset, s){
    return '050-' + p1 + "-" +  p2;
  });
}

app.get('/start', function(req, res){
  //アップグレードアカウントなら利用可能な電話番号リストを作成
  var option_data = [];
  var sms_option_data = [];
  var sid = req.session.sid;
  var auth_token = req.session.auth_token;
  var client = new twilio.RestClient(sid, auth_token);
  client.incomingPhoneNumbers.list(function(err, numbers){
    if(!err){
      numbers.incomingPhoneNumbers.forEach(function(number){
        option_data.push('<option value="'+number.phone_number+'">' + display_phone_number(number.phone_number) + '</option>');
        if(number.capabilities.sms){
          sms_option_data.push('<option value="'+number.phone_number+'">' + display_phone_number(number.phone_number) + '</option>');
        }
      });
      var options = option_data.join('');
      var sms_options = sms_option_data.join('');
      res.render('start', {title: 'Twilio抽選アプリ', options: options, sms_options: sms_options, csrf: req.csrfToken()}); 
    }else{
      res.render('error', {title: 'Twilio抽選アプリ', message: err.message}); 
    }
  });
});

function updateVoiceUrl(req, to, sid, auth_token, callback){
console.log(to);
console.log(sid);
console.log(auth_token);
  var client = new twilio.RestClient(sid, auth_token);
  client.incomingPhoneNumbers.list({ phoneNumber: to }, function(err, data) {
    if(err || !data.incomingPhoneNumbers){
     if(!err){
      err = {message: "data is null("+to+")"}; 
     }
     callback(err, null); 
    }else{
      var number = data.incomingPhoneNumbers[0];
      client.incomingPhoneNumbers(number.sid).update({
        voiceUrl: req.protocol + "://" + req.hostname + '/twilio'
      }, function(err, num){
        console.log(num);
        callback(err, num);
      });
    }
  });
}

function saveAndRedirect(req, res, sid, auth_token, number, generated_token, voice_text, file_path, mode){
  var lottery = new Lottery();
  lottery.account_sid = sid;
  lottery.auth_token = auth_token;
  lottery.createdAt = new Date();
  lottery.phone_number = format_phone_number(number);
  lottery.sms_phone_number = format_phone_number(req.param('sms_phone_number'));
  lottery.token = generated_token;
  lottery.voice_file = file_path;
  lottery.voice_text = voice_text;
  lottery.mode = mode;
  lottery.save(function(err){
    if(err){
      res.json({success: false, message: 'データを保存できませんでした'});
    }else{
      updateVoiceUrl(req, number, sid, auth_token, function(err, num){
        if(err){
          res.json({success: false, message: err.message});
        }else{
          switch(mode){
            case "trial":
              res.json({success: true, message: display_phone_number(number) + 'に電話をかけてください', debug: lottery});
              break;
            default:
              res.json({success: true, message: display_phone_number(number) + 'に電話をかけてください', url: '/l/' + generated_token});
              break;
          }
        }
      });
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
//TODO
//var client = new twilio.RestClient(docs[0].account_sid, docs[0].auth_token);
//client.incomingPhoneNumbers.list({ phoneNumber: '+815031596448' }, function(err, data) {
//  if(err || !data.incomingPhoneNumbers){
//    if(!err){
//      err = {message: "data is null(+815031596448)"}; 
//    }
//    console.log(data);
//    console.log(err);
//  }else{
//    console.log(data.incomingPhoneNumbers);
//  }
//});
//
//
    getCandidateCount({token: docs[0].token}, function(num){
      res.render('lottery', {title: 'Twilio抽選アプリ', number: display_phone_number('+'+docs[0].phone_number), message: message, num: num, token: docs[0].token, csrf: req.csrfToken()});  
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
  getCandidateCount({status: 'won', token: req.param('id')}, function(num){
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
        }else{
          args.status = {'$ne': 'won'};
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
                  res.json({success: false, message: "データベースにエラーが発生しました"});
                }else{
                  var data = shuffle(docs);
                  var max = req.param('num');
                  for(var i = 0, len = data.length; i < max; i++){
                    data[i].status = 'calling';
                    phoneCall(req, {data: data[i], lottery: lotteries[0]});
                  }
                }
              });
              res.json({success: true, message: "当選者に電話しています。しばらくお待ち下さい。"});
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
    url: req.protocol + "://" + req.hostname + '/call/' + args.lottery.token,
    fallbackUrl: req.protocol + "://" + req.hostname + '/fallback/' + args.lottery.token,
    statusCallback: req.protocol + "://" + req.hostname + '/status/' + args.lottery.token
  }, function(err, call){
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
  validateToken(req, res, req.param('AccountSid'), req.param('To'), function(e){
    Lottery.find({token: req.param('token')}, function(err, docs){
      if(err){
        speakErrorMessage(res, "エラーが発生しました。通話を終了します");
      }else{
        var l = docs[0];
        if(l.voice_file){
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
  Phone.where('token', req.param('token')).where('status', 'calling').where('status', 'won').where('status', 'error').exec(function(err, docs){
    var data = [];
    for(var i = 0, l = docs.length; i < l; i++){
      data.push({status: docs[i].status, phone_number: docs[i].phone_number});
    }
    res.json({data: data});
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
function validateToken(req, res, sid, to, callback, error){
  //callback();
  //Lottery.find({phone_number: format_phone_number(to)}, function(err, docs){
  //  if(err || docs.length <= 0){
  //    speakErrorMessage(res, "指定された番号("+format_phone_number(to)+")が見つかりませんでした");
  //  }else{
  //    var doc = docs[0];
      callback();
      //if (twilio.validateExpressRequest(req, doc.auth_token)){
      //  callback();
      //}else{
      //  error('エラーが発生しました');
      //}
  //  }
  //});
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
  validateToken(req, res, req.param('AccountSid'), req.param('From'), function(e){
    //Toからアプリケーションとユーザを検索
    Lottery.find({phone_number: format_phone_number(req.param('To'))}, function(err, docs){
      if(err || docs.length <= 0){
        //見つからなかったらエラー処理
        speakErrorMessage(res, 'おかけになった電話番号は既に抽選が終了しているか、登録されていないためご利用できません');
      }else{
        //見つかったら通話履歴チェック
        var lottery_data = docs[0];
        Phone.find({token: lottery_data.token, phone_number: format_phone_number(req.param('From'))}, function(err, p_docs){
          if(err || p_docs.length <= 0){
            //履歴が見つからなければ履歴保存
            var phone = new Phone();
            phone.phone_number = format_phone_number(req.param('From'));
            if(docs[0].mode == 'trial'){
              phone.status = 'trial';
            }else{
              //お試し以外は保存
              phone.token = lottery_data.token;
              phone.save();
            }
            //指定された方法で返信を開始
            var resp = new twilio.TwimlResponse();
            //SMS送信
            var client = new twilio.RestClient(lottery_data.account_sid, lottery_data.auth_token);
            client.messages.create({
//  var client = new twilio.RestClient('AC9f7b0b7ee516c2fa051478118208b1fc', '7a7fb4c0a1dec149fa6ad09282c98bc6');
              body: req.protocol + "://" + req.hostname + "/l/" + lottery_data.token,
              to: req.param('From'),
              from: '+' + lottery_data.sms_phone_number
            }, function(err, message){
              console.log(message);
            });
            if(phone.status == 'trial'){
              if(lottery_data.voice_file){
                sendXml(res, resp.play(req.protocol + "://" + req.hostname + "" + lottery_data.voice_file.replace(/public/, '').replace(/\\/g, '/')));
              }else{
                speakErrorMessage(res, lottery_data.voice_text);
                //sendXml(res, resp.say(lottery_data.voice_text));
              }
            }else{
              speakErrorMessage(res, 'お申し込みを受け付けました');
            }
          }else{
            //２回目ならキャンセル処理（過去の履歴は削除）
            for(var k = 0, l = p_docs.length; k < l; k++){
              switch(p_docs[k].status){
                case "won":
                  //当選済みなのでキャンセルできない
                  break;
                case "calling":
                  //通話中なのでキャンセルしないで
                  break;
                default:
                  p_docs[k].remove();
                  break;
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

//応募者から受信した通話が異常終了した
app.post('/incoming/fallback/:token', function(req, res){

});

//応募者から受信した通話が終了した
app.post('/incoming/status/:token', function(req, res){

});

//システムから発信した通話がエラーになった
app.post('/fallback/:token', function(req, res){
  Phone.find({phone_number: req.param('To')}, function(err, docs){

  });
});
//システムから発信した通話が終了した
app.post('/status/:token', function(req, res){

});

//app.get('/debug', function(req, res){
//  var message = "";
//  var client = new twilio.RestClient('AC9f7b0b7ee516c2fa051478118208b1fc', '7a7fb4c0a1dec149fa6ad09282c98bc6');
//  client.makeCall({
//    to: '+' + '818054694667',
//    from: '+' + '815031596333',
//    url: 'http://twilio-lottery.azurewebsites.net/deb'
//  }, function(err, call){
//    if(err){
//      message = "エラー";
//    }else{
//      message = 'ok';
//    }
//    res.json({message: message});
//  });
//});
//
//app.post('/deb', function(req, res){
//  speakErrorMessage(res, "テストです");
//});

// Here we go!
app.listen(process.env.PORT || 3000);
