var twilio = require('twilio');
module.exports = function(sid, token, body, from, to){
  var client = new twilio.RestClient(sid, token);
  client.messages.create({
    body: body,
    to: to,
    from: '+' + from
  }, function(err, message){
    console.log(message);
  });
};
