var express = require('express');
var mongoose = require('mongoose'); 
var morgan = require('morgan');
var bodyParser = require('body-parser');
var multer  = require('multer');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var ECT = require('ect');
var twilio = require('twilio');
var csrf = require('csurf');
var path = require('path');
var fs = require('fs-extra');
var Lottery = require(__dirname + '/models/lottery');
var Phone = require(__dirname + '/models/phone');
var display_phone_number = require(__dirname + '/common/display_phone_number');
var update_voice_url = require(__dirname + '/common/update_voice_url');
var save_and_redirect = require(__dirname + '/common/save_and_redirect');
var format_phone_number = require(__dirname + '/common/format_phone_number');
var get_candidate_count = require(__dirname + '/common/get_candidate_count');
var shuffle = require(__dirname + '/common/shuffle');
var phone_call = require(__dirname + '/common/phone_call');
var speak_error_message = require(__dirname + '/common/speak_error_message');
var send_xml = require(__dirname + '/common/send_xml');
var send_sms = require(__dirname + '/common/send_sms');
var hangup = require(__dirname + '/common/hangup');
var clear_all = require(__dirname + '/common/clear_all');
var delete_mp3 = require(__dirname + '/common/delete_mp3');

/* configuration */
var app = express();

// Cookie
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());

// MongoDB
var connectionString = process.env.CUSTOMCONNSTR_MONGOLAB_URI;
mongoose.connect(connectionString);

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'what do you plan to do?',
  mongoose_connection: mongoose.connections[0],
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

// Logs
if (app.get('env') == 'production') {
  app.use(morgan("dev", {}));
} else {
  app.use(morgan("dev", { format: 'dev', immediate: true }));
}

// File upload
app.use(multer({
  dest: "./public/files/"
}));

/* configuration */

/* Application */

//Auth TokenやAccoutn SIDを入力するトップページ
app.get('/', function (req, res) {
  res.render('index', { title: 'Twilio抽選アプリ', csrf: req.csrfToken(), message: "" });
});

//汎用エラーページ
app.get('/error', function(req, res){
  res.render('error', {title: 'Twilio抽選アプリ', message: req.session.message});
  req.session.message = null;
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

  if(!number || (!voice_text && !voice_file)){
    var message = "電話番号とテキストまたはMP3は必須項目です。";
    if(mode == "trial"){
      res.json({error: true, message: message});
    }else{
      req.session.message = message;
      res.redirect('/error');
    }
  }else{
    function random(){
      return Math.random().toString(32).substr(4);
    }
    function generate(){
      //var token = random() + random();
      var token = random();
      Lottery.where({token: token}).count(function(err, count){
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
                save_and_redirect(req, res, sid, auth_token, number, generated_token, voice_text, req.files.voice_file.path, mode);
              }else{
                save_and_redirect(req, res, sid, auth_token, number, generated_token, voice_text, req.files.voice_file.path, mode);
              }
            });
          }else{
              save_and_redirect(req, res, sid, auth_token, number, generated_token, voice_text, null, mode);
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
  }
});

app.get('/token', function(req, res){
  if(req.xhr){
    res.json({csrf: req.csrfToken()});  
  }
});

//電話番号別抽選ページ
app.get('/l/:token', function(req, res){
  var lottery = new Lottery();
  Lottery.find({token: req.param('token')}, function(err, docs){
    var message;
    if(err || docs.length <= 0){
      message = "";
      req.session.message = "指定された抽選は受付期間が終了しました。";
      res.redirect('/error');
    }else{
      get_candidate_count({token: docs[0].token}, function(num){
        res.render('lottery', {title: 'Twilio抽選アプリ', number: display_phone_number('+'+docs[0].phone_number), message: message, num: num, token: docs[0].token, csrf: req.csrfToken(), finished: 0});  
      });
    }
  });
});

// 応募者数
app.get('/candidates', function(req, res){
  get_candidate_count({token: req.param('id')}, function(num){
    res.json({num: num});
  });
});
//当選者数
app.get('/winners', function(req, res){
  get_candidate_count({status: 'won', token: req.param('id')}, function(num){
    res.json({num: num});
  });
});

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
          args.status = {'$ne': 'won'};
        }//else{
          //clear_all(req.param('token'));
        //}
        Phone.find(args, function(err, docs){
          if(err){
            res.json({success: false, message: "データベースにエラーが発生しました"});
          }else{
            if(docs.length <= 0){
              res.json({success: false, message: "応募者が見つかりませんでした"});
            }else if(docs.length < num){
              res.json({success: false, message: "応募者数が当選者数より少ないため実行できません"});
            }else{
              // 当選やり直し処理
              // 当選処理開始
              lotteries[0].action_status = 'calling';
              lotteries[0].call_session = lotteries[0].call_session + docs.length;
              lotteries[0].save(function(e){
                if(e){
                  res.json({success: false, message: "データベースにエラーが発生しました"});
                }else{
                  var start_phone_call = function(){
                    var data = shuffle(docs);
                    var max = req.param('num');
                    for(var i = 0, len = data.length; i < max; i++){
                      data[i].status = 'calling';
                      phone_call(req, {data: data[i], lottery: lotteries[0]});
                    }
                  };
                  if(!req.param('no_dup')){
                    clear_all(docs, start_phone_call);
                  }else{
                    start_phone_call();
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
app.post('/call/:token', function(req, res){
  var resp = new twilio.TwimlResponse();
  validateToken(req, res, req.param('AccountSid'), req.param('To'), function(e){
    Lottery.find({token: req.param('token')}, function(err, docs){
      if(err){
        speak_error_message(res, "エラーが発生しました。通話を終了します");
      }else{
        var l = docs[0];
        if(l.voice_file){
          send_xml(res, resp.play(req.protocol + "://" + req.hostname + "" + l.voice_file.replace(/public/, '').replace(/\\/g, '/')));
        }else{
          speak_error_message(res, l.voice_text);
        }
      }
    });
  });
});

//Ajaxで当選者情報を受け取る
app.get('/s/:token', function(req, res){
  Lottery.find({token: req.param('token')}, function(err, lotteries){
    if(!err){
      var lottery = lotteries[0];
      Phone.where('token', req.param('token')).where({status: {'$ne': null}}).exec(function(err, docs){
        var data = [];
        for(var i = 0, l = docs.length; i < l; i++){
          data.push({status: docs[i].status, phone_number: docs[i].phone_number, callstatus: docs[i].callstatus});
        }
        res.json({data: data, lottery: lottery});
      });
    }else{
      res.json({data: [], lottery: null});
    }
  });
});

// 終了
app.post('/destroy/:token', function(req, res){
  // 抽選データ削除
  Lottery.find({token: req.param('token')}, function(err, docs){
    if(!err){
      for(var i = 0, len = docs.length; i < len; i++){
        delete_mp3(docs[i]);
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

//Twilioからのリクエストかチェック
function validateToken(req, res, sid, to, callback, error){
  //callback();
  //Lottery.find({phone_number: format_phone_number(to)}, function(err, docs){
  //  if(err || docs.length <= 0){
  //    speak_error_message(res, "指定された番号("+format_phone_number(to)+")が見つかりませんでした");
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

//着電するとTwilioから呼び出される
app.post('/twilio', function(req, res){
  //speak_error_message(res, "こんにちは");
  validateToken(req, res, req.param('AccountSid'), req.param('From'), function(e){
    //Toからアプリケーションとユーザを検索
    Lottery.find({phone_number: format_phone_number(req.param('To'))}, function(err, docs){
      if(err || docs.length <= 0){
        //見つからなかったらエラー処理
        speak_error_message(res, 'おかけになった電話番号は既に抽選が終了しているか、登録されていないためご利用できません');
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
            if(phone.status == 'trial'){
              //SMS送信
              var url = req.hostname + "/l/" + lottery_data.token;
              var body = "抽選アプリのURLは "+ url +" です。画面を閉じてしまった時にご利用下さい。";
              send_sms(lottery_data.account_sid, lottery_data.auth_token, body,  lottery_data.sms_phone_number, req.param('From'));

              if(lottery_data.voice_file){
                send_xml(res, resp.play(req.protocol + "://" + req.hostname + "" + lottery_data.voice_file.replace(/public/, '').replace(/\\/g, '/'), {loop: 3}));
              }else{
                speak_error_message(res, lottery_data.voice_text);
                //send_xml(res, resp.say(lottery_data.voice_text));
              }
            }else{
              if(lottery_data.sms_phone_number){
                speak_error_message(res, 'お申し込みを受け付けました。ご契約キャリアおよび電波状況によりSMS到着しない場合がございます。');
              }else{
                speak_error_message(res, 'お申し込みを受け付けました');
              }
              //SMS送信
              send_sms(lottery_data.account_sid, lottery_data.auth_token, "抽選登録が終了いたしました。抽選開始までしばらくお待ちください。",  lottery_data.sms_phone_number, req.param('From'));
            }
          }else{
            //２回目ならキャンセル処理（過去の履歴は削除）
            //IVRに変更予定
            for(var k = 0, l = p_docs.length; k < l; k++){
              p_docs[k].remove();
            }
            speak_error_message(res, 'お申し込みをキャンセルしました');
            send_sms(lottery_data.account_sid, lottery_data.auth_token, "抽選登録を解除しました。",  lottery_data.sms_phone_number, req.param('From'));
          }
        });
      }
    });
  }, function(e){
    speak_error_message(res, e);
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
  Phone.find({phone_number: format_phone_number(req.param('To')), token: req.param('token')}, function(err, docs){
    if(!err && docs.length > 0){
      docs[0].callstatus = req.param('CallStatus');
      docs[0].status = 'error';
      docs[0].save();
    }
  });
  Lottery.find({token: req.param('token')}, function(err, docs){
    docs[0].call_session = docs[0].call_session - 1;
    docs[0].save();
  });
  hangup();
});

//システムから発信した通話が終了した
app.post('/status/:token', function(req, res){
  Phone.find({phone_number: format_phone_number(req.param('To')), token: req.param('token')}, function(err, docs){
    if(!err && docs.length > 0){
      docs[0].callstatus = req.param('CallStatus');
      docs[0].save();
    }
  });
  Lottery.find({token: req.param('token')}, function(err, docs){
    docs[0].call_session = docs[0].call_session - 1;
    docs[0].save();
  });
  //Hangupを返す
  hangup();
});

//通話を中止する
app.post('/stop/:token', function(req, res){
  Lottery.find({token: req.param('token')}, function(e, ls){
    if(!e && ls.length > 0){
      var client = new twilio.RestClient(ls[0].account_sid, ls[0].auth_token);
      Phone.find({token: req.param('token')}, function(err, docs){
        if(!err){
var sids = "";
          for(var i = 0, l = docs.length; i < l; i++){
            if(docs[i].callsid){
sids += ":" + docs[i].callsid;
              client.calls(docs[i].callsid).update({status: 'completed'}, function(err, call){
                if(!err){
                  docs[i].callstatus = 'canceled';
                  docs[i].save();
                }
              });
            }
          }
          res.json({error: false, message: sids});
        }else{
          res.json({error: true, message: "該当する番号が見つかりませんでした"});
        }
      });
    }else{
      res.json({error: true, message: "該当する抽選が見つかりませんでした"});
    }
  });
});

// Here we go!
app.listen(process.env.PORT || 3000);
