var socket = io();
var dcd = false;

var username = 'TestUser';

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
	$('#spanel-player-list').height($('#chat-contents').height() - 20);
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

function populatePlayers() {
	var players = 0;

	$('.spanel-player-info').each(function(e) {
		var html = "<div class='spanel-player-name'>" + $(this).attr('data-nickname') + "</div><div class='spanel-player-score'><b>" + $(this).attr('data-points') + "</b> points</div>";
		$(this).html(html);
		players++;
	});
	
	$('#spanel-player-counter').html('<b>' + players + '</b> players');
}

function setUsernameField() {
	$('#username-field').text(username);
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

socket.on('chat-message', function(msg) {
	addChatMessage(msg);
});

socket.on('connect', function() {
	if(dcd) {
		addChatMessage('<b class="text-success">You have successfully reconnected to the server.</b>');
		dcd = false;
	}
});

socket.on('disconnect', function() {
	addChatMessage('<b class="text-danger">You have been disconnected from the server.</b>');	
	dcd = true;
});

function addChatMessage(msg) {
	var contents = $('#chat-messages');
	
	contents.append("<li><div class='chat-message-container'>" + msg + "</div></li>");
	contents.scrollTop(contents[0].scrollHeight);
}
