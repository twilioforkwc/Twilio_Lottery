module.exports = function(docs, callback){
  for(var i = 0, l = docs.length; i < l; i++){
    docs[i].status = "";
    docs[i].callstatus = "";
    docs[i].save();
  }
  callback();
};
