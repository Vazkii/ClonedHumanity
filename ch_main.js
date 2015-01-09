// ============================================= Modules begin
var fs = require('fs');
var app = require('express')();
var http = require('http').Server(app);
var util = require('util');
var validator = require('validator');
// ============================================= Modules end

// ============================================= Main begin
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var port = config['port'];
var timeout = config['timeout'];
var maxPlayers = config['max_players'];
var motd = config['motd'];
var maxNickLength = config['max_nick_length'];

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
// ============================================= Main end

// ============================================= GameServer begin
var GameServer = function() {
	this.games = [];
	this.players = {};
	this.playerProfiles = {};
	this.usernameToSocketLookup = {};
	this.playerCount = 0;
};
var gameserver = new GameServer();

GameServer.prototype.onConnect = function(socket) {
	console.log('Connection opened by socket with ID ' + socket.id);
	this.players[socket.id] = socket;
	this.generateProfile(socket);
	
	this.playerCount++;
	this.sendMessageToClient(socket, '<b class="text-info">Welcome to ClonedHumanity.</b> There are <b>' + this.playerCount + '/' + maxPlayers + '</b> players online. | <b>' + 'MOTD:</b> ' + motd);
	this.sendMessageToAll('<i class="text-muted">' + this.getUsername(socket.id) + ' has logged in.</i>');
}

GameServer.prototype.onDisconnect = function(socket) {
	console.log('Connection closed socket with ID ' + socket.id);
	this.playerCount--;
	this.sendMessageToAll('<i class="text-muted">' + socket.id + ' has logged out.</i>');
	
	delete this.usernameToSocketLookup[this.getUsername(socket.id)];
	delete this.players[socket.id];
	delete this.playerProfiles[socket.id];
	
}

GameServer.prototype.onChatMessage = function(socket, msg) {
	console.log('Message from ' + socket.id + ': ' + msg);
	msg = msg.trim();
	
	if(msg.indexOf('/') == 0) { // Handle command
		var tokens = msg.substr(1).split(' ');
		var commandName = tokens[0].toLowerCase();
		if(commandName in commands) {
			tokens = tokens.slice(1, tokens.length);
			commands[commandName](socket, tokens);
		} else this.sendMessageToClient(socket, '<b class="text-warning">That command does not exist. Type /help for a list of commands.</b>');
	} else {
		msg = validator.escape(msg);
		this.sendMessageToAll('<b>'  + this.getUsername(socket.id) + ':</b> '  + msg);
	}
}

GameServer.prototype.generateProfile = function(socket) {
	var profile = { };
	this.playerProfiles[socket.id] = profile;
	
	//var cookieName = socket.handshake.headers['cookie'];
	this.setUsername(socket, this.generateGuestUsername());
}

GameServer.prototype.generateGuestUsername = function() {
	var user = 'Guest' + getRandomArbitrary(1000, 1999);
	if(user in this.usernameToSocketLookup)
		return this.generateGuestUsername();
		
	return user;
}

GameServer.prototype.getSocketId = function(socket) {
	return typeof socket == 'string' ? socket : socket.id;
}

GameServer.prototype.getUsername = function(socket) {
	return this.playerProfiles[this.getSocketId(socket)].username;
}

GameServer.prototype.setUsername = function(socket, name) {
	var oldName = this.getUsername(socket);
	name = name.trim();
	if(name != oldName) {
		this.playerProfiles[this.getSocketId(socket)].username = name;
	
		delete this.usernameToSocketLookup[oldName];
		this.usernameToSocketLookup[name] = socket;
		socket.emit('set-username', name);
	}
}

GameServer.prototype.getSocketForUsername = function(username) {
	return usernameToSocketLookup[username];
}

GameServer.prototype.sendMessageToAll = function(msg) {
	io.emit('chat-message', msg);
}

GameServer.prototype.sendMessageToClient = function(socket, msg) {
	socket.emit('chat-message', msg);
}
// ============================================= GameServer end

// ============================================= Commands begin
var commands = { };
var commandInfo = { };

function addCommand(name, func, desc) {
	commands[name] = func;
	commandInfo[name] = desc;
}

addCommand('help', function(socket, args) {
	var message = '<b class="text-info">ClonedHumanity command lookup:</b><br>';
	for(name in commandInfo)
		message += ('<b>/' + name + ':</b> ' + commandInfo[name] + '<br>');
	gameserver.sendMessageToClient(socket, message);
}, 'Gets info about all the registered commands.');

addCommand('ping', function(socket, args) {
	gameserver.sendMessageToClient(socket, '<b class="text-success">Pong!</b>');
}, 'Pings the server.');

addCommand('me', function(socket, args) {
	var action = args.join(' ');
	if(action.length > 0) {
		var message = '<i><b>' + gameserver.getUsername(socket.id) + '</b> ' + action + '</i>';
		gameserver.sendMessageToAll(message);
	} else gameserver.sendMessageToClient(socket, '<b class="text-warning">No mesage to send.</b>');
}, 'Does an action. Usage: <u>/me (action)</u>');

addCommand('nick', function(socket, args) {
	if(args.length > 0) {
		var nick = args.join(' ').trim();
		if(nick.length > maxNickLength) {
			gameserver.sendMessageToClient(socket, '<b class="text-warning">Your nickname can\'t be longer than ' + maxNickLength + ' characters.</b>');
			return;
		} else if(nick.match(/^[a-zA-Z0-9_]+$/) == null) {
			gameserver.sendMessageToClient(socket, '<b class="text-warning">Your nickname can only contain alphanumerical characters or underscores.</b>');
			return;
		}
	
		var currentNick = gameserver.getUsername(socket.id);
		if(nick != currentNick) {
			gameserver.setUsername(socket, nick);
			gameserver.sendMessageToAll('<i class="text-muted">' + currentNick + ' is now known as ' + nick + '.</i>');
		} else gameserver.sendMessageToClient(socket, '<b class="text-warning">That nickname is the same as the one you have now.</b>');
	} else gameserver.sendMessageToClient(socket, '<b class="text-warning">Not enough arguments.</b>');
	
}, 'Sets your nickname. Usage: <u>/nick (name)</u>');


// ============================================= Commands end

// ============================================= Misc begin

function getRandomArbitrary(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

// ============================================= Misc end