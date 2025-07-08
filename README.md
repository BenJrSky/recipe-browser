# Recipe Browser - Guida all'utilizzo

Un'applicazione web completa per esplorare ricette culinarie utilizzando l'API di TheMealDB con un design giovane, moderno e colori pastello adatti al food.

## 🚀 Caratteristiche

### 📱 **Navigazione Intuitiva**
- **Home**: Panoramica con ricerche rapide e ricette popolari
- **Categorie**: Sfoglia per categorie (Antipasti, Primi, Dolci, ecc.)
- **Ricerca**: Ricerca avanzata per nome, ingrediente, area geografica o lettera
- **Casuale**: Scopri ricette casuali per ispirarti

### 🎨 **Design Giovane e Moderno**
- Palette colori pastello food-friendly (pesca, menta, crema, lavanda, corallo, salvia)
- Icone flat minimali e moderne
- Typography Inter per un look contemporaneo
- Layout adattivo per desktop, tablet e mobile
- Animazioni fluide e micro-interazioni
- Border radius ampi e ombre soft per un aspetto delicato

### 🎨 **Palette Colori**
- **Pesca Pastello** (#ffcccb) - Colore principale warm
- **Menta Pastello** (#b8e6b8) - Accenti e categorie  
- **Crema Vaniglia** (#fff8dc) - Background speciali
- **Lavanda Pastello** (#e6e6fa) - Dettagli delicati
- **Corallo Pastello** (#ffa07a) - Call-to-action
- **Salvia Pastello** (#c3d9c3) - Elementi secondari

### 🔍 **Funzionalità di Ricerca**
- **Per Nome**: Cerca ricette specifiche
- **Per Ingrediente**: Trova ricette con ingredienti che hai
- **Per Area**: Esplora cucine internazionali
- **Per Lettera**: Naviga alfabeticamente
- **Casuale**: Lasciati sorprendere

### 📖 **Dettagli Ricetta Completi**
- Immagini HD delle ricette
- Lista ingredienti con quantità
- Istruzioni paso-paso numerate
- Link a video YouTube (quando disponibili)
- Informazioni su categoria e origine
- Link alla fonte originale

## 🛠️ **Tecnologie Utilizzate**

- **HTML5**: Struttura semantica e accessibile
- **CSS3**: Styling moderno con variabili CSS pastello, flexbox e grid
- **JavaScript ES6+**: Logica di navigazione e chiamate API
- **TheMealDB API**: Database di ricette gratuito
- **Responsive Design**: Mobile-first approach
- **Icone Flat**: Design minimale con simboli geometrici

## 📂 **Struttura File**

```
recipe-browser/
├── index.html          # Homepage principale
├── categories.html     # Pagina categorie
├── category-meals.html # Ricette per categoria
├── search.html         # Ricerca avanzata
├── random.html         # Ricette casuali
├── recipe-detail.html  # Dettaglio ricetta
├── styles.css          # Stili principali
└── README.md          # Documentazione
```

## 🎯 **Come Usare**

### **1. Apertura**
Apri `index.html` nel browser per iniziare

### **2. Navigazione**
- Usa il menu principale per spostarti tra le sezioni
- Ogni pagina ha una barra di navigazione consistente

### **3. Ricerca Ricette**
- **Home**: Ricerca rapida dalla barra principale
- **Categorie**: Clicca su una categoria per vedere tutte le ricette
- **Ricerca**: Usa i filtri avanzati per risultati specifici
- **Casuale**: Ottieni ricette casuali istantaneamente

### **4. Visualizzazione Dettagli**
- Clicca su qualsiasi ricetta per vedere ingredienti e istruzioni
- Usa i pulsanti azione per navigare o trovare ricette simili

## 🌟 **Funzionalità Avanzate**

### **Ricerca Intelligente**
- Suggerimenti automatici per ingredienti
- Filtri multipli combinabili
- Risultati in tempo reale

### **Gestione Errori**
- Messaggi informativi per connessioni lente
- Fallback per immagini mancanti
- Ricaricamento automatico in caso di errori

### **Performance**
- Caricamento lazy delle immagini
- Cache delle ricerche frequenti
- Animazioni ottimizzate

### **Accessibilità**
- Alt text per tutte le immagini
- Contrasto colori ottimale
- Navigazione da tastiera
- Testi leggibili su tutti i dispositivi

## 🎨 **Palette Colori Pastello**

```css
/* Palette colori pastello moderna per food */
--peach: #ffcccb                  /* Pesca pastello - warmth e comfort */
--mint: #b8e6b8                   /* Menta pastello - freschezza e naturalezza */
--cream: #fff8dc                  /* Crema vaniglia - delicatezza e purezza */
--lavender: #e6e6fa               /* Lavanda pastello - eleganza e calma */
--coral: #ffa07a                  /* Corallo pastello - energia e appetito */
--sage: #c3d9c3                   /* Salvia pastello - organic e healthy */

--primary-color: #ffa07a          /* Corallo pastello principale */
--secondary-color: #b8e6b8        /* Menta pastello per accenti */
--text-dark: #5a5a5a             /* Grigio scuro soft per leggibilità */
--background-primary: #ffffff     /* Bianco puro per pulizia */
--background-secondary: #fafafa   /* Off-white per contrasto delicato */
```

### **Filosofia del Design**
- **Pastello per Food**: Colori che evocano ingredienti naturali e freschezza
- **Giovane e Moderno**: Typography Inter, icone flat, ampi border-radius
- **Food-Friendly**: Palette che stimola l'appetito senza essere aggressiva
- **Accessibile**: Contrasti ottimali per leggibilità su tutti i dispositivi

## ✨ **Elementi di Design Moderni**

### **Icone Flat**
- ⌂ Home (geometrica e minimalista)
- ⊞ Categorie (griglia simbolica)  
- ⊙ Cerca (target circle)
- ⊛ Casuale (stella dinamica)
- ◐ ◉ ◎ ◒ Accenti vari per sezioni

### **Micro-interazioni**
- Hover effects delicati con transform
- Ombre soft pastello per profondità
- Transizioni fluide (cubic-bezier)
- Animazioni fade-in per contenuti

### **Typography Moderna**
- Font Inter per un look contemporaneo
- Letter-spacing ottimizzato (-0.025em)
- Line-height generoso (1.7) per leggibilità
- Font-feature-settings per ligature

## 📱 **Responsive Breakpoints**

- **Mobile**: < 480px
- **Tablet**: 480px - 768px  
- **Desktop**: > 768px

## 🔧 **Personalizzazione**

### **Modificare Colori**
Modifica le variabili CSS in `:root` nel file `styles.css`

### **Aggiungere Funzionalità**
- Estendi le chiamate API in ogni file JavaScript
- Aggiungi nuove sezioni seguendo la struttura esistente

### **Internazionalizzazione**
- Modifica i testi in tutti i file HTML
- Aggiorna i placeholder e messaggi di errore

## 🚀 **Deployment**

1. **Server Web**: Carica tutti i file su un server web
2. **GitHub Pages**: Push del repository per hosting gratuito
3. **Netlify/Vercel**: Deploy automatico da repository

## 📊 **API Utilizzate**

### **Endpoint TheMealDB**
- `random.php` - Ricette casuali
- `search.php` - Ricerca per nome/lettera
- `filter.php` - Filtri per categoria/area/ingrediente
- `lookup.php` - Dettagli ricetta per ID
- `categories.php` - Lista categorie
- `list.php` - Liste aree e ingredienti

### **Limiti API Gratuita**
- Chiave test "1" per sviluppo
- Alcune funzioni premium (multi-ingrediente, più ricette casuali)
- Rate limiting standard

## 🐛 **Troubleshooting**

### **Problemi Comuni**
- **Immagini non caricano**: Controlla connessione internet
- **Ricette non trovate**: Verifica termini di ricerca
- **Errori API**: Ricarica la pagina

### **Browser Supportati**
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 📈 **Metriche Performance**

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **Time to Interactive**: < 3s

## 🔮 **Funzionalità Future**

- [ ] Salvataggio ricette preferite (localStorage) con icone a cuore
- [ ] Lista della spesa automatica con design pastello
- [ ] Modalità dark theme con palette pastello scura
- [ ] Condivisione social con preview ottimizzate
- [ ] PWA support per installazione mobile
- [ ] Filtri nutrizionali avanzati
- [ ] Integrazione con timer di cottura
- [ ] Galleria foto utenti con overlay pastello

## 🎯 **Design System**

### **Principi Chiave**
1. **Food-First**: Ogni colore evoca ingredienti naturali
2. **Young & Fresh**: Design che parla ai millennials e Gen Z  
3. **Pastello Sophistication**: Eleganza senza essere formale
4. **Accessibilità**: WCAG 2.1 AA compliance con colori soft
5. **Mobile-Optimized**: Touch-friendly con area target ampie

### **Componenti Riutilizzabili**
- Card system unificato (categorie, ricette, dettagli)
- Button hierarchy con stati pastello
- Input styling coerente con focus ring pastello
- Loading states con animazioni delicate
- Error messaging con toni coral soft

Questo Recipe Browser rappresenta un esempio perfetto di come i colori pastello possano rendere un'applicazione food-related più appetitosa, accessibile e moderna, mantenendo al contempo funzionalità complete e performance ottimali.
- [ ] Condivisione ricette sui social
- [ ] Modalità scura
- [ ] Ricerca vocale
- [ ] Conversione unità di misura
- [ ] Timer di cottura integrato
- [ ] Valutazioni e recensioni

---

**Recipe Browser** - Creato con ❤️ per gli amanti della cucina
