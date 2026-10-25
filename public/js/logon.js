// Tab switching
const loginTab = document.getElementById('login-tab');
const createAccountTab = document.getElementById('create-account-tab');
const logonForm = document.getElementById('logon-form');
const createAccountForm = document.getElementById('create-account-form');
const messageEl = document.getElementById('message');
const forgotPasswordForm = document.getElementById('forgot-password-form');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const backToLogin = document.getElementById('back-to-login');

loginTab.addEventListener('click', () => {
    logonForm.classList.add('active-form');
    createAccountForm.classList.remove('active-form');
    loginTab.classList.add('active');
    createAccountTab.classList.remove('active');
});

createAccountTab.addEventListener('click', () => {
    createAccountForm.classList.add('active-form');
    logonForm.classList.remove('active-form');
    createAccountTab.classList.add('active');
    loginTab.classList.remove('active');
});

// Logon form submission
logonForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;



    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const result = await response.json();
        if (response.ok) {
            localStorage.setItem('jwtToken', result.token);
            window.location.href = '/dashboard';
        } else {
            messageEl.textContent = result.message;
            messageEl.classList.add('error');
        }
    } catch (error) {
        console.error('Error:', error);
        messageEl.textContent = 'An error occurred. Please try again later.';
        messageEl.classList.add('error');
    }
});

// Create account form submission
createAccountForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const firstname = document.getElementById('create-firstname').value;
    const lastname = document.getElementById('create-lastname').value;
    const username= document.getElementById('create-username').value;
    const birthday= document.getElementById('create-birthday').value;
    const password = document.getElementById('create-password').value;
    const confirmPassword = document.getElementById('create-confirm-password').value;

    if (password !== confirmPassword) {
        messageEl.textContent = 'Passwords do not match.';
        messageEl.classList.remove('success');
        messageEl.classList.add('error');
        return;
    }

    try {
        const response = await fetch('/api/create-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstname, lastname, username, birthday, password }),
        });

        const result = await response.json();
        if (response.ok) {
            messageEl.textContent = 'Account created successfully!';
            messageEl.classList.remove('error');
            messageEl.classList.add('success');
            document.getElementById('login-username').value = username;
            document.getElementById('login-password').value = password;
            logonForm.classList.add('active-form');
            createAccountForm.classList.remove('active-form');
            loginTab.classList.add('active');
            createAccountTab.classList.remove('active');
        } else {
            messageEl.textContent = result.message;
            messageEl.classList.remove('success')
            messageEl.classList.add('error');
        }
    } catch (error) {
        console.error('Error:', error);
        messageEl.textContent = 'An error occurred. Please try again later.';
        messageEl.classList.add('error');
    }
});

// Forgot password: show the form
forgotPasswordLink.addEventListener('click', () => {
    forgotPasswordForm.classList.add('active-form');
    logonForm.classList.remove('active-form');
    createAccountForm.classList.remove('active-form');
    messageEl.textContent = '';
});

// Make the Log In and Sign Up tabs also hide the forgot password form
loginTab.addEventListener('click', () => {
    forgotPasswordForm.classList.remove('active-form');
});
createAccountTab.addEventListener('click', () => {
    forgotPasswordForm.classList.remove('active-form');
});

// Forgot password: back to log in
backToLogin.addEventListener('click', () => {
    forgotPasswordForm.classList.remove('active-form');
    logonForm.classList.add('active-form');
    messageEl.textContent = '';
});

// Forgot password: submit
forgotPasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('forgot-username').value.trim();
    const firstname = document.getElementById('forgot-firstname').value.trim();
    const lastname = document.getElementById('forgot-lastname').value.trim();
    const birthday = document.getElementById('forgot-birthday').value;
    const newPassword = document.getElementById('forgot-new-password').value;
    const confirmPassword = document.getElementById('forgot-confirm-password').value;

    if (newPassword !== confirmPassword) {
        messageEl.textContent = 'Passwords do not match.';
        messageEl.classList.remove('success');
        messageEl.classList.add('error');
        return;
    }

    try {
        const response = await fetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, firstname, lastname, birthday, newPassword, confirmPassword }),
        });

        const result = await response.json();
        if (response.ok) {
            // Success: go back to the log in page
            forgotPasswordForm.reset();
            forgotPasswordForm.classList.remove('active-form');
            logonForm.classList.add('active-form');
            loginTab.classList.add('active');
            createAccountTab.classList.remove('active');
            messageEl.textContent = 'Password reset successfully! You can now log in.';
            messageEl.classList.remove('error');
            messageEl.classList.add('success');
        } else {
            messageEl.textContent = result.message;
            messageEl.classList.remove('success');
            messageEl.classList.add('error');
        }
    } catch (error) {
        console.error('Error:', error);
        messageEl.textContent = 'An error occurred. Please try again later.';
        messageEl.classList.remove('success');
        messageEl.classList.add('error');
    }
});