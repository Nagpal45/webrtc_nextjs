import express, { Request, Response } from 'express';
import http from 'http';
import socketIO from 'socket.io';
import next from 'next';
import cors from 'cors';

const dev: boolean = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = express();
    server.use(cors());

    const httpServer = http.createServer(server);
    const io = new socketIO.Server(httpServer, {
        cors: {
            origin: '*',
        }
    });

    io.on('connection', (socket: socketIO.Socket) => {
        socket.on('call', () => {
            socket.broadcast.emit('call');
        });

        socket.on('answer', () => {
            socket.broadcast.emit('answer');
        });

        socket.on('message', (message: any) => {
            socket.broadcast.emit('message', message);
        });

        socket.on('end', () => {
            socket.broadcast.emit('end');
        });

        socket.on('chatMessage', (message: string) => {
            socket.broadcast.emit('chatMessage', message);
        });
    });

    server.all('*', (req: Request, res: Response) => {
        return handle(req, res);
    });

    const PORT: string | number = process.env.PORT || 3000;
    httpServer.listen(PORT, (err?: Error) => {
        if (err) throw err;
        console.log(`Server is running on port ${PORT}`);
    });
}).catch((err: Error) => {
    console.error('Error:::::', err);
});
