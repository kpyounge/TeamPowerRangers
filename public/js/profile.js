const username = document.getElementById("username");
const bio = document.getElementById("bio");

const editProfileButton = document.getElementById("editProfileButton");
const logoutButton = document.getElementById("logoutButton");

const editProfileDialog = document.getElementById("editProfileDialog");
const editProfileForm = document.getElementById("editProfileForm");
const usernameInput = document.getElementById("usernameInput");
const bioInput = document.getElementById("bioInput");
const cancelEditButton = document.getElementById("cancelEditButton");

//Edit popup
editProfileButton.addEventListener("click", () => {
        usernameInput.value = username.textContent.trim();
        bioInput.value = bio.textContent.trim();

        editProfileDialog.showModal();
    });
cancelEditButton.addEventListener("click", () => {
        editProfileDialog.close();
    });
editProfileForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const newUsername = usernameInput.value.trim();
        const newBio = bioInput.value.trim();

        username.textContent = newUsername;
        bio.textContent = newBio;

        editProfileDialog.close();
    });

//Log out
logoutButton.addEventListener("click", () => {
        localStorage.removeItem("jwtToken");
        window.location.href = "/logon.html";
    });