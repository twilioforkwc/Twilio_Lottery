var twilio = require('twilio');
module.exports = function(res){
  var resp = new twilio.TwimlResponse();
  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(resp.hangup().toString());
};
