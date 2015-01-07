var fs = require('fs');
var http = require('http');

var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var port = config['port'];

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Test... WIP');
}).listen(port, '127.0.0.1');
console.log('HTTP Server running on port ' + port);