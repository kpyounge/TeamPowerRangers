////////////////////////////////////////////////////////////////
//THEME.JS
//Shared light/dark theme helper. The actual toggle switch lives
//on the Profile page, but EVERY themed page (dashboard, profile)
//needs to apply whichever theme was last chosen, every time it
//loads - otherwise switching it on Profile wouldn't affect the
//Dashboard, and it would reset every time you navigate.
//
//How it works: the chosen theme ('light' or 'dark') is saved in
//localStorage. We set a data-theme="light" attribute on the
//<html> element, and dashboard.css has a
//":root[data-theme='light']" rule that overrides the page's
//background/text colors when that attribute is present.
////////////////////////////////////////////////////////////////

const Theme = {
    STORAGE_KEY: 'habitStackerTheme',

    // Reads the saved theme preference. Defaults to 'dark' (our
    // design guide's primary theme) if nothing has been chosen yet.
    get: function () {
        return localStorage.getItem(this.STORAGE_KEY) || 'dark';
    },

    // Applies a theme: updates the <html> attribute CSS reads from,
    // and saves the choice so it's remembered on the next page load.
    apply: function (theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(this.STORAGE_KEY, theme);
    },

    // Flips between light and dark. Returns the new theme.
    toggle: function () {
        const next = this.get() === 'light' ? 'dark' : 'light';
        this.apply(next);
        return next;
    }
};