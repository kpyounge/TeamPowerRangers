////////////////////////////////////////////////////////////////
//DASHBOARD.JS
//THIS IS YOUR "CONTROLLER" FOR THE HABIT STACKS PAGE.
//
//Sprint 1 note: the backend doesn't have habit routes yet, so the
//habit data below is just a hardcoded sample array used to build
//the layout. Checking a box, reordering, and saving a new habit
//in the modal are all front-end only right now - nothing is sent
//to the server or saved permanently. That wiring comes in a later
//sprint once the habit table + routes exist.
////////////////////////////////////////////////////////////////

// Sample data just for laying out the page. Replace with a real
// fetch to the server once habit routes exist.
let sampleHabits = [
    { id: 1, name: 'Brush Teeth', time: 'morning', completed: true, streak: 3 },
    { id: 2, name: 'Apply Sunscreen', time: 'morning', completed: false, streak: 0 },
    { id: 3, name: 'Feed Bird', time: 'afternoon', completed: false, streak: 0 },
    { id: 4, name: 'Read 10 Pages', time: 'evening', completed: false, streak: 5 },
    { id: 5, name: 'Lay Out Clothes', time: 'night', completed: false, streak: 0 },
];

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

    //////////////////////////////////////////
    //INITIAL RENDER
    //////////////////////////////////////////
    renderStacks();
});

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

        const habitsForTime = sampleHabits.filter(h => h.time === timeKey);

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

    const menuBtn = document.createElement('button');
    menuBtn.className = 'menu-btn';
    menuBtn.textContent = '⋮';
    menuBtn.title = 'More options (reorder / delete - coming in a later sprint)';
    row.appendChild(menuBtn);

    return row;
}

//////////////////////////////////////////
//CHECKBOX TOGGLE (front-end only for now)
//////////////////////////////////////////
function toggleHabit(habitId, isChecked) {
    const habit = sampleHabits.find(h => h.id === habitId);
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

function saveNewHabit() {
    const name = document.getElementById('habitNameInput').value.trim();
    const time = document.getElementById('habitTimeInput').value;

    if (!name) {
        return;
    }

    const newId = Math.max(0, ...sampleHabits.map(h => h.id)) + 1;
    sampleHabits.push({ id: newId, name, time, completed: false, streak: 0 });

    closeModal();
    renderStacks();
}
