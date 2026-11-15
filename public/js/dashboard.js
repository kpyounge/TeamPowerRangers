////////////////////////////////////////////////////////////////
//DASHBOARD.JS
//THIS IS YOUR "CONTROLLER" FOR THE HABIT STACKS PAGE.
//
//Habits are loaded from the server (/api/habits) and adding,
//editing, deleting and checking off a habit are all saved to
//the database. The server also works out each habit's streak.
////////////////////////////////////////////////////////////////

// The logged-in user's habits, in stack order. Filled in by loadHabits().
let habits = [];

// The id of the habit currently open in the edit pop-up
let editingHabitId = null;

// How far the user is through the tutorial, saved on their account:
//   "new"         - hasn't added a first habit yet
//   "first_habit" - added a first habit; the first-stack pop-up is still to come
//   "complete"    - has seen everything
// Defaults to "complete" so that if it can't be loaded, nothing pops up.
let tutorialStatus = 'complete';

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

// Today's date in the user's own time zone, as YYYY-MM-DD
function todayString() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}

//////////////////////////////////////////
//LOAD HABITS FROM THE SERVER
//////////////////////////////////////////
async function loadHabits() {
    // Load the habits and the user's tutorial progress at the same time
    const [result, user] = await Promise.all([
        DataModel.getHabits(todayString()),
        DataModel.getCurrentUser()
    ]);

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


    tutorialStatus = (user && user.tutorial_status) || 'complete';

    if (tutorialStatus === 'new') {
        if (habits.length === 0) {
            // First-time user: show the tutorial
            startTutorial();
        } else {
            // Already has habits
            saveTutorialStatus('complete');
        }
    }
}

// The server sends "completed" (checked today?) and "streak" with each habit
function toLocalHabit(serverHabit) {
    return { ...serverHabit, completed: !!serverHabit.completed };
}

// Saves the tutorial progress on the user's account. The page moves on
// right away; if the save fails the worst case is seeing a pop-up again.
async function saveTutorialStatus(status) {
    tutorialStatus = status;
    const result = await DataModel.updateTutorialStatus(status);
    if (!result.ok) {
        console.error('Could not save tutorial progress:', result.error);
    }
}

// Called after a new habit is saved
function updateTutorialProgress() {
    if (tutorialStatus === 'new') {
        // They just added their first habit, so the tutorial is done
        saveTutorialStatus('first_habit');
    } else if (tutorialStatus === 'first_habit' && hasStackOfTwo()) {
        // Their first stack: celebrate once, then never show it again
        showFirstStackPopup();
        saveTutorialStatus('complete');
    }
}

// True when any stack (time of day) has two or more habits
function hasStackOfTwo() {
    return TIME_ORDER.some(time => habits.filter(h => h.time === time).length >= 2);
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
        // "working_on" (in progress) or "current" (existing) gets its own class
    // so the CSS can style the two differently
    row.className = `habit-row ${habit.status} ${habit.completed ? 'completed' : ''}`;
    row.dataset.habitId = habit.id;

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

    // Fire icon with the streak number on top, shown to the left of the edit button
    if (habit.streak >= 1) {
        const streakBadge = document.createElement('span');
        streakBadge.className = 'streak-badge';
        streakBadge.title = `${habit.streak} day streak`;

        const fire = document.createElement('span');
        fire.className = 'streak-fire';
        fire.textContent = '\u{1F525}';

        const count = document.createElement('span');
        count.className = 'streak-count';
        count.textContent = habit.streak;

        streakBadge.appendChild(fire);
        streakBadge.appendChild(count);
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

        // Three vertical dots: press and drag to reorder
    const handle = document.createElement('button');
    handle.className = 'drag-handle';
    handle.type = 'button';
    handle.textContent = '\u22EE'; // three vertical dots
    handle.title = 'Drag to reorder';
    handle.setAttribute('aria-label', `Reorder ${habit.name}. Use the up and down arrow keys, or drag.`);
    handle.addEventListener('pointerdown', (event) => startDrag(event, row));
    handle.addEventListener('keydown', (event) => moveWithKeyboard(event, row));
    row.appendChild(handle);

    return row;
}

//////////////////////////////////////////
//DRAG & DROP REORDERING
//////////////////////////////////////////
// Press the three dots and drag a habit up or down within its stack.
// While dragging, the row follows the pointer and a black line shows
// where it will land. When the pointer is released the new order is
// saved to the database. Works with mouse and touch.
function startDrag(event, row) {
    if (event.button > 0) {
        return; // ignore right / middle click
    }
    event.preventDefault();

    const list = row.parentElement;
    const startY = event.clientY;
    let dropTarget = null; // the row to drop in front of (null = the end)
    let moved = false;

    row.classList.add('dragging');
    document.body.classList.add('is-dragging');

    function clearMarkers() {
        list.querySelectorAll('.drop-before, .drop-after').forEach(el => {
            el.classList.remove('drop-before', 'drop-after');
        });
    }

    function onMove(e) {
        moved = true;
        row.style.transform = `translateY(${e.clientY - startY}px)`;
        clearMarkers();

        const others = [...list.querySelectorAll('.habit-row')].filter(r => r !== row);
        dropTarget = others.find(r => {
            const box = r.getBoundingClientRect();
            return e.clientY < box.top + box.height / 2;
        }) || null;

        if (dropTarget) {
            dropTarget.classList.add('drop-before');
        } else if (others.length > 0) {
            others[others.length - 1].classList.add('drop-after');
        }
    }

    function stopDragging() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onCancel);
        clearMarkers();
        row.classList.remove('dragging');
        row.style.transform = '';
        document.body.classList.remove('is-dragging');
    }

    function onUp() {
        stopDragging();
        if (!moved) {
            return;
        }
        if (dropTarget) {
            list.insertBefore(row, dropTarget);
        } else {
            list.appendChild(row);
        }
        saveStackOrder([...list.querySelectorAll('.habit-row')].map(r => Number(r.dataset.habitId)));
    }

    function onCancel() {
        stopDragging();
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
}

// Keyboard version: focus the dots, then press the up / down arrow
function moveWithKeyboard(event, row) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return;
    }
    event.preventDefault();

    const ids = [...row.parentElement.querySelectorAll('.habit-row')].map(r => Number(r.dataset.habitId));
    const id = Number(row.dataset.habitId);
    const from = ids.indexOf(id);
    const to = event.key === 'ArrowUp' ? from - 1 : from + 1;
    if (to < 0 || to >= ids.length) {
        return;
    }

    ids.splice(from, 1);
    ids.splice(to, 0, id);
    saveStackOrder(ids, id);
}

// orderedIds = every habit id in one stack, in the new order.
// Updates the page right away, then saves it to the server.
async function saveStackOrder(orderedIds, focusId) {
    const stackHabits = habits.filter(h => orderedIds.includes(h.id));

    // Nothing to do if the order did not actually change
    if (stackHabits.every((h, i) => h.id === orderedIds[i])) {
        return;
    }

    // Hand the stack's existing order numbers back out in the new order
    // (same idea the server uses), so the page matches the database
    const slots = stackHabits.map(h => h.sort_order).sort((a, b) => a - b);
    orderedIds.forEach((id, i) => {
        habits.find(h => h.id === id).sort_order = slots[i];
    });
    sortHabits();
    renderStacks();

    if (focusId !== undefined) {
        const handle = document.querySelector(`[data-habit-id="${focusId}"] .drag-handle`);
        if (handle) {
            handle.focus();
        }
    }

    const result = await DataModel.reorderHabits(orderedIds);
    if (!result.ok) {
        alert(`${result.error} Your new order was not saved.`);
        loadHabits(); // put the page back to what the database has
    }
}

//////////////////////////////////////////
//CHECKBOX TOGGLE (saved to the database)
//////////////////////////////////////////
async function toggleHabit(habitId, isChecked) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) {
        return;
    }

    habit.completed = isChecked;
    renderStacks();

    const result = await DataModel.setHabitCheck(habitId, todayString(), isChecked);
    if (!result.ok) {
        habit.completed = !isChecked; // put the checkbox back
        renderStacks();
        alert(result.error);
        return;
    }

    // The server works out the streak
    habit.streak = result.data.streak;
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
    endTutorial(); // the first saved habit finishes the tutorial
    updateTutorialProgress(); // saves progress and shows the first-stack pop-up
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