var format_phone_number = require(__dirname + '/format_phone_number');
var update_voice_url = require(__dirname + '/update_voice_url');
var display_phone_number = require(__dirname + '/display_phone_number');
var Lottery = require(__dirname + '/../models/lottery');
module.exports = function(req, res, sid, auth_token, number, generated_token, voice_text, file_path, mode){
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
  lottery.call_session = 0;
  lottery.save(function(err){
    if(err){
      res.json({success: false, message: 'データを保存できませんでした'});
    }else{
      update_voice_url(req, number, sid, auth_token, function(err, num){
        if(err){
          res.json({success: false, message: err.message});
        }else{
          switch(mode){
            case "trial":
              res.json({success: true, message: display_phone_number(number), debug: lottery});
              break;
            default:
              res.json({success: true, message: display_phone_number(number), url: '/l/' + generated_token});
              break;
          }
        }
      });
    }
  });
};

