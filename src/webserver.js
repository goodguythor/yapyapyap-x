const http = require('http');
const port = 4000;
const server = http.createServer((req, res) => {
    const { method, url } = req;
    const parsedUrl = new URL(url, `http://${req.headers.host}/api/`);
    const path = parsedUrl.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method == 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    else if (pathname == "chat") {
        if (method == 'GET') {
        }
        else if (method == 'POST') {
        }
        else if (method == 'DELETE') { }
    }
    else if (pathname == "contact") {
        if (method == 'GET') {
        }
        else if (method == 'POST') {
        }
        else if (method == 'DELETE') { }
    }
    else {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end("This page doesn't exist");
    }
});



server.listen(port, 'localhost', () => {
    console.log(`Server running at port ${port}`);
});
