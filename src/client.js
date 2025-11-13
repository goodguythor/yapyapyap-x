const socket = new WebSocket('ws://localhost:8080');

socket.addEventListener("open", (event) => {
    socket.send("Welcome to yapyapyap");
});

socket.addEventListener("message", (event) => {
    console.log("Message: ", event.data);
});

socket.addEventListener("close", (event) => {
    console.log("Websocket connection is closed");
});

socket.addEventListener("error", (event) => {
    console.log("Error: ", event);
});
