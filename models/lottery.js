var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var expire = 2 * 60 * 60;
//TODO
expire = 1;

var LotterySchema = new Schema({
  account_sid: { type: String },
  auth_token: { type: String },
  phone_number: { type: String },
  phone_sid: { type: String },
  sms_phone_number: { type: String },
  sms_sid: { type: String },
  token: { type: String },
  mode: { type: String },
  original_voice_url: { type: String },
  voice_file: { type: String },
  voice_text: {type: String},
  action_status: {type: String},
  createdAt: { type: Date, expires: '7200s'}//TODO
});

//LotterySchema.index({createdAt: 1}, {expireAfterSeconds: expire});

module.exports = mongoose.model('LotteryModel', LotterySchema);

