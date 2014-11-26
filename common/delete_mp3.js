var path = require('path');
var fs = require('fs-extra');
module.exports = function(doc){
  if(doc.voice_file){
    console.log(doc.voice_file); 
  }  
};
