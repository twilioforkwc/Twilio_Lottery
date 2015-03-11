var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var HistorySchema = new Schema({
  numbers: { type: Number},
  createdAt: { type: Date, "default": Date.now }
});

module.exports = mongoose.model('HistoryModel', HistorySchema);

