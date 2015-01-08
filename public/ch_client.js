var socket;

var username = 'TestUser';

$(function() {
	$.material.init();
	socket = io();

	// TODO
	populateCards();
	setUsernameField();
	onResize();
});

$(".cah-card").click(function() {
	if(!$(this).hasClass('selected-card') && !$(this).hasClass('cah-card-black')) {
		deselectCards();
		$(this).addClass('selected-card');
		var checkbox = $(this).find('.card-checkbox');
		checkbox.fadeIn(400).css('display', 'inline-block');
	}
});

$('#chat-input').focusout(function() {
	var el = $(this);
	setTimeout(function() {
		el.focus();
	});
});

$(document).keypress(function(e) {
    if(e.which == 13)
		sendChatFromInput();
});

function onResize() {
	$('#chatbox').height($(document).height() - $('#playfield').outerHeight() - $('#the-navbar').outerHeight());
	$('#chat-input').width($(document).width() - $('#username-field').outerWidth() - 15);
	$('#chat-contents').height($('#chatbox').height() - $('#chat-input').height() - $('#chat-header').height());
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
	return str.replace("_", "<b>___</b>");
}

function setUsernameField() {
	$('#username-field').text(username);
}


function sendChatFromInput() {
	var input = clean($('#chat-input').val());
	if(input.length > 0) {
		var text = "<b>" + username + ":</b> " + input;
		sendChat(text);
		$('#chat-input').val('');
		contents.scrollTop(contents[0].scrollHeight);
	}
}
$('#send-msg-button').click(sendChatFromInput);

function sendChat(text) {
	if(text.length > 0) {
		var contents = $('#chat-contents');
		contents.append("<li>" + text + "</li>");
	}
}

function clean(text) {
	return $('<b></b>').text(text).html();
}