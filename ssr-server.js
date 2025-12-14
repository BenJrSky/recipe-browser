const AyishaSSR = require('./ayisha-ssr');
const express = require('express');
const app = express();
const port = 3000;

// Inizializza il renderer SSR
const ssr = new AyishaSSR();

// Route per la home page
app.get('/', async (req, res) => {
    try {
        // Stato iniziale per la pagina
        const initialState = {
            message: 'Hello from SSR!',
            items: ['Apple', 'Banana', 'Orange'],
            user: { name: 'John Doe', age: 30 }
        };

        // Renderizza la pagina usando il template home.html
        const html = await ssr.renderPage('./pages/home.html', initialState);
        res.send(html);
    } catch (error) {
        console.error('Error rendering home page:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route per la pagina delle categorie
app.get('/categories', async (req, res) => {
    try {
        const initialState = {
            categories: [
                { id: 1, name: 'Breakfast', count: 25 },
                { id: 2, name: 'Lunch', count: 40 },
                { id: 3, name: 'Dinner', count: 35 },
                { id: 4, name: 'Dessert', count: 20 }
            ],
            title: 'Recipe Categories'
        };

        const html = await ssr.renderPage('./pages/categories.html', initialState);
        res.send(html);
    } catch (error) {
        console.error('Error rendering categories page:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route per una ricetta casuale
app.get('/random', async (req, res) => {
    try {
        // Simula il fetch di una ricetta casuale
        const initialState = {
            recipe: {
                id: Math.floor(Math.random() * 1000),
                title: 'Random Recipe',
                ingredients: ['Ingredient 1', 'Ingredient 2', 'Ingredient 3'],
                instructions: 'Mix all ingredients and cook for 30 minutes.'
            }
        };

        const html = await ssr.renderPage('./pages/random.html', initialState);
        res.send(html);
    } catch (error) {
        console.error('Error rendering random recipe:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Servi i file statici (CSS, JS, immagini)
app.use(express.static('.'));

// Avvia il server
app.listen(port, () => {
    console.log(`Ayisha SSR server running at http://localhost:${port}`);
});</content>
<parameter name="filePath">/Users/devben/Documents/Projects/devBen/recipe-browser/ssr-server.js