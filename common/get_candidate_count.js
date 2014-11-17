var Phone = require(__dirname + '/../models/phone');
module.exports = function(args, callback){
  var num = 0;
  Phone.where(args).count(function(err, count){
    if(count){
      num = count;
    }
    callback(num);
  });
};
