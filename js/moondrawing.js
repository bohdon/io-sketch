
$(document).ready(function() {

	var canvas = document.getElementById('artcanvas');
	paper.setup(canvas);

	var paintBrush = new PaintBrush();
	var eraseBrush = new EraserBrush();
	// setup relation to allow auto-tool switching
	paintBrush.eraseTool = eraseBrush.tool;
	eraseBrush.paintTool = paintBrush.tool;

	function brush_onMouseDown(event) {
		if (wacom.isEraser) {
			eraseTool.activate();
		} else {
			paintTool.activate();
		}
	}

});



function lerp(a, b, t){
	return a + (b - a) * t;
}



/*
 * Pressure sentsitive Paint Brush used for drawing basic paths
 */

function PaintBrush() {
	this.brushColor = 'black';
	this.brushMaxSize = 4;
	this.brushMinSizeScale = 0.1;
	this.pressureSmoothing = 0.5;

	this.changeCallbacks = [];
	this.smoothPressure = 0;
	this.path;

	this.tool = new paper.Tool();
	this.tool.brush = this;
	this.tool.onMouseDown = this.onMouseDown.bind(this);
	this.tool.onMouseDrag = this.onMouseDrag.bind(this);
	this.tool.onMouseUp = this.onMouseUp.bind(this);
	this.tool.onKeyDown = this.onKeyDown.bind(this);
	this.activate = this.tool.activate.bind(this.tool);
}


PaintBrush.prototype.addChangeListener = function(callback) {
	changeCallbacks.push(callback);
};

PaintBrush.prototype.removeChangeListener = function(callback) {

};

PaintBrush.prototype.fireChange = function() {
	for (var i = 0; i < changeCallbacks.length; i++) {
		changeCallbacks[i]();
	};
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

