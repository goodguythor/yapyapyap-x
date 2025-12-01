document.addEventListener("DOMContentLoaded", async () => {
    // TODO:
    // - Split message into send & received
    // - Fetch message from non contact
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

    const socket = new WebSocket(`ws://localhost:8080/${username}`);
    const chatContainer = document.querySelector(".chat");
    const inputBox = document.querySelector(".text-box");
    const sendButton = document.querySelector(".send-button");
    const contactNameDisplay = document.querySelector(".contact-name");
    const contactList = document.querySelector(".contact-list");
    const addButton = document.querySelector(".add-button");
    const contactBox = document.querySelector(".contact-box");
    const logoutButton = document.querySelector(".logout-button");
    const deleteButton = document.querySelector(".delete-button");
    // TODO:
    // - fix chat fetching
    // - implement more secure shit
    let recipient = "";
    let fetchedMessages = [];

    socket.onopen = () => {
        console.log("Connected to WebSocket as", username);
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log(data);
        appendMessage(data.message);
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
                createContactButton(contact.username);
            });
        })
        .catch(err => console.error("Failed to fetch contacts:", err));

    sendButton.addEventListener("click", () => {
        const message = inputBox.value.trim();
        if (message !== "") {
            inputBox.value = "";

            if (recipient != "") {
                const payload = {
                    sender: username,
                    message: message,
                    target: recipient,
                };
                // console.log("Sending message:", payload);
                socket.send(JSON.stringify(payload));
            }
        }
        // console.log(message);
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
                    createContactButton(newContact);
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
                    const contactButton = [...document.querySelectorAll('.contact-button')].find(button => button.textContent.includes(recipient));
                    if (contactButton) {
                        contactList.removeChild(contactButton);
                    }
                    recipient = "";
                    contactNameDisplay.textContent = "yaPyaPyaP";
                    chatContainer.innerHTML = "";
                })
                .catch(err => {
                    console.error("Error deleting contact:", err);
                    alert("Failed to delete contact. Please try again.");
                });
        }
    }
    );

    function createContactButton(contactName) {
        const button = document.createElement("button");
        button.textContent = contactName;
        button.classList.add("contact-button");
        button.addEventListener("click", () => {
            recipient = contactName;
            contactNameDisplay.textContent = recipient;
            chatContainer.innerHTML = "";
            fetchChatHistory(recipient);
        });
        contactList.appendChild(button);
    }

    function appendMessage(message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add("sender");
        msgDiv.innerHTML = `
            <div class="name">You</div>
            <hr class="name-line">
            <div class="message">${message}</div>
        `;

        chatContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function appendReceivedMessage(message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add("recipient");
        msgDiv.innerHTML = `
            <div class="name">${recipient}</div>
            <hr class="name-line">
            <div class="message">${message}</div>
        `;
        chatContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function fetchChatHistory(target) {
        fetchedMessages = [];
        const msgSent = fetch(
            `http://localhost:4000/api/chat?target=${target}`,
            {
                method: 'GET',
                credentials: 'include',
            }
        )
            .then(res => res.json())
            .then(data => {
                chatContainer.innerHTML = "";
                data.forEach(msgObj => {
                    fetchedMessages.push({ ...msgObj });
                });
            })
            .catch(err => console.error("Failed to fetch chat:", err));
        Promise.all([msgSent]).then(() => {
            fetchedMessages.forEach(msgObj => {
                // console.log(msgObj);
                if (msgObj.sent) {
                    appendMessage(msgObj.message);
                } else {
                    appendReceivedMessage(msgObj.message);
                }
            });
        });
    }
});
