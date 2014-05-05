

var iosketch = new function() {

var defaultColors = ['black', 'white', '#d00', 'orange', '#fe0', '#6a0', '#7ae', '#24a', '#728'];
var sketches = {};

function lerp(a, b, t){
	return a + (b - a) * t;
}

function colorWithAlpha(color, alpha) {
	var c = tinycolor(color);
	c.setAlpha(alpha);
	return c;
}

function getInitials(name) {
	return name.match(/\b(\w)/g).join('');
}

function IOSketch(id, elems, opts) {

	this.id = id;
	this.elems = elems ? elems : {};
	this.opts = opts ? opts : {};
	if (!this.opts.colors) {
		this.opts.colors = defaultColors;
	}
	this.users = {};

	// setup paper scope
	this.paper = new paper.PaperScope();
	this.paper.setup(this.elems.canvas);
	this.paper.sketch = this;

	// activate and initialize brushes, layers
	this.activate();
	this.setupBrushes();
	this.updateColorSwatches();

	// register sketch
	sketches[id] = this;

}

IOSketch.prototype.activate = function() {
	if (!this.isActive) {
		window.paper = this.paper;
	}
};

Object.defineProperty(IOSketch.prototype, "isActive", {
	get: function isActive() {
		return window.paper === this.paper;
	}
});

IOSketch.prototype.addUser = function(username, fullname, initials) {
	this.activate();
	if (!this.users[username]) {
		// create new layer;
		var layer = getOrCreateLayer(username);
		if (initials == undefined) {
			initials = getInitials(fullname);
		}
		this.users[username] = {
			layer: layer,
			fullname: fullname,
			initials: initials,
			order: this.users.length,
			activate: function() {
				layer.activate();
			}
		}
		this.updateLayerButtons();
	}

	function getOrCreateLayer(name) {
		var layer;
		for (var i = 0; i < paper.project.layers.length; i++) {
			if (paper.project.layers[i].isEmpty() && !paper.project.layers[i].name) {
				layer = paper.project.layers[i];
			}
		}
		if (!layer) {
			layer = new paper.Layer();
		}
		layer.name = name;
		return layer;
	}
};

IOSketch.prototype.updateLayerButtons = function() {
	// append any new layers
	var child_ids = []
	for (var i = 0; i < this.elems.layers.length; i++) {
		child_ids.push(this.elems.layers[i].getAttribute('user'));
	}
	console.log(child_ids);
	for (var username in this.users) {
		if (child_ids.indexOf(username) < 0) {
			// add new child element
			var elem = document.createElement('div');
			elem.addEventListener('click', this.setLayerActive.bind(this));
			elem.addEventListener('mouseover', this.selectLayer.bind(this));
			elem.addEventListener('mouseout', this.deselectLayer.bind(this));
			elem.innerHTML = this.users[username].initials;
			$(elem).attr({
				user: username,
			}).addClass("layerTile active");
			this.elems.layers.appendChild(elem);
		}
	}
	// sort layer elements
}



IOSketch.prototype.setupBrushes = function() {
	this.paintBrush = new PaintBrush();
	this.eraseBrush = new EraserBrush();

	// setup relation to allow auto-tool switching
	this.paintBrush.eraseTool = this.eraseBrush.tool;
	this.eraseBrush.paintTool = this.paintBrush.tool;

	// setup brush size display
	this.paintBrush.addEventListener(this.elems.brushSize, function() {
		this.elems.brushSize.innerHTML = this.paintBrush.brushMaxSize;
	}.bind(this));
};


IOSketch.prototype.updateColorSwatches = function() {
	// setup color swatches
	for (var i = 0; i < this.opts.colors.length; i++) {
		var swatch = document.createElement('div');
		swatch.style.color = this.opts.colors[i];
		swatch.style.backgroundColor = colorWithAlpha(this.opts.colors[i], 0.5);
		swatch.className = 'colorSwatch boxButton';
		swatch.addEventListener('click', this.setBrushColorCallback.bind(this));
		this.elems.colorSwatches.appendChild(swatch);
		if (i == 0) {
			this.setBrushColorCallback.call(this, {target:swatch});
		}
	}
	this.paintBrush.fireChange();
};


IOSketch.prototype.setBrushColorCallback = function(e) {
	var swatch = e.target;
	var actives = document.getElementsByClassName('colorSwatch boxButton active');
	for (var i = 0; i < actives.length; i++) {
		actives[i].style.backgroundColor = colorWithAlpha(actives[i].style.color, 0.5);
		$(actives[i]).removeClass('active');
	};
	$(swatch).addClass('active');
	swatch.style.backgroundColor = swatch.style.color;
	this.paintBrush.brushColor = swatch.style.color;
};

IOSketch.prototype.setLayerActive = function(e, active) {
	if (e.altKey) {
		var allLayers = document.getElementsByClassName("layerTile");
		for (var i = 0; i < allLayers.length; i++) {
			if ($(allLayers[i]).hasClass('active')) {
				this.setLayerActive({target: allLayers[i]}, false);
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
};

IOSketch.prototype.selectLayer = function(e) {
	var layer = e.target;
	var index = layer.getAttribute('layerindex');
	if (paper.project.layers[index]) {
		paper.project.layers[index].selected = true;
		paper.project.view.update();
	}
};

IOSketch.prototype.deselectLayer = function(e) {
	var layer = e.target;
	var index = layer.getAttribute('layerindex');
	if (paper.project.layers[index]) {
		paper.project.layers[index].selected = false;
		paper.project.view.update();
	}
};





//
// Pressure sentsitive Paint Brush used for drawing basic paths
//


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
};



//
// Eraser Brush, handles hit testing paths and deleting them
//

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


return {
	IOSketch: IOSketch,
	PaintBrush: PaintBrush,
	EraseBrush: EraserBrush,
	sketches: sketches,
}


};




