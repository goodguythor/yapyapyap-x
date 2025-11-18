const http = require('http');
const { Client } = require('pg');
require('dotenv').config();

let db = null;

async function connectDB() {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });

    try {
        await client.connect();
        console.log('Connected to database');
        return client;
    }
    catch (err) {
        console.error('DB connection error', err);
        process.exit(1);
    }
}

const server = http.createServer(async (req, res) => {
    const { method, url } = req;
    const parsedUrl = new URL(url, `http://${process.env.HOST}/api`);
    const pathname = parsedUrl.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method == 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    else if (pathname == "/chat") {
        const sender = parsedUrl.searchParams.get('sender');
        const target = parsedUrl.searchParams.get('target');
        const message = parsedUrl.searchParams.get('message');
        const messageId = parsedUrl.searchParams.get('message_id');

        async function getUserId(sender, target) {
            let senderId = null, targetId = null;

            if (!senderId || !targetId) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "User not found" }));
            }

            const result = await db.query(
                `select username, user_id 
                from users
                where username = $1 or username = $2`,
                [sender, target]
            );

            for (const row of result.rows) {
                if (row.username === sender) senderId = row.user_id;
                else if (row.username === target) targetId = row.user_id;
            }

            return { senderId, targetId };
        }

        if (method == 'GET') {
            const { senderId, targetId } = await getUserId(sender, target);

            if (!senderId || !targetId) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "User not found" }));
            }

            try {
                const result = await db.query(
                    `select message, timestamp 
                    from messages
                    where (sender_id = $1 and recipient_id = $2) 
                    or (sender_id = $2 and recipient_id = $1)
                    order by timestamp ASC`,
                    [senderId, targetId]
                );
                res.writeHead(200, { 'content-type': 'application/json' });
                return res.end(JSON.stringify(result.rows));
            }
            catch (err) {
                res.writeHead(500);
                return res.end(JSON.stringify({ error: err }));
            }
        }
        else if (method == 'POST') {
            const { senderId, targetId } = await getUserId(sender, target);

            if (!senderId || !targetId) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "User not found" }));
            }

            try {
                await db.query(
                    `insert into messages (message, sender_id, recipient_id) 
                    values ($1, $2, $3)`,
                    [message, senderId, targetId]
                );
                res.writeHead(201);
                res.end(JSON.stringify({ status: "insert successful" }));
            }
            catch (err) {
                res.writeHead(500);
                return res.end(JSON.stringify({ error: err }));
            }
        }
        else if (method == 'DELETE') {
            const { senderId } = await getUserId(sender, target);

            if (!senderId) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "User not found" }));
            }

            try {
                await db.query(
                    `delete from messages
                    where (message_id = $1)
                    and (sender_id = $2)`,
                    [messageId, senderId]
                );

                res.writeHead(200);
                res.end(JSON.stringify({ status: "delete successful" }));
            }
            catch (err) {
                res.writeHead(500);
                return res.end(JSON.stringify({ error: err }));
            }
        }
        else {
            res.writeHead(405, { 'Allow': 'GET' });
            return res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
    }
    else if (pathname == "/contact") {
        if (method == 'GET') {

        }
        else if (method == 'POST') {

        }
        else if (method == 'DELETE') {

        }
        else {
            res.writeHead(405, { 'Allow': 'GET' });
            return res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end("This page doesn't exist");
});

async function startServer() {
    db = await connectDB();
    server.listen(port, host, () => {
        console.log(`Server running at http://${process.env.HOST}:${process.env.PORT}`);
    });
}

startServer();
