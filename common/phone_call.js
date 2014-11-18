var twilio = require('twilio');
module.exports = function(req, args){
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
      args.data.callsid = call.sid;
      args.data.status = 'won';
    }
    args.data.save();
  });
};
