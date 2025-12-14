const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Mock del DOM per il server
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Carica Ayisha.js
require('./ayisha-1.1.1.js');

class AyishaSSR {
    constructor() {
        this.ayisha = window.ayisha;
    }

    async renderComponent(templatePath, initialState = {}, page = '') {
        try {
            // Leggi il template
            const template = fs.readFileSync(templatePath, 'utf8');

            // Crea un container per il rendering
            const container = document.createElement('div');
            container.innerHTML = template;

            // Inizializza lo stato
            Object.assign(this.ayisha.state, initialState);

            // Processa gli elementi <init>
            const initElements = container.querySelectorAll('init');
            initElements.forEach(init => {
                try {
                    // Esegui il codice JavaScript nell'init
                    const code = init.textContent.trim();
                    if (code) {
                        // Crea una funzione sicura per eseguire il codice
                        const initFn = new Function('state', `with(state) { ${code} }`);
                        initFn(this.ayisha.state);
                    }
                } catch (error) {
                    console.warn('SSR: Error processing init block:', error);
                }
                init.remove(); // Rimuovi l'elemento init dal DOM
            });

            // Simula il rendering iniziale
            await this.renderVDOM(container);

            // Restituisci l'HTML renderizzato
            return container.innerHTML;

        } catch (error) {
            console.error('SSR Error:', error);
            return '<div>Error rendering component</div>';
        }
    }

    async renderVDOM(container) {
        // Processa direttive SSR-safe (quelle che non richiedono interazione)
        const elements = container.querySelectorAll('*');

        for (const el of elements) {
            // Processa @text
            if (el.hasAttribute('@text')) {
                const expr = el.getAttribute('@text');
                try {
                    const value = this.ayisha.evaluator.evalExpr(expr, this.ayisha.state);
                    el.textContent = value || '';
                } catch (error) {
                    console.warn('SSR: Error evaluating @text:', expr, error);
                }
                el.removeAttribute('@text');
            }

            // Processa @if (solo per rendering iniziale)
            if (el.hasAttribute('@if')) {
                const expr = el.getAttribute('@if');
                try {
                    const condition = this.ayisha.evaluator.evalExpr(expr, this.ayisha.state);
                    if (!condition) {
                        el.remove();
                        continue;
                    }
                } catch (error) {
                    console.warn('SSR: Error evaluating @if:', expr, error);
                }
                el.removeAttribute('@if');
            }

            // Processa @for (versione semplificata per SSR)
            if (el.hasAttribute('@for')) {
                const expr = el.getAttribute('@for');
                try {
                    // Parse dell'espressione @for (item in array)
                    const match = expr.match(/^(\w+)\s+in\s+(.+)$/);
                    if (match) {
                        const [, itemVar, arrayExpr] = match;
                        const array = this.ayisha.evaluator.evalExpr(arrayExpr, this.ayisha.state);

                        if (Array.isArray(array)) {
                            const parent = el.parentNode;
                            const template = el.cloneNode(true);
                            template.removeAttribute('@for');

                            // Rimuovi l'elemento template originale
                            parent.removeChild(el);

                            // Renderizza ogni elemento dell'array
                            array.forEach((item, index) => {
                                const itemEl = template.cloneNode(true);
                                const itemCtx = { ...this.ayisha.state, [itemVar]: item, $index: index };

                                // Processa @text nei figli
                                const textElements = itemEl.querySelectorAll('*[@text]');
                                textElements.forEach(textEl => {
                                    const textExpr = textEl.getAttribute('@text');
                                    try {
                                        const value = this.ayisha.evaluator.evalExpr(textExpr, itemCtx);
                                        textEl.textContent = value || '';
                                    } catch (error) {
                                        console.warn('SSR: Error evaluating @text in @for:', textExpr, error);
                                    }
                                    textEl.removeAttribute('@text');
                                });

                                parent.appendChild(itemEl);
                            });
                        }
                    }
                } catch (error) {
                    console.warn('SSR: Error processing @for:', expr, error);
                }
            }
        }

        // Rimuovi tutte le direttive Ayisha per evitare problemi lato client
        const allElements = container.querySelectorAll('*');
        allElements.forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('@')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
    }

    async renderPage(templatePath, initialState = {}) {
        const componentHtml = await this.renderComponent(templatePath, initialState);

        // Crea la pagina HTML completa
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ayisha SSR</title>
    <script>
        // Inietta lo stato iniziale per l'hydration
        window.__AYISHA_STATE__ = ${JSON.stringify(initialState)};
    </script>
</head>
<body>
    <div id="app">${componentHtml}</div>
    <script src="/ayisha-1.1.1.js"></script>
    <script>
        // Hydration: inizializza Ayisha con lo stato del server
        if (window.ayisha && window.__AYISHA_STATE__) {
            Object.assign(window.ayisha.state, window.__AYISHA_STATE__);
            window.ayisha.renderManager.render();
        }
    </script>
</body>
</html>`;

        return html;
    }
}

module.exports = AyishaSSR;</content>
<parameter name="filePath">/Users/devben/Documents/Projects/devBen/recipe-browser/ayisha-ssr.js