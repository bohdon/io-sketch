/*
 * Loads the Wacom Tablet plugin
 * http://www.wacomeng.com/web/TestFBPluginTable.html
 */


$(document).ready(function() {
	loadWacomPlugin();
})


wacom = {
	get plugin() { return document.embeds['wtPlugin']; },
	get loaded() { return (this.plugin && this.plugin.version != undefined); },

	get version() { return this.plugin.penAPI.version; },
	get isWacom() { return this.plugin.penAPI.isWacom; },
	get isEraser() { return this.plugin.penAPI.isEraser; },
	get pointerType() { return this.plugin.penAPI.pointerType; },
	get tabletModel() { return this.plugin.penAPI.tabletModel; },
	get pressure() { return this.plugin.penAPI.pressure; },
	get tangentialPressure() { return this.plugin.penAPI.tangentialPressure; },
	get posX() { return this.plugin.penAPI.posX; },
	get posY() { return this.plugin.penAPI.posY; },
	get sysX() { return this.plugin.penAPI.sysX; },
	get sysY() { return this.plugin.penAPI.sysY; },
	get tabX() { return this.plugin.penAPI.tabX; },
	get tabY() { return this.plugin.penAPI.tabY; },
	get tiltX() { return this.plugin.penAPI.tiltX; },
	get tiltY() { return this.plugin.penAPI.tiltY; },
	get rotationDeg() { return this.plugin.penAPI.rotationDeg; },
	get rotationRad() { return this.plugin.penAPI.rotationRad; },
}


function loadWacomPlugin() {
	if (!wacom.plugin) {
		wtPlugin = document.createElement('embed');
		wtPlugin.id = 'wtPlugin';
		wtPlugin.type = 'application/x-wacomtabletplugin';
		wtPlugin.style.position = 'fixed';
		document.body.appendChild(wtPlugin);
	}
	if (!wacom.loaded) {
		alert("Could not load Wacom Tablet plugin");
	}
}


