var express = require('express'),
    path = require('path'),
    fs = require('fs');

var app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server);

var gravatar = require('gravatar');

io.sockets.on('connection', function (socket) {

	socket.user = {};

	socket.on('login', function(data) {
		if (!data.user.username) {
			return socket.emit('login_failed', function(data) {err:'no username'});
		}
		socket.user = data.user;
		if (data.user.email) {
			// update user info
			socket.user.avatar = gravatar.url(data.user.email, {s: '60', r: 'x', d: '404'});
		}
		console.log('user logged in: %s', socket.user.username);
	});

	socket.on('join_room', function(data) {
		if (!socket.user) {
			return socket.emit('join_room_failed', {err:'not logged in'});
		}
		if (!data.room) {
			return socket.emit('join_room_failed', {err:'no room specified'});
		}
		if (socket.room) {
			socket.leave_room();
		}
		// TODO: validate that user is allowed to join room
		socket.room = data.room;

		// join the room
		socket.join(data.room);
		console.log("%s joined room %s", socket.user.username, data.room);

		// sent to all users in room
		io.sockets.to(data.room).emit('user_joined', {
			user: socket.user
		});

		// send all current users in room
		var allSockets = io.sockets.clients(data.room),
			users = allSockets.map(function(c) {return c.user;});

		socket.emit('users_in_room', {
			users: users
		});
		

		// send full state of the sketch
		if (allSockets.length > 1) {
			// request sending of state to the target user
			allSockets[0].emit('send_state', {
				user: socket.user
			});
		}
	});

	socket.on('leave_room', function() {
		if (socket.room) {
			socket.leave_room();
		}
	});

	socket.on('disconnect', function() {
		if (socket.room) {
			socket.leave_room();
		}
	});

	socket.on('action', function(data) {
		// send action to all other clients in room
		if (socket.room) {
			socket.broadcast.to(socket.room).emit('action', data);
		}
	});

	socket.on('send_state', function(data) {
		// forward the state to the correct user
		var allSockets = io.sockets.clients(socket.room);
		for (var i = 0; i < allSockets.length; i++) {
			if (allSockets[i].user.username == data.user.username) {
				allSockets[i].emit('load_state', data);
			}
		}
	});

	socket.leave_room = function() {
		// send to all users in room
		io.sockets.to(socket.room).emit('user_left', {
			user: socket.user
		});

		// leave room
		socket.leave(socket.room);
		console.log("%s left room %s", socket.user.username, socket.room);

		delete socket.room;
	};

});


module.exports = server;
module.exports.use = function() {
	app.use.apply(app, arguments);
};
