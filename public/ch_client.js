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
		var checkbox = $(this).find('.card-checkbox');
		if(checkbox.css('display') == 'none') {
			deselectCards();
			$(this).addClass('selected-card');
			checkbox.fadeIn(400).css('display', 'inline-block');
		}
	}
});

if(!isMobile())
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
	var docWidth = $(document).width();
	var docHeight = $(document).height();

	$('#chatbox').height(docHeight - $('#playfield').outerHeight() - $('#the-navbar').outerHeight());
	$('#chat-input').width(docWidth - $('#username-field').outerWidth() - 15);
	$('#chat-contents').height($('#chatbox').height() - $('#chat-input').height() - $('#chat-header').height() - 3);
	$('#chat-messages').width(docWidth - 200);
	$('#chat-messages').height($('#chat-contents').height());
	$('#spanel-lobby-interface').css('line-height', $('#chat-contents').height() + "px");
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
	var contents = $('#chat-messages');
	
	if(input.length > 0) {
		var text = "<b>" + username + ":</b> " + input;
		sendChat(text);
		$('#chat-input').val('');
		updateSendButton();
		contents.scrollTop(contents[0].scrollHeight);
	}
}
$('#send-msg-button').click(sendChatFromInput);

function sendChat(text) {
	if(text.length > 0) {
		var contents = $('#chat-messages');
		contents.append("<li><div class='chat-message-container'>" + text + "</div></li>");
	}
}

// Utils

function isMobile() {
	return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function clean(text) {
	return $('<b></b>').text(text).html();
}