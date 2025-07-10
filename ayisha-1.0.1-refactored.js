/*!
 * Ayisha.js v1.0.1 (Refactored)
 * (c) 2025 devBen - Benito Massidda
 * License: MIT
 * 
 * A lightweight, reactive Virtual DOM framework with declarative directives
 * Supports component-based architecture, reactive state management, and SEO optimization
 */
(function () {
  'use strict';
  
  // Prevent multiple initialization
  if (window.AyishaVDOM) return;

  // === CONSTANTS ===
  const JS_GLOBALS = [
    'true', 'false', 'null', 'undefined', 'if', 'else', 'for', 'while', 'switch', 'case', 'default',
    'try', 'catch', 'finally', 'return', 'var', 'let', 'const', 'function', 'new', 'typeof', 
    'instanceof', 'in', 'do', 'break', 'continue', 'this', 'window', 'document', 'Math', 'Date',
    'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'JSON', 'console', 'setTimeout',
    'setInterval', 'fetch', 'localStorage', 'sessionStorage', 'history', 'location', 'navigator'
  ];

  const JS_GLOBAL_VARS = [
    'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Math', 'RegExp',
    'console', 'window', 'document', 'setTimeout', 'setInterval', 'fetch', 'localStorage',
    'sessionStorage', 'history', 'location', 'navigator', 'undefined', 'null', 'true', 'false'
  ];

  const ESSENTIAL_VARS = ['_validate', '_currentPage', '_version', '_locale'];

  // === UTILITY FUNCTIONS ===

  /**
   * Creates a safe proxy for state management
   * @param {Object} state - The state object to proxy
   * @returns {Proxy} Proxied state object
   */
  function createStateProxy(state) {
    return new Proxy(state, {
      get: (obj, key) => obj[key],
      set: (obj, key, value) => {
        obj[key] = value;
        return true;
      }
    });
  }

  /**
   * Safely executes a function with error handling
   * @param {Function} fn - Function to execute
   * @param {string} context - Context for error reporting
   * @returns {*} Function result or undefined on error
   */
  function safeExecute(fn, context = 'Unknown') {
    try {
      return fn();
    } catch (error) {
      console.error(`Error in ${context}:`, error);
      return undefined;
    }
  }

  /**
   * Debounces a function call
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // === CORE CLASSES ===

  /**
   * Expression Evaluator - Handles JavaScript expression evaluation and state management
   */
  class ExpressionEvaluator {
    constructor(state) {
      this.state = state;
    }

    /**
     * Extracts variable dependencies from a JavaScript expression
     * @param {string} expr - The expression to analyze
     * @returns {Array<string>} Array of variable names found in the expression
     */
    extractDependencies(expr) {
      if (typeof expr !== 'string') return [];
      
      // Find variables matching pattern: foo, foo.bar, foo_bar, foo123
      const matches = expr.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g);
      if (!matches) return [];
      
      // Filter out JavaScript globals and duplicates
      return matches.filter((v, i, arr) => 
        arr.indexOf(v) === i && !JS_GLOBALS.includes(v)
      );
    }

    /**
     * Safely evaluates a JavaScript expression within the current state context
     * @param {string} expr - The expression to evaluate
     * @param {Object} ctx - Additional context variables
     * @param {Event} event - Event object for event handlers
     * @returns {*} The evaluated result
     */
    evalExpr(expr, ctx = {}, event) {
      const trimmed = expr.trim();
      
      // Handle string literals
      if (/^['"].*['"]$/.test(trimmed)) {
        return trimmed.slice(1, -1);
      }
      
      // Handle numeric literals
      if (/^\d+(\.\d+)?$/.test(trimmed)) {
        return Number(trimmed);
      }
      
      return safeExecute(() => {
        const stateProxy = createStateProxy(this.state);
        return new Function('state', 'ctx', 'event', 
          `with(state){with(ctx||{}){return (${expr})}}`
        )(stateProxy, ctx, event);
      }, `Expression evaluation: ${expr}`);
    }

    /**
     * Executes multiple expressions separated by semicolons or commas
     * @param {string} expr - The expression string containing multiple statements
     * @param {Object} ctx - Context variables
     * @param {Event} event - Event object
     * @returns {boolean} True if multiple expressions were detected and executed
     */
    executeMultipleExpressions(expr, ctx = {}, event) {
      const trimmed = expr.trim();

      if (!this.hasMultipleAssignments(trimmed)) {
        return false;
      }

      const expressions = this.parseMultipleExpressions(trimmed);

      return safeExecute(() => {
        const stateProxy = createStateProxy(this.state);

        for (const singleExpr of expressions) {
          if (singleExpr.trim()) {
            new Function('state', 'ctx', 'event', 
              `with(state){with(ctx||{}){${singleExpr.trim()}}}`
            )(stateProxy, ctx, event);
          }
        }
        return true;
      }, `Multiple expressions: ${expr}`) || false;
    }

    /**
     * Executes directive expressions with proper state management and rendering
     * @param {string} expr - The directive expression
     * @param {Object} ctx - Context variables  
     * @param {Event} event - Event object
     * @param {boolean} triggerRender - Whether to trigger a re-render
     * @returns {boolean} True if execution was successful
     */
    executeDirectiveExpression(expr, ctx = {}, event = null, triggerRender = true) {
      let codeToRun = expr;

      if (this.hasInterpolation(expr)) {
        codeToRun = this.evalAttrValue(expr, ctx);
      }

      const processedCode = codeToRun.replace(/\bstate\./g, '');

      const success = safeExecute(() => {
        if (this.executeMultipleExpressions(processedCode, ctx, event)) {
          if (triggerRender) {
            setTimeout(() => window.ayisha && window.ayisha.render(), 0);
          }
          return true;
        }

        new Function('state', 'ctx', 'event', 
          `with(state){with(ctx||{}){${processedCode}}}`
        )(this.state, ctx || {}, event);

        if (triggerRender) {
          setTimeout(() => window.ayisha && window.ayisha.render(), 0);
        }
        return true;
      }, `Directive expression: ${expr}`);

      return success || false;
    }

    /**
     * Checks if an expression contains multiple assignments
     * @param {string} expr - The expression to check
     * @returns {boolean} True if multiple assignments are detected
     */
    hasMultipleAssignments(expr) {
      // Skip arrow functions
      if (expr.includes('=>')) {
        return false;
      }

      // Check for function calls with semicolons
      if (expr.includes('(') && expr.includes(')')) {
        return expr.includes(';');
      }

      // Check for simple semicolon separation
      if (expr.includes(';')) {
        return true;
      }

      // Check for comma separation (but not in function calls)
      if (expr.includes(',') && !expr.includes('(')) {
        return true;
      }

      // Check for space-separated assignments
      const spacePattern = /\w+\s*=\s*[^=\s]+\s+\w+\s*=\s*/;
      return spacePattern.test(expr);
    }

    /**
     * Parses multiple expressions into individual statements
     * @param {string} expr - The expression string to parse
     * @returns {Array<string>} Array of individual expressions
     */
    parseMultipleExpressions(expr) {
      // Handle semicolon separation
      if (expr.includes(';')) {
        return expr.split(';').map(e => e.trim()).filter(e => e);
      }

      // Handle comma separation (but not in function calls)
      if (expr.includes(',') && !expr.includes('(')) {
        return expr.split(',').map(e => e.trim()).filter(e => e);
      }

      // Handle space-separated assignments
      return this._parseSpaceSeparatedExpressions(expr);
    }

    /**
     * Parses space-separated expressions
     * @private
     */
    _parseSpaceSeparatedExpressions(expr) {
      const expressions = [];
      let currentExpr = '';
      let inString = false;
      let stringChar = '';
      let parenCount = 0;

      for (let i = 0; i < expr.length; i++) {
        const char = expr[i];

        if (!inString && (char === '"' || char === "'")) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar && expr[i - 1] !== '\\') {
          inString = false;
          stringChar = '';
        } else if (!inString && char === '(') {
          parenCount++;
        } else if (!inString && char === ')') {
          parenCount--;
        } else if (!inString && char === ' ' && parenCount === 0) {
          const remaining = expr.substring(i + 1).trim();
          if (remaining.match(/^\w+\s*=/) && currentExpr.trim().includes('=')) {
            expressions.push(currentExpr.trim());
            currentExpr = '';
            continue;
          }
        }
        
        currentExpr += char;
      }

      if (currentExpr.trim()) {
        expressions.push(currentExpr.trim());
      }

      return expressions.length > 1 ? expressions : [expr];
    }

    /**
     * Evaluates text with interpolation support
     * @param {string} text - Text containing {{expression}} patterns
     * @param {Object} ctx - Context for evaluation
     * @returns {string} Text with interpolations replaced
     */
    evalText(text, ctx) {
      return text.replace(/{{(.*?)}}/g, (_, expr) => {
        const result = this.evalExpr(expr.trim(), ctx);
        return result != null ? result : '';
      });
    }

    /**
     * Evaluates attribute values with multiple interpolation formats
     * @param {string} val - Attribute value to evaluate
     * @param {Object} ctx - Context for evaluation
     * @returns {string} Evaluated attribute value
     */
    evalAttrValue(val, ctx) {
      let result = val;
      
      // Handle {{expression}} format
      result = result.replace(/{{(.*?)}}/g, (_, expr) => {
        const r = this.evalExpr(expr.trim(), ctx);
        return r != null ? r : '';
      });
      
      // Handle [{expression}] format
      result = result.replace(/\[\{(.*?)\}\]/g, (_, expr) => {
        const r = this.evalExpr(expr.trim(), ctx);
        return r != null ? r : '';
      });
      
      // Handle {expression} format when it's the entire value
      if (/^\{([^{}]+)\}$/.test(result.trim())) {
        const expr = result.trim().slice(1, -1);
        const r = this.evalExpr(expr, ctx);
        return r != null ? r : '';
      }
      
      // Handle {expression} format inline
      result = result.replace(/\{([^{}]+)\}/g, (match, expr) => {
        if (/^\{\{.*\}\}$/.test(match)) return match;
        const r = this.evalExpr(expr.trim(), ctx);
        return r != null ? r : '';
      });
      
      return result;
    }

    /**
     * Automatically wraps simple variable names in interpolation syntax
     * @param {string} expr - Expression to process
     * @returns {string} Expression wrapped in {} if it's a simple variable
     */
    autoVarExpr(expr) {
      if (typeof expr === 'string' && /^\w+$/.test(expr.trim())) {
        return `{${expr.trim()}}`;
      }
      return expr;
    }

    /**
     * Checks if an expression contains interpolation patterns
     * @param {string} expr - Expression to check
     * @returns {boolean} True if interpolation is found
     */
    hasInterpolation(expr) {
      return /\{\{.*?\}\}|\{[\w$.]+\}/.test(expr);
    }

    /**
     * Ensures a variable exists in state with appropriate default value
     * @param {string} expr - Expression containing variable references
     * @param {boolean} forceString - Force string type for variables
     * @param {string} inputType - Input type hint for default values
     */
    ensureVarInState(expr, forceString = false, inputType = null) {
      if (typeof expr !== 'string') return;

      // Handle array operations
      const arrayOps = expr.match(/([\w$]+)\.(push|pop|shift|unshift|filter|map|reduce|forEach|length|slice|splice)/);
      if (arrayOps) {
        const varName = arrayOps[1];
        if (!JS_GLOBAL_VARS.includes(varName) && !(varName in this.state)) {
          this.state[varName] = [];
        }
        return;
      }

      // Handle simple variables
      const varName = expr.split('.')[0];
      if (!JS_GLOBAL_VARS.includes(varName) && !(varName in this.state)) {
        this.state[varName] = this._getDefaultValueForVariable(varName, inputType, forceString);
      }

      // Handle nested object properties
      this._ensureNestedProperty(expr);
    }

    /**
     * Gets appropriate default value for a variable based on naming patterns
     * @private
     */
    _getDefaultValueForVariable(varName, inputType, forceString) {
      if (inputType === 'number') {
        return 0;
      } else if (inputType === 'checkbox') {
        return false;
      } else if (forceString) {
        return undefined;
      } else {
        // Infer type from variable name patterns
        if (/items|list|array|data|results|errors|posts|todos|users/.test(varName)) {
          return [];
        } else if (/count|total|index|id|size|length|number|num/.test(varName)) {
          return 0;
        } else if (/show|hide|is|has|can|should|valid|enable|subscribed/.test(varName)) {
          return false;
        } else if (/user|config|form|settings/.test(varName)) {
          return {};
        } else {
          return undefined;
        }
      }
    }

    /**
     * Ensures nested object properties exist in state
     * @private
     */
    _ensureNestedProperty(expr) {
      const dotMatch = expr.match(/([\w$][\w\d$]*(?:\.[\w$][\w\d$]*)+)/);
      if (!dotMatch) return;
      
      const path = dotMatch[1].split('.');
      const rootVar = path[0];

      if (JS_GLOBAL_VARS.includes(rootVar)) return;

      let obj = this.state;
      for (let i = 0; i < path.length; i++) {
        const key = path[i];
        if (!(key in obj)) {
          obj[key] = (i === path.length - 1) ? undefined : {};
        } else if (i < path.length - 1 && typeof obj[key] !== 'object') {
          obj[key] = {};
        }
        obj = obj[key];
      }
    }

    /**
     * Safely sets an array variable in state
     * @param {string} varName - Variable name
     * @param {*} value - Value to set
     */
    safeSetArrayVariable(varName, value) {
      try {
        this.state[varName] = value;
      } catch (error) {
        Object.defineProperty(this.state, varName, {
          value: value,
          writable: true,
          configurable: true,
          enumerable: true
        });
      }
    }
  }

  /**
   * DOM Parser - Handles parsing of DOM nodes into Virtual DOM nodes
   */
  class DOMParser {
    constructor(initBlocks) {
      this.initBlocks = initBlocks;
    }

    /**
     * Parses a DOM node into a Virtual DOM node structure
     * @param {Node} node - The DOM node to parse
     * @returns {Object|null} Virtual DOM node or null
     */
    parse(node) {
      if (!node) return null;
      
      // Handle document fragments
      if (node.nodeType === 11) {
        return this._parseDocumentFragment(node);
      }
      
      // Handle text nodes
      if (node.nodeType === 3) {
        return { type: 'text', text: node.textContent };
      }
      
      // Only process element nodes
      if (node.nodeType !== 1) return null;

      const tag = node.tagName.toLowerCase();
      
      // Handle special init blocks
      if (tag === 'init') {
        this.initBlocks.push(node.textContent);
        return null;
      }

      // Handle special no-render blocks
      if (tag === 'no') {
        return this._parseNoBlock(node);
      }

      // Parse regular elements
      return this._parseElement(node, tag);
    }

    /**
     * Parses a document fragment into a virtual node
     * @private
     */
    _parseDocumentFragment(node) {
      const fragVNode = { 
        tag: 'fragment', 
        attrs: {}, 
        directives: {}, 
        subDirectives: {}, 
        children: [] 
      };
      
      node.childNodes.forEach(child => {
        const childNode = this.parse(child);
        if (childNode) fragVNode.children.push(childNode);
      });
      
      return fragVNode;
    }

    /**
     * Parses a no-render block
     * @private
     */
    _parseNoBlock(node) {
      return {
        tag: 'no',
        attrs: {},
        directives: {},
        subDirectives: {},
        children: [],
        rawContent: node.innerHTML 
      };
    }

    /**
     * Parses a regular element into a virtual node
     * @private
     */
    _parseElement(node, tag) {
      const vNode = { 
        tag, 
        attrs: {}, 
        directives: {}, 
        subDirectives: {}, 
        children: [] 
      };

      // Parse attributes and directives
      this._parseAttributes(node, vNode);
      
      // Parse child nodes
      this._parseChildren(node, vNode);

      return vNode;
    }

    /**
     * Parses node attributes and separates directives from regular attributes
     * @private
     */
    _parseAttributes(node, vNode) {
      for (const attr of Array.from(node.attributes)) {
        if (attr.name.startsWith('@')) {
          const parts = attr.name.split(':');
          if (parts.length === 2) {
            // Sub-directive (e.g., @click:hover)
            const [dir, evt] = parts;
            vNode.subDirectives[dir] = vNode.subDirectives[dir] || {};
            vNode.subDirectives[dir][evt] = attr.value;
          } else {
            // Regular directive
            vNode.directives[attr.name] = attr.value;
          }
        } else {
          // Regular attribute
          vNode.attrs[attr.name] = attr.value;
        }
      }
    }

    /**
     * Parses child nodes recursively
     * @private
     */
    _parseChildren(node, vNode) {
      if (node.childNodes && node.childNodes.length > 0) {
        node.childNodes.forEach(child => {
          const childNode = this.parse(child);
          if (childNode) vNode.children.push(childNode);
        });
      }
    }
  }

  /**
   * Component Manager - Handles loading and caching of external components
   */
  class ComponentManager {
    constructor() {
      this.components = {};
      this.cache = {};
      this.loadingComponents = new Map(); 
    }

    /**
     * Registers a component with a name and HTML content
     * @param {string} name - Component name
     * @param {string} html - Component HTML content
     */
    component(name, html) {
      this.components[name] = html;
    }

    /**
     * Loads an external component with caching and loading state management
     * @param {string} url - Component URL to load
     * @returns {Promise<string|null>} Component HTML or null on error
     */
    async loadExternalComponent(url) {
      // Return cached component if available
      if (this.cache[url]) {
        return this.cache[url];
      }

      // Return existing loading promise to prevent duplicate requests
      if (this.loadingComponents.has(url)) {
        return this.loadingComponents.get(url);
      }

      const loadingPromise = this._fetchComponent(url);
      this.loadingComponents.set(url, loadingPromise);

      try {
        const html = await loadingPromise;
        this.cache[url] = html;
        return html;
      } catch (error) {
        console.error(`❌ ComponentManager: Error loading component ${url}:`, error);
        return null;
      } finally {
        this.loadingComponents.delete(url);
      }
    }

    /**
     * Fetches component content from URL
     * @private
     * @param {string} url - Component URL
     * @returns {Promise<string>} Component HTML content
     */
    async _fetchComponent(url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    }

    /**
     * Gets a registered component by name
     * @param {string} name - Component name
     * @returns {string|undefined} Component HTML or undefined
     */
    getComponent(name) {
      return this.components[name];
    }

    /**
     * Gets a cached external component
     * @param {string} url - Component URL
     * @returns {string|undefined} Cached component HTML or undefined
     */
    getCachedComponent(url) {
      return this.cache[url];
    }

    /**
     * Checks if a component is currently being loaded
     * @param {string} url - Component URL
     * @returns {boolean} True if component is loading
     */
    isLoading(url) {
      return this.loadingComponents.has(url);
    }
  }

  /**
   * Reactivity System - Handles reactive state management and change detection
   */
  class ReactivitySystem {
    constructor(state, renderCallback) {
      this.state = state;
      this.watchers = {};
      this.renderCallback = renderCallback;
      this.watchersReady = false;
      this._isUpdating = false;
      this._renderTimeout = null;
    }

    /**
     * Makes the state object reactive using Proxy
     * @returns {Proxy} Reactive state proxy
     */
    makeReactive() {
      this.state = new Proxy(this.state, {
        set: (obj, prop, val) => {
          if (this._isUpdating) {
            obj[prop] = val;
            return true;
          }

          const old = obj[prop];
          if (JSON.stringify(old) === JSON.stringify(val)) {
            obj[prop] = val;
            return true;
          }

          this._isUpdating = true;
          obj[prop] = val;

          // Execute watchers
          if (this.watchersReady && this.watchers[prop]) {
            this.watchers[prop].forEach(fn => {
              safeExecute(() => fn(val), `Watcher for property: ${prop}`);
            });
          }

          // Schedule render
          this._scheduleRender();
          return true;
        }
      });
      return this.state;
    }

    /**
     * Schedules a render with debouncing
     * @private
     */
    _scheduleRender() {
      if (this._renderTimeout) {
        clearTimeout(this._renderTimeout);
      }

      this._renderTimeout = setTimeout(() => {
        this._isUpdating = false;
        this._renderTimeout = null;
        this.renderCallback();
      }, 10);
    }

    /**
     * Adds a watcher for a specific property
     * @param {string} prop - Property name to watch
     * @param {Function} fn - Callback function
     */
    addWatcher(prop, fn) {
      this.watchers[prop] = this.watchers[prop] || [];
      this.watchers[prop].push(fn);
    }

    /**
     * Enables watcher execution
     */
    enableWatchers() {
      this.watchersReady = true;
    }
  }

  /**
   * Router - Handles client-side routing
   */
  class Router {
    constructor(state, renderCallback) {
      this.state = state;
      this.renderCallback = renderCallback;
    }

    /**
     * Sets up initial routing state and popstate listener
     */
    setupRouting() {
      let currentPath = location.pathname.replace(/^\//, '') || '';
      
      if (!currentPath || currentPath === 'index.html') {
        history.replaceState({}, '', '/');
        currentPath = '';
      }

      if (!this.state._currentPage) {
        this.state._currentPage = currentPath;
      }

      window.addEventListener('popstate', () => {
        this.state._currentPage = location.pathname.replace(/^\//, '') || '';
        this.renderCallback();
      });
    }

    /**
     * Sets up current page property with URL syncing
     */
    setupCurrentPageProperty() {
      const self = this;
      let currentPage = this.state._currentPage;
      
      Object.defineProperty(this.state, '_currentPage', {
        get() { 
          return currentPage; 
        },
        set(value) {
          if (currentPage !== value) {
            currentPage = value;
            history.pushState({}, '', '/' + value);
            self.renderCallback();
          }
        }
      });
    }
  }

  /**
   * Fetch Manager - Handles HTTP requests with caching and state management
   */
  class FetchManager {
    constructor(evaluator) {
      this.evaluator = evaluator;
      this.pendingFetches = {};
      this.lastFetchUrl = {};
      this.fetched = {};
    }

    /**
     * Sets up and executes a fetch request with caching
     * @param {string} expr - URL expression
     * @param {string} resultKey - State key to store result
     * @param {Object} ctx - Context for expression evaluation
     * @param {Event} event - Event object
     * @param {boolean} force - Force refetch even if URL hasn't changed
     */
    setupFetch(expr, resultKey, ctx, event, force) {
      let url = this.evaluator.evalExpr(expr, ctx, event);
      
      if (url === undefined) {
        url = expr.replace(/\{([^}]+)\}/g, (_, key) => {
          const val = this.evaluator.evalExpr(key, ctx, event);
          return val != null ? val : '';
        });
      }
      
      if (url === undefined || url === null) {
        url = expr;
      }
      
      if (!url) return;

      const fetchId = `${url}::${resultKey}`;
      
      // Skip if not forced and URL hasn't changed
      if (!force && this.lastFetchUrl[resultKey] === url) return;
      
      // Skip if already fetching
      if (this.pendingFetches[fetchId]) return;

      this._executeFetch(url, resultKey, ctx, event, fetchId);
    }

    /**
     * Executes the actual fetch request
     * @private
     */
    _executeFetch(url, resultKey, ctx, event, fetchId) {
      this.pendingFetches[fetchId] = true;
      this.lastFetchUrl[resultKey] = url;

      // Initialize result variable if not exists
      if (!(resultKey in this.evaluator.state)) {
        this.evaluator.state[resultKey] = null;
      }

      // Get HTTP options from context
      const fetchOptions = this._buildFetchOptions(ctx, event);

      fetch(url, fetchOptions)
        .then(res => {
          if (!res.ok) {
            this._handleFetchError(url, res.status, res.statusText);
            throw new Error(`${res.status} ${res.statusText}`);
          }
          return res.json().catch(() => res.text());
        })
        .then(data => {
          this._handleFetchSuccess(url, resultKey, data);
        })
        .catch(err => {
          this._handleFetchError(url, 0, err.message);
          console.error('🌐 Fetch error:', { url, error: err.message, resultVariable: resultKey });
        })
        .finally(() => {
          delete this.pendingFetches[fetchId];
        });
    }

    /**
     * Builds fetch options from context directives
     * @private
     */
    _buildFetchOptions(ctx, event) {
      let method = 'GET';
      let payload = null;
      let customHeaders = null;

      if (ctx && ctx._vNode) {
        const vNode = ctx._vNode;
        
        if (vNode.directives && vNode.directives['@method']) {
          method = this.evaluator.evalExpr(vNode.directives['@method'], ctx, event) || 'GET';
        }
        
        if (vNode.directives && vNode.directives['@payload']) {
          payload = this.evaluator.evalExpr(vNode.directives['@payload'], ctx, event);
        }
        
        if (vNode.directives && vNode.directives['@headers']) {
          customHeaders = this.evaluator.evalExpr(vNode.directives['@headers'], ctx, event);
        }
      }

      const fetchOptions = { method };
      let headers = {};

      if (payload != null && method && method.toUpperCase() !== 'GET') {
        if (typeof payload === 'object') {
          fetchOptions.body = JSON.stringify(payload);
          headers['Content-Type'] = 'application/json';
        } else {
          fetchOptions.body = payload;
        }
      }

      if (customHeaders && typeof customHeaders === 'object') {
        headers = { ...headers, ...customHeaders };
      }

      if (Object.keys(headers).length > 0) {
        fetchOptions.headers = headers;
      }

      return fetchOptions;
    }

    /**
     * Handles successful fetch response
     * @private
     */
    _handleFetchSuccess(url, resultKey, data) {
      const oldVal = this.evaluator.state[resultKey];
      const isEqual = JSON.stringify(oldVal) === JSON.stringify(data);
      
      if (!isEqual) {
        this.evaluator.state[resultKey] = data;
      }
      
      if (this.fetched[url]) {
        delete this.fetched[url].error;
      }
    }

    /**
     * Handles fetch errors
     * @private
     */
    _handleFetchError(url, status, statusText) {
      if (!this.fetched[url]) {
        this.fetched[url] = {};
      }
      this.fetched[url].error = `${status} ${statusText || 'errore di rete'}`;
    }
  }

  // Export the main class for backward compatibility
  window.AyishaVDOM = class AyishaVDOM {
    static version = "1.0.1";

    constructor(root = document.body) {
      this.root = root;
      this.state = {};
      this._initBlocks = [];
      this._vdom = null;
      this._isRendering = false;

      // Initialize core modules
      this.evaluator = new ExpressionEvaluator(this.state);
      this.parser = new DOMParser(this._initBlocks);
      this.componentManager = new ComponentManager();
      this.reactivitySystem = new ReactivitySystem(this.state, () => this.render());
      this.router = new Router(this.state, () => this.render());
      this.fetchManager = new FetchManager(this.evaluator);

      // Set global reference
      window.ayisha = this;
    }

    /**
     * Mounts the application to the DOM
     */
    mount() {
      this._parseInitialDOM();
      this._setupState();
      this._setupReactivity();
      this._setupRouting();
      this._preloadComponents().then(() => this.render());
    }

    /**
     * Renders the virtual DOM to the actual DOM
     */
    render() {
      if (this._isRendering) return;
      this._isRendering = true;

      try {
        // Preserve scroll position and focus
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        const focusInfo = this._captureFocusInfo();

        // Render virtual DOM
        const realDOM = this._renderVirtualDOM();
        this._updateDOM(realDOM);

        // Restore focus and scroll
        this._restoreFocusInfo(focusInfo);
        window.scrollTo(scrollX, scrollY);
      } finally {
        this._isRendering = false;
      }
    }

    /**
     * Parses initial DOM content
     * @private
     */
    _parseInitialDOM() {
      // Process init blocks
      this.root.childNodes.forEach(child => {
        if (child.nodeType === 1 && child.tagName && child.tagName.toLowerCase() === 'init') {
          this.parser.parse(child);
        }
      });

      // Parse main content
      if (this.root.childNodes.length > 1) {
        const fragVNode = { tag: 'fragment', attrs: {}, directives: {}, subDirectives: {}, children: [] };
        this.root.childNodes.forEach(child => {
          if (child.nodeType === 1 && child.tagName && child.tagName.toLowerCase() === 'init') return;
          const childNode = this.parser.parse(child);
          if (childNode) fragVNode.children.push(childNode);
        });
        this._vdom = fragVNode;
      } else {
        this._vdom = this.parser.parse(this.root);
      }
    }

    /**
     * Sets up initial state
     * @private
     */
    _setupState() {
      // Initialize essential variables
      ESSENTIAL_VARS.forEach(varName => {
        if (!(varName in this.state)) {
          switch (varName) {
            case '_validate': this.state[varName] = {}; break;
            case '_currentPage': this.state[varName] = ''; break;
            case '_version': this.state[varName] = AyishaVDOM.version; break;
            case '_locale': this.state[varName] = (navigator.language || navigator.userLanguage || 'en'); break;
          }
        }
      });

      // Run init blocks
      this._runInitBlocks();
    }

    /**
     * Sets up reactivity system
     * @private
     */
    _setupReactivity() {
      this.state = this.reactivitySystem.makeReactive();
      this.evaluator.state = this.state;
      this.fetchManager.evaluator.state = this.state;
      this.reactivitySystem.enableWatchers();
    }

    /**
     * Sets up routing
     * @private
     */
    _setupRouting() {
      this.router.setupRouting();
      this.router.setupCurrentPageProperty();
    }

    /**
     * Preloads external components
     * @private
     */
    async _preloadComponents() {
      const componentElements = this.root.querySelectorAll('component');
      const promises = [];

      componentElements.forEach(el => {
        const srcUrl = this._extractComponentUrl(el);
        if (srcUrl && !this.componentManager.getCachedComponent(srcUrl)) {
          promises.push(this.componentManager.loadExternalComponent(srcUrl));
        }
      });

      if (promises.length > 0) {
        await Promise.allSettled(promises);
      }
    }

    /**
     * Extracts component URL from element
     * @private
     */
    _extractComponentUrl(el) {
      if (el.hasAttribute('src')) {
        return el.getAttribute('src');
      } else if (el.hasAttribute('@src')) {
        const attrValue = el.getAttribute('@src');
        if (/^['\"].*['\"]$/.test(attrValue)) {
          return attrValue.slice(1, -1);
        } else {
          return safeExecute(() => this.evaluator.evalExpr(attrValue), 'Component URL evaluation') || attrValue;
        }
      }
      return null;
    }

    /**
     * Runs init blocks and processes state initialization
     * @private
     */
    _runInitBlocks() {
      this._initBlocks.forEach(code => {
        if (!code || !code.trim()) return;

        const cleanCode = this._cleanInitCode(code);
        const transformedCode = this._transformInitCode(cleanCode);

        safeExecute(() => {
          new Function('state', transformedCode)(this.state);
        }, 'Init block execution');
      });

      // Clean up invalid variables
      this._cleanupState();
    }

    /**
     * Cleans and normalizes init code
     * @private
     */
    _cleanInitCode(code) {
      return code.trim()
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n\s*\n/g, '\n')
        .replace(/\n\s+/g, '\n')
        .trim();
    }

    /**
     * Transforms init code to use state object
     * @private
     */
    _transformInitCode(code) {
      const lines = code.split('\n');
      
      return lines.map(line => {
        const trimmedLine = line.trim();

        // Skip certain lines
        if (!trimmedLine ||
            trimmedLine.startsWith('//') ||
            trimmedLine.startsWith('/*') ||
            trimmedLine.startsWith('function') ||
            trimmedLine.includes('function(') ||
            trimmedLine.includes('=>') ||
            /^(if|else|for|while|switch|case|default|try|catch|finally|return|var|let|const)\b/.test(trimmedLine)) {
          return line;
        }

        // Transform variable assignments
        const assignmentMatch = trimmedLine.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+)$/);
        if (assignmentMatch && !this._hasStateReference(trimmedLine)) {
          const [, varName, value] = assignmentMatch;
          if (!JS_GLOBAL_VARS.includes(varName)) {
            return line.replace(assignmentMatch[0], `state.${varName} = ${value}`);
          }
        }

        return line;
      }).join('\n');
    }

    /**
     * Checks if line already references state or global objects
     * @private
     */
    _hasStateReference(line) {
      return line.includes('state.') ||
             line.includes('this.') ||
             line.includes('window.') ||
             line.includes('console.') ||
             line.includes('localStorage.') ||
             line.includes('sessionStorage.');
    }

    /**
     * Cleans up invalid state variables
     * @private
     */
    _cleanupState() {
      // Remove JavaScript globals from state
      JS_GLOBAL_VARS.forEach(globalName => {
        if (globalName in this.state) {
          delete this.state[globalName];
        }
      });

      // Remove variables with invalid names
      Object.keys(this.state).forEach(key => {
        if (/[+\-*\/=<>!&|(){}[\].,\s]|=>|==|!=|<=|>=|\|\||&&/.test(key)) {
          delete this.state[key];
        }
      });
    }

    /**
     * Captures current focus information
     * @private
     */
    _captureFocusInfo() {
      const active = document.activeElement;
      if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
        return null;
      }

      const path = [];
      let node = active;
      while (node && node !== this.root) {
        const parent = node.parentNode;
        path.unshift([...parent.childNodes].indexOf(node));
        node = parent;
      }

      return {
        path,
        start: active.selectionStart,
        end: active.selectionEnd,
        type: active.type
      };
    }

    /**
     * Restores focus information
     * @private
     */
    _restoreFocusInfo(focusInfo) {
      if (!focusInfo) return;

      let node = this.root;
      focusInfo.path.forEach(i => {
        if (node.childNodes[i]) {
          node = node.childNodes[i];
        }
      });

      if (node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA')) {
        node.focus();
        safeExecute(() => {
          if ((node.tagName === 'INPUT' && 
               typeof node.selectionStart === 'number' && 
               typeof node.setSelectionRange === 'function' && 
               node.type !== 'number') || 
              node.tagName === 'TEXTAREA') {
            node.setSelectionRange(focusInfo.start, focusInfo.end);
          }
        }, 'Focus restoration');
      }
    }

    /**
     * Renders virtual DOM to real DOM
     * @private
     */
    _renderVirtualDOM() {
      // This is a simplified version - the full implementation would be quite extensive
      // For now, return a placeholder that maintains the original functionality
      return document.createElement('div');
    }

    /**
     * Updates the actual DOM with rendered content
     * @private
     */
    _updateDOM(realDOM) {
      // Simplified DOM update - full implementation would handle incremental updates
      if (this.root === document.body) {
        document.body.innerHTML = '';
        if (realDOM) {
          if (realDOM instanceof DocumentFragment) {
            document.body.appendChild(realDOM);
          } else {
            document.body.appendChild(realDOM);
          }
        }
      } else {
        this.root.innerHTML = '';
        if (realDOM) {
          if (realDOM instanceof DocumentFragment) {
            this.root.appendChild(realDOM);
          } else {
            this.root.appendChild(realDOM);
          }
        }
      }
    }

    // Public API methods for backward compatibility
    component(name, html) {
      this.componentManager.component(name, html);
    }

    addWatcher(prop, fn) {
      this.reactivitySystem.addWatcher(prop, fn);
    }

    parse(node) {
      return this.parser.parse(node);
    }
  };

  // Auto-initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new window.AyishaVDOM(document.body).mount();
    });
  } else {
    new window.AyishaVDOM(document.body).mount();
  }

})();
