////////////////////////////////////////////////////////////////
//PROFILE.JS
//Controller for the Profile page. This is where the Sprint 1
//requirement "invoke a protected route from an internal page" is
//demonstrated: it calls GET /api/users, which requires a valid
//JWT, via DataModel.getUsers().
////////////////////////////////////////////////////////////////

document.addEventListener('DOMContentLoaded', () => {

    //////////////////////////////////////////
    //JWT CHECK - redirect to logon if missing
    //////////////////////////////////////////
    const token = localStorage.getItem('jwtToken');
    if (!token) {
        window.location.href = '/';
        return;
    }
    DataModel.setToken(token);

    //////////////////////////////////////////
    //ELEMENTS + EVENT LISTENERS
    //////////////////////////////////////////
    const logoutButton = document.getElementById('logoutButton');
    const refreshButton = document.getElementById('refreshButton');
    const themeToggle = document.getElementById('themeToggle');

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('jwtToken');
        window.location.href = '/';
    });

    refreshButton.addEventListener('click', () => renderUserList());

    //////////////////////////////////////////
    //LIGHT / DARK MODE TOGGLE
    //////////////////////////////////////////
    // Set the switch's starting position to match whatever theme is
    // currently applied (checked = light, unchecked = dark).
    themeToggle.checked = Theme.get() === 'light';

    themeToggle.addEventListener('change', () => {
        Theme.apply(themeToggle.checked ? 'light' : 'dark');
    });

    //////////////////////////////////////////
    //INITIAL RENDER
    //////////////////////////////////////////
    renderUserList();
});

async function renderUserList() {
    const userListElement = document.getElementById('userList');
    userListElement.innerHTML = '<div class="loading-message">Loading user list...</div>';

    const users = await DataModel.getUsers();

    userListElement.innerHTML = '';
    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.classList.add('user-item');
        userItem.textContent = user;
        userListElement.appendChild(userItem);
    });
}