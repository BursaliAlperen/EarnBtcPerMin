import * as storage from 'storage';

let translations = {};

export async function loadLanguage(lang) {
    try {
        const response = await fetch(`${lang}.json`);
        if (!response.ok) {
            throw new Error(`Could not load ${lang}.json`);
        }
        translations = await response.json();
        document.documentElement.lang = lang;
        storage.setUserLang(lang);
    } catch (error) {
        console.error("Language loading failed:", error);
        // Fallback to English
        if (lang !== 'en') {
            await loadLanguage('en');
        }
    }
}

export function translate(key) {
    return translations[key] || key;
}

export function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        // For elements like <input placeholder="...">
        if (element.hasAttribute('placeholder')) {
             element.placeholder = translate(key);
        }
        element.textContent = translate(key);
    });
}

