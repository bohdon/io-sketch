
var paintBrush, eraseBrush;

$(document).ready(function() {

	var canvas = document.getElementById('artcanvas');
	paper.setup(canvas);

	paintBrush = new PressureBrush();

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



function PressureBrush() {

	this.brushColor = 'black';
	this.brushMaxSize = 4;
	this.brushMinSizeScale = 0.1;
	this.pressureSmoothing = 0.5;

	var curPressure = 0,
		path;

	getPressure = function() {
		return wacom.active ? wacom.pressure : 1;
	};

	getSmoothPressure = function() {
		return wacom.active ? curPressure : 1;
	};

	getPressureAccel = function() {
		return 1 - Math.min(this.pressureSmoothing, 0.99);
	};

	getBrushSize = function() {
		return lerp(this.brushMinSize, this.brushMaxSize, this.smoothPressure);
	};
	
	setBrushSize = function(size) {
		this.brushMaxSize = size;
	};

	getBrushMinSize = function() {
		return this.brushMaxSize * this.brushMinSizeScale;
	};

	this.increaseBrushSize = function() {
		this.setBrushSize(Math.min(32, this.brushMaxSize * 2));
	};

	this.decreaseBrushSize = function() {
		this.setBrushSize(Math.max(1, this.brushMaxSize / 2));
	};


	this.onMouseDown = function(event) {
		curPressure = 0;
	};

	this.onMouseDrag = function(event) {
		// update smooth pressure
		if (wacom.loaded) {
			curPressure = lerp(curPressure, wacom.pressure, this.pressureAccel);
		}

		// create a new path if necessary
		if (!path) {
			path = new paper.Path({
				fillColor: this.brushColor
			});
			path.add(event.lastPoint);
		}

		var delta = event.delta.normalize();
		delta.angle = delta.angle + 90;

		// add to path on both sides creation dynamic width
		var top = event.middlePoint.add(delta.multiply(this.brushSize));
		var bottom = event.middlePoint.add(delta.multiply(-this.brushSize));

		path.add(top);
		path.insert(0, bottom);
		path.smooth();
	};

	this.onMouseUp = function(event) {
		if (path) {
			// finish path
			path.add(event.point);
			path.closed = true;
			path.simplify(1);
			path = null;
		}
	};

	this.onKeyDown = function(event) {
		if (event.key == '[') {
			this.decreaseBrushSize();
		} else if (event.key == ']') {
			this.increaseBrushSize();
		}
	}

	this.tool = new paper.Tool();
	this.tool.onMouseDown = this.onMouseDown.bind(this);
	this.tool.onMouseDrag = this.onMouseDrag.bind(this);
	this.tool.onMouseUp = this.onMouseUp.bind(this);
	this.tool.onKeyDown = this.onKeyDown.bind(this);
	this.activate = this.tool.activate.bind(this.tool);
	this.tool.brush = this;

	this.__defineGetter__('pressure', getPressure);
	this.__defineGetter__('smoothPressure', getSmoothPressure);
	this.__defineGetter__('pressureAccel', getPressureAccel);
	this.__defineGetter__('brushSize', getBrushSize);
	this.__defineSetter__('brushSize', setBrushSize);
	this.__defineGetter__('brushMinSize', getBrushMinSize);

}

