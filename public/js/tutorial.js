////////////////////////////////////////////////////////////////
//TUTORIAL.JS
//First-time walkthrough shown on the dashboard when the user has
//no habits saved. Three chat-style pop-ups with a tutorial avatar:
//  1. What is habit stacking?       (Next ->)
//  2. Stacking basics               (Next ->)
//  3. Points at the "+" button      (must add a habit to finish)
//
//A semi-transparent overlay covers the page, and the rest of the
//page is made "inert" so it can't be clicked OR tabbed to. On the
//last step only the "+" button works. The tutorial ends when the
//first habit is saved (dashboard.js calls endTutorial()).
//
//dashboard.js calls startTutorial() after loading the habits, but
//only when the user has 0 habits.
//
//A 4th pop-up congratulates the user the first time a stack (a
//time-of-day section) reaches two habits. dashboard.js decides when
//(using the tutorial_status saved on the user's account) and calls
//showFirstStackPopup().
////////////////////////////////////////////////////////////////

const TUTORIAL_AVATAR = '/images/tutorial-1.png';

// PLACEHOLDER: replace each title and text with your own copy
const TUTORIAL_STEPS = [
    {
        title: 'What is habit stacking?',
        text: 'Welcome to HabitStacker! Habit stacking means linking a new habit to one you already do every day. The habit you already have becomes the cue for the new one, so you don\'t have to rely on willpower or memory. After I [current habit], I will [new habit].'
    },
    {
        title: 'Stacking basics',
        text: 'A stack is a chain of habits done in direct order, one right after another. Each habit should start as soon as the one before it ends, with no gaps in between. Example: Wake up + Meditate or Brush Teeth + Floss'
    },
    {
        title: "Let's get started!",
        text: 'Since you don\'t have any habits yet, let\'s build your first stack. Tap the "+" button to add your first habit. Then add a second habit to complete the stack.',
        avatar: 'images/tutorial-3.png'
    }
];

// The congratulation pop-up shown after the first two-habit stack
const FIRST_STACK_POPUP = {
    title: 'Yay!',
    text: "You've added your first stack! Good luck on your habit stacking journey!",
    avatar: '/images/tutorial-2.png',
    buttonLabel: "Let's go!"
};

let tutorialActive = false;
let tutorialStep = 0;
let tutorialOverlay = null;
let firstStackOverlay = null;

// Parts of the page the user must not reach while the tutorial is open
function setTutorialInert(isInert) {
    ['.theme-toggle-row', '.container', '#addHabitBtn'].forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.inert = isInert;
        }
    });
}

// Builds one chat message: avatar on the left, speech bubble on the right.
// footerChildren = the elements to put along the bottom of the bubble.
function buildChatCard(title, text, avatarSrc, footerChildren) {
    const card = document.createElement('div');
    card.className = 'tutorial-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'tutorialTitle');

    const avatar = document.createElement('img');
    avatar.className = 'tutorial-avatar';
    avatar.src = avatarSrc;
    avatar.alt = 'Tutorial guide';

    const bubble = document.createElement('div');
    bubble.className = 'tutorial-bubble';

    const titleEl = document.createElement('h2');
    titleEl.id = 'tutorialTitle';
    titleEl.textContent = title;

    const textEl = document.createElement('p');
    textEl.textContent = text;

    const footer = document.createElement('div');
    footer.className = 'tutorial-footer';
    footer.append(...footerChildren);

    bubble.append(titleEl, textEl, footer);
    card.append(avatar, bubble);
    return card;
}

function startTutorial() {
    if (tutorialActive) {
        return;
    }
    tutorialActive = true;
    tutorialStep = 0;

    document.body.classList.add('tutorial-active');
    setTutorialInert(true);

    tutorialOverlay = document.createElement('div');
    tutorialOverlay.className = 'tutorial-overlay';
    document.body.appendChild(tutorialOverlay);

    showTutorialStep();
}

function showTutorialStep() {
    const step = TUTORIAL_STEPS[tutorialStep];
    const isLastStep = tutorialStep === TUTORIAL_STEPS.length - 1;
    const addHabitBtn = document.getElementById('addHabitBtn');

    // The last step moves the chat bubble next to the "+" button
    tutorialOverlay.classList.toggle('pointing', isLastStep);
    tutorialOverlay.replaceChildren();

    const progress = document.createElement('span');
    progress.className = 'tutorial-progress';
    progress.textContent = `Step ${tutorialStep + 1} of ${TUTORIAL_STEPS.length}`;
    const footerChildren = [progress];

    // Steps 1 and 2 get a Next button. The last step has none: the user
    // has to use the "+" button.
    let focusTarget = addHabitBtn;
    if (!isLastStep) {
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'tutorial-next-btn';
        nextBtn.textContent = 'Next \u2192';
        nextBtn.addEventListener('click', nextTutorialStep);
        footerChildren.push(nextBtn);
        focusTarget = nextBtn;
    }

    tutorialOverlay.appendChild(
        buildChatCard(step.title, step.text, step.avatar || TUTORIAL_AVATAR, footerChildren)
    );

    // Only the "+" button is usable on the last step
    addHabitBtn.inert = !isLastStep;
    addHabitBtn.classList.toggle('tutorial-highlight', isLastStep);
    focusTarget.focus();
}

function nextTutorialStep() {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
        tutorialStep++;
        showTutorialStep();
    }
}

// Safe to call any time: does nothing if the tutorial isn't open
function endTutorial() {
    if (!tutorialActive) {
        return;
    }
    tutorialActive = false;

    if (tutorialOverlay) {
        tutorialOverlay.remove();
        tutorialOverlay = null;
    }

    document.body.classList.remove('tutorial-active');
    setTutorialInert(false);
    document.getElementById('addHabitBtn').classList.remove('tutorial-highlight');
}


////////////////////////////////////////////////////////////////
//FIRST-STACK CONGRATULATION POP-UP
////////////////////////////////////////////////////////////////
// Shows the congratulation pop-up. dashboard.js decides WHEN (the
// user's tutorial_status is "first_habit" and a stack has two habits).
function showFirstStackPopup() {
    if (firstStackOverlay) {
        return;
    }
    setTutorialInert(true);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'tutorial-next-btn';
    closeBtn.textContent = FIRST_STACK_POPUP.buttonLabel;
    closeBtn.addEventListener('click', closeFirstStackPopup);

    firstStackOverlay = document.createElement('div');
    firstStackOverlay.className = 'tutorial-overlay';
    firstStackOverlay.appendChild(
        buildChatCard(
            FIRST_STACK_POPUP.title,
            FIRST_STACK_POPUP.text,
            FIRST_STACK_POPUP.avatar,
            [closeBtn]
        )
    );
    document.body.appendChild(firstStackOverlay);
    document.addEventListener('keydown', onFirstStackKeydown);
    closeBtn.focus();
}

function onFirstStackKeydown(event) {
    if (event.key === 'Escape') {
        closeFirstStackPopup();
    }
}

function closeFirstStackPopup() {
    if (!firstStackOverlay) {
        return;
    }
    firstStackOverlay.remove();
    firstStackOverlay = null;
    document.removeEventListener('keydown', onFirstStackKeydown);
    setTutorialInert(false);
    document.getElementById('addHabitBtn').focus();
}