const socket = require('ws');

const server = new socket.Server({ port: 8080 });

console.log("Web Socket Server is running on port 8080");

server.on('connection', (ws) => {
    console.log("New client connected");

    ws.send("Welcome to yapyapyap");

    ws.on('message', (msg) => {
        console.log(`Received: ${msg}`);
        ws.send(`Received: ${msg}`);
    });

    ws.on('close', () => {
        console.log("Client disconnected");
    });
});
