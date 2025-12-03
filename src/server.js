// TODO:
// - fix get send message logic

const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });
const { Client } = require('pg');
require('dotenv').config();

console.log("WebSocket Server running at ws://localhost:8080");

const clients = new Map();

let db = null;

function getCookie(name, cookieHeader) {
    const cookies = cookieHeader?.split(";").map(c => c.trim());
    for (let c of cookies) {
        const [key, value] = c.split("=");
        if (key === name) return value;
    }
    return null;
}

async function connectDB() {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });

    await client.connect();
    console.log("Connected to database");
    return client;
}

async function getUserId(target) {
    const result = await db.query(
        `select user_id
                    from users
                    where username = $1`,
        [target]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0].user_id;
}

(async () => {
    db = await connectDB();
})();

server.on('connection', async (ws, req) => {
    console.log("New client connected");

    const cookieHeader = req.headers.cookie;
    const sessionToken = getCookie("session_token", cookieHeader);

    if (!sessionToken) {
        ws.send(JSON.stringify({ error: "No session token" }));
        ws.close();
        return;
    }

    console.log("Client session:", sessionToken);

    let userId = null;
    try {
        const result = await db.query(
            `SELECT user_id FROM sessions WHERE token = $1 AND expires_at >= NOW()`,
            [sessionToken]
        );

        if (result.rows.length === 0) {
            ws.send(JSON.stringify({ error: "Invalid session" }));
            ws.close();
            return;
        }

        userId = result.rows[0].user_id;
        ws.userId = userId; // attach to ws object
        clients.set(userId, ws);

        const res = await db.query(
            `select username from users where user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            ws.send(JSON.stringify({ error: "Invalid user" }));
            ws.close();
            return;
        }

        const username = res.rows[0].username;
        ws.username = username;

        console.log("Authenticated user:", userId, username);

    }
    catch (err) {
        console.error("Session validation error:", err);
        ws.send(JSON.stringify({ error: "Session validation failed" }));
        ws.close();
        return;
    }

    ws.send(JSON.stringify({
        type: "announcement",
        message: "Welcome to yapyapyap",
        timestamp: Date.now()
    }));

    ws.on('message', async (rawData) => {
        console.log("Received:", rawData.toString());

        let parsed;
        try {
            parsed = JSON.parse(rawData);
        } catch (err) {
            ws.send(JSON.stringify({ error: "Invalid JSON format" }));
            return;
        }

        const action = parsed.action;

        if (action === "insert") {
            const message = parsed.message;
            const target = parsed.target;

            if (!message || !target) {
                ws.send(JSON.stringify({ error: "Missing fields" }));
                return;
            }

            try {
                const recipientId = await getUserId(target);
                if (!recipientId) {
                    ws.send(JSON.stringify({ error: "Recipient not found" }));
                    return;
                }

                const res = await db.query(
                    `INSERT INTO messages (message, sender_id, recipient_id)
                     VALUES ($1, $2, $3)
                    returning message_id`,
                    [message, ws.userId, recipientId]
                );

                const messageId = res.rows[0].message_id;

                ws.send(JSON.stringify({
                    action: "insert",
                    message_id: messageId,
                    target: target,
                    message,
                    timestamp: Date.now(),
                    sent: true,
                }));

                const targetSocket = clients.get(recipientId);
                if (targetSocket) {
                    targetSocket.send(JSON.stringify({
                        action: "insert",
                        message_id: messageId,
                        target: ws.username,
                        message,
                        timestamp: Date.now(),
                        sent: false,
                    }));
                }
            } catch (err) {
                console.error("DB Error:", err);
                ws.send(JSON.stringify({ error: "Database error" }));
            }
        }
        else if (action === 'delete') {
            const messageId = parsed.messageId;
            const target = parsed.target;

            if (!messageId || !target) {
                ws.send(JSON.stringify({ error: "Missing fields" }));
                return;
            }

            try {
                const recipientId = await getUserId(target);

                if (!recipientId) {
                    ws.send(JSON.stringify({ error: "Recipient not found" }));
                    return;
                }

                await db.query(
                    `update messages
                    set deleted = true
                    where (message_id = $1)
                    and (sender_id = $2)
                    and (recipient_id = $3)`,
                    [messageId, ws.userId, recipientId]
                );

                ws.send(JSON.stringify({
                    action: 'delete',
                    message_id: messageId,
                    target: target,
                }));

                const targetSocket = clients.get(recipientId);
                if (targetSocket) {
                    targetSocket.send(JSON.stringify({
                        action: 'delete',
                        message_id: messageId,
                        target: ws.username,
                    }));
                }
            } catch (err) {
                console.error("DB Error:", err);
                ws.send(JSON.stringify({ error: "Database error" }));
            }
        }
        else if (action === 'edit') {
            const messageId = parsed.messageId;
            const message = parsed.message;
            const target = parsed.target;

            if (!messageId || !message || !target) {
                ws.send(JSON.stringify({ error: "Missing fields" }));
                return;
            }

            try {
                const recipientId = await getUserId(target);

                if (!recipientId) {
                    ws.send(JSON.stringify({ error: "Recipient not found" }));
                    return;
                }

                await db.query(
                    `update messages
                    set message = $1
                    where (message_id = $2)
                    and (sender_id = $3)
                    and (recipient_id = $4)`,
                    [message, messageId, ws.userId, recipientId]
                );

                ws.send(JSON.stringify({
                    action: 'edit',
                    message_id: messageId,
                    target: target,
                    message: message,
                }));

                const targetSocket = clients.get(recipientId);
                if (targetSocket) {
                    targetSocket.send(JSON.stringify({
                        action: 'edit',
                        message_id: messageId,
                        target: ws.username,
                        message: message,
                    }));
                }
            } catch (err) {
                console.error("DB Error:", err);
                ws.send(JSON.stringify({ error: "Database error" }));
            }
        }
    });

    ws.on('close', () => {
        clients.delete(ws.userId);
        console.log("Client disconnected");
    });
});
