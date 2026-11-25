////////////////////////////////////////////////////////////////
//IDEAS.JS
//Builds the Ideas page: habit ideas grouped by category, each in
//a neon container with a small "+" button on the right.
//Clicking "+" opens the dashboard's Add Habit pop-up with the idea's
//name filled in. Once an idea has been added to a stack it no longer
//shows here (the server remembers this in the user_idea table).
//
//To add or change ideas, edit IDEA_CATEGORIES below. "color" is
//the neon color used for that category's containers.
////////////////////////////////////////////////////////////////

const IDEA_CATEGORIES = [
    {
        name: 'Wellness',
        color: 'var(--color-cyan)',
        ideas: [
            'Meditate for 5 minutes',
            'Drink a glass of water',
            'Write down 3 things you are grateful for',
            'Take 5 deep breaths',
            'Take your vitamins',
            'Journal for 5 minutes',
            'Spend 10 minutes outside',
            'Go to bed at the same time',
            'Put your phone away before bed',
            'Eat a piece of fruit'
        ]
    },
    {
        name: 'Fitness & Movement',
        color: 'var(--color-pink)',
        ideas: [
            'Stretch for 5 minutes',
            'Take a 10-minute walk',
            'Do 10 push-ups',
            'Do 20 squats',
            'Hold a plank for 30 seconds',
            'Take the stairs',
            'Do a 5-minute morning workout',
            'Walk after dinner',
            'Do a 10-minute yoga flow',
            'Stand up and move every hour'
        ]
    },
    {
        name: 'Learning New Things',
        color: 'var(--color-purple)',
        ideas: [
            'Read 10 pages of a book',
            'Practice a new language for 5 minutes',
            'Watch one educational video',
            'Learn one new word',
            'Practice an instrument for 15 minutes',
            'Listen to a podcast',
            'Do one coding exercise',
            'Review your flashcards',
            'Sketch or draw for 10 minutes',
            'Write about something you learned'
        ]
    },
    {
        name: 'Cleaning & Home',
        color: 'var(--color-orange)',
        ideas: [
            'Make your bed',
            'Wash the dishes after dinner',
            'Wipe down the kitchen counters',
            'Do a 10-minute tidy',
            'Put your clothes away',
            'Take out the trash',
            'Do a load of laundry',
            'Clear off your desk',
            'Sweep or vacuum one room',
            'Wipe the bathroom sink'
        ]
    },
    {
        name: 'Productivity',
        color: 'var(--color-green)',
        ideas: [
            'Plan your top 3 tasks for tomorrow',
            'Check your calendar',
            'Clear out your inbox for 10 minutes',
            'Review your to-do list',
            'Do one 25-minute focus session',
            'Pack your bag the night before',
            'Lay out your clothes for tomorrow',
            'Write down one priority for the day',
            'Tidy up your computer files',
            'Review your goals for the week'
        ]
    }
];

// One idea: the text on the left, a small "+" button on the far right
function buildIdeaCard(idea) {
    const card = document.createElement('div');
    card.className = 'idea-card';

    const text = document.createElement('span');
    text.className = 'idea-text';
    text.textContent = idea;

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'idea-add-btn';
    addBtn.textContent = '+';
    addBtn.setAttribute('aria-label', `Add "${idea}" to my stacks`);
        // Go to the dashboard, which opens the Add Habit pop-up with this name filled in
    addBtn.addEventListener('click', () => {
        window.location.href = '/dashboard?newHabit=' + encodeURIComponent(idea);
    });

    card.append(text, addBtn);
    return card;
}

// Ideas this user has already added to a stack. If they can't be loaded,
// every idea is simply shown.
async function loadAddedIdeas() {
    const result = await DataModel.getAddedIdeas();
    return result.ok ? new Set(result.data.ideas) : new Set();
}

async function renderIdeas() {
    const container = document.getElementById('ideasContainer');
    const added = await loadAddedIdeas();

    container.innerHTML = '';
    let shown = 0;

    IDEA_CATEGORIES.forEach(category => {
        const remaining = category.ideas.filter(idea => !added.has(idea));
        if (remaining.length === 0) {
            return; // every idea in this category has been added - hide it
        }

        const section = document.createElement('section');
        section.className = 'idea-category';
        section.style.setProperty('--neon', category.color);

        const heading = document.createElement('h2');
        heading.textContent = category.name;

        const grid = document.createElement('div');
        grid.className = 'ideas-grid';
        remaining.forEach(idea => grid.appendChild(buildIdeaCard(idea)));

        section.append(heading, grid);
        container.appendChild(section);
        shown += remaining.length;
    });

    if (shown === 0) {
        const done = document.createElement('p');
        done.className = 'ideas-intro';
        done.textContent = "You've added every idea. Nice work!";
        container.appendChild(done);
    }
}

// Only logged-in users see the page (same as the other pages)
const token = localStorage.getItem('jwtToken');
if (token) {
    DataModel.setToken(token);
    renderIdeas();

    // Coming back with the browser's Back button: refresh the list
    window.addEventListener('pageshow', event => {
        if (event.persisted) {
            renderIdeas();
        }
    });
} else {
    window.location.href = '/';
}