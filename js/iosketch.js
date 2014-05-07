

var iosketch = new function() {

var sketches = {};

var defaultColors = ['black', 'grey', 'white', '#d00', 'orange', '#fe0', '#6a0', '#7ae', '#24a', '#728'];

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

	// register sketch
	this.id = id;
	sketches[id] = this;

	this.elems = elems ? elems : {};
	this.opts = opts ? opts : {};
	if (!this.opts.colors) {
		this.opts.colors = defaultColors;
	}
	this.users = {};
	this.requireActiveUser = true;

	// setup paper scope
	this.paper = new paper.PaperScope();
	this.paper.setup(this.elems.canvas);
	this.paper.sketch = this;

	// activate and initialize brushes, layers
	this.activate();
	this.setupBrushes();
	this.setupColorSwatches();


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

IOSketch.prototype.addUser = function(user) {
	this.activate();
	var layer = paper.project.activeLayer;
	if (!this.users[user.username]) {
		// create new user
		var u = {};
		for (var key in user) {
			u[key] = user[key];
		}
		// get some user info automatically
		if (!u.initials && u.fullname) {
			u.initials = getInitials(u.fullname);
		}
		// add layer functionality
		u.layer = getOrCreateLayer(user.username);
		u.activate = function() {
			this.layer.activate();
		}
		this.users[u.username] = u;
		this.updateLayerButtons();
	}
	layer.activate();

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


Object.defineProperty(IOSketch.prototype, 'activeUser', {
	get: function activeUser() {
		return this._activeUser;
	},
	set: function activeUser(username) {
		this._activeUser = username;
		this.updateActiveLayer();
	}
});

IOSketch.prototype.updateActiveLayer = function() {
	if (this.users[this.activeUser]) {
		this.users[this.activeUser].activate();
	}
}


IOSketch.prototype.updateLayerButtons = function() {
	// append any new layers
	var children = this.elems.layers.children;
	var child_ids = []
	for (var i = 0; i < children.length; i++) {
		child_ids.push(children[i].getAttribute('user'));
	}
	for (var username in this.users) {
		var user = this.users[username];
		if (child_ids.indexOf(username) < 0) {
			// add new child element
			var elem = document.createElement(user.image ? 'img' : 'div');
			elem.addEventListener('click', this.setLayerActiveCallback.bind(this));
			elem.addEventListener('mouseover', this.setLayerHilitedCallback.bind(this, true));
			elem.addEventListener('mouseout', this.setLayerHilitedCallback.bind(this, false));
			if (user.image) {
				elem.src = user.image;
			} else {
				elem.innerHTML = user.initials;
			}
			$(elem).attr({
				user: username,
			}).addClass("layerButton active");
			this.elems.layers.appendChild(elem);
		}
	}
	// TODO: remove old layers

	// TODO: sort layer elements
}

IOSketch.prototype.setLayerActiveCallback = function(e, activate) {
	this.activate();
	// TEMP: middle-mouse to switch layers
	if (e.button != 0) {
		var user = this.users[e.target.getAttribute('user')];
		if (user) {
			user.activate();
		}
		return;
	}
	// alt to solo the layer
	if (e.altKey) {
		var allLayers = document.getElementsByClassName("layerButton");
		for (var i = 0; i < allLayers.length; i++) {
			if ($(allLayers[i]).hasClass('active')) {
				this.setLayerActiveCallback({target: allLayers[i]}, false);
			}
		};
		activate = true;
	}
	// toggle or set active the target layer
	var user = this.users[e.target.getAttribute('user')];
	if (user) {
		var layer = user.layer;
		if (activate == undefined) {
			activate = !$(e.target).hasClass('active');
		}
		if (activate) {
			$(e.target).addClass('active');
			layer.visible = true;
		} else {
			$(e.target).removeClass('active');
			layer.visible = false;
		}
		paper.project.view.update();
	}
};

IOSketch.prototype.setLayerHilitedCallback = function(hilite, e) {
	this.activate();
	var user = this.users[e.target.getAttribute('user')];
	if (user) {
		user.layer.selected = hilite;
		paper.project.view.update();
	}
};





IOSketch.prototype.setupBrushes = function() {
	this.paintBrush = new PaintBrush(this);
	this.eraseBrush = new EraserBrush(this);
	this.updateBrushSizeDisplay();
	this.paintBrush.addEventListener('brushSizeChange', this.updateBrushSizeDisplay.bind(this));
};

IOSketch.prototype.updateBrushSizeDisplay = function() {
	this.elems.brushSize.innerHTML = this.paintBrush.brushMaxSize;
};



IOSketch.prototype.setupColorSwatches = function() {
	// build color swatch elements
	this.updateColorSwatches();
	this.paintBrush.addEventListener('brushColorChange', this.updateActiveColorSwatch.bind(this));
};

IOSketch.prototype.updateColorSwatches = function() {
	// rebuild all color swatch elements
	while(this.elems.colorSwatches.firstChild) {
		this.elems.colorSwatches.removeChild(this.elems.colorSwatches.firstChild);
	}
	// setup color swatches
	for (var i = 0; i < this.opts.colors.length; i++) {
		var swatch = document.createElement('div');
		swatch.style.color = this.opts.colors[i];
		swatch.style.backgroundColor = colorWithAlpha(this.opts.colors[i], 0.5);
		swatch.className = 'colorSwatch boxButton';
		swatch.addEventListener('click', this.setBrushColorCallback.bind(this));
		this.elems.colorSwatches.appendChild(swatch);
	}
	this.updateActiveColorSwatch();
};

IOSketch.prototype.updateActiveColorSwatch = function() {
	// update activate state of all color swatches
	var swatches = this.elems.colorSwatches.children;
	for (var i = 0; i < swatches.length; i++) {
		var s = swatches[i];
		var swatchColor = new paper.Color(swatches[i].style.color);
		if (this.paintBrush.brushColor.equals(swatchColor)) {
			// activate swatch
			$(s).addClass('active');
			s.style.backgroundColor = s.style.color;
		} else {
			// deactivate swatch
			$(s).removeClass('active');
			s.style.backgroundColor = colorWithAlpha(s.style.color, 0.5);
		}
	}
};

IOSketch.prototype.setBrushColorCallback = function(e) {
	// set brush color to the clicked swatch's color
	this.paintBrush.brushColor = e.target.style.color;
};

IOSketch.prototype.selectRelativeColor = function(delta) {
	var paperColors = this.opts.colors.map(function(c){return new paper.Color(c)});
	var index = -1;
	for (var i = 0; i < paperColors.length; i++) {
		if (paperColors[i].equals(this.paintBrush.brushColor)) {
			index = i;
			break;
		}
	}
	if (index >= 0) {
		index += delta;
		if (index < 0) {
			index = paperColors.length - 1;
		}
		index %= paperColors.length;
		this.paintBrush.brushColor = paperColors[index];
	}
}


IOSketch.prototype.onKeyDown = function(event) {
	// TODO: prevent tool change mid-drag
	if (event.key == 'b') {
		this.paintBrush.activate();
	} else if (event.key == 'e') {
		this.eraseBrush.activate();

	} else if (event.key == '[') {
		this.paintBrush.decreaseBrushSize();
	} else if (event.key == ']') {
		this.paintBrush.increaseBrushSize();

	} else if (event.key == 'c') {
		this.selectRelativeColor(-1);
	} else if (event.key == 'v') {
		this.selectRelativeColor(1);
	}
}




//
// Pressure sentsitive Paint Brush used for drawing basic paths
//


function PaintBrush(sketch) {
	this.sketch = sketch;
	this.events = {};

	this.brushColor = new paper.Color('black');
	this.brushMaxSize = 4;
	this.brushMinSizeScale = 0.1;
	this.pressureSmoothing = 0.5;

	this.smoothPressure = 0;

	this.tool = new paper.Tool();
	this.tool.brush = this;
	this.tool.minDistance = 2;
	this.tool.onMouseDown = this.onMouseDown.bind(this);
	this.tool.onMouseDrag = this.onMouseDrag.bind(this);
	this.tool.onMouseUp = this.onMouseUp.bind(this);
	this.tool.onKeyDown = this.sketch.onKeyDown.bind(this.sketch);
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

Object.defineProperty(PaintBrush.prototype, 'brushColor', {
	get: function brushColor() {
		return this._brushColor;
	},
	set: function brushColor(color) {
		this._brushColor = new paper.Color(color);
		this.fireChange('brushColorChange');
	}
});


Object.defineProperty(PaintBrush.prototype, 'pressure', {
	get: function pressure() {
		return wacom.active ? this.smoothPressure : 1;
	}
});

Object.defineProperty(PaintBrush.prototype, 'pressureAccel', {
	get: function pressureAccel() {
		return 1 - Math.min(this.pressureSmoothing, 0.99);
	}
});

Object.defineProperty(PaintBrush.prototype, 'brushSize', {
	get: function brushSize() {
		return lerp(this.brushMinSize, this.brushMaxSize, this.pressure);
	},
	set: function brushSize(size) {
		this.brushMaxSize = size;
		this.fireChange('brushSizeChange');
	}
});

Object.defineProperty(PaintBrush.prototype, 'brushMinSize', {
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

PaintBrush.prototype.colorIntersecting = function(event, path) {
	var children = paper.project.activeLayer.children;
	for (var i = children.length - 1; i >= 0; i--) {
		if (children[i] != path) {
			var ints = path.getIntersections(children[i]);
			if (ints.length) {
				children[i].fillColor = this.brushColor;
			}
		}
	};
};

PaintBrush.prototype.pickColor = function(event) {
	// attempt to color pick via hit test
	var hitResult = paper.project.hitTest(event.point, {fill: true});
	if (hitResult) {
		// color pick
		this.brushColor = hitResult.item.fillColor;
	}
}


PaintBrush.prototype.onMouseDown = function(event) {
	// check for tool switch
	if (wacom.isEraser && this.sketch.eraseBrush) {
		this.sketch.eraseBrush.activate();
		this.sketch.eraseBrush.tool.onMouseDown(event);
	}
	this.smoothPressure = 0;
	
	// hit test for possible color pick
	if (event.modifiers.option) {
		this.pickColor(event);
	} else if (event.modifiers.shift) {
		// hit test for apply color
		var hitResult = paper.project.hitTest(event.point, {fill: true});
		if (hitResult) {
			// apply color
			hitResult.item.fillColor = this.brushColor;
		}
	}
};

PaintBrush.prototype.onMouseDrag = function(event) {
	if (this.sketch.requireActiveUser && !this.sketch.activeUser) {
		return;
	}

	// update smooth pressure
	if (wacom.loaded) {
		this.smoothPressure = lerp(this.smoothPressure, wacom.pressure, this.pressureAccel);
	}

	// check if layer is active
	if (!paper.project.activeLayer.visible) {
		return;
	}

	// check for dashing functionality
	var shouldDraw = true;
	this.dashDistance = event.modifiers.control ? 6 * this.brushSize : 0;
	this.tool.maxDistance = event.modifiers.control ? this.dashDistance / 2 : null;
	if (this.pathCore && this.dashDistance > 0) {
		shouldDraw = this.pathCore.length % (this.dashDistance * 2.5) < this.dashDistance;
	}

	// create a new path if necessary
	if (!this.path) {
		if (event.modifiers.option) {
			// color picked
		} else if (event.modifiers.shift) {
			// dont draw, just color existing objects
			var path = new paper.Path();
			path.add(event.lastPoint);
			path.add(event.point);
			this.colorIntersecting(event, path);
			path.remove();

		} else if (shouldDraw) {
			// start drawing path
			this.path = new paper.Path();
			this.path.fillColor = this.brushColor;
			this.path.add(event.lastPoint);
			if (!this.pathCore) {
				// create a core path that can be used
				// to check distances, etc
				this.pathCore = new paper.Path();
				this.pathCore.add(event.lastPoint);
			}
		}
	}

	if (this.path) {
		// add to path on both sides creating dynamic width
		var delta = event.delta.normalize();
		delta.angle = delta.angle + 90;
		var top = event.middlePoint.add(delta.multiply(this.brushSize));
		var bottom = event.middlePoint.add(delta.multiply(-this.brushSize));
		this.path.add(top);
		this.path.insert(0, bottom);
		this.path.smooth();
		if (!shouldDraw) {
			this.closePath(event);
		}
	}
	if (this.pathCore) {
		this.pathCore.add(event.point);
	}
};

PaintBrush.prototype.onMouseUp = function(event) {
	this.closePath(event);
	if (this.pathCore) {
		this.pathCore.remove();
		this.pathCore = null;
	}
};

PaintBrush.prototype.closePath = function(event) {
	// close current visible path
	if (this.path) {
		this.path.add(event.point);
		this.path.closed = true;
		this.path.smooth();
		this.path.simplify();
		this.path = null;
	}
}



//
// Eraser Brush, handles hit testing paths and deleting them
//

function EraserBrush(sketch) {
	this.sketch = sketch;

	this.tool = new paper.Tool();
	this.tool.brush = this;
	this.tool.onMouseDown = this.onMouseDown.bind(this);
	this.tool.onMouseDrag = this.onMouseDrag.bind(this);
	this.tool.onMouseUp = this.onMouseUp.bind(this);
	this.tool.onKeyDown = this.sketch.onKeyDown.bind(this.sketch);
	this.activate = this.tool.activate.bind(this.tool);
}

EraserBrush.prototype.deleteIntersecting = function(event, path) {
	var children = paper.project.activeLayer.children;
	for (var i = children.length - 1; i >= 0; i--) {
		if (children[i] != path) {
			var ints = path.getIntersections(children[i]);
			if (ints.length) {
				if (event.modifiers.shift && !children[i].fillColor.equals(this.sketch.paintBrush.brushColor)) {
					// dont erase, doesn't match the active color
					continue;
				}
				children[i].remove();
			}
		}
	}
}

EraserBrush.prototype.onMouseDown = function(event) {
	// check for tool switch
	if ((wacom.active && !wacom.isEraser) && this.sketch.paintBrush) {
		this.sketch.paintBrush.activate();
		this.sketch.paintBrush.tool.onMouseDown(event);
	}

	if (event.modifiers.option) {
		// color pick
		this.sketch.paintBrush.pickColor(event);
	} else {
		// hit test for erase
		var hitResult = paper.project.hitTest(event.point, {fill: true});
		if (hitResult) {
			// erase
			if (!event.modifiers.shift || hitResult.item.fillColor.equals(this.sketch.paintBrush.brushColor)) {
				hitResult.item.remove();
			}
		}
	}
};

EraserBrush.prototype.onMouseDrag = function(event) {
	if (event.modifiers.option) {
		return;
	}
	// erase intersecting
	var path = new paper.Path();
	path.add(event.lastPoint);
	path.add(event.point);
	this.deleteIntersecting(event, path);
	path.remove();
};

EraserBrush.prototype.onMouseUp = function(event) {
};	



return {
	IOSketch: IOSketch,
	PaintBrush: PaintBrush,
	EraseBrush: EraserBrush,
	sketches: sketches,
	defaultColors: defaultColors,
}


};




