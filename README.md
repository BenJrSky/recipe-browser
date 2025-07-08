# Recipe Browser - Ayisha.js Tutorial

🎓 **Complete tutorial project for learning Ayisha.js development**

A comprehensive web application that demonstrates how to build a modern Single Page Application (SPA) using the Ayisha.js framework. This project serves as a practical guide to understand the fundamental concepts and advanced features of Ayisha.js through a real-world example: a culinary recipe browser.

**🙏 Special Thanks**: This project is powered by [TheMealDB](https://www.themealdb.com/) - a free and open recipe database. We are grateful for their amazing API service that makes this tutorial possible and provides access to thousands of delicious recipes from around the world.

## 🎯 Learning Objectives

This tutorial will teach you how to:
- Structure an Ayisha.js application with SPA routing
- Use core directives (@if, @for, @model, @click, etc.)
- Manage application state reactively
- Implement reusable components
- Make asynchronous API calls with @fetch
- Create a complete navigation system
- Handle forms and input validation
- Implement responsive and modern design

## 📚 Ayisha.js Concepts Demonstrated

### **🔧 Core Directives**
- `@if/@show/@hide` - Conditional rendering
- `@for` - Iteration over lists and arrays
- `@model` - Two-way data binding
- `@click/@hover/@input` - Event handling
- `@fetch/@result` - Asynchronous API calls
- `@link/@page` - SPA routing and navigation

### **🧩 Components and Architecture**
- External components loaded dynamically
- Modular page structure
- Centralized state management
- Component-based patterns

### **🎨 Styling and UI System**
- Food-friendly pastel color palette
- Responsive layout with modern CSS
- Smooth micro-interactions and animations
- Consistent design system

### **🌐 API Integration**
- HTTP calls with error handling
- Loading states and user feedback
- Caching and performance optimization
- Async/await patterns with Ayisha.js

## �️ **Setup del Progetto**

### **Prerequisiti**
```bash
# Nessuna installazione richiesta! 
# Ayisha.js è incluso nel progetto come file singolo
```

### **Avvio Rapido**
```bash
# 1. Clona il repository
git clone [repository-url]
cd recipe-browser

# 2. Apri in un server locale (raccomandato)
# Opzione A: Python
python -m http.server 8000

# Opzione B: Node.js live-server
npx live-server

# Opzione C: VS Code Live Server extension

# 3. Naviga a http://localhost:8000
```

### **Struttura del Tutorial**
```
recipe-browser/
├── index.html                 # 📄 Entry point principale con setup Ayisha.js
├── ayisha-1.0.1.js           # 🚀 Framework Ayisha.js
├── styles.css                # 🎨 Stili globali e design system
├── components/               # 🧩 Componenti riutilizzabili
│   ├── header.html          #   - Header con logo e branding
│   ├── nav.html             #   - Navigazione principale SPA
│   ├── search-section.html  #   - Sezione ricerca avanzata
│   └── footer.html          #   - Footer con link e info
├── pages/                    # 📱 Pagine dell'applicazione
│   ├── home.html            #   - Homepage con ricerche rapide
│   ├── categories.html      #   - Lista categorie ricette  
│   ├── category-meals.html  #   - Ricette per categoria
│   ├── search.html          #   - Ricerca avanzata
│   ├── random.html          #   - Ricette casuali
│   └── recipe-detail.html   #   - Dettaglio singola ricetta
└── README.md                # 📖 Questa guida tutorial
```

## 📖 **Guida Tutorial Passo-Passo**

### **Livello 1: Fondamenti Ayisha.js** 🟢

#### **1.1 Inizializzazione dello Stato**
```html
<!-- index.html -->
<init>
    currentPage = 'home';
    quickSearch = '';
    selectedCategory = '';
    searchResults = [];
    loading = false;
    error = '';
</init>
```

**📝 Cosa impari:**
- Come inizializzare lo stato globale con `<init>`
- Convenzioni di naming per variabili di stato
- Setup base di un'applicazione Ayisha.js

#### **1.2 Routing SPA di Base**
```html
<!-- Navigazione -->
<nav>
    <a @link="home">Home</a>
    <a @link="categories">Categorie</a>
    <a @link="search">Cerca</a>
</nav>

<!-- Pagine condizionali -->
<component @src="./pages/home.html" @page="home"></component>
<component @src="./pages/categories.html" @page="categories"></component>
```

**📝 Cosa impari:**
- Direttiva `@link` per la navigazione
- Direttiva `@page` per il rendering condizionale delle pagine
- Sistema di routing dichiarativo

#### **1.3 Componenti Esterni**
```html
<!-- Caricamento componenti esterni -->
<component @src="./components/header.html"></component>
<component @src="./components/nav.html"></component>
```

**📝 Cosa impari:**
- Come strutturare un'app in componenti modulari
- Caricamento dinamico di template HTML esterni
- Architettura component-based

### **Livello 2: Gestione Stato e Eventi** 🟡

#### **2.1 Two-Way Data Binding**
```html
<!-- components/search-section.html -->
<input @model="quickSearch" 
       placeholder="Cerca ricette...">
<div>Stai cercando: {{quickSearch}}</div>
```

**📝 Cosa impari:**
- Direttiva `@model` per binding bidirezionale
- Interpolazione template con `{{}}` 
- Reattività automatica dello stato

#### **2.2 Event Handling e API Calls**
```html
<!-- Bottone con chiamata API -->
<button @click="
    loading = true; 
    error = ''
" @fetch:click="'https://www.themealdb.com/api/json/v1/1/random.php'"
   @result="randomMeal">
    Ricetta Casuale
</button>

<!-- Gestione loading state -->
<div @if="loading">Caricamento...</div>
<div @if="error">Errore: {{error}}</div>
```

**📝 Cosa impari:**
- Combinare `@click` con `@fetch` per API calls
- Gestione di loading states e errori
- Pattern comune per UX asincrona

#### **2.3 Iterazione e Rendering Liste**
```html
<!-- pages/categories.html -->
<div @fetch="'https://www.themealdb.com/api/json/v1/1/categories.php'" 
     @result="categories">
     
<div class="grid">
    <div @for="category in categories.categories" 
         class="category-card">
        <img src="{{category.strCategoryThumb}}" 
             alt="{{category.strCategory}}">
        <h3>{{category.strCategory}}</h3>
        <p>{{category.strCategoryDescription}}</p>
        <button @click="
            selectedCategory = category.strCategory;
            currentPage = 'category-meals'
        ">Visualizza Ricette</button>
    </div>
</div>
```

**📝 Cosa impari:**
- Direttiva `@for` per iterare array
- Accesso a proprietà di oggetti nell'interpolazione  
- Passaggio di dati tra pagine tramite stato

### **Livello 3: Funzionalità Avanzate** 🔴

#### **3.1 Ricerca Avanzata con Filtri**
```html
<!-- pages/search.html -->
<div class="search-filters">
    <select @model="searchType">
        <option value="name">Per Nome</option>
        <option value="ingredient">Per Ingrediente</option>
        <option value="area">Per Area</option>
    </select>
    
    <input @model="searchQuery" 
           @input="
               if (searchQuery.length > 2) {
                   loading = true
               }
           ">
    
    <button @click="performSearch()">Cerca</button>
</div>

<!-- URL dinamico basato sui filtri -->
<div @fetch="searchUrl" @result="searchResults" @if="searchQuery.length > 2">
</div>
```

**📝 Cosa impari:**
- Computed properties per URL dinamici
- Gestione form complessi con multiple opzioni
- Ricerca in tempo reale con debouncing

#### **3.2 Gestione Stato Complesso**
```html
<!-- pages/recipe-detail.html -->
<div @fetch="'https://www.themealdb.com/api/json/v1/1/lookup.php?i=' + selectedMealId" 
     @result="currentRecipe" 
     @if="selectedMealId">
     
<div @if="currentRecipe && currentRecipe.meals">
    <div @for="recipe in currentRecipe.meals">
        <h1>{{recipe.strMeal}}</h1>
        <img src="{{recipe.strMealThumb}}" alt="{{recipe.strMeal}}">
        
        <!-- Ingredienti dinamici -->
        <ul class="ingredients">
            <li @if="recipe.strIngredient1">
                {{recipe.strMeasure1}} {{recipe.strIngredient1}}
            </li>
            <li @if="recipe.strIngredient2">
                {{recipe.strMeasure2}} {{recipe.strIngredient2}}
            </li>
            <!-- ... fino a 20 ingredienti -->
        </ul>
        
        <!-- Istruzioni formattate -->
        <div class="instructions">
            {{recipe.strInstructions}}
        </div>
    </div>
</div>
```

**📝 Cosa impari:**
- Navigazione profonda negli oggetti di stato
- Rendering condizionale basato su dati API
- Gestione di strutture dati complesse

### **Livello 4: Ottimizzazioni e Best Practices** ⚡

#### **4.1 Performance e UX**
```html
<!-- Loading states sofisticati -->
<div @if="loading" class="loading-skeleton">
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
</div>

<!-- Error handling user-friendly -->
<div @if="error" class="error-message">
    <h3>Oops! Qualcosa è andato storto</h3>
    <p>{{error}}</p>
    <button @click="
        error = '';
        loading = false;
        /* retry logic */
    ">Riprova</button>
</div>
```

#### **4.2 Responsive Design con Ayisha.js**
```html
<!-- Adaptive UI basata su stato -->
<div class="layout" 
     @class="{
         'mobile-layout': screenSize === 'mobile',
         'tablet-layout': screenSize === 'tablet',
         'desktop-layout': screenSize === 'desktop'
     }">
</div>

<!-- Menu mobile toggle -->
<button @click="mobileMenuOpen = !mobileMenuOpen" 
        class="mobile-toggle">☰</button>
<nav @class="{'nav-open': mobileMenuOpen}">
    <!-- navigation items -->
</nav>
```

## 🎓 **Esercizi Pratici**

### **Esercizio 1: Aggiungi una Nuova Pagina** 
Crea una pagina "Preferiti" che:
- Mostri ricette salvate in localStorage
- Permetta di aggiungere/rimuovere ricette
- Utilizzi `@click` e `@if` per la gestione

### **Esercizio 2: Migliora la Ricerca**
Estendi la funzionalità di ricerca per:
- Aggiungere ricerca per prima lettera
- Implementare suggerimenti automatici
- Aggiungere filtri combinati

### **Esercizio 3: Componente Personalizzato**
Crea un componente `recipe-card.html` che:
- Sia riutilizzabile in più pagine
- Accetti parametri tramite attributi
- Includa azioni (visualizza, salva, condividi)

## 💡 **Concetti Chiave Dimostrati**

### **🔄 Reattività**
```javascript
// Lo stato è automaticamente reattivo
currentPage = 'search';           // Cambia la pagina istantaneamente
searchResults = newResults;       // Aggiorna la UI automaticamente
loading = false;                  // Nasconde i loading state
```

### **🎯 Event-Driven Programming**
```html
<!-- Catena di eventi coordinati -->
<button @click="
    loading = true;
    error = '';
    selectedCategory = ''
" @fetch:click="apiUrl" 
   @result="results">
    Carica Dati
</button>
```

### **🧩 Composizione Componenti**
```html
<!-- App composta da componenti modulari -->
<component @src="./components/header.html"></component>
<component @src="./pages/home.html" @page="home"></component>
<component @src="./components/footer.html"></component>
```

## 🏗️ **Architettura dell'App**

### **Pattern Utilizzati**
- **Component-Based Architecture**: UI divisa in componenti riutilizzabili
- **Single Source of Truth**: Stato centralizzato nell'`<init>` block
- **Unidirectional Data Flow**: Dati fluiscono dall'alto verso il basso
- **Event-Driven Updates**: Modifiche tramite eventi user e API responses

### **Gestione dello Stato**
```html
<init>
    // 🌐 Navigation state
    currentPage = 'home';
    
    // � Search state  
    quickSearch = '';
    searchQuery = '';
    searchType = 'name';
    
    // 📊 Data state
    categories = [];
    searchResults = [];
    currentRecipe = null;
    
    // � UI state
    loading = false;
    error = '';
    mobileMenuOpen = false;
</init>
```

## � **API Integration con Ayisha.js**

### **TheMealDB API Endpoints**
```javascript
// 🎲 Ricetta casuale
'https://www.themealdb.com/api/json/v1/1/random.php'

// 📋 Lista categorie  
'https://www.themealdb.com/api/json/v1/1/categories.php'

// 🔍 Ricerca per nome
'https://www.themealdb.com/api/json/v1/1/search.php?s=' + searchQuery

// 📖 Dettagli ricetta
'https://www.themealdb.com/api/json/v1/1/lookup.php?i=' + mealId

// 🏷️ Ricette per categoria
'https://www.themealdb.com/api/json/v1/1/filter.php?c=' + category
```

### **Pattern @fetch + @result**
```html
<!-- Pattern base per chiamate API -->
<div @fetch="apiUrl" 
     @result="targetVariable"
     @if="shouldFetch">
     
    <!-- Loading state -->
    <div @if="loading">Caricamento...</div>
    
    <!-- Success state -->
    <div @if="targetVariable && !loading">
        <div @for="item in targetVariable.meals">
            {{item.strMeal}}
        </div>
    </div>
    
    <!-- Error state -->
    <div @if="error">Errore: {{error}}</div>
</div>
```

## 🎯 **Obiettivi di Apprendimento Raggiunti**

Completando questo tutorial, avrai imparato:

✅ **Fondamenti Ayisha.js**
- Setup e inizializzazione di un progetto
- Gestione dello stato reattivo
- Sistema di routing SPA

✅ **Componenti e Architettura**  
- Creazione di componenti riutilizzabili
- Caricamento dinamico di template esterni
- Organizzazione modulare del codice

✅ **API Integration**
- Chiamate HTTP asincrone con @fetch
- Gestione di loading states e errori
- Pattern per UX ottimale

✅ **Advanced Patterns**
- Event handling complesso
- Form dinamici e validazione
- Responsive design con stato reattivo

## 🚀 **Prossimi Passi**

### **Estendere il Progetto**
1. **Aggiungi Preferiti**: Sistema di salvataggio ricette con localStorage
2. **Migliora UX**: Implementa ricerca predictive e autocomplete  
3. **PWA Features**: Rendi l'app installabile e funzionante offline
4. **Testing**: Aggiungi unit test per le funzionalità principali

### **Progetti Correlati**
- **Todo App Avanzata**: Gestione task con categorie e filtri
- **E-commerce SPA**: Shopping cart e checkout process
- **Dashboard Analytics**: Grafici e visualizzazioni dati
- **Chat App**: Real-time messaging con WebSocket

## 📚 **Risorse Aggiuntive**

### **Documentazione Ayisha.js**
- [Sito Ufficiale](https://www.ayisha.app)
- [GitHub Repository](https://github.com/BenJrSky/ayisha.js)
- [Esempi e Demo](https://www.ayisha.app/examples)

### **API References**
- [TheMealDB Documentation](https://www.themealdb.com/api.php)
- [REST API Best Practices](https://restfulapi.net/)

### **Design e UX**
- [Modern CSS Techniques](https://developer.mozilla.org/en-US/docs/Web/CSS)
- [Responsive Design Patterns](https://web.dev/responsive-web-design-basics/)

## 🤝 **Contribuire**

Questo progetto tutorial è open source! Contribuisci con:

- 🐛 **Bug Reports**: Segnala problemi nel codice
- 💡 **Feature Ideas**: Proponi nuove funzionalità didattiche  
- 📝 **Documentation**: Migliora questa guida
- 🎨 **UI/UX**: Ottimizza design e usabilità
- 🧪 **Tests**: Aggiungi test per garantire stabilità

### **Come Contribuire**
```bash
# 1. Fork del repository
# 2. Crea un branch per la tua feature
git checkout -b feature/nome-feature

# 3. Commit delle modifiche
git commit -m "Add: descrizione delle modifiche"

# 4. Push e crea una Pull Request
git push origin feature/nome-feature
```

## 📊 **Metriche del Tutorial**

### **Difficoltà**: ⭐⭐⭐ (Intermedio)
### **Tempo Stimato**: 4-6 ore
### **Prerequisiti**: 
- HTML, CSS, JavaScript base
- Conoscenza base dei concetti SPA
- Familiarità con API REST

### **Competenze Acquisite**:
- ✅ Sviluppo SPA con framework moderno
- ✅ Gestione stato reattivo
- ✅ Integrazione API esterne  
- ✅ Architettura component-based
- ✅ Responsive design avanzato

## 🔮 **Evoluzioni Future del Tutorial**

### **Versione 2.0 - Funzionalità Avanzate**
- [ ] Sistema di autenticazione utenti
- [ ] Database locale con IndexedDB
- [ ] Modalità offline con Service Workers
- [ ] Notifiche push per nuove ricette
- [ ] Integrazione social sharing

### **Versione 3.0 - Scaling e Performance**  
- [ ] Code splitting e lazy loading
- [ ] Ottimizzazioni performance avanzate
- [ ] A/B testing framework
- [ ] Analytics e tracking utenti
- [ ] Internazionalizzazione completa

---

## 🎓 **Conclusione**

Questo tutorial **Recipe Browser** rappresenta un esempio completo di come Ayisha.js possa essere utilizzato per creare applicazioni web moderne, reattive e performanti. 

La semplicità della sintassi, combinata con la potenza delle funzionalità, rende Ayisha.js ideale sia per principianti che vogliono imparare i concetti SPA, sia per sviluppatori esperti che cercano un framework leggero e produttivo.

**Buon coding e buon appetito! 🍽️✨**

---

**Recipe Browser Tutorial** - Creato con ❤️ per la community Ayisha.js  
*Un progetto [devBen](https://www.devben.app) per imparare il web development moderno*
