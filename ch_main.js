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

var responses = {
	'/': 'index.html',
	'/?css': 'ch.css',
	'/?js': 'ch_client.js'
};

var GameServer = function() {
	this.games = [];
	this.players = {};
};
var gameserver = new GameServer();

app.get('/', function(req, res){
	//res.send(util.inspect(req, false, null));
	var url = req['url'];
	
	if(url in responses)
		res.sendFile(__dirname + '/client/' + responses[url]);
	else res.send('No known response for ' + url);
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