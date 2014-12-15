module.exports =  function(number){
  var num;
  if(number){
    num = number.replace(/[^\d]/g, '');
  }else{
    num = "";
  }
  return num;
};
