var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var expire = 24 * 60 * 60;

var PhoneSchema = new Schema({
  phone_number: { type: String },
  token: { type: String },
  status: { type: String },
  callstatus: { type: String },
  callsid: { type: String },
  createdAt: { type: Date, expires: expire + 's' }
});

module.exports = mongoose.model('PhoneModel', PhoneSchema);

