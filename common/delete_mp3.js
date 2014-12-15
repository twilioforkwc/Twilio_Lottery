var path = require('path');
var fs = require('fs-extra');
module.exports = function(doc){
  if(doc.voice_file){
    fs.unlink(doc.voice_file, function(e){
      console.log(e);
    });
  }  
};
