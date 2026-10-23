////////////////////////////////////////////////////////////////
// PROFILE.JS
// Controls authentication, profile editing, theme selection,
// and logout functionality on the Profile page.
////////////////////////////////////////////////////////////////

document.addEventListener("DOMContentLoaded", async () => {

    ////////////////////////////////////////////////////////////
    // JWT CHECK
    ////////////////////////////////////////////////////////////

    const token = localStorage.getItem("jwtToken");

    if (!token) {
        window.location.href = "/";
        return;
    }

    DataModel.setToken(token);


    ////////////////////////////////////////////////////////////
    // GET HTML ELEMENTS
    ////////////////////////////////////////////////////////////

    const firstname = document.getElementById("firstname");
    const accountCreationDate = document.getElementById("accountCreationDate");

    const editProfileButton = document.getElementById("editProfileButton");
   
    const logoutButton = document.getElementById("logoutButton");

    const editProfileDialog = document.getElementById("editProfileDialog");
   
    const editProfileForm = document.getElementById("editProfileForm");
    const usernameInput = document.getElementById("usernameInput");
    const firstnameInput = document.getElementById("firstnameInput");
    const lastnameInput = document.getElementById("lastnameInput");
    const cancelEditButton = document.getElementById("cancelEditButton");
    const saveEditButton = document.getElementById("saveEditButton");
    const editError = document.getElementById("editError");
    const themeToggle = document.getElementById("themeToggle");

////////////////////////////////////////////////////////////
    // SHOW USER INFO ON THE PAGE
    ////////////////////////////////////////////////////////////

    let currentUser = null;

    function renderUser(user) {
        firstname.textContent = user.firstname;

        if (user.created_at) {
            const created = new Date(user.created_at).toLocaleDateString(
                undefined,
                { year: "numeric", month: "long", day: "numeric" }
            );
            accountCreationDate.textContent = `Account created: ${created}`;
        }
    }

    // Load the logged-in user's info when the page opens
    currentUser = await DataModel.getCurrentUser();

    if (currentUser) {
        renderUser(currentUser);
    }


    ////////////////////////////////////////////////////////////
    // OPEN EDIT PROFILE POPUP
    ////////////////////////////////////////////////////////////

    editProfileButton.addEventListener("click", () => {
        if (!currentUser) return;

        usernameInput.value = currentUser.username || "";
        firstnameInput.value = currentUser.firstname || "";
        lastnameInput.value = currentUser.lastname || "";

        editError.hidden = true;
        editProfileDialog.showModal();
    });


    ////////////////////////////////////////////////////////////
    // CANCEL PROFILE EDIT
    ////////////////////////////////////////////////////////////

    cancelEditButton.addEventListener("click", () => {
        editProfileDialog.close();
    });


    ////////////////////////////////////////////////////////////
    // SAVE PROFILE CHANGES
    ////////////////////////////////////////////////////////////

    editProfileForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        saveEditButton.disabled = true;

        const result = await DataModel.updateProfile({
            username: usernameInput.value.trim(),
            firstname: firstnameInput.value.trim(),
            lastname: lastnameInput.value.trim()
        });

        saveEditButton.disabled = false;

        if (!result.ok) {
            editError.textContent = result.error;
            editError.hidden = false;
            return;
        }

        // Keep the refreshed token so the new username stays logged in
        if (result.token) {
            localStorage.setItem("jwtToken", result.token);
        }

        // Only update the page after the server confirms the save
        currentUser = result.user;
        renderUser(currentUser);
        editProfileDialog.close();
    });


    ////////////////////////////////////////////////////////////
    // LIGHT / DARK MODE
    ////////////////////////////////////////////////////////////

    themeToggle.checked = Theme.get() === "light";

    themeToggle.addEventListener("change", () => {
        const selectedTheme =
            themeToggle.checked ? "light" : "dark";

        Theme.apply(selectedTheme);
    });


    ////////////////////////////////////////////////////////////
    // LOG OUT
    ////////////////////////////////////////////////////////////

    logoutButton.addEventListener("click", () => {
        localStorage.removeItem("jwtToken");
        window.location.href = "/";
    });

});