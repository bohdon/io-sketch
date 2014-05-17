

$(document).ready(function() {

	var elems = {
		canvas: $('#canvas')[0],
		layers: $('#layers')[0],
		colorSwatches: $('#brushColors')[0],
		paintToolButton: $('#paintToolButton')[0],
		brushSize: $('#brushSize')[0],
		brushStroke: $('#brushStroke')[0],
		fillToolButton: $('#fillToolButton')[0],
		eraseToolButton: $('#eraseToolButton')[0],
		eraseType: $('#eraseType')[0],
	}

	var mysketch = new iosketch.IOSketch('mysketch', elems);

	var server = process.env.SKETCH_PORT,
		room = process.env.SKETCH_ROOM;
	var sketchsocket = new iosketch.IOSketchSocket(mysketch, server, room);

	var thisUser = {
		username: process.env.SKETCH_USER || process.env.USER,
		fullname: process.env.SKETCH_NAME,
		email: process.env.SKETCH_EMAIL
	};

	mysketch.addUser(thisUser);
	mysketch.activeUser = thisUser.username;

});

