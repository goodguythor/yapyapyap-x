const http = require('http');
const bcrypt = require('bcrypt');
const { Client } = require('pg');
require('dotenv').config();

const port = process.env.PORT;
const host = process.env.HOST;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|:;"'<>,.?/~`]).{8,100}$/;

// TODO:

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

    async function getUserId(target) {
        let targetId = null;

        if (!target) {
            return targetId;
        }

        const result = await db.query(
            `select username, user_id 
            from users
            where username = $1`,
            [target]
        );

        const row = result.rows[0];
        if (row.username === target) targetId = row.user_id;

        return targetId;
    }

    if (method == 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    else if (pathname == "/api/register") {
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

                if (!passwordRegex.test(password)) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({
                        error: "Password must include uppercase, lowercase, number, and symbol"
                    }));
                }


                const saltRounds = 10;

                let hashedPassword;
                try {
                    hashedPassword = await bcrypt.hash(password, saltRounds);
                }
                catch (err) {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Failed to hash password" }));
                }

                try {
                    await db.query(
                        `insert into users (username, password)
                        values ($1, $2)`,
                        [username, hashedPassword]
                    );
                    res.writeHead(201);
                    return res.end(JSON.stringify({ status: "User registration success" }));
                }
                catch (err) {
                    res.writeHead(500);
                    return res.end(JSON.stringify({ error: "User registration failed" }));
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

                if (!passwordRegex.test(password)) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({
                        error: "Password must include uppercase, lowercase, number, and symbol"
                    }));
                }

                try {
                    const result = await db.query(
                        `select user_id, password
                        from users
                        where username = $1`,
                        [username]
                    );

                    if (result.rows.length === 0) {
                        res.writeHead(401, { "Content-Type": "application/json" });
                        return res.end(JSON.stringify({ error: "Invalid username or password" }));
                    }

                    const dbPassword = result.rows[0].password;
                    const match = await bcrypt.compare(password, dbPassword);

                    if (!match) {
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
        if (method == 'GET') {
            const body = await getRequestBody(req);
            const { senderId, target } = body;

            if (!target) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "Target username is missing" }));
            }

            const targetId = await getUserId(target);

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
            const body = await getRequestBody(req);
            const { senderId, target, message } = body;

            if (!message) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "Message not found" }));
            }

            const targetId = await getUserId(target);

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
            const body = await getRequestBody(req);
            const { senderId, target, messageId } = body;

            if (!target) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "Target username is missing" }));
            }


            if (!messageId) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "Message ID not found" }));
            }

            const targetId = await getUserId(target);

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
            const body = await getRequestBody(req);
            const { userId } = body;

            if (!userId) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "User not found" }));
            }

            try {
                const result = await db.query(
                    `select u.username
                    from users as u
                    join contacts as c
                    on c.contact_id = u.user_id
                    where c.user_id = $1
                    and deleted = false`,
                    [userId]
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
            const body = await getRequestBody(req);
            const { userId, target } = body;

            if (!target) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "Target username is missing" }));
            }

            const targetId = await getUserId(target);

            if (!userId || !targetId) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "User not found" }));
            }

            try {
                await db.query(
                    `insert into contacts (user_id, contact_id) 
                    values ($1, $2)`,
                    [userId, targetId]
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
            const body = await getRequestBody(req);
            const { userId, target } = body;

            if (!target) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "Target username is missing" }));
            }

            const targetId = await getUserId(target);

            if (!userId || !targetId) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: "User not found" }));
            }

            try {
                await db.query(
                    `update contacts
                    set deleted = true
                    where (user_id = $1)
                    and (contact_id = $2)`,
                    [userId, targetId]
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
