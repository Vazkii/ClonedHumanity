// =============== Modules Start
var fs = require('fs');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var util = require('util');
// =============== Modules End

// =============== Main Start
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var port = config['port'];

var GameServer = function() {
	this.games = [];
	this.players = {};
};
var gameserver = new GameServer();

app.get('/', function(req, res){
  res.sendFile(__dirname + '/client/index.html');
});

http.listen(port, function() {
	console.log('HTTP Server running on port ' + port);
});

io.on('connection', function(socket) {
	gameserver.onConnect(socket);
	
	socket.on('disconnect', function() {
		gameserver.onDisconnect(socket);
	});
});
// =============== Main End

// =============== GameServer start
GameServer.prototype.onConnect = function(socket) {
	console.log('Connection opened by socket with ID ' + socket.id);
	this.players[socket.id] = socket;
}

GameServer.prototype.onDisconnect = function(socket) {
	console.log('Connection closed socket with ID ' + socket.id);
	delete this.players[socket.id];
}
// =============== GameServer end