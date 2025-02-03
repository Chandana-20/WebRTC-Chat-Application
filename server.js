const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

// Serve static files
app.use(express.static('public'));

// Add a test route
app.get('/test', (req, res) => {
    res.send('Server is running!');
});

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (roomId) => {
        console.log(`Socket ${socket.id} joining room ${roomId}`);
        socket.join(roomId);
        
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        
        const room = rooms.get(roomId);
        room.add(socket.id);
        
        const role = room.size === 1 ? 'initiator' : 'receiver';
        console.log(`Assigning role ${role} to socket ${socket.id}`);
        socket.emit('role', role);
        
        io.to(roomId).emit('userCount', room.size);
    });

    socket.on('signal', (data) => {
        console.log(`Signal ${data.signalData.type} from ${socket.id} in room ${data.roomId}`);
        socket.to(data.roomId).emit('signal', data.signalData);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const [roomId, peers] of rooms.entries()) {
            if (peers.has(socket.id)) {
                peers.delete(socket.id);
                if (peers.size === 0) {
                    rooms.delete(roomId);
                }
                io.to(roomId).emit('userCount', peers.size);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Handle errors
server.on('error', (error) => {
    console.error('Server error:', error);
});

io.on('connect_error', (error) => {
    console.error('Socket.IO error:', error);
});