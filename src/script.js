document.addEventListener("DOMContentLoaded", async () => {
    // TODO:
    // - Add feature to edit & delete message
    // - Add feature to reply message
    // - Check if user is online/typing etc
    async function fetchMe() {
        const res = await fetch("http://localhost:4000/api/user/me", {
            method: "GET",
            credentials: "include"
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

    let recipient = "";
    let chatCache = {};

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
            if (!chatCache[target]) chatCache[target] = [];
            console.log(msgObj);
            chatCache[target].push({ message_id: msgObj.message_id, message: msgObj.message, timestamp: msgObj.timestamp, sent: msgObj.sent });
            if (msgObj.sent) {
                appendMessage(msgObj.message_id, msgObj.message, msgObj.timestamp);
            } else {
                appendReceivedMessage(msgObj.message_id, msgObj.message, msgObj.timestamp);
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
    };

    socket.onclose = () => {
        console.log("Disconnected from WebSocket");
    };

    socket.onerror = (err) => {
        console.error("WebSocket error:", err);
    };

    fetch(
        `http://localhost:4000/api/contact`,
        {
            method: 'GET',
            credentials: 'include',
        }
    )
        .then(res => res.json())
        .then(data => {
            data.forEach(contact => {
                createContactButton(contact.username, contact.contact);
            });
        })
        .catch(err => console.error("Failed to fetch contacts:", err));

    chatContainer.addEventListener("click", (e) => {
        if (e.target.classList.contains("message-option")) {
            const msgDiv = e.target.closest("[data-message-id]");
            const messageId = msgDiv.dataset.messageId;
            console.log("Clicked message:", messageId);

            menu.style.left = e.pageX + "px";
            menu.style.top = e.pageY + "px";

            // Store the message id
            menu.dataset.messageId = messageId;

            const editBtn = menu.querySelector("[data-action='edit']");
            const deleteBtn = menu.querySelector("[data-action='delete']");
            const replyBtn = menu.querySelector("[data-action='reply']");
            const isRecipient = msgDiv.classList.contains("recipient");

            if (isRecipient) {
                editBtn.classList.add("hidden");
                deleteBtn.classList.add("hidden");
            }
            else {
                editBtn.classList.remove("hidden")
                deleteBtn.classList.remove("hidden");
            }

            // Show the menu
            menu.classList.remove("hidden");
        }
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
        }

        if (action === "delete") {
            console.log("Delete message:", messageId);
            const payload = { action: 'delete', messageId: messageId, target: recipient }
            socket.send(JSON.stringify(payload));
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
            sendButton.dataset.action = 'insert';
            delete menu.dataset.messageId;
        }
        inputBox.value = "";
    });

    logoutButton.addEventListener("click", () => {
        if (confirm("Are you sure you want to log out?")) {
            socket.close();
            window.location.href = "./login.html"; // Redirect to login page
        }
    });

    addButton.addEventListener("click", () => {
        const newContact = contactBox.value.trim();
        if (newContact === username) alert("Can't add your account into contact");
        else if (newContact !== "") {
            fetch(`http://localhost:4000/api/contact`, {
                method: "POST",
                credentials: 'include',
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
                fetch(`http://localhost:4000/api/contact`, {
                    method: "PATCH",
                    credentials: 'include',
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
                        const contactButton = [...document.querySelectorAll('.contact-button')].find(button => button.textContent === recipient);
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
            fetch(`http://localhost:4000/api/contact`, {
                method: "POST",
                credentials: 'include',
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

    function createContactButton(contactName, isContact) {
        const button = document.createElement("button");
        button.textContent = contactName;
        button.classList.add("contact-button");

        button.dataset.isContact = isContact ? "true" : "false";

        button.addEventListener("click", () => {
            recipient = contactName;
            contactNameDisplay.textContent = recipient;
            chatContainer.innerHTML = "";

            if (button.dataset.isContact === "false") deleteButton.textContent = "Add Contact";
            else deleteButton.textContent = "Delete Contact";

            fetchChatHistory(recipient);
        });
        contactList.appendChild(button);
    }

    function appendMessage(messageId, message, timestamp) {
        const msgDiv = document.createElement("div");
        msgDiv.dataset.messageId = messageId;
        msgDiv.classList.add("sender");
        msgDiv.innerHTML = `
            <div class="message-header">
                <button class="message-option">...</button>
                <div class="name">You</div> 
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
        msgDiv.classList.add("recipient");
        msgDiv.innerHTML = `
            <div class="message-header">
                <button class="message-option">...</button>
                <div class="name">${recipient}</div> 
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

    function renderChat(messages) {
        chatContainer.innerHTML = "";
        messages.forEach(msgObj => {
            // console.log(msgObj);
            if (msgObj.sent) {
                appendMessage(msgObj.message_id, msgObj.message, msgObj.timestamp);
            } else {
                appendReceivedMessage(msgObj.message_id, msgObj.message, msgObj.timestamp);
            }
        });
    }

    function fetchChatHistory(target) {
        if (chatCache[target]) {
            console.log(chatCache[target]);
            renderChat(chatCache[target]);
            return;
        }
        fetch(
            `http://localhost:4000/api/chat?target=${target}`,
            {
                method: 'GET',
                credentials: 'include',
            }
        )
            .then(res => res.json())
            .then(data => {
                console.log(data);
                chatCache[target] = data;
                renderChat(data);
            })
            .catch(err => console.error("Failed to fetch chat:", err));
    }
});
