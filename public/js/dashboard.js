////////////////////////////////////////////////////////////////
//DASHBOARD.JS
//THIS IS YOUR "CONTROLLER" FOR THE HABIT STACKS PAGE.
//
//Habits are loaded from the server (/api/habits) and adding,
//editing and deleting a habit are all saved to the database.
//
//Still front-end only: the "completed" checkbox and the streak
//badge. Those get wired up in a later sprint.
////////////////////////////////////////////////////////////////

// The logged-in user's habits, in stack order. Filled in by loadHabits().
let habits = [];

// The id of the habit currently open in the edit pop-up
let editingHabitId = null;

const TIME_LABELS = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    night: 'Night'
};
const TIME_ORDER = ['morning', 'afternoon', 'evening', 'night'];

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
    //ELEMENTS
    //////////////////////////////////////////
    const logoutButton = document.getElementById('logoutButton');
    const addHabitBtn = document.getElementById('addHabitBtn');
    const habitModal = document.getElementById('habitModal');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalSaveBtn = document.getElementById('modalSaveBtn');

    //////////////////////////////////////////
    //EVENT LISTENERS
    //////////////////////////////////////////
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('jwtToken');
        window.location.href = '/';
    });

    addHabitBtn.addEventListener('click', () => openModal());
    modalCancelBtn.addEventListener('click', () => closeModal());
    modalSaveBtn.addEventListener('click', () => saveNewHabit());

    document.getElementById('editCancelBtn').addEventListener('click', () => closeEditModal());
    document.getElementById('editSaveBtn').addEventListener('click', () => saveEditedHabit());
    document.getElementById('deleteHabitBtn').addEventListener('click', () => deleteEditedHabit());

    //////////////////////////////////////////
    //INITIAL LOAD
    //////////////////////////////////////////
    loadHabits();
});

//////////////////////////////////////////
//LOAD HABITS FROM THE SERVER
//////////////////////////////////////////
async function loadHabits() {
    const result = await DataModel.getHabits();

    if (!result.ok) {
        // An expired or invalid token means the user has to log in again
        if (result.status === 401 || result.status === 403) {
            localStorage.removeItem('jwtToken');
            window.location.href = '/';
            return;
        }
        document.getElementById('stacksContainer').textContent = result.error;
        return;
    }

    habits = result.data.habits.map(toLocalHabit);
    renderStacks();
}

// Adds the front-end-only fields (checkbox + streak) to a habit from the server
function toLocalHabit(serverHabit) {
    return { ...serverHabit, completed: false, streak: 0 };
}

// The server decides the order (sort_order), so keep our list in that order
function sortHabits() {
    habits.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

//////////////////////////////////////////
//RENDER HABIT STACKS
//////////////////////////////////////////
function renderStacks() {
    const container = document.getElementById('stacksContainer');
    container.innerHTML = '';

    TIME_ORDER.forEach(timeKey => {
        const section = document.createElement('div');
        section.className = `stack-section ${timeKey}`;

        const heading = document.createElement('h2');
        heading.textContent = TIME_LABELS[timeKey];
        section.appendChild(heading);

        const list = document.createElement('div');
        list.className = 'habit-list';

        const habitsForTime = habits.filter(h => h.time === timeKey);

        if (habitsForTime.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-stack-msg';
            emptyMsg.textContent = 'No habits yet.';
            list.appendChild(emptyMsg);
        } else {
            habitsForTime.forEach(habit => list.appendChild(renderHabitRow(habit)));
        }

        section.appendChild(list);
        container.appendChild(section);
    });
}

function renderHabitRow(habit) {
    const row = document.createElement('div');
    row.className = `habit-row ${habit.completed ? 'completed' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'habit-checkbox';
    checkbox.checked = habit.completed;
    checkbox.addEventListener('change', () => toggleHabit(habit.id, checkbox.checked));

    const name = document.createElement('span');
    name.className = 'habit-name';
    name.textContent = habit.name;

    row.appendChild(checkbox);
    row.appendChild(name);

    if (habit.streak >= 3) {
        const streakBadge = document.createElement('span');
        streakBadge.className = 'streak-badge';
        streakBadge.textContent = `\u{1F525} ${habit.streak}`;
        row.appendChild(streakBadge);
    }

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.type = 'button';
    editBtn.textContent = '\u270E'; // pencil
    editBtn.title = 'Edit habit';
    editBtn.setAttribute('aria-label', `Edit ${habit.name}`);
    editBtn.addEventListener('click', () => openEditModal(habit.id));
    row.appendChild(editBtn);

    return row;
}

//////////////////////////////////////////
//CHECKBOX TOGGLE (front-end only for now)
//////////////////////////////////////////
function toggleHabit(habitId, isChecked) {
    const habit = habits.find(h => h.id === habitId);
    if (habit) {
        habit.completed = isChecked;
    }
    renderStacks();
}

//////////////////////////////////////////
//ADD HABIT MODAL
//////////////////////////////////////////
function openModal() {
    document.getElementById('habitNameInput').value = '';
    document.getElementById('habitTimeInput').value = 'morning';
    document.getElementById('habitStatusInput').value = 'working_on';
    document.getElementById('habitModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('habitModal').classList.add('hidden');
}

async function saveNewHabit() {
    const name = document.getElementById('habitNameInput').value.trim();
    const time = document.getElementById('habitTimeInput').value;
    const status = document.getElementById('habitStatusInput').value;

    if (!name) {
        return;
    }

    const saveBtn = document.getElementById('modalSaveBtn');
    saveBtn.disabled = true;
    const result = await DataModel.createHabit({ name, time, status });
    saveBtn.disabled = false;

    if (!result.ok) {
        alert(result.error);
        return;
    }

    habits.push(toLocalHabit(result.data.habit));
    sortHabits();
    closeModal();
    renderStacks();
}

//////////////////////////////////////////
//EDIT / DELETE HABIT MODAL
//////////////////////////////////////////
function openEditModal(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) {
        return;
    }

    editingHabitId = habitId;

    // Auto-fill the form with the habit's current values
    document.getElementById('editHabitNameInput').value = habit.name;
    document.getElementById('editHabitTimeInput').value = habit.time;
    document.getElementById('editHabitStatusInput').value = habit.status;

    document.getElementById('editHabitError').hidden = true;
    document.getElementById('editHabitModal').classList.remove('hidden');
    document.getElementById('editHabitNameInput').focus();
}

function closeEditModal() {
    document.getElementById('editHabitModal').classList.add('hidden');
    editingHabitId = null;
}

function showEditError(message) {
    const errorEl = document.getElementById('editHabitError');
    errorEl.textContent = message;
    errorEl.hidden = false;
}

// Disable the pop-up's buttons while a request is in flight
function setEditButtonsDisabled(disabled) {
    ['editSaveBtn', 'editCancelBtn', 'deleteHabitBtn'].forEach(id => {
        document.getElementById(id).disabled = disabled;
    });
}

async function saveEditedHabit() {
    const name = document.getElementById('editHabitNameInput').value.trim();
    const time = document.getElementById('editHabitTimeInput').value;
    const status = document.getElementById('editHabitStatusInput').value;

    if (!name) {
        showEditError('Habit name is required.');
        return;
    }

    setEditButtonsDisabled(true);
    const result = await DataModel.updateHabit(editingHabitId, { name, time, status });
    setEditButtonsDisabled(false);

    if (!result.ok) {
        showEditError(result.error);
        return;
    }

    // Only change the page after the server confirms the save. Merging
    // keeps the checkbox/streak state; the server's sort_order moves the
    // habit to the end of the list if its stack changed.
    const habit = habits.find(h => h.id === editingHabitId);
    if (habit) {
        Object.assign(habit, result.data.habit);
        sortHabits();
    }

    closeEditModal();
    renderStacks();
}

async function deleteEditedHabit() {
    const habit = habits.find(h => h.id === editingHabitId);
    if (!habit) {
        return;
    }

    if (!confirm(`Delete "${habit.name}"? This can't be undone.`)) {
        return;
    }

    setEditButtonsDisabled(true);
    const result = await DataModel.deleteHabit(editingHabitId);
    setEditButtonsDisabled(false);

    if (!result.ok) {
        showEditError(result.error);
        return;
    }

    habits = habits.filter(h => h.id !== editingHabitId);
    closeEditModal();
    renderStacks();
}

//////////////////////////////////////////
//LIGHT / DARK MODE TOGGLE
//////////////////////////////////////////
// Set the switch's starting position to match whatever theme is
// currently applied (checked = light, unchecked = dark).
themeToggle.checked = Theme.get() === 'light';

themeToggle.addEventListener('change', () => {
    Theme.apply(themeToggle.checked ? 'light' : 'dark');
});