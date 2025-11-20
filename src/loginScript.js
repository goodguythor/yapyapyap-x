document.addEventListener("DOMContentLoaded", () => {
    const loginButton = document.getElementById('login-button');
    const signUpButton = document.getElementById('signup-button');
    const usernameBox = document.getElementById('username-box');
    const passwordBox = document.getElementById('password-box');
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|:;"'<>,.?/~`]).{8,100}$/;

    loginButton.addEventListener('click', () => {
        const username = usernameBox.value.trim();
        const password = passwordBox.value.trim();

        if (username === "" || password === "") {
            alert("Username or password cannot be empty.");
            return;
        }

        if (username.length > 20) {
            alert("Username must have at most 20 characters");
            return;
        }

        if (password.length < 8) {
            alert("Password must have at least 8 characters");
            return;
        }

        if (password.length > 100) {
            alert("Password must have at most 100 characters");
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
                localStorage.setItem('token', data.token);
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
        if (username === "" || password === "") {
            alert("Username or password cannot be empty.");
            return;
        }

        if (username.length > 20) {
            alert("Username must have at most 20 characters");
            return;
        }

        if (password.length < 8) {
            alert("Password must have at least 8 characters");
            return;
        }

        if (password.length > 100) {
            alert("Password must have at most 100 characters");
            return;
        }

        if (!passwordRegex.test(password)) {
            alert("Password must include uppercase, lowercase, number, and symbol");
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
            .then(() => {
                return fetch('http://localhost:4000/api/user/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Auto-login failed');
                }
                return response.json();
            })
            .then(data => {
                localStorage.setItem('token', data.token);
                window.location.href = './index.html';
            })
            .catch(error => {
                alert(error.message);
                return;
            });
    });
});
