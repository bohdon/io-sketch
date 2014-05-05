

$(document).ready(function() {

	var elems = {
		canvas: $('#sketchcanvas')[0],
		brushSize: $('#brushSize')[0],
		colorSwatches: $('#brushColors')[0],
		layers: $('#layers')[0],
	}

	mysketch = new iosketch.IOSketch('mysketch', elems);
	mysketch.activeUser = 'bsayre';

	mysketch.addUser({
		username:'bsayre',
		fullname:'Bohdon Sayre',
	});
	mysketch.addUser({
		username: 'jcannon',
		fullname: 'John Cannon',
	});
	mysketch.addUser({
		username: 'bchapman',
		fullname: 'Brennan Chapman',
	});

});