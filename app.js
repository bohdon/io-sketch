var express = require('express'),
    path = require('path'),
    fs = require('fs');

var app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server);


io.sockets.on('connection', function (socket) {
	// TODO: send current full state of drawing

	socket.on('action', function(data) {
		// send action to all other sockets
		socket.broadcast.emit('action', data);
	});

	socket.on('disconnect', function(data) {

	});
	
});

module.exports = server;
module.exports.use = function() {
	app.use.apply(app, arguments);
}