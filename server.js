const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const next = require('next');
const cors = require('cors');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = express();
    server.use(cors());

    const httpServer = http.createServer(server);
    const io = socketIO(httpServer, {
        cors: {
            origin: '*',
        }
    });

    io.on('connection', socket => {
        socket.on('call', () => {
            socket.broadcast.emit('call');
        });

        socket.on('answer', () => {
            socket.broadcast.emit('answer');
        });

        socket.on('message', message => {
            socket.broadcast.emit('message', message);
        });

        socket.on('end', () => {
            socket.broadcast.emit('end');
        });

        socket.on('chatMessage', message => {
            socket.broadcast.emit('chatMessage', message);
        });
    });

    server.all('*', (req, res) => {
        return handle(req, res);
    });

    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, err => {
        if (err) throw err;
        console.log(`Server is running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Error:::::', err);
});