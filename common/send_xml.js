module.exports = function(res, resp){
  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(resp.toString());
};
