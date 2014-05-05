

$(document).ready(function() {

	var elems = {
		canvas: $('#sketchcanvas')[0],
		brushSize: $('#brushSize')[0],
		colorSwatches: $('#brushColors')[0],
		layers: $('#layers')[0],
	}

	mysketch = new iosketch.IOSketch('mysketch', elems);

	mysketch.addUser('bsayre', 'Bohdon Sayre');

});