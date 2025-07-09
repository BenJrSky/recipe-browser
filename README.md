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


## 🧭 **Ayisha.js Directives: Complete List, Description, Usage & Execution Order**

### **Directive Execution Order (Hierarchy)**
The execution order of directives on a node follows this hierarchy (from top to bottom):

1. **@page** / **@if** / **@show** / **@hide**  
   - Determine if the node is rendered. If the condition is not met, other directives are not executed.
2. **@for**  
   - Handles repeating the node for each item in a list. All child directives are applied for each iteration.
3. **@fetch** / **@result** / **@source** / **@map** / **@filter** / **@reduce** / **@initial**  
   - Handle asynchronous data loading and data transformation.
4. **@component** / **@src**  
   - Load external components or HTML templates.
5. **@model** / **@validate**  
   - Handle two-way binding and input validation.
6. **@class** / **@style**  
   - Handle dynamic CSS classes and styles.
7. **@click** / **@input** / **@focus** / **@blur** / **@change** / **@hover** / **@set**  
   - Handle user events and state assignments.
8. **@text**  
   - Updates the node's text content.
9. **@key**  
   - Helps track unique nodes in @for loops.
10. **@then** / **@finally**  
   - Execute code after all other directives on the node.
11. **@log** / **@state**  
   - Show logs or state for debugging.
12. **no**  
   - Disables interpolation on the content.

---


### **New Directives: @when, @do, @go, @wait**

| Directive         | Description | Usage / Example |
|-------------------|-------------|-------------------------|
| `@when`           | Watches a condition and triggers `@do` or `@go` when it becomes true (only on transition from false to true). | `<span @when="_currentPage=='home'" @do="step='004'"></span>` |
| `@do`             | Executes an expression when the associated `@when` condition becomes true. | `<span @when="_currentPage=='random'" @do="step='001'"></span>` |
| `@go`             | Navigates to a page (SPA style) when the associated `@when` condition becomes true, or on click. The value is the page name (string or variable). | `<span @when="_currentPage=='categories'" @go="random"></span>` |
| `@wait`           | Delays the execution of `@do` or `@go` by the specified milliseconds after the `@when` condition becomes true. | `<span @when="_currentPage=='search'" @wait="2000" @do="step='003'"></span>` |

#### **Usage Examples**

```html
<!-- Set step to '004' when entering the home page -->
<span @when="_currentPage=='home'" @do="step='004'"></span>

<!-- Set step to '001' when entering the random page -->
<span @when="_currentPage=='random'" @do="step='001'"></span>

<!-- After 2 seconds on the search page, set step to '003' -->
<span @when="_currentPage=='search'" @wait="2000" @do="step='003'"></span>

<!-- When entering the categories page, automatically go to the random page -->
<span @when="_currentPage=='categories'" @go="random"></span>

<!-- When entering the random page, after 3 seconds go to the search page -->
<span @when="_currentPage=='random'" @wait="3000" @go="search"></span>
```

#### **How it works**
- `@when` observes a condition and only triggers `@do` or `@go` when the condition changes from false to true (not on initial render if already true).
- `@do` runs the given expression (e.g. set a variable) when triggered by `@when`.
- `@go` navigates to the given page (SPA navigation) when triggered by `@when`, or on click if used on a clickable element.
- `@wait` (optional) adds a delay (in milliseconds) before running `@do` or `@go` after the `@when` condition becomes true.

**These directives are ideal for page transitions, onboarding flows, step-by-step wizards, and reactive navigation logic.**

---

### **Ayisha.js Directives List**

| Directive         | Description | Usage / Example |
|-------------------|-------------|-------------------------|
| `@if`             | Show the node only if the condition is true | `<div @if="condition">Visible if true</div>` |
| `@show`           | Show the node if the condition is true (like @if, but does not remove from DOM) | `<div @show="condition">Show if true</div>` |
| `@hide`           | Hide the node if the condition is true | `<div @hide="condition">Hide if true</div>` |
| `@for`            | Repeat the node for each item in a list | `<li @for="item in items">{{item}}</li>` |
| `@when`           | Watches a condition and triggers `@do` or `@go` when it becomes true (only on transition from false to true). | `<span @when="_currentPage=='home'" @do="step='004'"></span>` |
| `@do`             | Executes an expression when the associated `@when` condition becomes true. | `<span @when="_currentPage=='random'" @do="step='001'"></span>` |
| `@go`             | Navigates to a page (SPA style) when the associated `@when` condition becomes true, or on click. The value is the page name (string or variable). | `<span @when="_currentPage=='categories'" @go="random"></span>` |
| `@wait`           | Delays the execution of `@do` or `@go` by the specified milliseconds after the `@when` condition becomes true. | `<span @when="_currentPage=='search'" @wait="2000" @do="step='003'"></span>` |
| `@model`          | Two-way binding between input and state | `<input @model="name">` |
| `@validate`       | Apply validation rules to input | `<input @validate="required,minLength:3">` |
| `@click`          | Execute code on click | `<button @click="state.count++">Increment</button>` |
| `@input`          | Execute code on input | `<input @input="doSomething()">` |
| `@focus`          | Execute code on focus | `<input @focus="doSomething()">` |
| `@blur`           | Execute code on blur | `<input @blur="doSomething()">` |
| `@change`         | Execute code on change | `<input @change="doSomething()">` |
| `@hover`          | Execute code on hover | `<div @hover="doSomething()"></div>` |
| `@set`            | Assign values to state on event | `<button @set:click="foo=1"></button>` |
| `@fetch`          | Perform a fetch (API call) | `<div @fetch="'url'" @result="data"></div>` |
| `@result`         | Target variable for @fetch result | `<div @fetch="'url'" @result="data"></div>` |
| `@source`         | Data source for transformations | `<div @source="items" @map="item => item*2" @result="double"></div>` |
| `@map`            | Transform a list | `<div @source="items" @map="item => item*2"></div>` |
| `@filter`         | Filter a list | `<div @source="items" @filter="item > 0"></div>` |
| `@reduce`         | Reduce a list to a value | `<div @source="items" @reduce="(acc, item) => acc+item" @initial="0"></div>` |
| `@initial`        | Initial value for @reduce | `<div @source="items" @reduce="..." @initial="0"></div>` |
| `@component`      | Load an external component | `<component @src="comp.html"></component>` |
| `@src`            | URL of the external component | `<component @src="comp.html"></component>` |
| `@link`           | SPA navigation | `<a @link="page">Go</a>` |
| `@page`           | Show the node only on a specific page | `<div @page="home">Only on home</div>` |
| `@key`            | Unique identifier for @for loops | `<li @for="item in items" @key="item.id"></li>` |
| `@switch`         | Switch on a value | `<div @switch="value"><div @case="1">One</div><div @default>Other</div></div>` |
| `@case`           | Case for @switch | `<div @case="1">One</div>` |
| `@default`        | Default for @switch | `<div @default>Other</div>` |
| `@animate`        | Apply CSS animation | `<div @animate="fade-in"></div>` |
| `@state`          | Show current state as JSON | `<div @state></div>` |
| `@log`            | Show directive logs on the element | `<div @log></div>` |
| `@text`           | Update the node's text | `<span @text="name"></span>` |
| `no`              | Disable interpolation | `<no>{{name}}</no>` |
| `@then`           | Execute code after all other directives | `<div @then="foo=1;;bar=2"></div>` |
| `@finally`        | Execute code after everything, including @then | `<div @finally="foo=1;;bar=2"></div>` |

#### **Practical Examples for @when, @do, @go, @wait**

```html
<!-- 1. Show a welcome message only the first time you enter the home page -->
<div @when="_currentPage=='home' && !welcomeShown" @do="welcomeShown=true">
  <div class="alert">Welcome to Recipe Browser!</div>
</div>

<!-- 2. Automatically redirect to the login page if the user is not authenticated -->
<span @when="!isLoggedIn" @go="login"></span>

<!-- 3. After a successful search, show a message for 2 seconds -->
<div @when="searchResults.length > 0" @do="showMsg=true"></div>
<div @when="showMsg" @wait="2000" @do="showMsg=false">
  <div class="info">Results loaded!</div>
</div>

<!-- 4. After 3 seconds on the random recipe page, go back to home -->
<span @when="_currentPage=='random'" @wait="3000" @go="home"></span>

<!-- 5. When entering the categories page, automatically fetch categories if not loaded -->
<div @when="_currentPage=='categories' && categories.length==0" 
     @fetch="'https://www.themealdb.com/api/json/v1/1/categories.php'" 
     @result="categories">
</div>
```

#### **Event Variants**
Many directives support an event variant, e.g.:
- `@click:input`, `@fetch:click`, `@model:change`, `@class:hover`, etc.
These allow you to bind the directive to a specific DOM event.

#### **Detailed Functionality**
- **Conditionals**: `@if`, `@show`, `@hide`, `@page` control node visibility/rendering.
- **Loops**: `@for` repeats the node for each item in a list.
- **Async Data**: `@fetch` performs a fetch call, `@result` receives the result, `@source` enables array transformations.
- **Components**: `@component` and `@src` load external HTML as templates.
- **Binding**: `@model` binds input and state, `@validate` applies validation rules.
- **Events**: `@click`, `@input`, `@focus`, `@blur`, `@change`, `@hover`, `@set` handle user events and update state.
- **Styles**: `@class`, `@style` allow dynamic classes and styles.
- **Text**: `@text` updates the node's text.
- **Log & Debug**: `@log`, `@state` show debug info.
- **Switch**: `@switch`, `@case`, `@default` for multi-conditional rendering.
- **Animations**: `@animate` applies animation classes.
- **Special**: `@then`, `@finally` for post-directive execution, `no` disables interpolation.

---
For details, advanced examples and use cases, see the official documentation or the `ayisha-1.0.1.js` source code.

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

## ⚡️ **Project Setup**

### **Prerequisites**
```bash
# No installation required! 
# Ayisha.js is included in the project as a single file
```

### **Quick Start**
```bash
# 1. Clone the repository
git clone [repository-url]
cd recipe-browser

# 2. Open in a local server (recommended)
# Option A: Python
python -m http.server 8000

# Option B: Node.js live-server
npx live-server

# Option C: VS Code Live Server extension

# 3. Navigate to http://localhost:8000
```

### **Tutorial Structure**
```
recipe-browser/
├── index.html                 # 📄 Main entry point with Ayisha.js setup
├── ayisha-1.0.1.js           # 🚀 Ayisha.js Framework
├── styles.css                # 🎨 Global styles and design system
├── components/               # 🧩 Reusable components
│   ├── header.html          #   - Header with logo and branding
│   ├── nav.html             #   - Main SPA navigation
│   ├── search-section.html  #   - Advanced search section
│   └── footer.html          #   - Footer with links and info
├── pages/                    # 📱 Application pages
│   ├── home.html            #   - Homepage with quick searches
│   ├── categories.html      #   - Recipe categories list  
│   ├── category-meals.html  #   - Recipes by category
│   ├── search.html          #   - Advanced search
│   ├── random.html          #   - Random recipes
│   └── recipe-detail.html   #   - Single recipe detail
└── README.md                # 📖 This tutorial guide
```

## 📖 **Step-by-Step Tutorial Guide**

### **Level 1: Ayisha.js Fundamentals** 🟢

#### **1.1 State Initialization**
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

**📝 What you'll learn:**
- How to initialize global state with `<init>`
- Naming conventions for state variables
- Basic setup of an Ayisha.js application

#### **1.2 Basic SPA Routing**
```html
<!-- Navigation -->
<nav>
    <a @link="home">Home</a>
    <a @link="categories">Categories</a>
    <a @link="search">Search</a>
</nav>

<!-- Conditional pages -->
<component @src="./pages/home.html" @page="home"></component>
<component @src="./pages/categories.html" @page="categories"></component>
```

**📝 What you'll learn:**
- `@link` directive for navigation
- `@page` directive for conditional page rendering
- Declarative routing system

#### **1.3 External Components**
```html
<!-- Loading external components -->
<component @src="./components/header.html"></component>
<component @src="./components/nav.html"></component>
```

**📝 What you'll learn:**
- How to structure an app with modular components
- Dynamic loading of external HTML templates
- Component-based architecture

### **Level 2: State Management and Events** 🟡

#### **2.1 Two-Way Data Binding**
```html
<!-- components/search-section.html -->
<input @model="quickSearch" 
       placeholder="Search recipes...">
<div>You're searching for: {{quickSearch}}</div>
```

**📝 What you'll learn:**
- `@model` directive for bidirectional binding
- Template interpolation with `{{}}` 
- Automatic state reactivity

#### **2.2 Event Handling and API Calls**
```html
<!-- Button with API call -->
<button @click="
    loading = true; 
    error = ''
" @fetch:click="'https://www.themealdb.com/api/json/v1/1/random.php'"
   @result="randomMeal">
    Random Recipe
</button>

<!-- Loading state handling -->
<div @if="loading">Loading...</div>
<div @if="error">Error: {{error}}</div>
```

**📝 What you'll learn:**
- Combining `@click` with `@fetch` for API calls
- Managing loading states and errors
- Common patterns for async UX

#### **2.3 Iteration and List Rendering**
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
        ">View Recipes</button>
    </div>
</div>
```

**📝 What you'll learn:**
- `@for` directive for iterating arrays
- Accessing object properties in interpolation  
- Passing data between pages via state

### **Level 3: Advanced Features** 🔴

#### **3.1 Advanced Search with Filters**
```html
<!-- pages/search.html -->
<div class="search-filters">
    <select @model="searchType">
        <option value="name">By Name</option>
        <option value="ingredient">By Ingredient</option>
        <option value="area">By Area</option>
    </select>
    
    <input @model="searchQuery" 
           @input="
               if (searchQuery.length > 2) {
                   loading = true
               }
           ">
    
    <button @click="performSearch()">Search</button>
</div>

<!-- Dynamic URL based on filters -->
<div @fetch="searchUrl" @result="searchResults" @if="searchQuery.length > 2">
</div>
```

**📝 What you'll learn:**
- Computed properties for dynamic URLs
- Complex form handling with multiple options
- Real-time search with debouncing

#### **3.2 Complex State Management**
```html
<!-- pages/recipe-detail.html -->
<div @fetch="'https://www.themealdb.com/api/json/v1/1/lookup.php?i=' + selectedMealId" 
     @result="currentRecipe" 
     @if="selectedMealId">
     
<div @if="currentRecipe && currentRecipe.meals">
    <div @for="recipe in currentRecipe.meals">
        <h1>{{recipe.strMeal}}</h1>
        <img src="{{recipe.strMealThumb}}" alt="{{recipe.strMeal}}">
        
        <!-- Dynamic ingredients -->
        <ul class="ingredients">
            <li @if="recipe.strIngredient1">
                {{recipe.strMeasure1}} {{recipe.strIngredient1}}
            </li>
            <li @if="recipe.strIngredient2">
                {{recipe.strMeasure2}} {{recipe.strIngredient2}}
            </li>
            <!-- ... up to 20 ingredients -->
        </ul>
        
        <!-- Formatted instructions -->
        <div class="instructions">
            {{recipe.strInstructions}}
        </div>
    </div>
</div>
```

**📝 What you'll learn:**
- Deep navigation in state objects
- Conditional rendering based on API data
- Handling complex data structures

### **Level 4: Optimizations and Best Practices** ⚡

#### **4.1 Performance and UX**
```html
<!-- Sophisticated loading states -->
<div @if="loading" class="loading-skeleton">
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
</div>

<!-- User-friendly error handling -->
<div @if="error" class="error-message">
    <h3>Oops! Something went wrong</h3>
    <p>{{error}}</p>
    <button @click="
        error = '';
        loading = false;
        /* retry logic */
    ">Try Again</button>
</div>
```

#### **4.2 Responsive Design with Ayisha.js**
```html
<!-- Adaptive UI based on state -->
<div class="layout" 
     @class="{
         'mobile-layout': screenSize === 'mobile',
         'tablet-layout': screenSize === 'tablet',
         'desktop-layout': screenSize === 'desktop'
     }">
</div>

<!-- Mobile menu toggle -->
<button @click="mobileMenuOpen = !mobileMenuOpen" 
        class="mobile-toggle">☰</button>
<nav @class="{'nav-open': mobileMenuOpen}">
    <!-- navigation items -->
</nav>
```

## 🎓 **Practical Exercises**

### **Exercise 1: Add a New Page** 
Create a "Favorites" page that:
- Shows recipes saved in localStorage
- Allows adding/removing recipes
- Uses `@click` and `@if` for management

### **Exercise 2: Improve Search**
Extend search functionality to:
- Add search by first letter
- Implement autocomplete suggestions
- Add combined filters

### **Exercise 3: Custom Component**
Create a `recipe-card.html` component that:
- Is reusable across multiple pages
- Accepts parameters via attributes
- Includes actions (view, save, share)

## 💡 **Key Concepts Demonstrated**

### **🔄 Reactivity**
```javascript
// State is automatically reactive
currentPage = 'search';           // Changes page instantly
searchResults = newResults;       // Updates UI automatically
loading = false;                  // Hides loading states
```

### **🎯 Event-Driven Programming**
```html
<!-- Coordinated event chain -->
<button @click="
    loading = true;
    error = '';
    selectedCategory = ''
" @fetch:click="apiUrl" 
   @result="results">
    Load Data
</button>
```

### **🧩 Component Composition**
```html
<!-- App composed of modular components -->
<component @src="./components/header.html"></component>
<component @src="./pages/home.html" @page="home"></component>
<component @src="./components/footer.html"></component>
```

## 🏗️ **App Architecture**

### **Patterns Used**
- **Component-Based Architecture**: UI divided into reusable components
- **Single Source of Truth**: Centralized state in `<init>` block
- **Unidirectional Data Flow**: Data flows from top to bottom
- **Event-Driven Updates**: Changes via user events and API responses

### **State Management**
```html
<init>
    // 🌐 Navigation state
    currentPage = 'home';
    
    // 🔍 Search state  
    quickSearch = '';
    searchQuery = '';
    searchType = 'name';
    
    // 📊 Data state
    categories = [];
    searchResults = [];
    currentRecipe = null;
    
    // 🎨 UI state
    loading = false;
    error = '';
    mobileMenuOpen = false;
</init>
```

## 🌐 **API Integration with Ayisha.js**

### **TheMealDB API Endpoints**
```javascript
// 🎲 Random recipe
'https://www.themealdb.com/api/json/v1/1/random.php'

// 📋 Categories list  
'https://www.themealdb.com/api/json/v1/1/categories.php'

// 🔍 Search by name
'https://www.themealdb.com/api/json/v1/1/search.php?s=' + searchQuery

// 📖 Recipe details
'https://www.themealdb.com/api/json/v1/1/lookup.php?i=' + mealId

// 🏷️ Recipes by category
'https://www.themealdb.com/api/json/v1/1/filter.php?c=' + category
```

### **@fetch + @result Pattern**
```html
<!-- Basic pattern for API calls -->
<div @fetch="apiUrl" 
     @result="targetVariable"
     @if="shouldFetch">
     
    <!-- Loading state -->
    <div @if="loading">Loading...</div>
    
    <!-- Success state -->
    <div @if="targetVariable && !loading">
        <div @for="item in targetVariable.meals">
            {{item.strMeal}}
        </div>
    </div>
    
    <!-- Error state -->
    <div @if="error">Error: {{error}}</div>
</div>
```

## 🎯 **Learning Objectives Achieved**

By completing this tutorial, you will have learned:

✅ **Ayisha.js Fundamentals**
- Project setup and initialization
- Reactive state management
- SPA routing system

✅ **Components and Architecture**  
- Creating reusable components
- Dynamic external template loading
- Modular code organization

✅ **API Integration**
- Asynchronous HTTP calls with @fetch
- Loading states and error handling
- Patterns for optimal UX

✅ **Advanced Patterns**
- Complex event handling
- Dynamic forms and validation
- Responsive design with reactive state

## 🚀 **Next Steps**

### **Extend the Project**
1. **Add Favorites**: Recipe saving system with localStorage
2. **Improve UX**: Implement predictive search and autocomplete  
3. **PWA Features**: Make the app installable and offline-capable
4. **Testing**: Add unit tests for core functionality

### **Related Projects**
- **Advanced Todo App**: Task management with categories and filters
- **E-commerce SPA**: Shopping cart and checkout process
- **Analytics Dashboard**: Charts and data visualizations
- **Chat App**: Real-time messaging with WebSocket

## 📚 **Additional Resources**

### **Ayisha.js Documentation**
- [Official Website](https://www.ayisha.app)
- [GitHub Repository](https://github.com/BenJrSky/ayisha.js)

### **API References**
- [TheMealDB Documentation](https://www.themealdb.com/api.php)
- [REST API Best Practices](https://restfulapi.net/)

### **Design and UX**
- [Modern CSS Techniques](https://developer.mozilla.org/en-US/docs/Web/CSS)
- [Responsive Design Patterns](https://web.dev/responsive-web-design-basics/)

## 🤝 **Contributing**

This tutorial project is open source! Contribute with:

- 🐛 **Bug Reports**: Report issues in the code
- 💡 **Feature Ideas**: Propose new educational features  
- 📝 **Documentation**: Improve this guide
- 🎨 **UI/UX**: Optimize design and usability
- 🧪 **Tests**: Add tests to ensure stability

### **How to Contribute**
```bash
# 1. Fork the repository
# 2. Create a branch for your feature
git checkout -b feature/feature-name

# 3. Commit your changes
git commit -m "Add: description of changes"

# 4. Push and create a Pull Request
git push origin feature/feature-name
```

## 📊 **Tutorial Metrics**

### **Difficulty**: ⭐⭐⭐ (Intermediate)
### **Estimated Time**: 4-6 hours
### **Prerequisites**: 
- Basic HTML, CSS, JavaScript
- Basic knowledge of SPA concepts
- Familiarity with REST APIs

### **Skills Acquired**:
- ✅ Modern framework SPA development
- ✅ Reactive state management
- ✅ External API integration  
- ✅ Component-based architecture
- ✅ Advanced responsive design

## 🔮 **Future Tutorial Evolution**

### **Version 2.0 - Advanced Features**
- [ ] User authentication system
- [ ] Local database with IndexedDB
- [ ] Offline mode with Service Workers
- [ ] Push notifications for new recipes
- [ ] Social sharing integration

### **Version 3.0 - Scaling and Performance**  
- [ ] Code splitting and lazy loading
- [ ] Advanced performance optimizations
- [ ] A/B testing framework
- [ ] User analytics and tracking
- [ ] Complete internationalization

---

## 🎓 **Conclusion**

This **Recipe Browser** tutorial represents a complete example of how Ayisha.js can be used to create modern, reactive, and performant web applications. 

The simplicity of the syntax, combined with the power of the features, makes Ayisha.js ideal for both beginners wanting to learn SPA concepts and experienced developers looking for a lightweight and productive framework.

**Happy coding and bon appétit! 🍽️✨**

---

**Recipe Browser Tutorial** - Created with ❤️ for the Ayisha.js community  
*A [devBen](https://www.devben.app) project for learning modern web development*
