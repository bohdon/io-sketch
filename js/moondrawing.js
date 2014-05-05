
(function() {



$(document).ready(function() {

	var colors = ['black', 'white', '#d00', 'orange', '#fe0', '#6a0', '#7ae', '#24a', '#728'];
	var canvas = document.getElementById('artcanvas');
	paper.setup(canvas);


	var paintBrush = new PaintBrush();
	var eraseBrush = new EraserBrush();
	// setup relation to allow auto-tool switching
	paintBrush.eraseTool = eraseBrush.tool;
	eraseBrush.paintTool = paintBrush.tool;



	// setup brush size display
	paintBrush.addEventListener('brushSize', function() {
		var span = document.getElementById('brushSize');
		span.innerHTML = paintBrush.brushMaxSize;
	});



	// setup color swatches
	var brushColorsDiv = document.getElementById('brushColors');
	for (var i = 0; i < colors.length; i++) {
		var swatch = document.createElement('div');
		swatch.style.color = colors[i];
		swatch.style.backgroundColor = colorWithAlpha(colors[i], 0.5);
		swatch.className = 'colorSwatch boxButton';
		swatch.addEventListener('click', setBrushColor);
		brushColorsDiv.appendChild(swatch);
		if (i == 0) {
			setBrushColor({target:swatch});
		}
	}
	paintBrush.fireChange();

	function setBrushColor(e) {
		var swatch = e.target;
		var actives = document.getElementsByClassName('colorSwatch boxButton active');
		for (var i = 0; i < actives.length; i++) {
			actives[i].style.backgroundColor = colorWithAlpha(actives[i].style.color, 0.5);
			$(actives[i]).removeClass('active');
		};
		$(swatch).addClass('active');
		swatch.style.backgroundColor = swatch.style.color;
		paintBrush.brushColor = swatch.style.color;
	}


	// create layer for user
	var users = ['BS', 'JC', 'JB', 'AV', 'TS'];
	var layerGrp = document.getElementById('layerspanel');
	for (var i = 0; i < users.length; i++) {
		if (!paper.project.layers[i]) {
			new paper.Layer();
		}
		var elem = document.createElement('div');
		elem.addEventListener('click', setLayerActive);
		elem.addEventListener('mouseover', selectLayer);
		elem.addEventListener('mouseout', deselectLayer);
		elem.innerHTML = users[i];
		$(elem).attr({
			layerindex: i,
		}).addClass("layerTile active");
		layerGrp.appendChild(elem);
	}
	paper.project.layers[0].activate();

	function setLayerActive(e, active) {
		if (e.altKey) {
			var allLayers = document.getElementsByClassName("layerTile");
			for (var i = 0; i < allLayers.length; i++) {
				if ($(allLayers[i]).hasClass('active')) {
					setLayerActive({target: allLayers[i]}, false);
				}
			};
			active = true;
		}
		var layer = e.target;
		var index = layer.getAttribute('layerindex');
		if (active == undefined) {
			active = !$(layer).hasClass('active');
		}
		if (active) {
			// activate
			$(layer).addClass('active');
			if (paper.project.layers[index]) {
				paper.project.layers[index].visible = true;
				// TEMP
				paper.project.layers[index].activate();
			}
		} else {
			// deactivate
			$(layer).removeClass('active');
			if (paper.project.layers[index]) {
				paper.project.layers[index].visible = false;
			}
		}
		paper.project.view.update();
	}

	function selectLayer(e) {
		var layer = e.target;
		var index = layer.getAttribute('layerindex');
		if (paper.project.layers[index]) {
			paper.project.layers[index].selected = true;
			paper.project.view.update();
		}
	}

	function deselectLayer(e) {
		var layer = e.target;
		var index = layer.getAttribute('layerindex');
		if (paper.project.layers[index]) {
			paper.project.layers[index].selected = false;
			paper.project.view.update();
		}
	}



});



function lerp(a, b, t){
	return a + (b - a) * t;
}

function colorWithAlpha(color, alpha) {
	var c = tinycolor(color);
	c.setAlpha(alpha);
	return c;
}



/*
 * Pressure sentsitive Paint Brush used for drawing basic paths
 */


function PaintBrush() {
	this.brushColor = 'black';
	this.brushMaxSize = 4;
	this.brushMinSizeScale = 0.1;
	this.pressureSmoothing = 0.5;

	this.events = {};
	this.smoothPressure = 0;
	this.path;

	this.tool = new paper.Tool();
	this.tool.brush = this;
	this.tool.minDistance = 2;
	this.tool.onMouseDown = this.onMouseDown.bind(this);
	this.tool.onMouseDrag = this.onMouseDrag.bind(this);
	this.tool.onMouseUp = this.onMouseUp.bind(this);
	this.tool.onKeyDown = this.onKeyDown.bind(this);
	this.activate = this.tool.activate.bind(this.tool);
}


PaintBrush.prototype.addEventListener = function(event, callback) {
	if (!this.events[event]) {
		this.events[event] = [];
	}
	this.events[event].push(callback);
};

PaintBrush.prototype.fireChange = function(event) {
	if (!event) {
		for (var key in this.events) {
			this.fireChange(key);
		}
	} else if (this.events[event]) {
		var these = this.events[event];
		for (var i = 0; i < these.length; i++) {
			these[i](this);
		};
	}
};


Object.defineProperty(PaintBrush.prototype, "pressure", {
	get: function pressure() {
		return wacom.active ? this.smoothPressure : 1;
	}
});

Object.defineProperty(PaintBrush.prototype, "pressureAccel", {
	get: function pressureAccel() {
		return 1 - Math.min(this.pressureSmoothing, 0.99);
	}
});

Object.defineProperty(PaintBrush.prototype, "brushSize", {
	get: function brushSize() {
		return lerp(this.brushMinSize, this.brushMaxSize, this.pressure);
	},
	set: function brushSize(size) {
		this.brushMaxSize = size;
		this.fireChange('brushSize')
	}
});

Object.defineProperty(PaintBrush.prototype, "brushMinSize", {
	get: function brushMinSize() {
		return this.brushMaxSize * this.brushMinSizeScale;
	}
});

PaintBrush.prototype.increaseBrushSize = function() {
	this.brushSize = Math.min(32, this.brushMaxSize * 2);
};

PaintBrush.prototype.decreaseBrushSize = function() {
	this.brushSize = Math.max(1, this.brushMaxSize / 2);
};


PaintBrush.prototype.onMouseDown = function(event) {
	// check for tool switch
	if (wacom.isEraser && this.eraseTool) {
		this.eraseTool.activate();
		this.eraseTool.onMouseDown(event);
	}
	this.smoothPressure = 0;
};

PaintBrush.prototype.onMouseDrag = function(event) {
	// update smooth pressure
	if (wacom.loaded) {
		this.smoothPressure = lerp(this.smoothPressure, wacom.pressure, this.pressureAccel);
	}

	// check if layer is active
	if (!paper.project.activeLayer.visible) {
		return;
	}

	// create a new path if necessary
	if (!this.path) {
		this.path = new paper.Path({
			fillColor: this.brushColor
		});
		this.path.add(event.lastPoint);
	}

	var delta = event.delta.normalize();
	delta.angle = delta.angle + 90;

	// add to path on both sides creation dynamic width
	var top = event.middlePoint.add(delta.multiply(this.brushSize));
	var bottom = event.middlePoint.add(delta.multiply(-this.brushSize));

	this.path.add(top);
	this.path.insert(0, bottom);
	this.path.smooth();
};

PaintBrush.prototype.onMouseUp = function(event) {
	if (this.path) {
		// finish path
		this.path.add(event.point);
		this.path.closed = true;
		this.path.simplify(1);
		this.path = null;
		}
	};

PaintBrush.prototype.onKeyDown = function(event) {
	if (event.key == '[') {
		this.decreaseBrushSize();
	} else if (event.key == ']') {
		this.increaseBrushSize();
	}
}



/*
 * Eraser Brush, handles hit testing paths and deleting them
 */

function EraserBrush() {
	this.tool = new paper.Tool();
	this.tool.brush = this;
	this.tool.onMouseDown = this.onMouseDown.bind(this);
	this.tool.onMouseDrag = this.onMouseDrag.bind(this);
	this.tool.onMouseUp = this.onMouseUp.bind(this);
	this.tool.onKeyDown = this.onKeyDown.bind(this);
	this.activate = this.tool.activate.bind(this.tool);
}

EraserBrush.prototype.onMouseDown = function(event) {
	// check for tool switch
	if (!wacom.isEraser && this.paintTool) {
		this.paintTool.activate();
		this.paintTool.onMouseDown(event);
	}
};

EraserBrush.prototype.onMouseDrag = function(event) {
};

EraserBrush.prototype.onMouseUp = function(event) {
};	

EraserBrush.prototype.onKeyDown = function(event) {	
};


window.PaintBrush = PaintBrush;
window.EraserBrush = EraserBrush;

})();


