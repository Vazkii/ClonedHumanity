// ============================================= Modules begin
var fs = require('fs');
var app = require('express')();
var http = require('http');
var server = http.Server(app);
var util = require('util');
var validator = require('validator');
var request = require('request');
// ============================================= Modules end

// ============================================= Main begin
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var port = config['port'];
var timeout = config['timeout'];
var maxPlayers = config['max_players'];
var minGamePlayers = config['min_game_players'];
var motd = config['motd'];
var maxNickLength = config['max_nick_length'];
var maxMessageLength = config['max_message_length'];
var maxGameNameLength = config['max_game_name_length'];
var gameRoundTime = config['game_round_time'];
var intervalTime = config['inteval_time'];
var allowGlobalChat = config['allow_global_chat'] == 'true';

var io = require('socket.io')(server, {
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

server.listen(port, function() {
	console.log('HTTP Server running on port ' + port);
});

io.on('connection', function(socket) {
	gameserver.onConnect(socket);
	
	socket.on('disconnect', function() {
		gameserver.onDisconnect(socket);
	});
	
	socket.on('chat-message', function(msg) {
		gameserver.onChatMessage(socket, msg);
	});
});
// ============================================= Main end

// ============================================= GameServer begin
var GameServer = function() {
	this.games = {};
	this.players = {};
	this.playerProfiles = {};
	this.usernameToSocketLookup = {};
	this.playerCount = 0;
	this.gameCount = 0;
}
var gameserver = new GameServer();

GameServer.prototype.onConnect = function(socket) {
	console.log('Connection opened by socket with ID ' + socket.id);
	if(this.playerCount >= maxPlayers) {
		this.sendMessageToClient(socket, '<b class="text-danger">The server is capped at the maximum amount of players (' + maxPlayers + '). Please try again later.</b>');
		socket.disconnect();
		return;
	}
	
	this.players[socket.id] = socket;
	this.generateProfile(socket);
	
	this.playerCount++;
	this.sendMessageToClient(socket, '<b class="text-info">Welcome to ClonedHumanity.</b> There are <b>' + this.playerCount + '/' + maxPlayers + '</b> players online. | <b>' + 'MOTD:</b> ' + motd);
	this.setDefaultHintMessage(socket);
	this.sendMessageToAll('<i class="text-muted">' + this.getUsername(socket.id) + ' has logged in.</i>');
}

GameServer.prototype.onDisconnect = function(socket) {
	console.log('Connection closed socket with ID ' + socket.id);
	if(socket.id in this.players) {
		this.playerCount--;
		this.sendMessageToAll('<i class="text-muted">' + this.getUsername(socket.id) + ' has logged out.</i>');
		
		var game = this.getGamePlayerIsIn(socket);
		if(game != null)
			game.leaveGame(socket);
		
		delete this.usernameToSocketLookup[this.getUsername(socket.id)];
		delete this.players[socket.id];
		delete this.playerProfiles[socket.id];
	}
}

GameServer.prototype.onChatMessage = function(socket, msg) {
	console.log('Message from ' + socket.id + ' (' + this.getUsername(socket) + '): ' + msg);
	msg = msg.trim();
	
	if(msg.indexOf('/') == 0) { // Handle command
		var tokens = msg.substr(1).split(' ');
		var commandName = tokens[0].toLowerCase();
		if(commandName in commands) {
			tokens = tokens.slice(1, tokens.length);
			commands[commandName](socket, tokens);
		} else this.sendMessageToClient(socket, '<b class="text-warning">That command does not exist. Type /help for a list of commands.</b>');
	} else {
		if(msg.length > maxMessageLength)
			this.sendMessageToClient(socket, '<b class="text-warning">That message is too long. Your messages can\'t be longer than ' + maxMessageLength + ' characters.</b>');
		else if(msg.length > 0) {
			msg = validator.escape(msg);
			var sendmsg = '<b>' + this.getUsername(socket.id) + ':</b> '  + msg;
			var game = this.getGamePlayerIsIn(socket);
			if(game == null) {
				 if(!allowGlobalChat)
				 	this.sendMessageToClient(socket, '<b class="text-warning">Global chat is disabled, you must join a game if you want to chat.</b>');
				else this.sendMessageToAll(sendmsg);
			} else game.sendChatMessageToAll(sendmsg);
		}
	}
}

GameServer.prototype.generateProfile = function(socket) {
	var profile = { };
	this.playerProfiles[socket.id] = profile;
	
	this.setUsername(socket, this.generateGuestUsername());
	this.setPlayerGame(socket, null);
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
		
		var game = this.getGamePlayerIsIn(socket);
		if(game != null)
			game.syncState();
	}
}

GameServer.prototype.getSocketForUsername = function(username) {
	return this.usernameToSocketLookup[username];
}

GameServer.prototype.sendMessageToAll = function(msg) {
	io.emit('chat-message', msg);
}

GameServer.prototype.sendMessageToClient = function(socket, msg) {
	socket.emit('chat-message', msg);
}

GameServer.prototype.setHintMessage = function(socket, msg) {
	socket.emit('hint-message', msg);
}

GameServer.prototype.setDefaultHintMessage = function(socket) {
	this.setHintMessage(socket, 'You are not in a game. Type <b>/listgames</b> to check out public games or <b>/startgame</b> to make one! If you need help try <b>/help</b>.');
}

GameServer.prototype.addGame = function(socket, maxPlayers, name, locked) {
	var game = new Game(socket, maxPlayers, name, locked);
	this.games[name] = game;
	this.gameCount++;
}

GameServer.prototype.getGameForName = function(name) {
	return this.games[name];
}

GameServer.prototype.getGame = function(game) {
	typeof game == 'string' ? games[game] : game;
}

GameServer.prototype.disbandGame = function(game) {
	//game = this.getGame(game);
	for(player in game.players)
		this.setPlayerGame(game.players[player], null);
	this.gameCount--;
	
	var msg = '<i class="text-info">The game "' + game.name + '" has been disbanded.</i>';
	if(this.locked)
		game.sendChatMessageToAll(msg);
	else this.sendMessageToAll(msg);
	
	delete this.games[game.name];
}

GameServer.prototype.getGamePlayerIsIn = function(socket) {
	return this.playerProfiles[this.getSocketId(socket)].game;
}

GameServer.prototype.setPlayerGame = function(socket, game) {
	this.playerProfiles[this.getSocketId(socket)].game = game;
	if(game == null) {
		socket.emit('game-state', { nogame: true });
		this.setDefaultHintMessage(socket);
	}
}

GameServer.prototype.makeGamePassword = function(length) {
	var validChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	var pass = '';
	for(var i = 0; i < length; i++)
		pass += validChars.charAt(getRandomArbitrary(0, validChars.length));
	
	return pass;
}
// ============================================= GameServer end

// ============================================= Game begin
var Game = function(host, maxPlayers, name, locked) {
	this.name = name;
	this.players = { };
	this.roundTime = gameRoundTime;
	this.host = host;
	this.maxPlayers = maxPlayers;
	this.locked = locked;
	this.playerCount = 0;
	this.playing = false;
	this.password = locked ? gameserver.makeGamePassword(8) : '';
	this.deck = new Deck();
	
	this.joinGame(host);
}

Game.prototype.tryJoinGame = function(socket, pass) {
	if(this.playerCount >= this.maxPlayers)
		gameserver.sendMessageToClient(socket, '<b class="text-warning">This game is full.</b>');
	else if(this.playing) 
		gameserver.sendMessageToClient(socket, '<b class="text-warning">This game is in progress, you can\'t join a game that\'s already in progress.</b>');
	else if(this.locked && this.password != pass)
		gameserver.sendMessageToClient(socket, '<b class="text-warning">This game is private, the password is either missing or invalid.</b>');
	else this.joinGame(socket);
}

Game.prototype.joinGame = function(socket) {
	this.players[socket.id] = socket;
	gameserver.setPlayerGame(socket, this);
	this.setPlayerAwesomePoints(socket, 0);
	this.playerCount++;
	this.sendChatMessageToAll('<i>' + gameserver.getUsername(socket.id) + ' joined the game.</i>');
	if(this.isHost(socket))
		gameserver.setHintMessage(socket, 'You are the game\'s host. When you want to start the game type <b>/start</b>.' + (this.locked ? (' <i>This game\'s password is ' + this.password + '.</i>') : ''));
	else gameserver.setHintMessage(socket, 'You are in a game, the game will start once the host decides. Feel free to chat until then!');
	this.syncState();
}

Game.prototype.leaveGame = function(socket) {
	var sync = false;
	gameserver.setPlayerGame(socket, null);
	this.playerCount--;
	
	if(this.isHost(socket) || this.playerCount < (this.playing ? minGamePlayers : 1))
		gameserver.disbandGame(this);
	else {
		this.sendChatMessageToAll('<i>' + gameserver.getUsername(socket.id) + ' left the game.</i>');
		sync = true;
	}
	
	delete this.players[socket.id];
	if(sync)
		this.syncState();
}

Game.prototype.syncState = function() {
	var data = {};
	var players = {};
	for(name in this.players) {
		var info = {};
		var username = gameserver.getUsername(name);
		info.name = username;
		info.points = this.getPlayerAwesomePoints(name);
		info.role = 'player'; // TODO
		info.host = this.isHost(this.players[name]);
		players[username] = info;
	}
	
	data.players = players;
	data.name = this.name;
	
	this.sendToAll('game-state', data);
}

Game.prototype.sendChatMessageToAll = function(message) {
	this.sendToAll('chat-message', message);
}

Game.prototype.sendToAll = function(packetName, data) {
	for(name in this.players)
		this.players[name].emit(packetName, data);
}

Game.prototype.isHost = function(socket) {
	return socket == this.host;
}

Game.prototype.getListString = function() {
	return '<b class="' + (this.playing ? 'text-danger' : 'text-success') + '">' + this.name + '</b> (' + this.playerCount + '/' + this.maxPlayers + ')';
}

Game.prototype.addCardcast = function(socket, id) {
	if(this.isHost(socket))
		this.deck.addCardcast(socket, id);
	else gameserver.sendMessageToClient(socket, '<b class="text-warning">You are not this game\'s host.</b>');
}

// Game logic
Game.prototype.tick = function() {
	
}

Game.prototype.getPlayerAwesomePoints = function(socket) {
	return gameserver.playerProfiles[gameserver.getSocketId(socket)].points;
}

Game.prototype.setPlayerAwesomePoints = function(socket, points) {
	gameserver.playerProfiles[gameserver.getSocketId(socket)].points = points;
}


Game.prototype.playCard = function(socket, card) {
	var cards = [ card ];
	this.playCards(socket, cards, false);
}

Game.prototype.playCards = function(socket, cards, override) {
	socket.emit('play-cards', cards);
}

// ============================================= Game end

// ============================================= Deck begin
var Deck = function() {
	this.calls = { };
	this.responses = { };
	this.decksAdded = [ ];
}

Deck.prototype.addCardcast = function(socket, ccId) {
	gameserver.sendMessageToClient(socket, '<b class="text-info">Adding deck ' + ccId + ', please wait a bit as we get the info...<b>');
	
	var deckId = 'cc_' + ccId;
	if(deckId in this.decksAdded)
		return gameserver.sendMessageToClient(socket, '<b class="text-warning">Couldn\'t add the deck. It was either already there or something went wrong internally.</b>');
	
	var host = 'https://api.cardcastgame.com';
	var deckPath = '/v1/decks/' + ccId;
	var callsPath = deckPath + '/calls';
	var responsesPath = deckPath + '/responses';
	var deckName = undefined;
	
	var deck = this;
	request(host + deckPath, function(error, response, body) {
		if(!error && response.statusCode == 200) {
			var bodyObj = JSON.parse(body);
			deckName = bodyObj.name;
			console.log('Deck name is ' + deckName);
			
			request(host + callsPath, function(error1, response1, body1) {
				deck.makeLoadCardCastJsonFunction(deckName, deck.calls, true)(error1, response1, body1);
				request(host + responsesPath, function(error2, response2, body2) {
					deck.makeLoadCardCastJsonFunction(deckName, deck.responses, false)(error2, response2, body2);
					deck.decksAdded.push(deckId);
					gameserver.sendMessageToClient(socket, '<b class="text-success">Successfuly added ' + deckName + ' to the list of decks playing.</b>');
				});
			});
		}
	});
}

Deck.prototype.makeLoadCardCastJsonFunction = function(deckname, obj, blackCard) {
	return function(error, response, body) {
		if(!error && response.statusCode == 200) {
			var cardsArr = JSON.parse(body);
			for(i in cardsArr) {
				var cardObj = cardsArr[i];
				var card = { 
					text: cardObj.text,
					deck: deckname,
					black: blackCard
				};
				obj[cardObj.id] = card;
			}
		}
	};
}

// ============================================= Deck end

// ============================================= Commands begin
var commands = { };
var commandInfo = { };

function addCommand(name, func, desc) {
	commands[name] = func;
	commandInfo[name] = desc;
}

// /help command
addCommand('help', function(socket, args) {
	var message = '<b class="text-info">ClonedHumanity command lookup:</b><br>';
	for(name in commandInfo)
		message += ('<b>/' + name + ':</b> ' + commandInfo[name] + '<br>');
	gameserver.sendMessageToClient(socket, message);
}, 'Gets info about all the registered commands.');

// /ping command
addCommand('ping', function(socket, args) {
	gameserver.sendMessageToClient(socket, '<b class="text-success">Pong!</b>');
}, 'Pings the server.');

// /me command
addCommand('me', function(socket, args) {
	var action = args.join(' ');
	if(action.length > 0) {
		action = validator.escape(action);
		var msg = '<i><b>' + gameserver.getUsername(socket.id) + '</b> ' + action + '</i>';		
		if(msg.length > maxMessageLength)
			gameserver.sendMessageToClient(socket, '<b class="text-warning">That message is too long. Your messages can\'t be longer than ' + maxMessageLength + ' characters.</b>');
		else gameserver.sendMessageToAll(msg);
	} else gameserver.sendMessageToClient(socket, '<b class="text-warning">No mesage to send.</b>');
}, 'Does an action. Usage: <u>/me (action)</u>');

// /nick command
addCommand('nick', function(socket, args) {
	if(args.length > 0) {
		var nick = args.join(' ').trim();
		if(nick.length > maxNickLength) {
			gameserver.sendMessageToClient(socket, '<b class="text-warning">Your nickname can\'t be longer than ' + maxNickLength + ' characters.</b>');
			return;
		}
		
		if(nick.match(/^[a-zA-Z0-9_]+$/) == null) {
			gameserver.sendMessageToClient(socket, '<b class="text-warning">Your nickname can only contain alphanumerical characters or underscores.</b>');
			return;
		}
	
		if(gameserver.getSocketForUsername(nick) != null) {
			gameserver.sendMessageToClient(socket, '<b class="text-warning">That username is already in use.</b>');
			return;
		}
	
		var currentNick = gameserver.getUsername(socket.id);
		if(nick != currentNick) {
			gameserver.setUsername(socket, nick);
			gameserver.sendMessageToAll('<i class="text-muted">' + currentNick + ' is now known as ' + nick + '.</i>');
		} else gameserver.sendMessageToClient(socket, '<b class="text-warning">That nickname is the same as the one you have now.</b>');
	} else gameserver.sendMessageToClient(socket, '<b class="text-warning">Not enough arguments.</b>');
}, 'Sets your nickname. Usage: <u>/nick (name)</u>');

// /list command
addCommand('list', function(socket, args) {
	var names = Object.keys(gameserver.usernameToSocketLookup);
	names.sort();
	gameserver.sendMessageToClient(socket, '<b class="text-info">Players Online (' + gameserver.playerCount + '): </b>' + names.join(', '));
}, 'Lists the players on the server currently.');

// /listgames command
addCommand('listgames', function(socket, args) {
	var names = [];
	var games = 0;
	for(game in gameserver.games)
		if(!gameserver.games[game].locked) {
			names.push(gameserver.games[game].getListString());
			games++;
		}
			
	names.sort();
	gameserver.sendMessageToClient(socket, '<b class="text-info">Public Games (' + games + '): </b>' + names.join(', '));

}, 'NYI');

// /startgame and /startprivgame command
addCommand('startgame', makeGame('startgame', false), 'Creates a new game.  Usage: <u>/startgame (max-players) (name)</u>');
addCommand('startprivgame', makeGame('startprivgame', true), 'Creates a new private game. A password is randomly generated and must be given to anyone who wants to join. Private games do not appear in /listgames. Usage: <u>/startprivgame (max-players) (name)</u>');

function makeGame(cname, locked) {
	return function(socket, args) {
		if(gameserver.getGamePlayerIsIn(socket) != null) {
			gameserver.sendMessageToClient(socket, '<b class="text-warning">You are already in a game.</b>');
			return;
		}

		if(args.length < 2) {
			gameserver.sendMessageToClient(socket, '<b class="text-warning">Not enough arguments. Proper Usage: <span class="text-info">/' + cname + ' (max-players) (name)</span></b>');
			return;
		}
		
		var players = parseInt(args[0]);
		if(isNaN(players) || players < minGamePlayers) {
			gameserver.sendMessageToClient(socket, '<b class="text-warning">The amount of max players is invalid or is below ' + minGamePlayers + ', can\'t create game.</b>');
			return;
		}
		
		var name = args.splice(1).join(' ').trim();
		
		if(name.length > maxGameNameLength) {
			gameserver.sendMessageToClient(socket, '<b class="text-warning">Your game\'s name can\'t be longer than ' + maxGameNameLength + ' characters.</b>');
			return;
		}
		
		if(name.match(/^[a-zA-Z0-9_]+$/) == null) {
			gameserver.sendMessageToClient(socket, '<b class="text-warning">Your game\'s name can only contain alphanumerical characters or underscores.</b>');
			return;
		}

		if(gameserver.getGameForName(name) != null) {
			gameserver.sendMessageToClient(socket, '<b class="text-warning">That game name is already in use.</b>');
			return;
		}
		
		gameserver.addGame(socket, players, name, locked);
		gameserver.sendMessageToClient(socket, '<b class="text-success">Successfully created the game "' + name + '"</b>');
		if(!locked)
			gameserver.sendMessageToAll('<i class="text-info">' + gameserver.getUsername(socket.id) + ' has created the game "' + name + '"</i>');
	};
}

// /joingame command
addCommand('joingame', function(socket, args) {
	if(args.length < 1) {
		gameserver.sendMessageToClient(socket, '<b class="text-warning">Not enough arguments. Proper Usage: <span class="text-info">/joingame (name)</span></b>');
		return;
	}
	
	var name = args.join(' ');
	var game = gameserver.getGameForName(name);
	var pass = '';
	if(game == undefined) {
		pass = args.pop();
		name = args.join(' ');
		game = gameserver.getGameForName(name);
	}
	
	if(game != undefined)
		game.tryJoinGame(socket, pass);
	else gameserver.sendMessageToClient(socket, '<b class="text-warning">There\'s no game by that name. Try <span class="text-info">/listgames</span> to see public games.</b>');
}, 'Joins a game. Usage: <u>/joingame (name)</u>');

// /leavegame command
addCommand('leavegame', function(socket, args) {
	var game = gameserver.getGamePlayerIsIn(socket);
	if(game != null)
		game.leaveGame(socket);
	else gameserver.sendMessageToClient(socket, '<b class="text-warning">You are not in a game.</b>');
}, 'Leaves your current game. If you\'re the host the game is disbanded.');

// invite command
// todo

// addcc command
addCommand('addcc', function(socket, args) {
	if(args.length < 1) {
		gameserver.sendMessageToClient(socket, '<b class="text-warning">Not enough arguments. Proper Usage: <span class="text-info">/addcc (id)</span></b>');
		return;
	}
	
	var game = gameserver.getGamePlayerIsIn(socket);
	if(game != null)
		game.addCardcast(socket, args[0]);
	else gameserver.sendMessageToClient(socket, '<b class="text-warning">You are not in a game.</b>');
}, 'Adds a deck from CardCast given the ID of that deck. Usage: <u>/addcc (id)</u>');

// ============================================= Commands end

// ============================================= Misc begin

function getRandomArbitrary(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

// ============================================= Misc end