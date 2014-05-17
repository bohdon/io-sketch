var express = require('express'),
    path = require('path'),
    fs = require('fs');

var app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server);

var gravatar = require('gravatar');

io.sockets.on('connection', function (socket) {

	socket.leave_room = function() {
		socket.broadcast.to(this.room).emit('user_left', {
			user: this.user
		});
		socket.leave(this.room);
		delete socket.room;
	};

	socket.on('login', function(data) {
		socket.user = data.user;
		if (data.user.email) {
			// update user info
			socket.user.avatar = gravatar.url(data.user.email, {s: '30', r: 'x', d: 'retro'});
			socket.emit('user_info', {
				user: socket.user
			});
		}
	});

	socket.on('join_room', function(data) {
		if (this.room) {
			this.leave_room();
		}
		// TODO: validate that user is allowed to join room
		socket.room = data.room;

		// broadcast to other users
		socket.broadcast.to(data.room).emit('user_joined', {
			user: socket.user
		});

		// join the room
		socket.join(data.room);

		// send all current users in room
		var users = chat.clients(data.room).map(function(c) {return c.user;});
		socket.emit('users_in_room', {
			users: users
		});
		// TODO: send full state of drawing for this room
	});

	socket.on('leave_room', function() {
		if (this.room) {
			this.leave_room();
		}
	});

	socket.on('disconnect', function() {
		if (this.room) {
			this.leave_room();
		}
	});

	socket.on('action', function(data) {
		// send action to all other clients in room
		if (this.room) {
			socket.broadcast.to(this.room).emit('action', data);
		}
	});

});


module.exports = server;
module.exports.use = function() {
	app.use.apply(app, arguments);
};
