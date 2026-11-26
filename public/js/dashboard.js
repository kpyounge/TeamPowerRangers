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
let stacks = [];
let coloringStackId = null;
let selectedEditStackColor = 'green';

// The id of the habit currently open in the edit pop-up
let editingHabitId = null;
let pendingIdea = null; // the idea this Add Habit pop-up was opened from (see Ideas page)
let renamingStackId = null;
let deletingStackId = null;

// How far the user is through the tutorial, saved on their account:
//   "new"         - hasn't added a first habit yet
//   "first_habit" - added a first habit; the first-stack pop-up is still to come
//   "complete"    - has seen everything
// Defaults to "complete" so that if it can't be loaded, nothing pops up.
let tutorialStatus = 'complete';


document.addEventListener('DOMContentLoaded', () => {

    ///////////i d///////////////////////////////
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
    const addStackBtn = document.getElementById('addStackBtn');
    const stackModal = document.getElementById('stackModal');
    const stackCancelBtn = document.getElementById('stackCancelBtn');
    const stackSaveBtn = document.getElementById('stackSaveBtn');
    const renameStackModal = document.getElementById('renameStackModal');
    const renameStackInput = document.getElementById('renameStackInput');
    const renameStackCancelBtn = document.getElementById('renameStackCancelBtn');
    const renameStackSaveBtn = document.getElementById('renameStackSaveBtn');
    const deleteStackModal = document.getElementById('deleteStackModal');
    const deleteStackMessage = document.getElementById('deleteStackMessage');
    const deleteStackCancelBtn = document.getElementById('deleteStackCancelBtn');
    const deleteStackConfirmBtn = document.getElementById('deleteStackConfirmBtn');
    //////////////////////////////////////////
    //EVENT LISTENERS
    //////////////////////////////////////////
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('jwtToken');
        window.location.href = '/';
    });
    addStackBtn.addEventListener('click', () => openStackModal());
    stackCancelBtn.addEventListener('click', () => {
    closeStackModal();

    if (typeof endStackCustomizePrompt === 'function') {
        endStackCustomizePrompt();
    }
});
    stackSaveBtn.addEventListener('click', () => saveNewStack());
    document.querySelectorAll('.stack-color-option').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.stack-color-option').forEach(option => {
            option.classList.remove('selected');
        });

        button.classList.add('selected');
        selectedStackColor = button.dataset.color;
    });
});
    renameStackCancelBtn.addEventListener('click', () => closeRenameStackModal());
    renameStackSaveBtn.addEventListener('click', () => saveRenamedStack());

    document
    .getElementById('changeStackColorCancelBtn')
    .addEventListener('click', () => closeChangeStackColorModal());
document
    .getElementById('changeStackColorSaveBtn')
    .addEventListener('click', () => saveChangedStackColor());
document.querySelectorAll('.edit-stack-color-option').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.edit-stack-color-option').forEach(option => {
            option.classList.remove('selected');
        });

        button.classList.add('selected');
        selectedEditStackColor = button.dataset.color;
    });
});

deleteStackCancelBtn.addEventListener('click', () => closeDeleteStackModal());
deleteStackConfirmBtn.addEventListener('click', () => confirmDeleteStack());

    addHabitBtn.addEventListener('click', () => openModal());
    modalCancelBtn.addEventListener('click', () => closeModal());
    modalSaveBtn.addEventListener('click', () => saveNewHabit());

    document.getElementById('editCancelBtn').addEventListener('click', () => closeEditModal());
    document.getElementById('editSaveBtn').addEventListener('click', () => saveEditedHabit());
    document.getElementById('deleteHabitBtn').addEventListener('click', () => deleteEditedHabit());
    document.getElementById('deleteHabitCancelBtn').addEventListener('click', () => closeDeleteHabitModal());
    document.getElementById('deleteHabitConfirmBtn').addEventListener('click', () => confirmDeleteHabit());

    //////////////////////////////////////////
    //INITIAL LOAD
    //////////////////////////////////////////
    loadDashboard().then(openIdeaFromUrl);
});

// Today's date in the user's own time zone, as YYYY-MM-DD
function todayString() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}

    //////////////////////////////////////////
    //LOAD STACKS + HABITS FROM THE SERVER
    //////////////////////////////////////////
    async function loadDashboard() {
    const [stackResult, habitResult, user] = await Promise.all([
        DataModel.getStacks(),
        DataModel.getHabits(todayString()),
        DataModel.getCurrentUser()
    ]);

        if (!stackResult.ok) {
            document.getElementById('stacksContainer').textContent = stackResult.error;
            return;
        }

        if (!habitResult.ok) {
            if (habitResult.status === 401 || habitResult.status === 403) {
                localStorage.removeItem('jwtToken');
                window.location.href = '/';
                return;
            }

            document.getElementById('stacksContainer').textContent = habitResult.error;
            return;
        }

        stacks = stackResult.data.stacks;
        habits = habitResult.data.habits.map(toLocalHabit);

        renderStacks();

        tutorialStatus = (user && user.tutorial_status) || 'complete';

        if (tutorialStatus === 'new') {
            if (habits.length === 0) {
                startTutorial();
            } else {
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
        // First habit added; next tutorial teaches stack customization
        saveTutorialStatus('first_habit');
    }
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

    if (stacks.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-stack-msg';
        emptyMsg.textContent = 'No stacks yet. Create your first stack!';
        container.appendChild(emptyMsg);
        return;
    }

    stacks.forEach(stack => {
        const section = document.createElement('div');
        section.className = 'stack-section';

        const stackColorClasses = {
            cyan: 'morning',
             pink: 'afternoon',
             purple: 'evening',
             orange: 'night',
            green: 'custom-green'
            };

section.classList.add(
    stackColorClasses[stack.color] || 'custom-green'
);

section.dataset.stackId = stack.stack_id;   

        const stackHeader = document.createElement('div');
        stackHeader.className = 'stack-header';

        const heading = document.createElement('h2');
        heading.textContent = stack.stack_name;
        const stackDragHandle = document.createElement('button');
        stackDragHandle.type = 'button';
        stackDragHandle.className = 'stack-drag-handle';
        stackDragHandle.textContent = '☰';
        stackDragHandle.title = 'Drag to reorder stack';
        stackDragHandle.setAttribute(
    'aria-label',
    `Reorder ${stack.stack_name}`
);

stackDragHandle.addEventListener('pointerdown', (event) => {
    startStackDrag(event, section);
});
        const optionsBtn = document.createElement('button');
        optionsBtn.type = 'button';
        optionsBtn.className = 'stack-options-btn';
        optionsBtn.textContent = '\u22EE';
        optionsBtn.title = 'Stack options';
        optionsBtn.setAttribute(
            'aria-label',
            `Options for ${stack.stack_name}`
        );
        optionsBtn.addEventListener('click', () => {
    showStackOptions(stack.stack_id, optionsBtn);
    }); 
        const stackTitleGroup = document.createElement('div');
        stackTitleGroup.className = 'stack-title-group';

        stackTitleGroup.appendChild(stackDragHandle);
        stackTitleGroup.appendChild(heading);

        stackHeader.appendChild(stackTitleGroup);
        stackHeader.appendChild(optionsBtn);
        section.appendChild(stackHeader);

        const list = document.createElement('div');
        list.className = 'habit-list';

        const stackHabits = habits.filter(
            habit => habit.stack_id === stack.stack_id
        );

        if (stackHabits.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-stack-msg';
            emptyMsg.textContent = 'No habits yet.';
            list.appendChild(emptyMsg);
        } else {
            stackHabits.forEach(habit => {
                list.appendChild(renderHabitRow(habit));
            });
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

    // Fire icon with the streak number on top, shown to the left of the edit button.
    // Only shown once the streak reaches 3 days (per the acceptance criteria).
    if (habit.streak >= 3) {
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
// Drag an entire stack up or down
function startStackDrag(event, section) {
    if (event.button > 0) {
        return;
    }

    event.preventDefault();

    const container = section.parentElement;
    const startY = event.clientY;

    let dropTarget = null;
    let moved = false;

    section.classList.add('stack-dragging');
    document.body.classList.add('is-dragging');

    function clearStackMarkers() {
        container
            .querySelectorAll('.stack-drop-before, .stack-drop-after')
            .forEach(stack => {
                stack.classList.remove(
                    'stack-drop-before',
                    'stack-drop-after'
                );
            });
    }

    function onMove(e) {
        moved = true;

        section.style.transform =
            `translateY(${e.clientY - startY}px)`;

        clearStackMarkers();

        const otherStacks = [
            ...container.querySelectorAll('.stack-section')
        ].filter(stack => stack !== section);

        dropTarget = otherStacks.find(stack => {
            const box = stack.getBoundingClientRect();

            return e.clientY < box.top + box.height / 2;
        }) || null;

        if (dropTarget) {
            dropTarget.classList.add('stack-drop-before');
        } else if (otherStacks.length > 0) {
            otherStacks[
                otherStacks.length - 1
            ].classList.add('stack-drop-after');
        }
    }

    function stopDragging() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onCancel);

        clearStackMarkers();

        section.classList.remove('stack-dragging');
        section.style.transform = '';

        document.body.classList.remove('is-dragging');
    }

    function onUp() {
        stopDragging();

        if (!moved) {
            return;
        }

        if (dropTarget) {
            container.insertBefore(section, dropTarget);
        } else {
            container.appendChild(section);
        }

        const orderedIds = [
            ...container.querySelectorAll('.stack-section')
        ].map(stack => Number(stack.dataset.stackId));

        saveStackOrderToServer(orderedIds);
    }

    function onCancel() {
        stopDragging();
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
}

// Save the new stack order on the page and in the database
async function saveStackOrderToServer(orderedIds) {
    // Update the local stack order
    orderedIds.forEach((id, index) => {
        const stack = stacks.find(s => s.stack_id === id);

        if (stack) {
            stack.sort_order = index + 1;
        }
    });

    // Put the stacks array in the same order
    stacks.sort((a, b) => a.sort_order - b.sort_order);

    // Save the order to MySQL
    const result = await DataModel.reorderStacks(orderedIds);

    if (!result.ok) {
        alert(`${result.error} The stack order was not saved.`);

        // Reload the real order from the database if saving failed
        loadDashboard();
        return;
    }

    // Re-render so colors follow the new stack positions
    renderStacks();
}

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
        loadDashboard(); // put the page back to what the database has
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

    // The server graduates an in-progress habit to an existing one when
    // its streak reaches the user's graduation length
    if (result.data.graduated) {
        habit.status = result.data.status;
        showToast(`"${habit.name}" graduated to an existing habit!`);
    }
    renderStacks();

// Shake the other unchecked habits in the same stack
(result.data.skippedIds || []).forEach(id => {
    shakeHabitRow(id);
});
}

// Briefly shakes a habit row (renderStacks must have already run,
// because it rebuilds the rows)
function shakeHabitRow(habitId) {
    const row = document.querySelector(`.habit-row[data-habit-id="${habitId}"]`);
    if (!row) {
        return;
    }
    row.classList.add('shake');
    row.addEventListener('animationend', () => row.classList.remove('shake'), { once: true });
}

// Shows a short message at the bottom of the screen
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
//////////////////////////////////////////
//CREATE STACK MODAL
//////////////////////////////////////////
function openStackModal() {
    const input = document.getElementById('stackNameInput');
    input.value = '';

    selectedStackColor = 'green';

    document.querySelectorAll('.stack-color-option').forEach(option => {
        option.classList.toggle(
            'selected',
            option.dataset.color === 'green'
        );
    });

    document.getElementById('stackModal').classList.remove('hidden');
    input.focus();
}

function closeStackModal() {
    document.getElementById('stackModal').classList.add('hidden');
}

async function saveNewStack() {
    const input = document.getElementById('stackNameInput');
    const stackName = input.value.trim();

    if (!stackName) {
        return;
    }

    const saveBtn = document.getElementById('stackSaveBtn');
    saveBtn.disabled = true;

    const result = await DataModel.createStack(
    stackName,
    selectedStackColor
);

    saveBtn.disabled = false;

    if (!result.ok) {
        alert(result.error);
        return;
    }

    stacks.push(result.data.stack);
closeStackModal();
renderStacks();
if (typeof endStackCustomizePrompt === 'function') {
    endStackCustomizePrompt();
}


if (tutorialStatus === 'first_habit') {
    endStackCustomizePrompt();
    showFirstStackPopup();
    saveTutorialStatus('complete');
}
}
function showStackOptions(stackId, button) {
    // Close any stack menu already open
    document.querySelectorAll('.stack-options-menu').forEach(menu => {
        menu.remove();
    });

    const menu = document.createElement('div');
    menu.className = 'stack-options-menu';

    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'stack-menu-item';
    renameBtn.textContent = '✎ Rename';

    renameBtn.addEventListener('click', () => {
        menu.remove();
        renameStack(stackId);
    });
    const colorBtn = document.createElement('button');
colorBtn.type = 'button';
colorBtn.className = 'stack-menu-item';
colorBtn.textContent = '🎨 Change Color';

colorBtn.addEventListener('click', () => {
    menu.remove();
    openChangeStackColorModal(stackId);
});

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'stack-menu-item delete';
    deleteBtn.textContent = '🗑 Delete';

    deleteBtn.addEventListener('click', () => {
        menu.remove();
        deleteStack(stackId);
    });

    menu.append(renameBtn, colorBtn, deleteBtn);
button.parentElement.appendChild(menu);

// Close the menu when the user clicks anywhere outside it
setTimeout(() => {
    document.addEventListener('click', function closeMenu(event) {
        if (!menu.contains(event.target) && event.target !== button) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    });
}, 0);
}

function openChangeStackColorModal(stackId) {
    const stack = stacks.find(s => s.stack_id === stackId);

    if (!stack) {
        return;
    }

    coloringStackId = stackId;
    selectedEditStackColor = stack.color || 'green';

    document.querySelectorAll('.edit-stack-color-option').forEach(option => {
        option.classList.toggle(
            'selected',
            option.dataset.color === selectedEditStackColor
        );
    });

    document
        .getElementById('changeStackColorModal')
        .classList.remove('hidden');
}


function closeChangeStackColorModal() {
    document
        .getElementById('changeStackColorModal')
        .classList.add('hidden');

    coloringStackId = null;
}
async function saveChangedStackColor() {
    if (coloringStackId === null) {
        return;
    }

    const saveBtn = document.getElementById('changeStackColorSaveBtn');
    saveBtn.disabled = true;

    const result = await DataModel.changeStackColor(
        coloringStackId,
        selectedEditStackColor
    );

    saveBtn.disabled = false;

    if (!result.ok) {
        alert(result.error);
        return;
    }

    const stack = stacks.find(
        s => s.stack_id === coloringStackId
    );

    if (stack) {
        stack.color = selectedEditStackColor;
    }

    closeChangeStackColorModal();
    renderStacks();
}
function renameStack(stackId) {
    const stack = stacks.find(s => s.stack_id === stackId);

    if (!stack) {
        return;
    }

    renamingStackId = stackId;

    const input = document.getElementById('renameStackInput');
    input.value = stack.stack_name;

    document.getElementById('renameStackModal').classList.remove('hidden');

    input.focus();
    input.select();
}


function closeRenameStackModal() {
    document.getElementById('renameStackModal').classList.add('hidden');
    renamingStackId = null;
}


async function saveRenamedStack() {
    const input = document.getElementById('renameStackInput');
    const newName = input.value.trim();

    if (!newName || renamingStackId === null) {
        return;
    }

    const saveBtn = document.getElementById('renameStackSaveBtn');
    saveBtn.disabled = true;

    const result = await DataModel.renameStack(
        renamingStackId,
        newName
    );

    saveBtn.disabled = false;

    if (!result.ok) {
        alert(result.error);
        return;
    }

    const stack = stacks.find(s => s.stack_id === renamingStackId);

    if (stack) {
        stack.stack_name = newName;
    }

    closeRenameStackModal();
    renderStacks();
}

function deleteStack(stackId) {
    const stack = stacks.find(s => s.stack_id === stackId);

    if (!stack) {
        return;
    }

    deletingStackId = stackId;

    // Count the habits inside this stack
    const habitCount = habits.filter(
        habit => habit.stack_id === stackId
    ).length;

    const message = document.getElementById('deleteStackMessage');
    const warning = document.getElementById('deleteStackWarning');
    const warningTitle = document.getElementById('deleteStackWarningTitle');
    const deleteBtn = document.getElementById('deleteStackConfirmBtn');

    message.textContent =
        `Are you sure you want to delete "${stack.stack_name}"?`;

    if (habitCount > 0) {
        warning.hidden = false;

        warningTitle.textContent =
            `⚠ This stack contains ${habitCount} ${habitCount === 1 ? 'habit' : 'habits'}.`;

        deleteBtn.textContent = 'Delete Stack & Habits';
    } else {
        warning.hidden = true;
        warningTitle.textContent = '';

        deleteBtn.textContent = 'Delete Stack';
    }

    document.getElementById('deleteStackModal').classList.remove('hidden');
}


function closeDeleteStackModal() {
    document.getElementById('deleteStackModal').classList.add('hidden');
    deletingStackId = null;
}


async function confirmDeleteStack() {
    if (deletingStackId === null) {
        return;
    }

    const deleteBtn = document.getElementById('deleteStackConfirmBtn');
    deleteBtn.disabled = true;

    const result = await DataModel.deleteStack(deletingStackId);

    deleteBtn.disabled = false;

    if (!result.ok) {
        alert(result.error);
        return;
    }

    // Remove the deleted stack's habits from the page
habits = habits.filter(
    habit => habit.stack_id !== deletingStackId
);

// Remove the stack itself
stacks = stacks.filter(
    stack => stack.stack_id !== deletingStackId
);

closeDeleteStackModal();
renderStacks();
}

//////////////////////////////////////////
//ADD HABIT MODAL
//////////////////////////////////////////
function openModal() {
    pendingIdea = null;
    document.getElementById('habitNameInput').value = '';
    document.getElementById('habitStatusInput').value = 'working_on';

    const stackSelect = document.getElementById('habitStackInput');

    stackSelect.innerHTML =
        '<option value="">Choose a stack</option>';

    stacks.forEach(stack => {
        const option = document.createElement('option');
        option.value = stack.stack_id;
        option.textContent = stack.stack_name;
        stackSelect.appendChild(option);
    });

    document.getElementById('habitModal').classList.remove('hidden');
}

function closeModal() {
    pendingIdea = null;
    document.getElementById('habitModal').classList.add('hidden');
}

// The Ideas page sends people here as /dashboard?newHabit=Some%20idea.
// Open the Add Habit pop-up with that name already filled in.
function openIdeaFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const idea = (params.get('newHabit') || '').trim();
    if (!idea) {
        return;
    }

    // Take it out of the address so a refresh doesn't open the pop-up again
    window.history.replaceState(null, '', window.location.pathname);

    openModal();
    document.getElementById('habitNameInput').value = idea;
    pendingIdea = idea;
    document.getElementById('habitStackInput').focus();
}

async function saveNewHabit() {
    const name = document.getElementById('habitNameInput').value.trim();
    const status = document.getElementById('habitStatusInput').value;
    const stackValue = document.getElementById('habitStackInput').value;
    const stack_id = Number(stackValue);

    if (!name) {
        return;
    }

    if (!stackValue) {
        alert('Please choose a stack.');
        return;
    }

    const saveBtn = document.getElementById('modalSaveBtn');
    saveBtn.disabled = true;

    const result = await DataModel.createHabit({
        name,
        status,
        stack_id,
        idea: pendingIdea
    });

    saveBtn.disabled = false;

    if (!result.ok) {
        alert(result.error);
        return;
    }

    habits.push(toLocalHabit(result.data.habit));
    sortHabits();
    closeModal();
    renderStacks();

    const isFirstHabit = habits.length === 1;

    endTutorial();
    updateTutorialProgress();

    if (isFirstHabit) {
        showStackCustomizePrompt();
    }
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

    // Fill in the habit's current information
    document.getElementById('editHabitNameInput').value = habit.name;
    document.getElementById('editHabitStatusInput').value = habit.status;

    const stackSelect = document.getElementById('editHabitStackInput');

    stackSelect.innerHTML =
        '<option value="">Choose a stack</option>';

    stacks.forEach(stack => {
        const option = document.createElement('option');
        option.value = stack.stack_id;
        option.textContent = stack.stack_name;
        stackSelect.appendChild(option);
    });

    stackSelect.value = habit.stack_id;

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
    const status = document.getElementById('editHabitStatusInput').value;
    const stackValue = document.getElementById('editHabitStackInput').value;
    const stack_id = Number(stackValue);

    if (!name) {
        showEditError('Habit name is required.');
        return;
    }

    if (!stackValue) {
        showEditError('Please choose a stack.');
        return;
    }

    setEditButtonsDisabled(true);

    const result = await DataModel.updateHabit(editingHabitId, {
        name,
        status,
        stack_id
    });

    setEditButtonsDisabled(false);

    if (!result.ok) {
        showEditError(result.error);
        return;
    }

    const habit = habits.find(h => h.id === editingHabitId);

    if (habit) {
        Object.assign(habit, result.data.habit);
        sortHabits();
    }

    closeEditModal();
    renderStacks();
}

function deleteEditedHabit() {
    const habit = habits.find(h => h.id === editingHabitId);

    if (!habit) {
        return;
    }

    document.getElementById('deleteHabitMessage').textContent =
        `Are you sure you want to delete "${habit.name}"?`;

    document.getElementById('editHabitModal').classList.add('hidden');
    document.getElementById('deleteHabitModal').classList.remove('hidden');
}


function closeDeleteHabitModal() {
    document.getElementById('deleteHabitModal').classList.add('hidden');
    document.getElementById('editHabitModal').classList.remove('hidden');
}


async function confirmDeleteHabit() {
    if (editingHabitId === null) {
        return;
    }

    const deleteBtn = document.getElementById('deleteHabitConfirmBtn');
    deleteBtn.disabled = true;

    const result = await DataModel.deleteHabit(editingHabitId);

    deleteBtn.disabled = false;

    if (!result.ok) {
        document.getElementById('deleteHabitModal').classList.add('hidden');
        document.getElementById('editHabitModal').classList.remove('hidden');
        showEditError(result.error);
        return;
    }

    habits = habits.filter(h => h.id !== editingHabitId);

    document.getElementById('deleteHabitModal').classList.add('hidden');

    editingHabitId = null;

    renderStacks();
}
