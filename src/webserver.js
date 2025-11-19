const http = require('http');
const { Client } = require('pg');
require('dotenv').config();

const port = process.env.PORT;
const host = process.env.HOST;

// TODO:
// - Save sender_id on FE so we don't fetch sender_id on each query
// - Implement contact api

let db = null;

function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk.toString();
        });

        req.on("end", () => {
            try {
                const json = JSON.parse(body);
                resolve(json);
            }
            catch (err) {
                reject(err);
            }
        });

        req.on("error", reject);
    });
}

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
    const parsedUrl = new URL(url, `http://${host}:${port}`);
    const pathname = parsedUrl.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method == 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    else if (pathname == "/api/login") {
        if (method == 'POST') {
            try {
                const body = await getRequestBody(req);
                const { username, password } = body;

                if (!username || !password) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Missing username or password" }));
                }

                if (password.length < 8) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Password must have at least 8 characters" }));
                }

                if (password.length > 100) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Password must have at most 100 characters" }));
                }

                const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|:;"'<>,.?/~`]).{8,100}$/;

                if (!passwordRegex.test(password)) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({
                        error: "Password must include uppercase, lowercase, number, and symbol"
                    }));
                }

                try {
                    const result = await db.query(
                        `select user_id
                        from users
                        where username = $1
                        and password = $2`,
                        [username, password]
                    );

                    if (result.rows.length === 0) {
                        res.writeHead(401, { "Content-Type": "application/json" });
                        return res.end(JSON.stringify({ error: "Invalid username or password" }));
                    }

                    res.writeHead(200);
                    return res.end(JSON.stringify(result.rows[0].user_id));
                }
                catch (err) {
                    res.writeHead(500);
                    return res.end(JSON.stringify({ error: "Login failed" }));
                }
            }
            catch (err) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "Invalid JSON" }));
            }
        }
        else {
            res.writeHead(405, { 'Allow': 'POST' });
            return res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
    }
    else if (pathname == "/api/chat") {
        const sender = parsedUrl.searchParams.get('sender');
        const target = parsedUrl.searchParams.get('target');

        async function getUserId(sender, target) {
            let senderId = null, targetId = null;

            if (!sender || !target) {
                return { senderId: null, targetId: null };
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
                    `select message_id, message, timestamp 
                    from messages
                    where ((sender_id = $1 and recipient_id = $2)
                    or (sender_id = $2 and recipient_id = $1))
                    and deleted = false
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
            const message = parsedUrl.searchParams.get('message');

            if (!message) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "Message not found" }));
            }

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
                return res.end(JSON.stringify({ status: "Insert successful" }));
            }
            catch (err) {
                res.writeHead(500);
                return res.end(JSON.stringify({ error: err }));
            }
        }
        else if (method == 'PATCH') {
            const messageId = parsedUrl.searchParams.get('message_id');

            if (!messageId) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "Message ID not found" }));
            }

            const { senderId, targetId } = await getUserId(sender, target);

            if (!senderId || !targetId) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "User not found" }));
            }

            try {
                await db.query(
                    `update messages
                    set deleted = true
                    where (message_id = $1)
                    and (sender_id = $2)
                    and (recipient_id = $3)`,
                    [messageId, senderId, targetId]
                );

                res.writeHead(200);
                return res.end(JSON.stringify({ status: "Delete successful" }));
            }
            catch (err) {
                res.writeHead(500);
                return res.end(JSON.stringify({ error: err }));
            }
        }
        else {
            res.writeHead(405, { 'Allow': 'GET, POST, PATCH' });
            return res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
    }
    else if (pathname == "/api/contact") {
        if (method == 'GET') {

        }
        else if (method == 'POST') {

        }
        else if (method == 'DELETE') {

        }
        else {
            res.writeHead(405, { 'Allow': 'GET, POST, DELETE' });
            return res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end("yapyapyap");
});

async function startServer() {
    db = await connectDB();
    server.listen(port, host, () => {
        console.log(`Server running at http://${host}:${port}`);
    });
}

startServer();
