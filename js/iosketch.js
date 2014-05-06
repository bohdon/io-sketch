

var iosketch = new function() {

var sketches = {};

var defaultColors = ['black', 'white', '#d00', 'orange', '#fe0', '#6a0', '#7ae', '#24a', '#728'];

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
	this.updateColorSwatches();


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

	// setup relation to allow auto-tool switching
	this.paintBrush.eraseTool = this.eraseBrush.tool;
	this.eraseBrush.paintTool = this.paintBrush.tool;

	// setup brush size display
	this.paintBrush.addEventListener(this.elems.brushSize, function() {
		this.elems.brushSize.innerHTML = this.paintBrush.brushMaxSize;
	}.bind(this));
};


IOSketch.prototype.updateColorSwatches = function() {
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
		if (i == 0) {
			this.setBrushColorCallback.call(this, {target:swatch});
		}
	}
	this.paintBrush.fireChange();
};


IOSketch.prototype.setBrushColorCallback = function(e) {
	var swatch = e.target;
	var children = this.elems.colorSwatches.children;
	for (var i = 0; i < children.length; i++) {
		if ($(children[i]).hasClass('active')) {
			children[i].style.backgroundColor = colorWithAlpha(children[i].style.color, 0.5);
			$(children[i]).removeClass('active');
		}
	};
	$(swatch).addClass('active');
	swatch.style.backgroundColor = swatch.style.color;
	this.paintBrush.brushColor = swatch.style.color;
};





//
// Pressure sentsitive Paint Brush used for drawing basic paths
//


function PaintBrush(sketch) {
	this.sketch = sketch;

	this.brushColor = 'black';
	this.brushMaxSize = 4;
	this.brushMinSizeScale = 0.1;
	this.pressureSmoothing = 0.5;

	this.events = {};
	this.smoothPressure = 0;

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
	} else if (event.key == 'b') {
		// already painting
	} else if (event.key == 'e') {
		this.eraseTool.activate();
	}
};



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
	this.tool.onKeyDown = this.onKeyDown.bind(this);
	this.activate = this.tool.activate.bind(this.tool);
}

EraserBrush.prototype.deleteIntersecting = function() {
	if (this.path) {
		var children = paper.project.activeLayer.children;
		for (var i = children.length - 1; i >= 0; i--) {
			var ints = this.path.getIntersections(children[i]);
			if (ints.length) {
				children[i].remove();
			}
		};
	}
}

EraserBrush.prototype.onMouseDown = function(event) {
	// check for tool switch
	if ((wacom.active && !wacom.isEraser) && this.paintTool) {
		this.paintTool.activate();
		this.paintTool.onMouseDown(event);
	}
};

EraserBrush.prototype.onMouseDrag = function(event) {
	if (!this.path) {
		this.path = new paper.Path();
		this.path.add(event.lastPoint);
	}
	this.deleteIntersecting();
	this.path.add(event.point);
};

EraserBrush.prototype.onMouseUp = function(event) {
	if (this.path) {
		this.path.add(event.point);
		this.deleteIntersecting();
		this.path.remove();
		this.path = null;
	}
};	

EraserBrush.prototype.onKeyDown = function(event) {	
	if (event.key == 'b') {
		this.paintTool.activate();
	} else if (event.key == 'e') {
		// already eraser
	}
};


return {
	IOSketch: IOSketch,
	PaintBrush: PaintBrush,
	EraseBrush: EraserBrush,
	sketches: sketches,
	defaultColors: defaultColors,
}


};




