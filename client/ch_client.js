var socket;

$(function() {
	$.material.init();
	socket = io();
	
	setChatboxHeight();
	// TODO
	populateCards();
});

function setChatboxHeight() {
	$('#chatbox').height($(document).height() - $('#playfield').height() - $('#the-navbar').height() - 40);
}
$(window).resize(setChatboxHeight);

function populateCards() {
	$('.cah-card').each(function(e) {
		var html = "<div class='card-text'>" + findSpaces($(this).attr('data-text')) + "</div><div class='card-deck'>" + $(this).attr('data-deck') + "</div>";
		if(!$(this).hasClass('cah-card-black'))
			html += "<div class='radio card-pick-radio'><label><input type='radio' name='picked-card'></label></div>";	
	
		$(this).html(html);
	});
	
	$.material.init();
}

function findSpaces(str) {
	return str.replace("_", "<b>___</b>");
}