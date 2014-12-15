var twilio = require('twilio');
module.exports = function(req, to, sid, auth_token, callback){
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
        callback(err, num);
      });
    }
  });
};
