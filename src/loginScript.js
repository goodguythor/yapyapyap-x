document.addEventListener("DOMContentLoaded", () => {
    const loginButton = document.getElementById('login-button');
    const signUpButton = document.getElementById('signup-button');
    const usernameBox = document.getElementById('username-box');
    const passwordBox = document.getElementById('password-box');
    loginButton.addEventListener('click', () => {
        const username = usernameBox.value.trim();
        const password = passwordBox.value.trim();
        if(username === "" || password === "") {
            alert("Username or password cannot be empty.");
            return;
        }
        fetch('http://localhost:4000/api/user/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Login failed');
            }
            return response.json();
        })
        .then(data => {
            // Optionally handle successful login, e.g., store token
            // localStorage.setItem('token', data.token);
            window.location.href = './index.html';
        })
        .catch(error => {
            alert(error.message);
            return;
        });
    });

    signUpButton.addEventListener('click', () => {
        const username = usernameBox.value.trim();
        const password = passwordBox.value.trim();
        if(username === "" || password === "") {
            alert("Username or password cannot be empty.");
            return;
        }
        if(username === "" || password === "") {
            alert("Username or password cannot be empty.");
            return;
        }
        fetch('http://localhost:4000/api/user/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Signup failed');
            }
            return response.json();
        })
        .then(data => {
            // Optionally handle successful login, e.g., store token
            // localStorage.setItem('token', data.token);
            window.location.href = './index.html';
        })
        .catch(error => {
            alert(error.message);
            return;
        });
    });
});
