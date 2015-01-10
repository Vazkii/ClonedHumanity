var socket = io();
var dcd = false;

var username = '';

$(function() {
	$.material.init();

	// TODO
	populateCards();
	populatePlayers();
	setUsernameField();
	onResize();
});

$(".cah-card").click(function() {
	var card = $(this);
	var parent = card.parent();
	if(parent.hasClass('card-group'))
		card = parent.first();

	if(!card.hasClass('selected-card') && !card.hasClass('cah-card-black')) {
		var checkbox = card.find('.card-checkbox');
		if(checkbox.css('display') == 'none') {
			deselectCards();			
			card.addClass('selected-card');
			checkbox.fadeIn(400).css('display', 'inline-block');
		}
	}
});

$(document).keypress(function(e) {
    if(e.which == 13)
		sendChatFromInput();
});

function onResize() {
	var docWidth = $(document).width();
	var docHeight = $(document).height();

	$('#chatbox').height(docHeight - $('#playfield').outerHeight() - $('#the-navbar').outerHeight());
	$('#chat-input').width(docWidth - $('#username-field').outerWidth() - 15);
	$('#chat-contents').height($('#chatbox').height() - $('#chat-input').height() - $('#chat-header').height() - 3);
	$('#chat-messages').width(docWidth - 200);
	$('#chat-messages').height($('#chat-contents').height());
	$('#spanel-lobby-interface').css('line-height', $('#chat-contents').height() + "px");
	$('#spanel-player-list').height($('#chat-contents').height() - $('#spanel-player-counter').height() - $('#spanel-game-name').height());
	$('#chat-header-hint').width(docWidth - 217);
}
$(window).resize(onResize);

function deselectCards() {
	$('.selected-card').each(function(e) {
		$(this).removeClass('selected-card');
		var checkbox = $(this).find('.card-checkbox');
		checkbox.fadeOut(400);
	});
}

function populateCards() {
	$('.cah-card').each(function(e) {
		var html = "<div class='card-text'>" + findSpaces($(this).attr('data-text')) + "</div><div class='card-deck'><div class='checkbox card-checkbox'><label><input type='checkbox' class='card-selector-checkbox' disabled='true' checked></label></div>" + $(this).attr('data-deck') + "</div>";
	
		$(this).html(html);
	});
	
	$.material.init();
}

function findSpaces(str) {
	return str.replace(/_/g, "<b>___</b>");
}

function setUsernameField() {
	$('#username-field').text(username);
	onResize();
}

function sendChatFromInput() {
	var input = $('#chat-input').val();
	var contents = $('#chat-messages');
	
	if(input.length > 0) {
		sendChat(input);
		$('#chat-input').val('');
	}
}
$('#send-msg-button').click(sendChatFromInput);

function sendChat(text) {
	if(text.length > 0)
		socket.emit('chat-message', text);
}

function clean(text) {
	return $('<b></b>').text(text).html();
}

socket.on('connect', function() {
	if(dcd) {
		addChatMessage('<b class="text-success">You have successfully reconnected to the server.</b>');
		dcd = false;
	}
});

socket.on('disconnect', function() {
	addChatMessage('<b class="text-danger">You have been disconnected from the server.</b>');
	setHintMessage('<b class="text-danger">You are not connected to the server.</b>');
	setNotInGame();
	dcd = true;
});

socket.on('chat-message', function(msg) {
	addChatMessage(msg);
});

socket.on('set-username', function(user) {
	username = user;
	setUsernameField();
});

socket.on('hint-message', function(msg) {
	setHintMessage(msg);
});

socket.on('game-state', function(data) {
	if('nogame' in data)
		setNotInGame();
	else {
		var players = data.players;
		var playerCount = 0;
		var html = '';
		for(name in players) {
			var player = players[name];

			var displayName = name;
			if(player.host)
				displayName += ('<i> (host)</i>');
				
			html += '<div class="spanel-player-info"><div class="spanel-player-name">' + displayName + '</div><div class"spanel-player-score"><b>' + player.points + '</b> points</div></div>';
			playerCount++;
		}
		
		html += '</div>';

		var set = function() {
			$('#spanel-game-name').html(data.name);
			$('#spanel-player-list').html(html);
			$('#spanel-player-counter').html('<b>' + playerCount + '</b> players');
		};
		
		if($('#spanel-game-interface').css('display') == 'none')
			$('#spanel-lobby-interface').fadeOut(function() {
				set();
				$('#spanel-game-interface').fadeIn();
			});
		else set();
	}
});

function setNotInGame() {
	if($('#spanel-lobby-interface').css('display') == 'none')
		$('#spanel-game-interface').fadeOut(function() {			
			$('#spanel-lobby-interface').fadeIn();
		});
}

function addChatMessage(msg) {
	var contents = $('#chat-messages');
	
	contents.append("<li><div class='chat-message-container'>" + msg + "</div></li>");
	contents.scrollTop(contents[0].scrollHeight);
}

function setHintMessage(msg) {
	$('#chat-header-hint').html(msg);
}
