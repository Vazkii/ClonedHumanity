var fs = require('fs');
var app = require('express')();
var http = require('http').Server(app);

var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var port = config['port'];

app.get('/', function(req, res){
  res.sendFile(__dirname + '/client/index.html');
});

http.listen(port, function() {
	console.log('HTTP Server running on port ' + port);
});