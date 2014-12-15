var twilio = require('twilio');
module.exports = function(res, message){
  var resp = new twilio.TwimlResponse();
  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(resp.say(message, {language: 'ja-jp', loop: 3}).toString());
};
