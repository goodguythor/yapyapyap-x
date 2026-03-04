document.addEventListener("DOMContentLoaded", async () => {
    // TODO:
    // - Implement E2EE on message
    async function forceFetch(url, options = {}) {
        const res = await fetch(url, { credentials: "include", ...options });
        if (res.status === 401 || res.status === 400) {
            const data = await res.json().catch(() => ({}));
            if (data.error === "Invalid Session") {
                alert("Please login first");
                redirectToLogin();
                return null;
            }
        }
        return res;
    }

    async function fetchMe() {
        const res = await forceFetch("http://localhost:4000/api/user/me", {
            method: "GET",
        });

        const data = await res.json();
        return data;
    }

    const me = await fetchMe();
    if (!me || !me.username) {
        window.location.href = "./login.html";
        return;
    }

    const username = me.username;

    console.log("Logged in as", username);

    const socket = new WebSocket(`ws://localhost:8080`);
    const chatContainer = document.querySelector(".chat");
    const inputBox = document.querySelector(".text-box");
    const sendButton = document.querySelector(".send-button");
    const contactNameDisplay = document.querySelector(".contact-name");
    const contactList = document.querySelector(".contact-list");
    const addButton = document.querySelector(".add-button");
    const contactBox = document.querySelector(".contact-box");
    const logoutButton = document.querySelector(".logout-button");
    const deleteButton = document.querySelector(".delete-button");
    const menu = document.querySelector(".message-menu");
    const typingIndicator = document.querySelector(".typing-indicator");

    let recipient = "";
    let chatCache = {};
    let typingTimeout = null;

    socket.onopen = () => {
        console.log("Connected to WebSocket as", username);
    };

    socket.onmessage = (event) => {
        const msgObj = JSON.parse(event.data);
        console.log(msgObj);
        const action = msgObj.action;
        const target = msgObj.target;
        const messageId = msgObj.message_id;
        if (action === 'insert') {
            if (!contactExists(target)) createContactButton(target, false);
            if (!chatCache[target]) chatCache[target] = fetchChatHistory(target);
            console.log(msgObj);
            chatCache[target].push({ message_id: msgObj.message_id, message: msgObj.message, timestamp: msgObj.timestamp, sent: msgObj.sent });
            if (target != recipient) return;
            if (msgObj.sent) {
                appendMessage(msgObj.message_id, msgObj.message, msgObj.timestamp);
            } else {
                appendReceivedMessage(msgObj.message_id, msgObj.message, msgObj.timestamp);
            }

        }
        else if (action === 'reply') {
            if (!chatCache[target]) chatCache[target] = fetchChatHistory(target);
            console.log(msgObj);
            chatCache[target].push({ message_id: msgObj.message_id, message: msgObj.message, timestamp: msgObj.timestamp, sent: msgObj.sent, referral_id: msgObj.referral_id });
            if (target != recipient) return;
            if (msgObj.sent) {
                appendReplyMessage(msgObj.message_id, msgObj.message, msgObj.timestamp, msgObj.referral_id);
            } else {
                appendReceivedReplyMessage(msgObj.message_id, msgObj.message, msgObj.timestamp, msgObj.referral_id);
            }
        }
        else if (action === 'delete') {
            const msgDiv = document.querySelector(`[data-message-id="${messageId}"]`);
            if (msgDiv) msgDiv.remove();
            const chat = chatCache[target];
            if (chat) {
                const idx = chat.findIndex(m => m.message_id == messageId);
                if (idx != -1) chat.splice(idx, 1);
            }
        }
        else if (action === 'edit') {
            const msgDiv = document.querySelector(`[data-message-id="${messageId}"]`);
            if (msgDiv) {
                const messageElement = msgDiv.querySelector(".message");
                messageElement.textContent = msgObj.message;
            }// update message with msgObj.message
            const chat = chatCache[target];
            if (chat) {
                const idx = chat.findIndex(m => m.message_id == messageId);
                if (idx !== -1) {
                    chat[idx].message = msgObj.message;
                }
            }
        }
        else if (action === "status") {
            const contactBtn = document.querySelector(`[data-username="${msgObj.username}"]`);
            if (contactBtn) {
                console.log("good");
                const dot = contactBtn.querySelector('.status-dot');
                if (dot) dot.style.background = msgObj.online ? 'green' : 'gray';
            }
        }
        else if (action === 'typing') {
            if (msgObj.username === recipient) {
                if (msgObj.isTyping) {
                    typingIndicator.textContent = `${msgObj.username} is typing...`;
                    typingIndicator.classList.remove("hidden");
                } else {
                    typingIndicator.textContent = "";
                    typingIndicator.classList.add("hidden");
                }
            }

            const contactBtn = document.querySelector(`.contact-button[data-username="${msgObj.username}"]`);
            if (contactBtn) {
                const nameSpan = contactBtn.querySelector("span");
                nameSpan.textContent = msgObj.isTyping ? `${msgObj.username} is typing` : msgObj.username;
            }
        }
    };

    socket.onclose = () => {
        console.log("Disconnected from WebSocket");
        if (event.code !== 1000) {
            redirectToLogin();
        }
    };

    socket.onerror = (err) => {
        console.error("WebSocket error:", err);
    };

    forceFetch(
        `http://localhost:4000/api/contact`,
        {
            method: 'GET'
        }
    )
        .then(res => res.json())
        .then(data => {
            data.forEach(contact => {
                createContactButton(contact.username, contact.contact);
            });

            const usernames = data.map(c => c.username);
            if (usernames.length > 0) {
                socket.send(JSON.stringify({ action: 'getStatus', targets: usernames }));
            }
        })
        .catch(err => console.error("Failed to fetch contacts:", err));

    chatContainer.addEventListener("click", (e) => {
        if (e.target.classList.contains("message-option")) {
            chatContainer.querySelectorAll(".selected")
                .forEach(el => {
                    el.classList.remove("selected");
                    el.querySelector(".unselect").click();
                });
            const msgDiv = e.target.closest("[data-message-id]");
            const messageId = msgDiv.dataset.messageId;
            console.log("Clicked message:", messageId);

            menu.style.left = e.pageX + "px";
            menu.style.top = e.pageY + "px";

            // Store the message id
            menu.dataset.messageId = messageId;

            const editBtn = menu.querySelector("[data-action='edit']");
            const deleteBtn = menu.querySelector("[data-action='delete']");
            const isRecipient = msgDiv.classList.contains("recipient");

            if (isRecipient) {
                editBtn.classList.add("hidden");
                deleteBtn.classList.add("hidden");
            }
            else {
                editBtn.classList.remove("hidden")
                deleteBtn.classList.remove("hidden");
            }

            menu.classList.remove("hidden");
        }
        const previewBtn = e.target.closest(".reply-preview");
        if (previewBtn) {
            console.log("reff woy");
            const refId = previewBtn.dataset.referralId;
            const target = document.querySelector(`[data-message-id="${refId}"]`);
            if (!target) return;

            target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (e.target.classList.contains("unselect")) {
            const msgDiv = e.target.closest("[data-message-id]");
            msgDiv.querySelector('.unselect').classList.add('hidden');
            msgDiv.classList.remove('selected');
            inputBox.value = "";
            sendButton.dataset.action = "insert";
            delete menu.dataset.messageId;
        }
    });

    inputBox.addEventListener("input", () => {
        if (recipient === "") return;

        socket.send(JSON.stringify({ action: 'typing', target: recipient, isTyping: true }));

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.send(JSON.stringify({ action: 'typing', target: recipient, isTyping: false }));
        }, 3000); // stops typing signal 1.5s after last keystroke
    });

    menu.addEventListener("click", (e) => {
        const action = e.target.dataset.action;
        const messageId = menu.dataset.messageId;
        if (action === "edit") {
            console.log("Edit message:", messageId);
            sendButton.dataset.action = 'edit';
            const chat = chatCache[recipient];
            const idx = chat.findIndex(m => m.message_id == messageId);
            if (idx != -1) {
                inputBox.value = chatCache[recipient][idx].message;
            }
            const msgDiv = document.querySelector(`[data-message-id="${messageId}"]`);
            if (msgDiv) {
                msgDiv.classList.add("selected");
                msgDiv.querySelector(".unselect").classList.remove("hidden");
            }
        }

        else if (action === "delete" && confirm("Are you sure want to delete this message?")) {
            console.log("Delete message:", messageId);
            const payload = { action: 'delete', messageId: messageId, target: recipient }
            socket.send(JSON.stringify(payload));
        }

        else if (action === "reply") {
            sendButton.dataset.action = "reply";
            const msgDiv = document.querySelector(`[data-message-id="${messageId}"]`);
            console.log(msgDiv);
            if (msgDiv) {
                msgDiv.classList.add("selected");
                msgDiv.querySelector(".unselect").classList.remove("hidden");
            }
        }

        // Hide menu after click
        menu.classList.add("hidden");
    });

    document.addEventListener("click", (e) => {
        if (!menu.contains(e.target) && !e.target.classList.contains("message-option")) {
            menu.classList.add("hidden");
        }
    });

    sendButton.addEventListener("click", (e) => {
        if (recipient === "") {
            alert("Select contact first");
            return;
        }
        const message = inputBox.value.trim();
        if (message === "") {
            alert("Message cannot empty");
            return;
        }
        const action = e.target.dataset.action;
        if (action === 'insert') {
            const payload = {
                action: 'insert',
                message: message,
                target: recipient,
            };
            // console.log("Sending message:", payload);
            socket.send(JSON.stringify(payload));
        }
        else if (action === 'edit') {
            const payload = {
                action: 'edit',
                messageId: menu.dataset.messageId,
                message: message,
                target: recipient,
            }
            socket.send(JSON.stringify(payload));

            const msgDiv = document.querySelector(`[data-message-id="${menu.dataset.messageId}"]`);
            if (msgDiv) {
                msgDiv.classList.remove("selected");
                msgDiv.querySelector(".unselect").classList.add("hidden");
            }
            sendButton.dataset.action = 'insert';
            delete menu.dataset.messageId;
        }
        else if (action === 'reply') {
            const payload = {
                action: 'reply',
                message: message,
                target: recipient,
                referral_id: menu.dataset.messageId,
            }
            socket.send(JSON.stringify(payload));

            const msgDiv = document.querySelector(`[data-message-id="${menu.dataset.messageId}"]`);
            if (msgDiv) {
                msgDiv.classList.remove("selected");
                msgDiv.querySelector(".unselect").classList.add("hidden");
            }
            sendButton.dataset.action = 'insert';
            delete menu.dataset.messageId;
        }
        inputBox.value = "";
    });

    function redirectToLogin() {
        if (socket && socket.readyState === WebSocket.OPEN) socket.close();
        window.location.href = "./login.html";
    }

    logoutButton.addEventListener("click", () => {
        if (confirm("Are you sure you want to log out?")) {
            forceFetch("http://localhost:4000/api/user/logout", {
                method: "POST",
            }).finally(() => redirectToLogin());
        }
    });

    addButton.addEventListener("click", () => {
        const newContact = contactBox.value.trim();
        if (newContact === username) alert("Can't add your account into contact");
        else if (newContact !== "") {
            forceFetch(`http://localhost:4000/api/contact`, {
                method: "POST",
                body: JSON.stringify({
                    target: newContact
                }),
                headers: {
                    "Content-Type": "application/json"
                }
            })
                .then(res => {
                    if (!res.ok) {
                        throw new Error("Failed to add contact");
                    }
                    return res.json();
                })
                .then(data => {
                    console.log("Contact added:", data);
                    createContactButton(newContact, true);
                    contactBox.value = ""; // Clear input box   
                    socket.send(JSON.stringify({ action: 'getStatus', targets: [newContact] }));
                })
                .catch(err => {
                    console.error("Error adding contact:", err);
                    alert("Failed to add contact. Please try again.");
                });
        }
        else {
            alert("Contact name cannot be empty.");
        }
    });

    deleteButton.addEventListener("click", () => {
        if (recipient === "") {
            alert("Please select a contact to delete.");
            return;
        }
        if (deleteButton.textContent === "Delete Contact") {
            if (confirm(`Are you sure you want to delete the contact "${recipient}"?`)) {
                forceFetch(`http://localhost:4000/api/contact`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        target: recipient
                    }),
                })
                    .then(res => {
                        if (!res.ok) {
                            throw new Error("Failed to delete contact");
                        }
                        return res.json();
                    })
                    .then(data => {
                        console.log("Contact deleted:", data);
                        const contactButton = document.querySelector(`.contact-button[data-username="${recipient}"]`);
                        if (contactButton) {
                            contactButton.dataset.isContact = "false";
                            deleteButton.textContent = "Add Contact";
                        }
                    })
                    .catch(err => {
                        console.error("Error deleting contact:", err);
                        alert("Failed to delete contact. Please try again.");
                    });
            }
        }
        else {
            forceFetch(`http://localhost:4000/api/contact`, {
                method: "POST",
                body: JSON.stringify({
                    target: recipient
                }),
                headers: {
                    "Content-Type": "application/json"
                }
            })
                .then(res => {
                    if (!res.ok) {
                        throw new Error("Failed to add contact");
                    }
                    return res.json();
                })
                .then(data => {
                    console.log("Contact added:", data);
                    const contactButton = [...document.querySelectorAll('.contact-button')].find(button => button.textContent === recipient);
                    if (contactButton) {
                        contactButton.dataset.isContact = "true";
                        deleteButton.textContent = "Delete Contact";
                    }
                })
                .catch(err => {
                    console.error("Error adding contact:", err);
                    alert("Failed to add contact. Please try again.");
                });
        }
    });

    function formatTimestamp(ts) {
        const date = new Date(ts);

        return date.toLocaleString("en-GB", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function contactExists(name) {
        return !!document.querySelector(`.contact-button[data-username="${name}"]`);
    }

    function createContactButton(contactName, isContact) {
        const button = document.createElement("button");
        button.classList.add("contact-button");

        button.dataset.isContact = isContact ? "true" : "false";

        button.dataset.username = contactName; // <-- add this

        // Add text + dot separately so textContent queries still work
        const nameSpan = document.createElement("span");
        nameSpan.textContent = contactName;
        const dot = document.createElement("span");
        dot.classList.add("status-dot");

        button.appendChild(nameSpan);
        button.appendChild(dot);

        button.addEventListener("click", () => {
            inputBox.value = "";
            sendButton.dataset.action = "insert";
            delete menu.dataset.messageId;
            recipient = contactName;
            contactNameDisplay.textContent = recipient;
            chatContainer.innerHTML = "";
            //const nameSpan = button.querySelector("span");
            //nameSpan.textContent = contactName;
            typingIndicator.textContent = "";
            typingIndicator.classList.add("hidden");

            if (button.dataset.isContact === "false") deleteButton.textContent = "Add Contact";
            else deleteButton.textContent = "Delete Contact";

            fetchChatHistory(recipient);
        });
        contactList.appendChild(button);
    }

    function appendMessage(messageId, message, timestamp) {
        const msgDiv = document.createElement("div");
        msgDiv.dataset.messageId = messageId;
        msgDiv.classList.add("message-container", "sender");
        msgDiv.innerHTML = `
            <div class="message-header">
                <button class="message-option">...</button>
                <div class="name">You</div>
                <button class="unselect hidden">X</button>
            </div>
            <div class="name">${formatTimestamp(timestamp)}</div>
            <hr class="name-line">
            <div class="message"></div>
        `;
        const messageElement = msgDiv.querySelector(".message");
        messageElement.textContent = message;

        chatContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function appendReceivedMessage(messageId, message, timestamp) {
        const msgDiv = document.createElement("div");
        msgDiv.dataset.messageId = messageId;
        msgDiv.classList.add("message-container", "recipient");
        msgDiv.innerHTML = `
            <div class="message-header">
                <button class="message-option">...</button>
                <div class="name">${recipient}</div> 
                <button class="unselect hidden">X</button>
            </div>
            <div class="name">${formatTimestamp(timestamp)}</div>
            <hr class="name-line">
            <div class="message"></div>
        `;
        const messageElement = msgDiv.querySelector(".message");
        messageElement.textContent = message;
        chatContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function appendReplyMessage(messageId, message, timestamp, referralId) {
        const original = document.querySelector(`[data-message-id="${referralId}"]`);
        let previewHTML = "";

        if (original) {
            const originalMsg = original.querySelector(".message")?.textContent || "(deleted message)";
            previewHTML = `
                <button class="reply-preview" data-referral-id="${referralId}">
                    <div class="name">Replying to:</div>
                    <hr class="name-line">
                    <div class="reply-message">${originalMsg}</div>
                </button>
            `;
        }

        const msgDiv = document.createElement("div");
        msgDiv.dataset.messageId = messageId;
        msgDiv.classList.add("message-container", "sender");
        msgDiv.innerHTML = `
            <div class="message-header">
                <button class="message-option">...</button>
                <div class="name">You</div>
                <button class="unselect hidden">X</button>
            </div>
            ${previewHTML}
            <div class="name">${formatTimestamp(timestamp)}</div>
            <hr class="name-line">
            <div class="message"></div>
        `;
        const messageElement = msgDiv.querySelector(".message");
        messageElement.textContent = message;

        chatContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function appendReceivedReplyMessage(messageId, message, timestamp, referralId) {
        const original = document.querySelector(`[data-message-id="${referralId}"]`);
        let previewHTML = "";

        if (original) {
            const originalMsg = original.querySelector(".message")?.textContent || "(deleted message)";
            previewHTML = `
                <button class="reply-preview" data-referral-id="${referralId}">
                    <div class="name">Replying to:</div>
                    <hr class="name-line">                    
                    <div class="reply-message">${originalMsg}</div>
                </button>
            `;
        }
        const msgDiv = document.createElement("div");
        msgDiv.dataset.messageId = messageId;
        msgDiv.classList.add("message-container", "recipient");
        msgDiv.innerHTML = `
            <div class="message-header">
                <button class="message-option">...</button>
                <div class="name">${recipient}</div> 
                <button class="unselect hidden">X</button>
            </div>
            ${previewHTML}
            <div class="name">${formatTimestamp(timestamp)}</div>
            <hr class="name-line">
            <div class="message"></div>
        `;
        const messageElement = msgDiv.querySelector(".message");
        messageElement.textContent = message;
        chatContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function renderChat(messages) {
        chatContainer.innerHTML = "";
        messages.forEach(msgObj => {
            // console.log(msgObj);
            if (msgObj.sent) {
                if (msgObj.referral_id) appendReplyMessage(msgObj.message_id, msgObj.message, msgObj.timestamp, msgObj.referral_id);
                else appendMessage(msgObj.message_id, msgObj.message, msgObj.timestamp);
            } else {
                if (msgObj.referral_id) appendReceivedReplyMessage(msgObj.message_id, msgObj.message, msgObj.timestamp, msgObj.referral_id);
                else appendReceivedMessage(msgObj.message_id, msgObj.message, msgObj.timestamp);
            }
        });
    }

    function fetchChatHistory(target) {
        if (chatCache[target]) {
            console.log(chatCache[target]);
            renderChat(chatCache[target]);
            return;
        }
        forceFetch(
            `http://localhost:4000/api/chat?target=${target}`,
            {
                method: 'GET',
            }
        )
            .then(res => res.json())
            .then(data => {
                console.log(data);
                chatCache[target] = data;
                if (target == recipient) renderChat(data);
            })
            .catch(err => console.error("Failed to fetch chat:", err));
    }
});
