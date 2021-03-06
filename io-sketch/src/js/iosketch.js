

var iosketch = new function() {
"use strict";

var io = require('socket.io-client');
var util = require('util');
var events = require('events');


var sketches = {};

var defaultColors = ['black', 'white', '#d00', 'orange', '#fe0', '#6a0', '#7ae', '#24a', '#728'];
var defaultOpts = {
	colors: defaultColors,
	ratio: 16 / 9,
	res: 600,
};

function lerp(a, b, t){
	return a + (b - a) * t;
}

function getInitials(name) {
	return name.match(/\b(\w)/g).join('');
}

function isIntersecting(path, item) {
	if (item.className == 'Path') {
		return path.getIntersections(item).length > 0;
	} else if (item.className == 'Group') {
		for (var i = 0; i < item.children.length; i++) {
			if (isIntersecting(path, item.children[i])) {
				return true;
			}
		}
	}
	return false;
}

function hasFillColor(item, color) {
	if (item.fillColor !== undefined) {
		return item.fillColor.equals(color);
	}
	return false;
}

function urlExists(url) {
	var http = new XMLHttpRequest();
	http.open('HEAD', url, false);
	try {
		http.send();
	} catch (e) {
		return false;
	}
	return http.status != 404;
}

function IOSketch(id, elems, opts) {
	events.EventEmitter.call(this);

	// register sketch
	this.id = id;
	sketches[id] = this;

	this.elems = elems ? elems : {};
	this.opts = jQuery.extend(true, defaultOpts, opts);
	this.users = {};
	this.requireActiveUser = true;

	// setup paper scope
	this.paper = new paper.PaperScope();
	this.paper.setup(this.elems.canvas);
	this.paper.sketch = this;

	this.baseSize = new paper.Size(this.opts.res * this.opts.ratio, this.opts.res);
	this.activeColor = new paper.Color('black');

	// activate and initialize brushes, layers
	this.activate();
	this.setupCanvas();
	this.setupBrushes();
	this.setupColorSwatches();

}

util.inherits(IOSketch, events.EventEmitter);

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

Object.defineProperty(IOSketch.prototype, 'readyForDrawing', {
	get: function readyForDrawing() {
		return (!this.requireActiveUser || this.activeUser) && paper.project.activeLayer.visible;
	}
});

IOSketch.prototype.addObject = function(data) {
	this.activate();
	var layer = this.getUserLayer(data.username);
	if (layer) {
		// import object
		var obj = layer.importJSON(data.obj);
		// update index to match receiver
		// NOTE: inserting at index like this is not reliable
		//       if multiple users are editing the same layer
		// TODO: update with a more reliable tagging system for objects
		layer.insertChild(data.index, obj);
	} else {
		console.warn('Missing layer for user: ' + data.username);
	}
	paper.project.view.update();
};

IOSketch.prototype.removeObject = function(data) {
	this.activate();
	var layer = this.getUserLayer(data.username);
	if (layer) {
		layer.removeChildren(data.index, data.index + 1);
	} else {
		console.warn('Missing layer for user: ' + data.username);
	}
	paper.project.view.update();
};

IOSketch.prototype.remove = function(obj) {
	this.emit('item removed', obj);
	obj.remove();
};


IOSketch.prototype.addUser = function(user) {
	if (!this.users[user.username]) {
		// keep track of active layer
		var layer = paper.project.activeLayer;
		// create new user
		var u = {
			username: user.username,
			layer: this.getOrCreateUserLayer(user.username),
			activate: function() {
				this.layer.activate();
			},
			simplified: function() {
				return {
					username: this.username,
					fullname: this.fullname,
					email: this.email,
				};
			}
		};
		this.users[u.username] = u;
		// restore active layer
		layer.activate();
	}
	var u = this.users[user.username];
	// update user information
	for (var key in user) {
		if (key != 'username') {
			u[key] = user[key];
		}
	}
	// update initials if possible
	if (!u.initials && u.fullname) {
		u.initials = getInitials(u.fullname);
	}
	// update display
	this.updateLayerButtons();
};

IOSketch.prototype.removeUser = function(user, clear) {
	if (this.users[user.username]) {
		// if layer is empty, fully delete the user regardless of clear flag
		var user = this.users[user.username];
		if (user.layer.isEmpty()) {
			clear = true;
		}
		if (clear && user.username != this.activeUsername) {
			// delete user
			user.layer.remove();
			delete this.users[user.username];
			this.updateLayerButtons();
		} else {
			// just set user status to not-online
			this.setUserOnline(user, false);
		}
	}
};

IOSketch.prototype.setUserOnline = function(user, online) {
	if (online === undefined) {
		online = true;
	}
	var u = this.users[user.username];
	if (u) {
		u.online = online;
		var elem = this.elems.layers.children('[user='+user.username+']');
		if (elem) {
			elem.attr('online', u.online);
		}
	}
}

IOSketch.prototype.getOrCreateUserLayer = function(username) {
	this.activate();
	var layer = this.getUserLayer(username);
	if (!layer) {
		// try to use existing empty layer
		for (var i = 0; i < paper.project.layers.length; i++) {
			if (paper.project.layers[i].isEmpty() && !paper.project.layers[i].name) {
				layer = paper.project.layers[i];
			}
		}
	}
	if (!layer) {
		// create new layer
		layer = new paper.Layer();
	}
	layer.name = username;
	return layer;
};

IOSketch.prototype.getUserLayer = function(username) {
	this.activate();
	for (var i = 0; i < paper.project.layers.length; i++) {
		if (paper.project.layers[i].name == username) {
			return paper.project.layers[i];
		}
	}
};


Object.defineProperty(IOSketch.prototype, 'activeUser', {
	get: function activeUser() {
		return this.users[this.activeUsername];
	},
	set: function activeUser(user) {
		this.activeUsername = user.username;
	}
});

Object.defineProperty(IOSketch.prototype, 'activeUsername', {
	get: function activeUsername() {
		return this._activeUsername;
	},
	set: function activeUsername(username) {
		this._activeUsername = username;
		this.updateActiveLayer();
	}
});

IOSketch.prototype.updateActiveLayer = function() {
	if (this.activeUser) {
		this.activeUser.activate();
		$('.layerButton').removeClass('activeUser');
		$('.layerButton[user=' + this.activeUsername + ']').addClass('activeUser');
	}
};


IOSketch.prototype.updateLayerButtons = function() {
	var self = this;
	// remove old layers
	var children = self.elems.layers.children('.layerButton');
	children.each(function(i, el) {
		var username = $(this).attr('user');
		if (!(username in self.users)) {
			$(this).remove();
		}
	});
	// get existing element usernames
	var child_ids = children.map(function(i, el) {return $(this).attr('user');}).get();
	// append any new layers
	for (var username in self.users) {
		var user = self.users[username];
		if (child_ids.indexOf(username) < 0) {
			// add new child element
			var elem = document.createElement('div');
			elem.addEventListener('click', self.setLayerActiveCallback.bind(self));
			elem.addEventListener('mouseover', self.setLayerHilitedCallback.bind(self, true));
			elem.addEventListener('mouseout', self.setLayerHilitedCallback.bind(self, false));
			$(elem).addClass("box button active layerButton").attr('user', username);
			self.elems.layers.append(elem);
		}
	}
	// update display of buttons
	children = self.elems.layers.children('.layerButton');
	children.each(function(i, c) {
		var elem = $(this),
			user = self.users[elem.attr('user')];
		elem.attr('title', user.fullname + ' (' + user.username + ')');
		if (user.avatar && urlExists(user.avatar)) {
			var url = 'url(' + user.avatar + ')';
			if (elem.css('background-image') != url) {
				elem.css({'background-image': url});
			}
			elem.html('');
		} else {
			elem.css({'background-image': null});
			elem.html(user.initials);
		}
	});
	// TODO: sort layer elements
};

IOSketch.prototype.setLayerActiveCallback = function(e, activate) {
	this.activate();
	// TEMP: middle-mouse to switch layers
	var user;
	if (e.button !== 0) {
		user = this.users[e.target.getAttribute('user')];
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
		}
		activate = true;
	}
	// toggle or set active the target layer
	user = this.users[e.target.getAttribute('user')];
	if (user) {
		var layer = user.layer;
		if (activate === undefined) {
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


IOSketch.prototype.setupCanvas = function() {
	var self = this;
	self.updateCanvasSize();
	window.addEventListener('resize', self.updateCanvasSize.bind(self));

	function onDocumentDrag(event) {
		event.preventDefault();
	}

	function onDocumentDrop(event) {
		event.preventDefault();

		var file = event.dataTransfer.files[0];
		var reader = new FileReader();

		reader.onload = function(event) {
			var image = document.createElement('img');
			image.onload = function() {
				self.activate();
				var raster = new paper.Raster(image);
				raster.fitBounds(paper.project.view.bounds);
				paper.project.activeLayer.insertChild(0, raster);
				paper.project.view.update();
				self.emit('item created', raster);
			};
			image.src = event.target.result;
		};
		reader.readAsDataURL(file);
	}

	document.addEventListener('drop', onDocumentDrop);
	document.addEventListener('dragover', onDocumentDrag);
	document.addEventListener('dragleave', onDocumentDrag);
};

IOSketch.prototype.updateCanvasSize = function() {
	this.activate();
	var c = $(this.elems.canvas),
		parent = $(this.elems.canvas.parentNode),
		bound = new paper.Size(parent.width(), parent.height()),
		boundRatio = bound.width / bound.height;
	var scale = this.opts.ratio > boundRatio ? bound.width / this.baseSize.width : bound.height / this.baseSize.height;
	paper.project.view.viewSize = this.baseSize.multiply(scale);
	paper.project.view.setZoom(scale);
	paper.project.view.setCenter(0, 0);
	c[0].style.left = (bound.width - c.width()) / 2;
	c[0].style.top = (bound.height - c.height()) / 2;
};



IOSketch.prototype.setupBrushes = function() {
	var self = this;

	self.paintBrush = new PaintBrush(self);
	self.fillBrush = new FillBrush(self);
	self.eraseBrush = new EraserBrush(self);

	self.updateToolDisplay();
	self.updateBrushSizeDisplay();
	self.updateBrushStrokeDisplay();

	self.elems.paintToolButton.addEventListener('click', function(){
		self.paintBrush.activate();
	});
	self.elems.fillToolButton.addEventListener('click', function(){
		self.fillBrush.activate();
	});
	self.elems.eraseToolButton.addEventListener('click', function(){
		self.eraseBrush.activate();
	});

	self.on('toolChange', self.updateToolDisplay.bind(self));
	self.paintBrush.on('brushSizeChange', self.updateBrushSizeDisplay.bind(self));
	self.paintBrush.on('brushStrokeChange', self.updateBrushStrokeDisplay.bind(self));
	self.eraseBrush.on('eraseTypeChange', self.updateEraseTypeDisplay.bind(self));
};

IOSketch.prototype.updateToolDisplay = function() {
	var paint = $(this.elems.paintToolButton);
	if (paper.tool == this.paintBrush.tool) {
		paint.addClass('active');
	} else {
		paint.removeClass('active');
	}

	var fill = $(this.elems.fillToolButton);
	if (paper.tool == this.fillBrush.tool) {
		fill.addClass('active');
	} else {
		fill.removeClass('active');
	}

	var erase = $(this.elems.eraseToolButton);
	if (paper.tool == this.eraseBrush.tool) {
		erase.addClass('active');
	} else {
		erase.removeClass('active');
	}
};

IOSketch.prototype.updateBrushSizeDisplay = function() {
	this.elems.brushSize.innerHTML = this.paintBrush.brushMaxSize;
};

IOSketch.prototype.updateBrushStrokeDisplay = function() {
	this.elems.brushStroke.className = this.paintBrush.brushStroke;
};

IOSketch.prototype.updateEraseTypeDisplay = function() {
	this.elems.eraseType.className = this.eraseBrush.eraseType;
};



IOSketch.prototype.setupColorSwatches = function() {
	// build color swatch elements
	this.updateColorSwatches();
	this.on('activeColorChange', this.updateActiveColorSwatch.bind(this));
};

IOSketch.prototype.updateColorSwatches = function() {
	// rebuild all color swatch elements
	while(this.elems.colorSwatches.firstChild) {
		this.elems.colorSwatches.removeChild(this.elems.colorSwatches.firstChild);
	}
	// setup color swatches
	for (var i = 0; i < this.opts.colors.length; i++) {
		var swatch = document.createElement('div');
		swatch.style.backgroundColor = this.opts.colors[i];
		swatch.className = 'box button-small colorSwatch';
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
		var swatchColor = new paper.Color(swatches[i].style.backgroundColor);
		if (this.activeColor.equals(swatchColor)) {
			$(s).addClass('active');
		} else {
			$(s).removeClass('active');
		}
	}
};

IOSketch.prototype.setBrushColorCallback = function(e) {
	// set brush color to the clicked swatch's color
	this.activeColor = new paper.Color(e.target.style.backgroundColor);
};

Object.defineProperty(IOSketch.prototype, 'activeColor', {
	get: function activeColor() {
		return this._activeColor;
	},
	set: function activeColor(value) {
		this._activeColor = value;
		this.emit('activeColorChange');
	}
});

IOSketch.prototype.pickColor = function(point) {
	// attempt to color pick via hit test
	var hitResult = paper.project.hitTest(point, {fill: true});
	if (hitResult) {
		// color pick
		this.activeColor = hitResult.item.fillColor;
	}
};

IOSketch.prototype.selectRelativeColor = function(delta) {
	var paperColors = this.opts.colors.map(function(c){ return new paper.Color(c); });
	var index = -1;
	for (var i = 0; i < paperColors.length; i++) {
		if (paperColors[i].equals(this.activeColor)) {
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
		this.activeColor = paperColors[index];
	}
};

IOSketch.prototype.toolChanged = function(tool) {
	this.emit('toolChange', tool);
};


IOSketch.prototype.onKeyDown = function(event) {
	// TODO: prevent tool change mid-drag
	if (event.key == 'b') {
		this.paintBrush.activate();
	} else if (event.key == 'e') {
		this.eraseBrush.activate();
	} else if (event.key == 'f') {
		this.fillBrush.activate();

	} else if (event.key == '[') {
		this.paintBrush.decreaseBrushSize();
	} else if (event.key == ']') {
		this.paintBrush.increaseBrushSize();

	} else if (event.key == 'c') {
		this.selectRelativeColor(-1);
	} else if (event.key == 'v') {
		this.selectRelativeColor(1);
	}

	if (event.modifiers.control) {
		this.paintBrush.brushStroke = 'dashed';
	}
	if (event.modifiers.shift) {
		this.eraseBrush.eraseType = 'all';
	}
};

IOSketch.prototype.onKeyUp = function(event) {
	if (!event.modifiers.control) {
		this.paintBrush.brushStroke = 'solid';
	}
	if (!event.modifiers.shift) {
		this.eraseBrush.eraseType = 'color';
	}
};

IOSketch.prototype.saveFile = function(name, data) {
	var chooser = document.querySelector(name);
	chooser.addEventListener("change", function(evt) {
		console.log(this.value); // get your file name
		var fs = require('fs');// save it now
		fs.writeFile(this.value, data, function(err) {
			if(err) {
				alert("error"+err);
			}
		});
	}, false);

	chooser.click();
};

IOSketch.prototype.saveSVG = function() {
	this.activate();
	this.saveFile('#export_file', paper.project.exportSVG({asString:true}));
};



// IOSketchSocket handles all talking to the server,
// including creating and deleting objects, keeping
// users and layers up to date, etc

function IOSketchSocket(sketch, address, room) {
	var self = this;
	this.sketch = sketch;
	this.address = address;
	this.room = room;

	// TEMP
	$('#serverAddress').html(address);
	$('#roomId').html(room).attr('state', 'disconnected');
	var statusIcon = $('#statusBar');

	var socket = io.connect(address);

	// basic connection events

	socket.on('connecting', function() {
		statusIcon.attr('state', 'connecting');
	});

	socket.on('connect', function() {
		statusIcon.attr('state', 'connected');

		socket.emit('login', {
			user: self.sketch.activeUser.simplified()
		});

		socket.emit('join_room', {
			room: self.room
		});
	});

	socket.on('connect_failed', function() {
		statusIcon.attr('state', 'disconnected');
	});

	socket.on('disconnect', function() {
		statusIcon.attr('state', 'disconnected');
		for (var i = 0; i < self.sketch.users.length; i++) {
			self.sketch.setUserOnline(self.sketch.users[i].username, false);
		};
	});


	// users and room management

	socket.on('login_failed', function(data) {
		alert('failed to login: ' + data.err);
	});

	socket.on('join_room_failed', function(data) {
		alert('failed to join room: ' + data.err);
	});

	socket.on('user_joined', function(data) {
		self.sketch.addUser(data.user);
		self.sketch.setUserOnline(data.user);
		if (data.user.username == self.sketch.activeUsername) {
			$('#roomId').attr('state', 'connected');
		}
	});

	socket.on('user_left', function(data) {
		self.sketch.removeUser(data.user, false);
		self.sketch.setUserOnline(data.user, false);
		if (data.user.username == self.sketch.activeUsername) {
			$('#roomId').attr('state', 'disconnected');
		}
	});

	socket.on('users_in_room', function(data) {
		for (var i = 0; i < data.users.length; i++) {
			self.sketch.addUser(data.users[i]);
			self.sketch.setUserOnline(data.users[i]);
		};
	});

	socket.on('send_state', this.sendState.bind(this));
	socket.on('load_state', this.loadState.bind(this));
	socket.on('action', this.parseAction.bind(this));

	this.socket = socket;
	sketch.socket = socket;

	this.sketch.on('item created', this.sendCreateItem.bind(this));
	this.sketch.on('item removed', this.sendRemoveItem.bind(this));
}

IOSketchSocket.prototype.sendState = function(data) {
	// return action objects for every object in the sketch
	this.sketch.activate();
	data.state = [];
	for (var i = 0; i < paper.project.layers.length; i++) {
		var children = paper.project.layers[i].children;
		for (var j = 0; j < children.length; j++) {
			data.state.push(this.getObjectAction(children[j], 'add'));
		}
	}
	this.socket.emit('send_state', data);
};

IOSketchSocket.prototype.loadState = function(data) {
	for (var i = 0; i < data.state.length; i++) {
		this.parseAction(data.state[i]);
	};
};

IOSketchSocket.prototype.parseAction = function(data) {
	if (data.type == 'add') {
		this.sketch.addObject(data);
	} else if (data.type == 'remove') {
		this.sketch.removeObject(data);
	}
};


IOSketchSocket.prototype.getObjectAction = function(obj, type) {
	var action = {
		type: type,
		username: this.sketch.activeUsername,
	};
	if (type == 'add') {
		action.index = obj.index;
		action.obj = obj.toJSON();
	} else if (type == 'remove') {
		action.index = obj.index;
	}
	return action;
};

IOSketchSocket.prototype.sendCreateItem = function(obj) {
	if (this.socket) {
		this.socket.emit('action', this.getObjectAction(obj, 'add'));
	}
};

IOSketchSocket.prototype.sendRemoveItem = function(obj) {
	if (this.socket) {
		this.socket.emit('action', this.getObjectAction(obj, 'remove'));
	}
};




//
// Pressure sentsitive Paint Brush used for drawing basic paths
//


function PaintBrush(sketch) {
	events.EventEmitter.call(this);

	this.sketch = sketch;

	this.brushStroke = 'solid';
	this.brushMaxSize = 2;
	this.brushMinSizeScale = 0.1;
	this.pressureSmoothing = 0.5;

	this.smoothPressure = 0;

	this.tool = new paper.Tool();
	this.tool.brush = this;
	this.tool.minDistance = 2;
	this.tool.onMouseMove = this.onMouseMove.bind(this);
	this.tool.onMouseDown = this.onMouseDown.bind(this);
	this.tool.onMouseDrag = this.onMouseDrag.bind(this);
	this.tool.onMouseUp = this.onMouseUp.bind(this);
	this.tool.onKeyDown = this.sketch.onKeyDown.bind(this.sketch);
	this.tool.onKeyUp = this.sketch.onKeyUp.bind(this.sketch);
	this.activate = function() {
		this.tool.activate();
		this.sketch.toolChanged();
	};
}

util.inherits(PaintBrush, events.EventEmitter);


Object.defineProperty(PaintBrush.prototype, 'pressure', {
	get: function pressure() {
		return wacom.active ? this.smoothPressure : 0.5;
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
		this.emit('brushSizeChange');
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

Object.defineProperty(PaintBrush.prototype, 'brushStroke', {
	get: function brushStroke() {
		return this._brushStroke;
	},
	set: function brushStroke(value) {
		this._brushStroke = value;
		this.emit('brushStrokeChange');
	}
});


PaintBrush.prototype.colorIntersecting = function(event, path) {
	var children = paper.project.activeLayer.children;
	for (var i = children.length - 1; i >= 0; i--) {
		if (children[i] != path) {
			if (isIntersecting(path, children[i])) {
				children[i].fillColor = this.sketch.activeColor;
			}
		}
	}
};

PaintBrush.prototype.onMouseMove = function(event) {
	// check for tool switch
	// if (wacom.isEraser && false) {
	//  this.sketch.eraseBrush.activate();
	// }
};

PaintBrush.prototype.onMouseDown = function(event) {
	this.smoothPressure = 0;
	
	// hit test for possible color pick
	if (event.modifiers.option) {
		this.sketch.pickColor(event.point);
	} else if (event.modifiers.shift) {
		// hit test for apply color
		var hitResult = paper.project.activeLayer.hitTest(event.point, {fill: true});
		if (hitResult) {
			// apply color
			if (hitResult.item.parent.className != 'Layer') {
				hitResult.item.parent.fillColor = this.sketch.activeColor;
			} else {
				hitResult.item.fillColor = this.sketch.activeColor;
			}
		}
	}
};

PaintBrush.prototype.onMouseDrag = function(event) {
	if (!this.sketch.readyForDrawing) {
		return;
	}

	// update smooth pressure
	if (wacom.loaded) {
		this.smoothPressure = lerp(this.smoothPressure, wacom.pressure, this.pressureAccel);
	}

	// check for dashing functionality
	var shouldDraw = true;
	this.tool.maxDistance = null;
	if (this.brushStroke == 'dashed') {
		this.dashDistance = 4 * this.brushMaxSize;
		this.tool.maxDistance = this.dashDistance / 2;
		if (this.pathCore && this.dashDistance > 0) {
			shouldDraw = this.pathCore.length % (this.dashDistance * 2.5) < this.dashDistance;
		}
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
			this.path.fillColor = this.sketch.activeColor;
			this.path.add(event.lastPoint);

			// group all newly created strokes
			if (!this.pathGroup) {
				this.pathGroup = new paper.Group();
			}
			this.pathGroup.addChild(this.path);

			// create a core path that can be used
			// to check distances, etc
			if (!this.pathCore) {
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
	if (this.pathGroup) {
		// send path group
		this.sketch.emit('item created', this.pathGroup);
		this.pathGroup = null;
	}
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
};


//
// Fill Brush, draws a basic path with a fill color
//

function FillBrush(sketch) {
	events.EventEmitter.call(this);

	this.sketch = sketch;

	this.tool = new paper.Tool();
	this.tool.brush = this;
	this.tool.onMouseMove = this.onMouseMove.bind(this);
	this.tool.onMouseDown = this.onMouseDown.bind(this);
	this.tool.onMouseDrag = this.onMouseDrag.bind(this);
	this.tool.onMouseUp = this.onMouseUp.bind(this);
	this.tool.onKeyDown = this.sketch.onKeyDown.bind(this.sketch);
	this.tool.onKeyUp = this.sketch.onKeyUp.bind(this.sketch);
	this.activate = function() {
		this.tool.activate();
		this.sketch.toolChanged();
	};
}

util.inherits(FillBrush, events.EventEmitter);


FillBrush.prototype.onMouseMove = function(event) {
	// check for tool switch
	// if (wacom.isEraser && false) {
	//  this.sketch.eraseBrush.activate();
	// }
};

FillBrush.prototype.onMouseDown = function(event) {
	// hit test for possible color pick
	if (event.modifiers.option) {
		this.sketch.pickColor(event.point);
	} else if (event.modifiers.shift) {
		// hit test for apply color
		var hitResult = paper.project.activeLayer.hitTest(event.point, {fill: true});
		if (hitResult) {
			// apply color
			if (hitResult.item.parent.className != 'Layer') {
				hitResult.item.parent.fillColor = this.sketch.activeColor;
			} else {
				hitResult.item.fillColor = this.sketch.activeColor;
			}
		}
	}
};

FillBrush.prototype.onMouseDrag = function(event) {
	if (!this.sketch.readyForDrawing) {
		return;
	}

	// create a new path if necessary
	if (!this.path) {
		if (event.modifiers.option) {
			// color picked
		} else if (event.modifiers.shift) {
			// TODO: make this behave unique to this tool,
			//       e.g. colors everything inside the fill
			// dont draw, just color existing objects
			var path = new paper.Path();
			path.add(event.lastPoint);
			path.add(event.point);
			this.sketch.paintBrush.colorIntersecting(event, path);
			path.remove();

		} else {
			// start drawing path
			this.path = new paper.Path();
			this.path.fillColor = this.sketch.activeColor;
			this.path.opacity = 0.25;
			this.path.add(event.lastPoint);
		}
	}

	if (this.path) {
		this.path.add(event.point);
		this.path.smooth();
	}
};

FillBrush.prototype.onMouseUp = function(event) {
	if (this.path) {
		this.path.closed = true;
		this.path.smooth();
		this.path.simplify();
		this.sketch.emit('item created', this.path);
		this.path = null;
	}
};



//
// Eraser Brush, handles hit testing paths and deleting them
//

function EraserBrush(sketch) {
	events.EventEmitter.call(this);

	this.sketch = sketch;

	this.eraseType = 'color';

	this.tool = new paper.Tool();
	this.tool.brush = this;
	this.tool.onMouseMove = this.onMouseMove.bind(this);
	this.tool.onMouseDown = this.onMouseDown.bind(this);
	this.tool.onMouseDrag = this.onMouseDrag.bind(this);
	this.tool.onMouseUp = this.onMouseUp.bind(this);
	this.tool.onKeyDown = this.sketch.onKeyDown.bind(this.sketch);
	this.tool.onKeyUp = this.sketch.onKeyUp.bind(this.sketch);
	this.activate = function() {
		this.tool.activate();
		this.sketch.toolChanged();
	};
}

util.inherits(EraserBrush, events.EventEmitter);


Object.defineProperty(EraserBrush.prototype, 'eraseType', {
	get: function eraseType() {
		return this._eraseType;
	},
	set: function eraseType(value) {
		this._eraseType = value;
		this.emit('eraseTypeChange');
	}
});

EraserBrush.prototype.deleteIntersecting = function(event, path) {
	var children = paper.project.activeLayer.children;
	for (var i = children.length - 1; i >= 0; i--) {
		if (children[i] != path) {
			if (isIntersecting(path, children[i])) {
				if (this.eraseType == 'color' && !hasFillColor(children[i], this.sketch.activeColor)) {
					// dont erase, doesn't match the active color
					continue;
				}
				this.sketch.remove(children[i]);
			}
		}
	}
};

EraserBrush.prototype.onMouseMove = function(event) {
	// check for tool switch
	// if (wacom.active && !wacom.isEraser) {
	//  this.sketch.paintBrush.activate();
	// }
};

EraserBrush.prototype.onMouseDown = function(event) {
	if (event.modifiers.option) {
		// color pick
		this.sketch.pickColor(event.point);
	} else {
		// hit test for erase
		var hitResult = paper.project.activeLayer.hitTest(event.point, {fill: true});
		if (hitResult) {
			// erase
			if (this.eraseType != 'color' || hasFillColor(hitResult.item, this.sketch.activeColor)) {
				if (hitResult.item.parent.className != 'Layer') {
					this.sketch.remove(hitResult.item.parent);
				} else {
					this.sketch.remove(hitResult.item);
				}
			}
		}
	}
};

EraserBrush.prototype.onMouseDrag = function(event) {
	if (!this.sketch.readyForDrawing) {
		return;
	}

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
	IOSketchSocket: IOSketchSocket,
	PaintBrush: PaintBrush,
	EraseBrush: EraserBrush,
	sketches: sketches,
	defaultColors: defaultColors,
};


}();




