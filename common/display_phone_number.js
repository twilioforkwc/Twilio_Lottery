module.exports = function(number){
  return number.replace(/\+81/, '0').replace(/^0120/, '0120-').replace(/0120-([\d][\d][\d])([\d][\d][\d])/, function(str, p1, p2, offset, s){return '0120-' + p1 + '-' + p2;}).replace(/^050/, '050-').replace(/050-([\d][\d][\d][\d])([\d][\d][\d][\d])$/, function(str, p1, p2, offset, s){
    return '050-' + p1 + "-" +  p2;
  });
};

