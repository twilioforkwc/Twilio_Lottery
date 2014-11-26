module.exports = function(docs, callback){
  for(var i = 0, l = docs.length; i < l; i++){
    docs[i].status = "";
    docs[i].save();
  }
  callback();
};
