

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

function onDocumentDrag(event) {
	event.preventDefault();
}

function onDocumentDrop(event) {
	event.preventDefault();

	var file = event.dataTransfer.files[0];
	var reader = new FileReader();

	reader.onload = function (event) {
		var image = document.createElement('img');
		image.onload = function() {
			raster = new paper.Raster(image);
			raster.fitBounds(paper.project.view.bounds);
			paper.project.activeLayer.insertChild(0, raster);
			paper.project.view.update();
		};
		image.src = event.target.result;
	};
	reader.readAsDataURL(file);
}

document.addEventListener('drop', onDocumentDrop);
document.addEventListener('dragover', onDocumentDrag);
document.addEventListener('dragleave', onDocumentDrag);

