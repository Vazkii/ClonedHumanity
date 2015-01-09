// =============== Modules Start
var fs = require('fs');
var app = require('express')();
var http = require('http').Server(app);
var util = require('util');
var validator = require('validator');
// =============== Modules End

// =============== Main Start
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var port = config['port'];
var timeout = config['timeout'];
var maxPlayers = config['max_players'];
var motd = config['motd'];

var io = require('socket.io')(http, {
	'close timeout': timeout,
	'heartbeat timeout': timeout
});

var responses = {
	'/': 'index.html',
	'/?css': 'ch.css',
	'/?js': 'ch_client.js'
};

app.get('/', function(req, res){
	//res.send(util.inspect(req, false, null));
	var url = req['url'];
	
	if(url in responses)
		res.sendFile(__dirname + '/public/' + responses[url]);
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
	
	// TODO IMPORTANT - Sanitize mesasge, no xss here.
	socket.on('chat-message', function(msg) {
		gameserver.onChatMessage(socket, msg);
	});
});
// =============== Main End

// =============== GameServer start
var GameServer = function() {
	this.games = [];
	this.players = {};
	this.playerCount = 0;
};
var gameserver = new GameServer();

GameServer.prototype.onConnect = function(socket) {
	console.log('Connection opened by socket with ID ' + socket.id);
	this.players[socket.id] = socket;
	this.playerCount++;
	this.sendMessageToClient(socket, '<b class="text-info">Welcome to ClonedHumanity.</b> There are <b>' + this.playerCount + '/' + maxPlayers + '</b> players online. | <b>' + 'MOTD:</b> ' + motd);
	this.sendMessageToAll('<i class="text-muted">' + socket.id + ' has logged in.</i>');
}

GameServer.prototype.onDisconnect = function(socket) {
	console.log('Connection closed socket with ID ' + socket.id);
	this.playerCount--;
	this.sendMessageToAll('<i class="text-muted">' + socket.id + ' has logged out.</i>');
	delete this.players[socket.id];
}

GameServer.prototype.onChatMessage = function(socket, msg) {
	console.log('Message from ' + socket.id + ': ' + msg);
	msg = validator.escape(msg);
	this.sendMessageToAll('<b>'  + socket.id + ':</b> '  + msg);
}

GameServer.prototype.sendMessageToAll = function(msg) {
	io.emit('chat-message', msg);
}

GameServer.prototype.sendMessageToClient = function(socket, msg) {
	socket.emit('chat-message', msg);
}
// =============== GameServer end