const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files (HTML, JS, CSS)
app.use(express.static('public'));

// Store rooms and users
const rooms = {};

// Socket.io connection handler
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle joining a room
    socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);

        if (!rooms[room]) {
            rooms[room] = [];
        }

        rooms[room].push(socket.id);

        // Assign roles
        if (rooms[room].length === 1) {
            // First user in the room is the initiator
            socket.emit('role', 'initiator');
        } else if (rooms[room].length === 2) {
            // Second user in the room is the receiver
            socket.emit('role', 'receiver');
        }

        // Relay signaling data within the room
        socket.on('signal', (data) => {
            socket.to(room).emit('signal', data);
        });
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const room in rooms) {
            rooms[room] = rooms[room].filter(id => id !== socket.id);
        }
    });
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Signaling server running on http://localhost:${PORT}`);
});