var socket;

$(function() {
	$.material.init();
	socket = io();
	
	setChatboxHeight();
	// TODO
	populateCards();
});

$(".cah-card").click(function() {
	var selected = $(this).hasClass('selected-card');
	if(!selected) {
		deselectCards();
		$(this).addClass('selected-card');
		var checkbox = $(this).find('.card-checkbox');
		checkbox.fadeIn(400).css('display', 'inline-block');
	}
});

function deselectCards() {
	$('.selected-card').each(function(e) {
		$(this).removeClass('selected-card');
		var checkbox = $(this).find('.card-checkbox');
		checkbox.fadeOut(400);
	});
}


function setChatboxHeight() {
	$('#chatbox').height($(document).height() - $('#playfield').height() - $('#the-navbar').height() - 40);
}
$(window).resize(setChatboxHeight);

function populateCards() {
	$('.cah-card').each(function(e) {
		var html = "<div class='card-text'>" + findSpaces($(this).attr('data-text')) + "</div><div class='card-deck'><div class='checkbox card-checkbox'><label><input type='checkbox' disabled='true' checked='true'></label></div>" + $(this).attr('data-deck') + "</div>";
	
		$(this).html(html);
	});
	
	$.material.init();
}

function findSpaces(str) {
	return str.replace("_", "<b>___</b>");
}