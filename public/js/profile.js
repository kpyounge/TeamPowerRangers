////////////////////////////////////////////////////////////////
// PROFILE.JS
// Controls authentication, profile editing, theme selection,
// and logout functionality on the Profile page.
////////////////////////////////////////////////////////////////

document.addEventListener("DOMContentLoaded", () => {

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

    const username =
        document.getElementById("username");

    const bio =
        document.getElementById("bio");

    const editProfileButton =
        document.getElementById("editProfileButton");

    const logoutButton =
        document.getElementById("logoutButton");

    const editProfileDialog =
        document.getElementById("editProfileDialog");

    const editProfileForm =
        document.getElementById("editProfileForm");

    const usernameInput =
        document.getElementById("usernameInput");

    const bioInput =
        document.getElementById("bioInput");

    const cancelEditButton =
        document.getElementById("cancelEditButton");

    const themeToggle =
        document.getElementById("themeToggle");


    ////////////////////////////////////////////////////////////
    // OPEN EDIT PROFILE POPUP
    ////////////////////////////////////////////////////////////

    editProfileButton.addEventListener("click", () => {
        usernameInput.value = username.textContent.trim();
        bioInput.value = bio.textContent.trim();

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

    editProfileForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const newUsername = usernameInput.value.trim();
        const newBio = bioInput.value.trim();

        username.textContent = newUsername;
        bio.textContent = newBio;

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