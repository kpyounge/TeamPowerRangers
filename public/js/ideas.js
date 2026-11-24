////////////////////////////////////////////////////////////////
//IDEAS.JS
//Builds the Ideas page: habit ideas grouped by category, each in
//a neon container with a small "+" button on the right.
//The "+" buttons don't do anything yet.
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
    // No action yet - the "+" buttons are placeholders for now

    card.append(text, addBtn);
    return card;
}

function renderIdeas() {
    const container = document.getElementById('ideasContainer');

    IDEA_CATEGORIES.forEach(category => {
        const section = document.createElement('section');
        section.className = 'idea-category';
        section.style.setProperty('--neon', category.color);

        const heading = document.createElement('h2');
        heading.textContent = category.name;

        const grid = document.createElement('div');
        grid.className = 'ideas-grid';
        category.ideas.forEach(idea => grid.appendChild(buildIdeaCard(idea)));

        section.append(heading, grid);
        container.appendChild(section);
    });
}

// Only logged-in users see the page (same as the other pages)
if (localStorage.getItem('jwtToken')) {
    renderIdeas();
} else {
    window.location.href = '/';
}
