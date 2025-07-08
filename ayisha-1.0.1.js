/*!
 * Ayisha.js v1.0.0
 * (c) 2025 devBen - Benito Massidda
 * License: MIT
 */
(function () {
  // Prevent redeclaration
  if (window.AyishaVDOM) return;

  // ===== CORE MODULES =====

  /**
   * Module: Expression Evaluator
   * Handles all expression evaluation and interpolation
   */
  class ExpressionEvaluator {
    constructor(state) {
      this.state = state;
    }

    evalExpr(expr, ctx = {}, event) {
      const t = expr.trim();
      if (/^['"].*['"]$/.test(t)) return t.slice(1, -1);
      if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
      try {
        const sp = new Proxy(this.state, {
          get: (o, k) => o[k],
          set: (o, k, v) => { o[k] = v; return true; }
        });
        return new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){return (${expr})}}`)(sp, ctx, event);
      } catch {
        return undefined;
      }
    }

    /**
     * Execute multiple expressions separated by various delimiters
     * Supports: semicolon (;), comma (,), or space-separated assignments
     */
    executeMultipleExpressions(expr, ctx = {}, event) {
      const trimmed = expr.trim();

      // If it's a simple expression, don't handle it here - let individual handlers take care of it
      if (!this.hasMultipleAssignments(trimmed)) {
        return false;
      }

      // Parse multiple expressions
      const expressions = this.parseMultipleExpressions(trimmed);

      try {
        const sp = new Proxy(this.state, {
          get: (o, k) => o[k],
          set: (o, k, v) => { o[k] = v; return true; }
        });

        for (const singleExpr of expressions) {
          if (singleExpr.trim()) {
            new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${singleExpr.trim()}}}`)(sp, ctx, event);
          }
        }
        return true;
      } catch (error) {
        console.warn('Error executing multiple expressions:', error, 'Original:', expr);
        return false;
      }
    }

    /**
     * General helper for executing expressions with multiple expressions support
     * This can be used by ANY directive that needs to execute code
     */
    executeDirectiveExpression(expr, ctx = {}, event = null, triggerRender = true) {
      let codeToRun = expr;

      // Handle interpolation
      if (this.hasInterpolation(expr)) {
        codeToRun = this.evalAttrValue(expr, ctx);
      }

      // Remove state. prefix
      const processedCode = codeToRun.replace(/\bstate\./g, '');

      try {
        // Try multiple expressions first
        if (this.executeMultipleExpressions(processedCode, ctx, event)) {
          if (triggerRender) {
            setTimeout(() => window.ayisha && window.ayisha.render(), 0);
          }
          return true;
        }

        // Fallback to single expression
        const cleanCode = processedCode;
        new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${cleanCode}}}`)
          (this.state, ctx || {}, event);

        if (triggerRender) {
          setTimeout(() => window.ayisha && window.ayisha.render(), 0);
        }
        return true;
      } catch (error) {
        console.error('Error executing directive expression:', error, 'Expression:', expr);
        return false;
      }
    }

    /**
     * Check if expression contains multiple assignments
     */
    hasMultipleAssignments(expr) {
      // If expression contains arrow functions, it's likely a single complex expression
      if (expr.includes('=>')) {
        return false;
      }

      // If expression contains function calls with parentheses, be cautious
      if (expr.includes('(') && expr.includes(')')) {
        // Only consider semicolon separation for complex expressions with functions
        const result = expr.includes(';');
        return result;
      }

      // Quick checks for obvious separators
      if (expr.includes(';')) {
        return true;
      }

      // Check comma separation (but be careful with function calls)
      if (expr.includes(',') && !expr.includes('(')) {
        return true;
      }

      // Check space separation - look for pattern: var=value space var=value
      const spacePattern = /\w+\s*=\s*[^=\s]+\s+\w+\s*=\s*/;
      const spaceResult = spacePattern.test(expr);
      return spaceResult;
    }

    /**
     * Parse multiple expressions from various formats
     */
    parseMultipleExpressions(expr) {
      // First try semicolon separation
      if (expr.includes(';')) {
        return expr.split(';').map(e => e.trim()).filter(e => e);
      }

      // Then try comma separation (but be careful with function calls)
      if (expr.includes(',') && !expr.includes('(')) {
        return expr.split(',').map(e => e.trim()).filter(e => e);
      }

      // Finally try space separation using a more robust approach
      // Look for patterns like: variable=value followed by space and another variable=value
      const expressions = [];
      let currentExpr = '';
      let inString = false;
      let stringChar = '';
      let parenCount = 0;
      let i = 0;

      while (i < expr.length) {
        const char = expr[i];

        if (!inString && (char === '"' || char === "'")) {
          inString = true;
          stringChar = char;
          currentExpr += char;
        } else if (inString && char === stringChar && expr[i - 1] !== '\\') {
          inString = false;
          stringChar = '';
          currentExpr += char;
        } else if (!inString && char === '(') {
          parenCount++;
          currentExpr += char;
        } else if (!inString && char === ')') {
          parenCount--;
          currentExpr += char;
        } else if (!inString && char === ' ' && parenCount === 0) {
          // Check if we're at a space that could separate expressions
          // Look ahead to see if there's a variable assignment pattern
          const remaining = expr.substring(i + 1).trim();
          if (remaining.match(/^\w+\s*=/) && currentExpr.trim().includes('=')) {
            expressions.push(currentExpr.trim());
            currentExpr = '';
            // Skip the space
          } else {
            currentExpr += char;
          }
        } else {
          currentExpr += char;
        }
        i++;
      }

      // Add the last expression
      if (currentExpr.trim()) {
        expressions.push(currentExpr.trim());
      }

      // Return multiple expressions if we found more than one, otherwise single
      return expressions.length > 1 ? expressions : [expr];
    }

    evalText(text, ctx) {
      return text.replace(/{{(.*?)}}/g, (_, e) => {
        const r = this.evalExpr(e.trim(), ctx);
        return r != null ? r : '';
      });
    }

    evalAttrValue(val, ctx) {
      let result = val.replace(/{{(.*?)}}/g, (_, e) => {
        const r = this.evalExpr(e.trim(), ctx);
        return r != null ? r : '';
      });
      result = result.replace(/\[\{(.*?)\}\]/g, (_, e) => {
        const r = this.evalExpr(e.trim(), ctx);
        return r != null ? r : '';
      });
      if (/^\{([^{}]+)\}$/.test(result.trim())) {
        const expr = result.trim().slice(1, -1);
        const r = this.evalExpr(expr, ctx);
        return r != null ? r : '';
      }
      result = result.replace(/\{([^{}]+)\}/g, (match, e) => {
        if (/^\{\{.*\}\}$/.test(match)) return match;
        const r = this.evalExpr(e.trim(), ctx);
        return r != null ? r : '';
      });
      return result;
    }

    autoVarExpr(expr) {
      if (typeof expr === 'string' && /^\w+$/.test(expr.trim())) {
        return `{${expr.trim()}}`;
      }
      return expr;
    }

    hasInterpolation(expr) {
      return /\{\{.*?\}\}|\{[\w$.]+\}/.test(expr);
    }

    ensureVarInState(expr, forceString = false, inputType = null) {
      if (typeof expr !== 'string') return;

      const jsGlobals = [
        'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Math', 'RegExp',
        'console', 'window', 'document', 'setTimeout', 'setInterval', 'fetch', 'localStorage',
        'sessionStorage', 'history', 'location', 'navigator', 'undefined', 'null', 'true', 'false'
      ];

      const arrayOps = expr.match(/([\w$]+)\.(push|pop|shift|unshift|filter|map|reduce|forEach|length|slice|splice)/);
      if (arrayOps) {
        const varName = arrayOps[1];
        if (!jsGlobals.includes(varName) && !(varName in this.state)) {
          this.state[varName] = [];
        }
        return;
      }

      const varName = expr.split('.')[0];
      if (!jsGlobals.includes(varName) && !(varName in this.state)) {
        if (inputType === 'number') {
          this.state[varName] = 0;
        } else if (inputType === 'checkbox') {
          this.state[varName] = false;
        } else if (forceString) {
          this.state[varName] = undefined;
        } else {
          if (/items|list|array|data|results|errors|posts|todos|users/.test(varName)) {
            this.state[varName] = [];
          } else if (/count|total|index|id|size|length|number|num/.test(varName)) {
            this.state[varName] = 0;
          } else if (/show|hide|is|has|can|should|valid|enable|subscribed/.test(varName)) {
            this.state[varName] = false;
          } else if (/user|config|form|settings/.test(varName)) {
            this.state[varName] = {};
          } else {
            this.state[varName] = undefined;
          }
        }
      }

      const dotMatch = expr.match(/([\w$][\w\d$]*(?:\.[\w$][\w\d$]*)+)/);
      if (dotMatch) {
        const path = dotMatch[1].split('.');
        const rootVar = path[0];

        if (jsGlobals.includes(rootVar)) return;

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
    }

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
   * Module: DOM Parser
   */
  class DOMParser {
    constructor(initBlocks) {
      this.initBlocks = initBlocks;
    }

    parse(node) {
      if (!node) return null;
      if (node.nodeType === 11) {
        const fragVNode = { tag: 'fragment', attrs: {}, directives: {}, subDirectives: {}, children: [] };
        node.childNodes.forEach(child => {
          const cn = this.parse(child);
          if (cn) fragVNode.children.push(cn);
        });
        return fragVNode;
      }
      if (node.nodeType === 3) {
        return { type: 'text', text: node.textContent };
      }
      if (node.nodeType !== 1) return null;

      const tag = node.tagName.toLowerCase();
      if (tag === 'init') {
        this.initBlocks.push(node.textContent);
        return null;
      }

      // Special handling for <no> tag - preserve raw HTML content
      if (tag === 'no') {
        return {
          tag: 'no',
          attrs: {},
          directives: {},
          subDirectives: {},
          children: [],
          rawContent: node.innerHTML // Store the raw HTML content
        };
      }

      const vNode = { tag, attrs: {}, directives: {}, subDirectives: {}, children: [] };

      for (const attr of Array.from(node.attributes)) {
        if (attr.name.startsWith('@')) {
          const parts = attr.name.split(':');
          if (parts.length === 2) {
            const [dir, evt] = parts;
            vNode.subDirectives[dir] = vNode.subDirectives[dir] || {};
            vNode.subDirectives[dir][evt] = attr.value;
          } else {
            vNode.directives[attr.name] = attr.value;
          }
        } else {
          vNode.attrs[attr.name] = attr.value;
        }
      }

      if (node.childNodes && node.childNodes.length > 0) {
        node.childNodes.forEach(child => {
          const cn = this.parse(child);
          if (cn) vNode.children.push(cn);
        });
      }

      return vNode;
    }
  }

  /**
   * Module: Component Manager
   */
  class ComponentManager {
    constructor() {
      this.components = {};
      this.cache = {};
      this.loadingComponents = new Map(); // Changed from Set to Map to store promises
      this.debugMode = true; // Aggiunto per debugging
    }

    component(name, html) {
      this.components[name] = html;
    }

    async loadExternalComponent(url) {
      if (this.debugMode) {
        console.log(`🔄 ComponentManager: Loading component ${url}`);
      }

      // Return cached component if available
      if (this.cache[url]) {
        if (this.debugMode) {
          console.log(`✅ ComponentManager: Found cached component ${url}`);
        }
        return this.cache[url];
      }

      // If already loading, return the existing promise
      if (this.loadingComponents.has(url)) {
        if (this.debugMode) {
          console.log(`⏳ ComponentManager: Component ${url} already loading, waiting...`);
        }
        return this.loadingComponents.get(url);
      }

      // Create and store the loading promise
      const loadingPromise = this._fetchComponent(url);
      this.loadingComponents.set(url, loadingPromise);

      try {
        const html = await loadingPromise;
        this.cache[url] = html;
        if (this.debugMode) {
          console.log(`✅ ComponentManager: Successfully loaded component ${url} (${html.length} chars)`);
        }
        return html;
      } catch (error) {
        console.error(`❌ ComponentManager: Error loading component ${url}:`, error);
        // Don't cache errors to allow retry
        return null;
      } finally {
        this.loadingComponents.delete(url);
      }
    }

    async _fetchComponent(url) {
      if (this.debugMode) {
        console.log(`🌐 ComponentManager: Fetching ${url}`);
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const html = await response.text();

      if (this.debugMode) {
        console.log(`📄 ComponentManager: Received ${html.length} characters from ${url}`);
      }

      return html;
    }

    getComponent(name) {
      return this.components[name];
    }

    getCachedComponent(url) {
      return this.cache[url];
    }

    isLoading(url) {
      return this.loadingComponents.has(url);
    }

    setDebugMode(enabled) {
      this.debugMode = enabled;
    }
  }

  /**
   * Module: Reactivity System
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

          if (this.watchersReady && this.watchers[prop]) {
            this.watchers[prop].forEach(fn => {
              try {
                fn(val);
              } catch (error) {
                console.error('Watcher execution error:', error, 'for property:', prop);
              }
            });
          }

          // Debounce renders to prevent loops
          if (this._renderTimeout) {
            clearTimeout(this._renderTimeout);
          }

          this._renderTimeout = setTimeout(() => {
            this._isUpdating = false;
            this._renderTimeout = null;
            this.renderCallback();
          }, 10);

          return true;
        }
      });
      return this.state;
    }

    addWatcher(prop, fn) {
      this.watchers[prop] = this.watchers[prop] || [];
      this.watchers[prop].push(fn);
    }

    enableWatchers() {
      this.watchersReady = true;
    }
  }

  /**
   * Module: Router
   */
  class Router {
    constructor(state, renderCallback) {
      this.state = state;
      this.renderCallback = renderCallback;
    }

    setupRouting() {
      let p = location.pathname.replace(/^\//, '') || '';
      if (!p || p === 'index.html') {
        history.replaceState({}, '', '/');
        p = '';
      }

      if (!this.state._currentPage) {
        this.state._currentPage = p;
      }

      window.addEventListener('popstate', () => {
        this.state._currentPage = location.pathname.replace(/^\//, '') || '';
        this.renderCallback();
      });
    }

    setupCurrentPageProperty() {
      const self = this;
      let cp = this.state._currentPage;
      Object.defineProperty(this.state, '_currentPage', {
        get() { return cp; },
        set(v) {
          if (cp !== v) {
            cp = v;
            history.pushState({}, '', '/' + v);
            self.renderCallback();
          }
        }
      });
    }
  }

  /**
   * Module: Fetch Manager
   */
  class FetchManager {
    constructor(evaluator) {
      this.evaluator = evaluator;
      this.pendingFetches = {};
      this.lastFetchUrl = {};
      this.fetched = {};
    }

    setupFetch(expr, rk, ctx, event, force) {
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
      const fid = `${url}::${rk}`;
      if (!force && this.lastFetchUrl[rk] === url) return;
      if (this.pendingFetches[fid]) return;

      this.pendingFetches[fid] = true;
      this.lastFetchUrl[rk] = url;

      if (!(rk in this.evaluator.state)) {
        this.evaluator.state[rk] = null;
      }

      fetch(url)
        .then(res => {
          if (!res.ok) {
            if (!this.fetched[url]) this.fetched[url] = {};
            this.fetched[url].error = `${res.status} ${res.statusText || 'errore di rete'}`;
            throw new Error(`${res.status} ${res.statusText}`);
          }
          return res.json();
        })
        .then(data => {
          const oldVal = this.evaluator.state[rk];
          const isEqual = JSON.stringify(oldVal) === JSON.stringify(data);
          if (!isEqual) {
            this.evaluator.state[rk] = data;
          }
          if (this.fetched[url]) delete this.fetched[url].error;
        })
        .catch(err => {
          console.error('🌐 Fetch error:', { url, error: err.message, resultVariable: rk });
          if (!this.fetched[url]) this.fetched[url] = {};
          if (!this.fetched[url].error) this.fetched[url].error = err.message;
          console.error('@fetch error:', err);
        })
        .finally(() => {
          delete this.pendingFetches[fid];
        });
    }
  }

  /**
   * Module: Directive Help System
   */
  class DirectiveHelpSystem {
    constructor() {
      this.helpTexts = {
        '@if': `Esempio: <div @if="condizione">Mostra se condizione è true</div>`,
        '@show': `Esempio: <div @show="condizione">Mostra se condizione è true</div>`,
        '@hide': `Esempio: <div @hide="condizione">Nasconde se condizione è true</div>`,
        '@for': `Esempio: <li @for="item in items">{{item}}</li> o <li @for="i, item in items">{{i}}: {{item}}</li>`,
        '@model': `Esempio: <input @model="nome">`,
        '@click': `Esempio: <button @click="state.count++">Aumenta</button>`,
        '@fetch': `Esempio: <div @fetch="'url'" @result="data">Carica</div>`,
        '@result': `Esempio: <div @fetch="'url'" @result="data">Carica</div>`,
        '@watch': `Esempio: <div @watch="prop=>console.log(prop)"></div>`,
        '@text': `Esempio: <span @text="nome"></span>`,
        '@class': `Esempio: <div @class="{rosso: condizione}"></div>`,
        '@style': `Esempio: <div @style="{color:'red'}"></div>`,
        '@validate': `Esempio: <input @validate="required,minLength:3">`,
        '@link': `Esempio: <a @link="pagina">Vai</a>`,
        '@page': `Esempio: <div @page="home">Solo su home</div>`,
        '@component': `Esempio: <component @src="comp.html"></component>`,
        '@set': `Esempio: <button @set:click="foo=1"></button>`,
        '@key': `Esempio: <li @for="item in items" @key="item.id"></li>`,
        '@src': `Esempio: <component @src="comp.html"></component>`,
        '@switch': `Esempio: <div @switch="valore"><div @case="1">Uno</div><div @default>Altro</div></div>`,
        '@case': `Esempio: <div @case="1">Uno</div>`,
        '@default': `Esempio: <div @default>Altro</div>`,
        '@source': `Esempio: <div @source="items" @map="item => item*2" @result="doppio"></div>`,
        '@map': `Esempio: <div @source="items" @map="item => item*2"></div>`,
        '@filter': `Esempio: <div @source="items" @filter="item > 0"></div>`,
        '@reduce': `Esempio: <div @source="items" @reduce="(acc, item) => acc+item" @initial="0"></div>`,
        '@initial': `Esempio: <div @source="items" @reduce="(acc, item) => acc+item" @initial="0"></div>`,
        '@animate': `Esempio: <div @animate="fade-in"></div>`,
        '@state': `Esempio: <div @state></div> (renderizza lo stato corrente come JSON)`,
        '@log': `Esempio: <div @log></div> (mostra il log delle direttive sull'elemento)`,
        '@hover': `Esempio: <div @hover="doSomething()"></div>`,
        'no': `Esempio: <no>{{nome}}</no> (mostra contenuto senza interpolazione)`,
        '@text:hover': `Esempio: <div @text:hover="'Testo hover'"></div>`,
        '@text:click': `Esempio: <div @text:click="'Testo click'"></div>`,
        '@text:input': `Esempio: <input @text:input="nome">`,
        '@text:focus': `Esempio: <input @text:focus="nome">`,
        '@class:focus': `Esempio: <input @class:focus="{rosso:true}">`,
        '@class:hover': `Esempio: <div @class:hover="{rosso: condizione}"></div>`,
        '@class:click': `Esempio: <div @class:click="{rosso: condizione}"></div>`,
        '@class:input': `Esempio: <input @class:input="{rosso: condizione}">`,
        '@class:change': `Esempio: <input @class:change="{rosso: condizione}">`,
        '@fetch:click': `Esempio: <button @fetch:click="'url'" @result="data"></button>`,
        '@fetch:hover': `Esempio: <button @fetch:hover="'url'" @result="data"></button>`,
        '@fetch:input': `Esempio: <input @fetch:input="'url'" @result="data">`,
        '@fetch:change': `Esempio: <input @fetch:change="'url'" @result="data">`,
        '@model:input': `Esempio: <input @model:input="nome">`,
        '@model:change': `Esempio: <input @model:change="nome">`,
        '@model:focus': `Esempio: <input @model:focus="nome">`,
        '@model:blur': `Esempio: <input @model:blur="nome">`,
        '@set:change': `Esempio: <input @set:change="foo='bar'">`,
        '@set:click': `Esempio: <button @set:click="foo=1"></button>`,
        '@set:input': `Esempio: <input @set:input="foo='bar'">`,
        '@set:focus': `Esempio: <input @set:focus="foo='bar'">`,
        '@set:blur': `Esempio: <input @set:blur="foo='bar'">`,
        '@focus': `Esempio: <input @focus="doSomething()">`,
        '@blur': `Esempio: <input @blur="doSomething()">`,
        '@change': `Esempio: <input @change="doSomething()">`,
        '@input': `Esempio: <input @input="doSomething()">`,
        '@then': `Esegui una o più espressioni dopo tutte le altre direttive su questo nodo. Esempio: <div @then=\"foo=1;;bar=2\"></div>`,
        '@finally': `Esegui una o più espressioni dopo tutto, inclusi @then. Esempio: <div @finally=\"foo=1;;bar=2\"></div>`
      };
    }

    getHelp(name) {
      return this.helpTexts[name] || '';
    }

    isValidDirective(name) {
      return this.helpTexts.hasOwnProperty(name);
    }
  }

  /**
   * Module: Directive-Specific Loggers
   */
  class DirectiveLogger {
    constructor(evaluator) {
      this.evaluator = evaluator;
      this.startTime = performance.now();
    }

    getBaseInfo(vNode, ctx) {
      return {
        tag: vNode.tag,
        timestamp: new Date(),
        executionTime: (performance.now() - this.startTime).toFixed(2) + 'ms'
      };
    }

    log(vNode, ctx, state) {
      return this.getBaseInfo(vNode, ctx);
    }
  }

  class ForLogger extends DirectiveLogger {
    log(vNode, ctx, state) {
      const base = super.log(vNode, ctx, state);
      const forExpr = vNode.directives['@for'];

      let arrayInfo = {};
      try {
        const match1 = forExpr.match(/(\w+),\s*(\w+) in (.+)/);
        const match2 = forExpr.match(/(\w+) in (.+)/);

        if (match1 || match2) {
          const arrayExpr = match1 ? match1[3] : match2[2];
          const itemVar = match1 ? match1[2] : match2[1];
          const indexVar = match1 ? match1[1] : null;

          const arrayData = this.evaluator.evalExpr(arrayExpr, ctx);
          const isArray = Array.isArray(arrayData);
          const length = isArray ? arrayData.length : (arrayData ? Object.keys(arrayData).length : 0);

          arrayInfo = {
            expression: forExpr,
            arrayVariable: arrayExpr,
            itemVariable: itemVar,
            indexVariable: indexVar,
            arrayType: isArray ? 'Array' : 'Object',
            length: length,
            isEmpty: length === 0,
            firstItem: length > 0 ? arrayData[0] : null,
            status: length === 0 ? '❌ Empty' : `✅ ${length} items`,
            performance: `${length} items rendered`
          };
        }
      } catch (error) {
        arrayInfo = {
          expression: forExpr,
          error: `❌ ${error.message}`,
          status: '❌ Error evaluating'
        };
      }

      return { ...base, type: '@for', data: arrayInfo };
    }
  }

  class FetchLogger extends DirectiveLogger {
    constructor(evaluator, fetchManager) {
      super(evaluator);
      this.fetchManager = fetchManager;
    }

    log(vNode, ctx, state) {
      const base = super.log(vNode, ctx, state);
      const fetchExpr = vNode.directives['@fetch'];
      const resultVar = vNode.directives['@result'] || 'result';

      let fetchInfo = {};
      try {
        let url = this.evaluator.evalExpr(fetchExpr, ctx);
        if (!url) url = fetchExpr;

        const resultValue = state[resultVar];
        const hasError = this.fetchManager.fetched[url]?.error;
        const isPending = this.fetchManager.pendingFetches[`${url}::${resultVar}`];

        fetchInfo = {
          url: url,
          method: 'GET',
          resultVariable: resultVar,
          status: hasError ? `❌ ${hasError}` : isPending ? '⏳ Loading...' : resultValue ? '✅ Success' : '⭕ No data',
          responseSize: resultValue ? `${JSON.stringify(resultValue).length} chars` : 'N/A',
          hasData: !!resultValue,
          hasError: !!hasError,
          isPending: !!isPending,
          lastFetch: this.fetchManager.lastFetchUrl[resultVar] ? 'Recently' : 'Never'
        };
      } catch (error) {
        fetchInfo = {
          url: fetchExpr,
          error: `❌ ${error.message}`,
          status: '❌ Error evaluating URL'
        };
      }

      return { ...base, type: '@fetch', data: fetchInfo };
    }
  }

  class ModelLogger extends DirectiveLogger {
    log(vNode, ctx, state) {
      const base = super.log(vNode, ctx, state);
      const modelExpr = vNode.directives['@model'];
      const validateRules = vNode.directives['@validate'];

      let modelInfo = {};
      try {
        const currentValue = this.evaluator.evalExpr(modelExpr, ctx);
        const validation = state._validate?.[modelExpr];

        modelInfo = {
          variable: modelExpr,
          currentValue: currentValue,
          valueType: typeof currentValue,
          isEmpty: !currentValue || currentValue === '',
          validation: validateRules ? {
            rules: validateRules,
            isValid: validation,
            status: validation ? '✅ Valid' : '❌ Invalid'
          } : null,
          binding: '✅ Active'
        };
      } catch (error) {
        modelInfo = {
          variable: modelExpr,
          error: `❌ ${error.message}`,
          status: '❌ Error evaluating'
        };
      }

      return { ...base, type: '@model', data: modelInfo };
    }
  }

  class ConditionalLogger extends DirectiveLogger {
    log(vNode, ctx, state) {
      const base = super.log(vNode, ctx, state);
      const directive = vNode.directives['@if'] || vNode.directives['@show'] || vNode.directives['@hide'];
      const directiveType = vNode.directives['@if'] ? '@if' : vNode.directives['@show'] ? '@show' : '@hide';

      let conditionalInfo = {};
      try {
        const result = this.evaluator.evalExpr(directive, ctx);
        const isVisible = directiveType === '@hide' ? !result : !!result;

        conditionalInfo = {
          condition: directive,
          result: result,
          isVisible: isVisible,
          status: isVisible ? '✅ Visible' : '❌ Hidden',
          evaluation: `${directive} → ${result}`
        };
      } catch (error) {
        conditionalInfo = {
          condition: directive,
          error: `❌ ${error.message}`,
          status: '❌ Error evaluating'
        };
      }

      return { ...base, type: directiveType, data: conditionalInfo };
    }
  }

  class ClickLogger extends DirectiveLogger {
    constructor(evaluator) {
      super(evaluator);
      this.clickCount = 0;
      this.lastClick = null;
    }

    log(vNode, ctx, state) {
      const base = super.log(vNode, ctx, state);
      const clickExpr = vNode.directives['@click'];
      return {
        ...base,
        type: '@click',
        data: {
          action: clickExpr,
          clickCount: this.clickCount,
          lastClick: this.lastClick ? `${Date.now() - this.lastClick}ms ago` : 'Never',
          status: '✅ Ready'
        }
      };
    }

    recordClick() {
      this.clickCount++;
      this.lastClick = Date.now();
    }
  }

  class InputLogger extends DirectiveLogger {
    constructor(evaluator) {
      super(evaluator);
      this.inputCount = 0;
      this.lastInput = null;
    }

    log(vNode, ctx, state) {
      const base = super.log(vNode, ctx, state);
      const inputExpr = vNode.directives['@input'];
      return {
        ...base,
        type: '@input',
        data: {
          action: inputExpr,
          inputCount: this.inputCount,
          lastInput: this.lastInput ? `${Date.now() - this.lastInput}ms ago` : 'Never',
          status: '✅ Ready'
        }
      };
    }

    recordInput() {
      this.inputCount++;
      this.lastInput = Date.now();
    }
  }

  class FocusLogger extends DirectiveLogger {
    constructor(evaluator) {
      super(evaluator);
      this.focusCount = 0;
      this.lastFocus = null;
    }

    log(vNode, ctx, state) {
      const base = super.log(vNode, ctx, state);
      const focusExpr = vNode.directives['@focus'];
      return {
        ...base,
        type: '@focus',
        data: {
          action: focusExpr,
          focusCount: this.focusCount,
          lastFocus: this.lastFocus ? `${Date.now() - this.lastFocus}ms ago` : 'Never',
          status: '✅ Ready'
        }
      };
    }

    recordFocus() {
      this.focusCount++;
      this.lastFocus = Date.now();
    }
  }

  class BlurLogger extends DirectiveLogger {
    constructor(evaluator) {
      super(evaluator);
      this.blurCount = 0;
      this.lastBlur = null;
    }

    log(vNode, ctx, state) {
      const base = super.log(vNode, ctx, state);
      const blurExpr = vNode.directives['@blur'];
      return {
        ...base,
        type: '@blur',
        data: {
          action: blurExpr,
          blurCount: this.blurCount,
          lastBlur: this.lastBlur ? `${Date.now() - this.lastBlur}ms ago` : 'Never',
          status: '✅ Ready'
        }
      };
    }

    recordBlur() {
      this.blurCount++;
      this.lastBlur = Date.now();
    }
  }

  class ChangeLogger extends DirectiveLogger {
    constructor(evaluator) {
      super(evaluator);
      this.changeCount = 0;
      this.lastChange = null;
    }

    log(vNode, ctx, state) {
      const base = super.log(vNode, ctx, state);
      const changeExpr = vNode.directives['@change'];
      return {
        ...base,
        type: '@change',
        data: {
          action: changeExpr,
          changeCount: this.changeCount,
          lastChange: this.lastChange ? `${Date.now() - this.lastChange}ms ago` : 'Never',
          status: '✅ Ready'
        }
      };
    }

    recordChange() {
      this.changeCount++;
      this.lastChange = Date.now();
    }
  }

  class ComponentLogger extends DirectiveLogger {
    constructor(evaluator, componentManager) {
      super(evaluator);
      this.componentManager = componentManager;
    }

    log(vNode, ctx, state) {
      const base = super.log(vNode, ctx, state);
      const srcExpr = vNode.directives['@src'];

      let componentInfo = {};
      try {
        let srcUrl = this.evaluator.evalExpr(srcExpr, ctx);
        if (!srcUrl) {
          const rawSrc = srcExpr.trim();
          srcUrl = /^['"].*['"]$/.test(rawSrc) ? rawSrc.slice(1, -1) : rawSrc;
        }

        const isCached = this.componentManager.getCachedComponent(srcUrl);
        const isLoading = this.componentManager.isLoading(srcUrl);

        componentInfo = {
          source: srcUrl,
          status: isLoading ? '⏳ Loading...' : isCached ? '✅ Loaded' : '⭕ Not loaded',
          cached: !!isCached,
          isLoading: isLoading,
          size: isCached ? `${isCached.length} chars` : 'N/A'
        };
      } catch (error) {
        componentInfo = {
          source: srcExpr,
          error: `❌ ${error.message}`,
          status: '❌ Error evaluating'
        };
      }

      return { ...base, type: '@component', data: componentInfo };
    }
  }

  /**
   * Module: Central Logger
   */
  class CentralLogger {
    constructor() {
      this.logs = [];
      this.loggers = {};
      this.clickLoggers = new WeakMap();
      this.startTime = performance.now();
      this.maxLogs = 100;
    }

    initializeLoggers(evaluator, fetchManager, componentManager) {
      this.loggers = {
        '@for': new ForLogger(evaluator),
        '@fetch': new FetchLogger(evaluator, fetchManager),
        '@model': new ModelLogger(evaluator),
        '@if': new ConditionalLogger(evaluator),
        '@show': new ConditionalLogger(evaluator),
        '@hide': new ConditionalLogger(evaluator),
        '@click': new ClickLogger(evaluator),
        '@component': new ComponentLogger(evaluator, componentManager),
        '@input': new InputLogger(evaluator),
        '@focus': new FocusLogger(evaluator),
        '@blur': new BlurLogger(evaluator),
        '@change': new ChangeLogger(evaluator)
      };
    }

    addLog(elementInfo, vNode, ctx, state, element = null) {
      if (!this.loggers || Object.keys(this.loggers).length === 0) {
        console.error('❌ CentralLogger: Loggers not initialized!');
        return;
      }
      const startTime = performance.now();
      const combinedLog = {
        id: Date.now() + Math.random(),
        timestamp: new Date(),
        tag: vNode.tag,
        type: 'multi-directive',
        elementInfo,
        executionTime: (performance.now() - startTime).toFixed(2) + 'ms',
        directives: []
      };
      Object.keys(vNode.directives).forEach(directive => {
        if (this.loggers[directive]) {
          try {
            const logData = this.loggers[directive].log(vNode, ctx, state);
            combinedLog.directives.push({
              type: directive,
              data: logData.data,
              status: this._getDirectiveStatus(logData.data)
            });
          } catch (error) {
            combinedLog.directives.push({
              type: directive,
              data: { error: error.message, status: '❌ Error logging' },
              status: 'error'
            });
          }
        } else {
          combinedLog.directives.push({
            type: directive,
            data: { expression: vNode.directives[directive], status: '📋 Untracked directive' },
            status: 'unknown'
          });
        }
      });
      Object.entries(vNode.subDirectives || {}).forEach(([directive, events]) => {
        Object.keys(events).forEach(event => {
          if (this.loggers[directive]) {
            try {
              const logData = this.loggers[directive].log(vNode, ctx, state);
              combinedLog.directives.push({
                type: `${directive}:${event}`,
                data: logData.data,
                status: this._getDirectiveStatus(logData.data),
                isSubDirective: true
              });
            } catch (error) {
              combinedLog.directives.push({
                type: `${directive}:${event}`,
                data: { error: error.message, status: '❌ Error logging' },
                status: 'error',
                isSubDirective: true
              });
            }
          } else {
            combinedLog.directives.push({
              type: `${directive}:${event}`,
              data: { expression: events[event], status: '📋 Untracked sub-directive' },
              status: 'unknown',
              isSubDirective: true
            });
          }
        });
      });
      if (combinedLog.directives.length === 0) {
        combinedLog.type = 'generic';
        combinedLog.directives.push({
          type: 'generic',
          data: { message: 'Element with @log but no tracked directives', status: '📋 Generic log' },
          status: 'generic'
        });
      }
      combinedLog.overallStatus = this._calculateOverallStatus(combinedLog.directives);
      this.logs.unshift(combinedLog);
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(0, this.maxLogs);
      }
    }

    _getDirectiveStatus(data) {
      if (data.error) return 'error';
      if (data.isPending || data.isLoading) return 'loading';
      if (data.status && data.status.includes('✅')) return 'success';
      if (data.status && data.status.includes('❌')) return 'error';
      if (data.status && data.status.includes('⏳')) return 'loading';
      return 'normal';
    }

    _calculateOverallStatus(directives) {
      if (!directives || directives.length === 0) return '📊 No directives';
      const statuses = directives.map(d => d.status);
      if (statuses.includes('error')) return '❌ Has Errors';
      if (statuses.includes('loading')) return '⏳ Loading';
      if (statuses.every(s => s === 'success')) return '✅ All Good';
      return '📊 Mixed Status';
    }

    recordClick(element) {
      const clickLogger = this.clickLoggers.get(element);
      if (clickLogger) {
        clickLogger.recordClick();
      }
    }

    _getDirectiveColor(type) {
      const colors = {
        '@for': '#ff9800',
        '@fetch': '#4caf50',
        '@model': '#2196f3',
        '@if': '#9c27b0',
        '@show': '#9c27b0',
        '@hide': '#9c27b0',
        '@click': '#f44336',
        '@component': '#00bcd4',
        '@input': '#e91e63',
        '@focus': '#3f51b5',
        '@blur': '#607d8b',
        '@change': '#795548',
        'generic': '#666666'
      };
      return colors[type] || '#666666';
    }

    _generateIntelligentLogHTML(log) {
      const time = log.timestamp.toLocaleTimeString();

      if (log.type === 'multi-directive') {
        let html = `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #66ccff; font-weight: bold;">🎯 &lt;${log.tag}&gt; (${log.directives.length} directives)</span>
            <span style="color: #999; font-size: 10px;">${time}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #ffcc66; font-size: 10px;">⏱️ ${log.executionTime}</span>
            <span style="color: ${this._getStatusColor(log.overallStatus)}; font-size: 10px; font-weight: bold;">${log.overallStatus}</span>
          </div>
        `;

        log.directives.forEach((directive, index) => {
          const color = this._getDirectiveColor(directive.type);
          const statusColor = this._getStatusColor(directive.status);

          html += `
            <div style="border-left: 3px solid ${color}; margin: 6px 0; padding: 6px 8px; background: rgba(255,255,255,0.03); border-radius: 3px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="color: ${color}; font-weight: bold; font-size: 11px;">
                  ${directive.isSubDirective ? '📎' : '📋'} ${directive.type}
                </span>
                <span style="color: ${statusColor}; font-size: 9px;">${this._getStatusIcon(directive.status)}</span>
              </div>
              ${this._generateCompactDirectiveHTML(directive.type, directive.data)}
            </div>
          `;
        });

        return html;
      }

      return `<div style="color: #cccccc;">Generic log entry</div>`;
    }

    _getStatusColor(status) {
      if (!status) return '#cccccc';
      if (typeof status === 'string') {
        if (status.includes('error') || status.includes('❌')) return '#ff6b6b';
        if (status.includes('loading') || status.includes('⏳')) return '#ffa726';
        if (status.includes('success') || status.includes('✅')) return '#66bb6a';
      }
      return '#cccccc';
    }

    _getStatusIcon(status) {
      if (!status) return '📊';
      if (status === 'error') return '❌';
      if (status === 'loading') return '⏳';
      if (status === 'success') return '✅';
      if (status === 'unknown') return '❓';
      return '📊';
    }

    _generateCompactDirectiveHTML(type, data) {
      if (!data) return '<div style="color: #999;">No data available</div>';
      let html = '';
      try {
        switch (type.split(':')[0]) {
          case '@for':
            html = `
              <div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
                Array: <strong>${data.arrayVariable || 'unknown'}</strong> (${data.length || 0} items)<br>
                Status: ${data.status || 'unknown'}
              </div>
            `;
            break;
          case '@fetch':
            const url = data.url || '';
            html = `
              <div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
                URL: <strong>${url.slice(0, 40)}${url.length > 40 ? '...' : ''}</strong><br>
                Status: ${data.status || 'unknown'} | Size: ${data.responseSize || 'N/A'}
              </div>
            `;
            break;
          case '@model':
            const value = data.currentValue;
            const displayValue = typeof value === 'string' ? `"${value.slice(0, 20)}${value.length > 20 ? '...' : ''}"` : JSON.stringify(value);
            html = `
              <div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
                Variable: <strong>${data.variable || 'unknown'}</strong><br>
                Value: ${displayValue} | ${data.validation?.status || 'No validation'}
              </div>
            `;
            break;
          case '@if':
          case '@show':
          case '@hide':
            const condition = data.condition || '';
            html = `
              <div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
                Condition: <strong>${condition.slice(0, 30)}${condition.length > 30 ? '...' : ''}</strong><br>
                Result: ${data.result} → ${data.isVisible ? 'Visible' : 'Hidden'}
              </div>
            `;
            break;
          case '@click':
            const action = data.action || '';
            html = `
              <div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
                Action: <strong>${action.slice(0, 30)}${action.length > 30 ? '...' : ''}</strong><br>
                Clicks: ${data.clickCount || 0} | Last: ${data.lastClick || 'Never'}
              </div>
            `;
            break;
          case '@component':
            const source = data.source || '';
            html = `
              <div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
                Source: <strong>${source.slice(0, 30)}${source.length > 30 ? '...' : ''}</strong><br>
                Status: ${data.status || 'unknown'} | Cached: ${data.cached ? 'Yes' : 'No'}
              </div>
            `;
            break;
          case '@input':
            const inputAction = data.action || '';
            html = `
              <div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
                Action: <strong>${inputAction.slice(0, 30)}${inputAction.length > 30 ? '...' : ''}</strong><br>
                Inputs: ${data.inputCount || 0} | Last: ${data.lastInput || 'Never'}
              </div>
            `;
            break;
          case '@focus':
            const focusAction = data.action || '';
            html = `
              <div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
                Action: <strong>${focusAction.slice(0, 30)}${focusAction.length > 30 ? '...' : ''}</strong><br>
                Focus events: ${data.focusCount || 0} | Last: ${data.lastFocus || 'Never'}
              </div>
            `;
            break;
          case '@blur':
            const blurAction = data.action || '';
            html = `
              <div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
                Action: <strong>${blurAction.slice(0, 30)}${blurAction.length > 30 ? '...' : ''}</strong><br>
                Blur events: ${data.blurCount || 0} | Last: ${data.lastBlur || 'Never'}
              </div>
            `;
            break;
          case '@change':
            const changeAction = data.action || '';
            html = `
              <div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
                Action: <strong>${changeAction.slice(0, 30)}${changeAction.length > 30 ? '...' : ''}</strong><br>
                Change events: ${data.changeCount || 0} | Last: ${data.lastChange || 'Never'}
              </div>
            `;
            break;
          default:
            const expression = data.expression || '';
            html = `
              <div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
                Expression: <strong>${expression.slice(0, 40)}${expression.length > 40 ? '...' : ''}</strong><br>
                Status: ${data.status || 'unknown'}
              </div>
            `;
        }
        if (data.error) {
          html += `<div style="color: #ff6b6b; font-size: 9px; margin-top: 2px;">💥 ${data.error}</div>`;
        }
      } catch (error) {
        html = `<div style=\"color: #ff6b6b; font-size: 9px;\">Error rendering directive data: ${error.message}</div>`;
      }
      return html;
    }
  }

  /**
   * Module: Error Handler
   */
  class ErrorHandler {
    showAyishaError(el, err, expr) {
      if (!el) return;
      let banner = el.parentNode && el.parentNode.querySelector('.ayisha-error-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.className = 'ayisha-error-banner';
        banner.style.background = '#c00';
        banner.style.color = '#fff';
        banner.style.padding = '0.5em 1em';
        banner.style.margin = '0.5em 0';
        banner.style.borderRadius = '4px';
        banner.style.fontWeight = 'bold';
        banner.style.border = '1px solid #900';
        banner.style.position = 'relative';
        banner.style.zIndex = '1000';
        banner.innerHTML = `<b>Errore JS:</b> ${err.message}<br><code>${expr}</code>`;
        el.parentNode && el.parentNode.insertBefore(banner, el.nextSibling);
      } else {
        banner.innerHTML = `<b>Errore JS:</b> ${err.message}<br><code>${expr}</code>`;
      }
    }

    createErrorElement(message) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'ayisha-directive-error';
      errorDiv.style.background = '#c00';
      errorDiv.style.color = '#fff';
      errorDiv.style.padding = '1em';
      errorDiv.style.margin = '0.5em 0';
      errorDiv.style.borderRadius = '4px';
      errorDiv.style.fontWeight = 'bold';
      errorDiv.style.border = '1px solid #900';
      errorDiv.innerHTML = message;
      return errorDiv;
    }

    createWarningElement(message) {
      const warnDiv = document.createElement('div');
      warnDiv.className = 'ayisha-directive-warning';
      warnDiv.style.background = '#ffeb3b';
      warnDiv.style.color = '#333';
      warnDiv.style.padding = '1em';
      warnDiv.style.margin = '0.5em 0';
      warnDiv.style.borderRadius = '4px';
      warnDiv.style.fontWeight = 'bold';
      warnDiv.style.border = '1px solid #e0c200';
      warnDiv.innerHTML = message;
      return warnDiv;
    }
  }

  /**
   * Module: Binding Manager
   */
  class BindingManager {
    constructor(evaluator, renderCallback) {
      this.evaluator = evaluator;
      this.renderCallback = renderCallback;
      this.modelBindings = [];
    }

    bindModel(el, key, ctx) {
      // Determine input type for proper initialization
      let inputTypeForInit = null;
      if (el.type === 'number') {
        inputTypeForInit = 'number';
      } else if (el.type === 'checkbox') {
        inputTypeForInit = 'checkbox';
      }

      // Helper: get root object for binding (context-aware)
      function getRootAndPath(key, ctx, globalState) {
        if (key.includes('.')) {
          const path = key.split('.');
          const rootName = path[0];
          if (ctx && typeof ctx[rootName] === 'object' && ctx[rootName] !== null) {
            return { root: ctx[rootName], path: path.slice(1) };
          }
          return { root: globalState, path: path };
        } else {
          if (ctx && typeof ctx[key] === 'object' && ctx[key] !== null) {
            return { root: ctx[key], path: [] };
          }
          return { root: globalState, path: [key] };
        }
      }

      // Ensure all intermediate objects exist for nested keys (context-aware)
      const { root, path } = getRootAndPath(key, ctx, this.evaluator.state);
      let ref = root;
      if (path.length > 0) {
        for (let i = 0; i < path.length - 1; i++) {
          if (typeof ref[path[i]] !== 'object' || ref[path[i]] === null) {
            ref[path[i]] = {};
          }
          ref = ref[path[i]];
        }
        const last = path[path.length - 1];
        if (el.type === 'number') {
          if (typeof ref[last] !== 'number') ref[last] = 0;
        } else if (el.type === 'checkbox') {
          if (typeof ref[last] !== 'boolean') ref[last] = false;
        } else {
          if (typeof ref[last] !== 'string') ref[last] = '';
        }
      } else if (typeof ref === 'object' && ref !== null) {
        // No path, just root object
        // (rare, e.g. @model="post" where post is an object)
      } else {
        if (el.type === 'number') {
          if (typeof this.evaluator.state[key] !== 'number') this.evaluator.state[key] = 0;
        } else if (el.type === 'checkbox') {
          if (typeof this.evaluator.state[key] !== 'boolean') this.evaluator.state[key] = false;
        } else {
          if (typeof this.evaluator.state[key] !== 'string') this.evaluator.state[key] = '';
        }
      }

      const update = () => {
        const val = this.evaluator.evalExpr(key, ctx);
        if (el.type === 'checkbox') {
          el.checked = !!val;
        } else if (el.type === 'radio') {
          el.checked = val == el.value;
        } else if (el.type === 'color') {
          if (val && typeof val === 'string' && val.match(/^#[0-9A-Fa-f]{6}$/)) {
            el.value = val;
          } else if (val && typeof val === 'string' && val.match(/^[0-9A-Fa-f]{6}$/)) {
            el.value = '#' + val;
          } else {
            el.value = '#000000';
          }
        } else {
          // Fix: always set el.value as string, fallback to '' if undefined/null
          const safeVal = val == null ? '' : String(val);
          if (el.value !== safeVal) el.value = safeVal;
        }
      };

      this.modelBindings.push({ el, update });
      update();

      const handleInput = () => {
        // Determine input type for proper initialization  
        let inputTypeForInit = null;
        if (el.type === 'number') {
          inputTypeForInit = 'number';
        } else if (el.type === 'checkbox') {
          inputTypeForInit = 'checkbox';
        }

        // Use context-aware root and path for writing
        const { root, path } = getRootAndPath(key, ctx, this.evaluator.state);
        let ref = root;
        let value;

        // Handle different input types
        if (el.type === 'checkbox') {
          value = el.checked;
        } else if (el.type === 'number') {
          value = el.value === '' ? undefined : Number(el.value);
        } else {
          value = el.value;
        }

        if (path.length > 0) {
          for (let i = 0; i < path.length - 1; i++) {
            if (typeof ref[path[i]] !== 'object' || ref[path[i]] === null) {
              ref[path[i]] = {};
            }
            ref = ref[path[i]];
          }
          const last = path[path.length - 1];
          ref[last] = value;
        } else if (typeof ref === 'object' && ref !== null) {
          // No path, just root object
          // (rare, e.g. @model="post" where post is an object)
        } else {
          this.evaluator.state[key] = value;
        }
        this.renderCallback();
      };

      // Use appropriate event for different input types
      if (el.type === 'checkbox' || el.type === 'radio') {
        el.addEventListener('change', handleInput);
      } else {
        el.addEventListener('input', handleInput);
      }
    }

    bindValidation(el, rulesStr, modelVar = null) {
      // Supporta: required, minLength:3, maxLength:5, email, phone, password, regex:pattern
      // Parse rules correctly - handle regex patterns that contain commas
      const rules = [];
      let currentRule = '';
      let inRegex = false;

      for (let i = 0; i < rulesStr.length; i++) {
        const char = rulesStr[i];
        if (char === '^' && !inRegex) {
          inRegex = true;
          currentRule += char;
        } else if (char === '$' && inRegex) {
          inRegex = false;
          currentRule += char;
          rules.push(currentRule.trim());
          currentRule = '';
        } else if (char === ',' && !inRegex) {
          if (currentRule.trim()) {
            rules.push(currentRule.trim());
          }
          currentRule = '';
        } else {
          currentRule += char;
        }
      }

      // Add the last rule if any
      if (currentRule.trim()) {
        rules.push(currentRule.trim());
      }

      if (!modelVar) {
        return;
      }

      if (!this.evaluator.state._validate) {
        this.evaluator.state._validate = {};
      }

      this.evaluator.state._validate[modelVar] = false;

      const validate = () => {
        let valid = true;

        for (const rule of rules) {
          // Prima controlla se è una regex pura (pattern che inizia con ^ e finisce con $)
          if (/^\^.*\$$/.test(rule)) {
            try {
              const re = new RegExp(rule);
              const testResult = re.test(el.value || '');
              if (!testResult) {
                valid = false;
                break;
              } else {
              }
            } catch (e) {
              valid = false;
              break;
            }
          }
          else if (rule === 'required') {
            if (!el.value || !el.value.trim()) {
              valid = false;
              break;
            }
          }
          else if (rule.startsWith('minLength:')) {
            const minLen = parseInt(rule.split(':')[1], 10);
            if (el.value.length < minLen) {
              valid = false;
              break;
            }
          }
          else if (rule.startsWith('maxLength:')) {
            const maxLen = parseInt(rule.split(':')[1], 10);
            if (el.value.length > maxLen) {
              valid = false;
              break;
            }
          }
          else if (rule.startsWith('min:')) {
            const minVal = parseFloat(rule.split(':')[1]);
            const val = parseFloat(el.value);
            if (isNaN(val) || val < minVal) {
              valid = false;
              break;
            }
          }
          else if (rule.startsWith('max:')) {
            const maxVal = parseFloat(rule.split(':')[1]);
            const val = parseFloat(el.value);
            if (isNaN(val) || val > maxVal) {
              valid = false;
              break;
            }
          }
          else if (rule === 'email') {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(el.value || '')) {
              valid = false;
              break;
            }
          }
          else if (rule === 'phone') {
            // Supporta formati: +39 123 456 7890, +39 1234567890, +391234567890
            const phoneRegex = /^\+\d{1,3}\s?\d{3,4}\s?\d{3,4}\s?\d{3,4}$/;
            if (!phoneRegex.test(el.value || '')) {
              valid = false;
              break;
            }
          }
          else if (rule === 'password') {
            // Password sicura: almeno 8 caratteri, almeno una maiuscola, una minuscola, un numero e un simbolo
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            if (!passwordRegex.test(el.value || '')) {
              valid = false;
              break;
            }
          }
          else if (rule.startsWith('regex:')) {
            // regex:pattern oppure solo pattern se non c'è regex:
            let pattern = rule.slice(6);
            try {
              const re = new RegExp(pattern);
              if (!re.test(el.value || '')) {
                valid = false;
                break;
              }
            } catch (e) {
              valid = false;
              break;
            }
          }
        }

        this.evaluator.state._validate[modelVar] = valid;
        el.classList.toggle('invalid', !valid);
        el.classList.toggle('valid', valid && el.value.length > 0);

        return valid;
      };

      validate();
      el.addEventListener('input', () => {
        validate();
        this.renderCallback();
      });
      el.addEventListener('blur', validate);
    }

    updateBindings() {
      this.modelBindings.forEach(b => b.update());
    }

    clearBindings() {
      this.modelBindings = [];
    }
  }

  // ===== MAIN AYISHA CLASS =====

  class AyishaVDOM {
    static version = "1.0.0";
    constructor(root = document.body) {
      this.root = root;
      this.state = {};
      this._initBlocks = [];
      this._vdom = null;
      this._isRendering = false;
      this._processedSetDirectives = new Set(); // Track processed @set directives
      this._componentRenderTimeout = null; // Timeout per debounce del rendering dei componenti

      // Initialize modules in correct order
      this.evaluator = new ExpressionEvaluator(this.state);
      this.parser = new DOMParser(this._initBlocks);
      this.componentManager = new ComponentManager();
      this.reactivitySystem = new ReactivitySystem(this.state, () => this.render());
      this.router = new Router(this.state, () => this.render());
      this.fetchManager = new FetchManager(this.evaluator);
      this.helpSystem = new DirectiveHelpSystem();
      this.errorHandler = new ErrorHandler();
      this.bindingManager = new BindingManager(this.evaluator, () => this.render());
      this.centralLogger = new CentralLogger();
      this.centralLogger.initializeLoggers(this.evaluator, this.fetchManager, this.componentManager);

      window.ayisha = this;
    }

    component(name, html) {
      this.componentManager.component(name, html);
    }

    addWatcher(prop, fn) {
      this.reactivitySystem.addWatcher(prop, fn);
    }

    directiveHelp(name) {
      return this.helpSystem.getHelp(name);
    }

    parse(node) {
      return this.parser.parse(node);
    }

    _runInitBlocks() {
      // Avoid running init blocks during rendering to prevent loops
      if (this._isRendering) {
        return;
      }

      this._initBlocks.forEach(code => {
        // Skip empty or whitespace-only code
        if (!code || !code.trim()) {
          return;
        }

        // Clean and normalize the code while preserving JavaScript syntax
        let cleanCode = code.trim()
          .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
          .replace(/\r\n/g, '\n') // Normalize line endings
          .replace(/\r/g, '\n') // Normalize line endings
          .replace(/\n\s*\n/g, '\n') // Remove empty lines
          .replace(/\n\s+/g, '\n') // Remove leading whitespace from lines
          .trim();

        // Trasforma "foo = ..." in "state.foo = ..." solo se non già prefissato
        let transformed = cleanCode;

        // Applica la trasformazione solo alle righe che non contengono parole chiave JS
        const lines = transformed.split('\n');
        const transformedLines = lines.map(line => {
          const trimmedLine = line.trim();

          // Skip empty lines, comments, and control structures
          if (!trimmedLine ||
            trimmedLine.startsWith('//') ||
            trimmedLine.startsWith('/*') ||
            trimmedLine.startsWith('function') ||
            trimmedLine.includes('function(') ||
            trimmedLine.includes('=>') ||
            /^(if|else|for|while|switch|case|default|try|catch|finally|return|var|let|const)\b/.test(trimmedLine)) {
            return line;
          }

          // Transform assignment statements: "foo = ..." to "state.foo = ..."
          // But only if not already prefixed with state, this, window, etc.
          const assignmentMatch = trimmedLine.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+)$/);
          if (assignmentMatch &&
            !trimmedLine.includes('state.') &&
            !trimmedLine.includes('this.') &&
            !trimmedLine.includes('window.') &&
            !trimmedLine.includes('console.') &&
            !trimmedLine.includes('localStorage.') &&
            !trimmedLine.includes('sessionStorage.')) {
            const [, varName, value] = assignmentMatch;
            // Don't transform JavaScript globals
            const jsGlobals = ['JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Math', 'RegExp'];
            if (!jsGlobals.includes(varName)) {
              return line.replace(assignmentMatch[0], `state.${varName} = ${value}`);
            }
          }

          return line;
        });

        transformed = transformedLines.join('\n');

        try {
          new Function('state', transformed)(this.state);
        } catch (e) {
          console.error('Init error:', e, 'Original code:', code, 'Cleaned:', cleanCode, 'Transformed:', transformed);
        }
      });

      const jsGlobals = [
        'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Math', 'RegExp',
        'console', 'window', 'document', 'setTimeout', 'setInterval', 'fetch', 'localStorage',
        'sessionStorage', 'history', 'location', 'navigator', 'undefined', 'null', 'true', 'false'
      ];

      jsGlobals.forEach(globalName => {
        if (globalName in this.state) {
          delete this.state[globalName];
        }
      });

      const stateKeys = Object.keys(this.state);
      stateKeys.forEach(key => {
        if (/[+\-*\/=<>!&|(){}[\].,\s]|=>|==|!=|<=|>=|\|\||&&/.test(key)) {
          delete this.state[key];
        }
      });

      const essentialVars = ['_validate', '_currentPage', '_version', '_locale'];
      essentialVars.forEach(varName => {
        if (!(varName in this.state)) {
          if (varName === '_validate') this.state[varName] = {};
          else if (varName === '_currentPage') this.state[varName] = '';
          else if (varName === '_version') this.state[varName] = AyishaVDOM.version;
          else if (varName === '_locale') this.state[varName] = (navigator.language || navigator.userLanguage || 'en');
        }
      });
    }

    _preInitializeEssentialVariables() {
      if (!this.state._validate) this.state._validate = {};
      if (!this.state._currentPage) this.state._currentPage = '';
      if (!this.state._version) this.state._version = AyishaVDOM.version;
      if (!this.state._locale) this.state._locale = (navigator.language || navigator.userLanguage || 'en');
    }

    _makeReactive() {
      this.state = this.reactivitySystem.makeReactive();
      this.evaluator.state = this.state;
      this.fetchManager.evaluator.state = this.state;
    }

    _setupRouting() {
      this.router.setupRouting();
    }

    _findFirstPageDirective(vNode) {
      if (!vNode) return null;
      if (vNode.directives && vNode.directives['@page']) {
        return vNode;
      }
      if (vNode.children && vNode.children.length) {
        for (const child of vNode.children) {
          const found = this._findFirstPageDirective(child);
          if (found) return found;
        }
      }
      return null;
    }

    async preloadComponents() {
      const componentPromises = [];
      const processedUrls = new Set();

      // Trova tutti i tag component
      const componentElements = this.root.querySelectorAll('component');

      componentElements.forEach(el => {
        let srcUrl = null;

        // Controlla sia 'src' che '@src'
        if (el.hasAttribute('src')) {
          srcUrl = el.getAttribute('src');
        } else if (el.hasAttribute('@src')) {
          const attrValue = el.getAttribute('@src');
          // Se è una stringa quotata, rimuovi le quote
          if (/^['\"].*['\"]$/.test(attrValue)) {
            srcUrl = attrValue.slice(1, -1);
          } else {
            // Prova a valutare come espressione
            try {
              srcUrl = this.evaluator.evalExpr(attrValue);
            } catch (e) {
              // Se fallisce, usa il valore raw se sembra un path
              if (attrValue.includes('.html') || attrValue.startsWith('./')) {
                srcUrl = attrValue;
              }
            }
          }
        }

        // Se abbiamo un URL valido e non è già stato processato
        if (srcUrl && !processedUrls.has(srcUrl) && !this.componentManager.getCachedComponent(srcUrl)) {
          processedUrls.add(srcUrl);
          componentPromises.push(this.componentManager.loadExternalComponent(srcUrl));
        }
      });

      if (componentPromises.length > 0) {
        console.log(`Preloading ${componentPromises.length} components...`);
        try {
          const results = await Promise.allSettled(componentPromises);
          const successful = results.filter(r => r.status === 'fulfilled').length;
          const failed = results.filter(r => r.status === 'rejected').length;

          console.log(`Components preloaded: ${successful} successful, ${failed} failed`);

          if (failed > 0) {
            console.warn('Failed components:', results.filter(r => r.status === 'rejected').map(r => r.reason));
          }
        } catch (error) {
          console.warn('Error during component preloading:', error);
        }
      } else {
        console.log('No components found to preload');
      }
    }

    render() {
      if (this._isRendering) return;
      this._isRendering = true;

      const scrollX = window.scrollX, scrollY = window.scrollY;
      const active = document.activeElement;
      let focusInfo = null;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        const path = [];
        let node = active;
        while (node && node !== this.root) {
          const parent = node.parentNode;
          path.unshift([...parent.childNodes].indexOf(node));
          node = parent;
        }
        focusInfo = { path, start: active.selectionStart, end: active.selectionEnd, type: active.type };
      }

      this.bindingManager.clearBindings();
      const real = this._renderVNode(this._vdom, this.state);

      if (this.root === document.body) {
        document.body.innerHTML = '';
        if (real) {
          if (real.tagName === undefined && real.childNodes) {
            Array.from(real.childNodes).forEach(child => document.body.appendChild(child));
          } else if (real instanceof DocumentFragment) {
            document.body.appendChild(real);
          } else {
            document.body.appendChild(real);
          }
        }
      } else {
        this.root.innerHTML = '';
        if (real) {
          if (real.tagName === undefined && real.childNodes) {
            Array.from(real.childNodes).forEach(child => this.root.appendChild(child));
          } else if (real instanceof DocumentFragment) {
            this.root.appendChild(real);
          } else {
            this.root.appendChild(real);
          }
        }
      }

      if (focusInfo) {
        let node = this.root;
        focusInfo.path.forEach(i => node = node.childNodes[i]);
        if (node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA')) {
          node.focus();
          try {
            if ((node.tagName === 'INPUT' && typeof node.selectionStart === 'number' && typeof node.setSelectionRange === 'function' && node.type !== 'number') || node.tagName === 'TEXTAREA') {
              node.setSelectionRange(focusInfo.start, focusInfo.end);
            }
          } catch (e) { }
        }
      }

      // Aggiungi gli indicatori @log come sibling prima di ripristinare lo scroll
      this._addLogIndicators();

      window.scrollTo(scrollX, scrollY);
      this.bindingManager.updateBindings();

      this._isRendering = false;
    }

    _addLogIndicators() {
      // Trova tutti gli elementi con data-ayisha-log e aggiungi i log come sibling
      const logElements = this.root.querySelectorAll('[data-ayisha-log="true"]');

      logElements.forEach(el => {
        // Rimuovi eventuali log esistenti
        const existingLog = el.nextElementSibling;
        if (existingLog && existingLog.classList.contains('ayisha-log-display')) {
          existingLog.remove();
        }

        try {
          const savedDirectiveInfo = JSON.parse(el.getAttribute('data-ayisha-log-info') || '{}');

          // Crea il display del log
          const logDisplay = document.createElement('div');
          logDisplay.className = 'ayisha-log-display';
          logDisplay.style.cssText = `
            background: rgba(0, 20, 40, 0.95) !important;
            color: #fff !important;
            padding: 8px 12px !important;
            margin: 4px 0 !important;
            border-radius: 6px !important;
            font-family: 'JetBrains Mono', 'Courier New', monospace !important;
            font-size: 11px !important;
            border-left: 4px solid #0066cc !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
            max-width: 400px !important;
            overflow-x: auto !important;
            line-height: 1.4 !important;
          `;

          // Genera il contenuto del log usando i dati salvati
          const logContent = this._generateInlineLogContent(el, savedDirectiveInfo);
          logDisplay.innerHTML = logContent;

          // Inserisci come sibling successivo
          if (el.parentNode) {
            el.parentNode.insertBefore(logDisplay, el.nextSibling);
          }

        } catch (error) {
          console.error('❌ Error creating log display:', error);
        }
      });

      // Gestisci gli elementi con errori di log
      const logErrorElements = this.root.querySelectorAll('[data-ayisha-log-error]');

      logErrorElements.forEach(el => {
        const errorMessage = el.getAttribute('data-ayisha-log-error');

        const errorDisplay = document.createElement('div');
        errorDisplay.className = 'ayisha-log-error-display';
        errorDisplay.style.cssText = `
          background: rgba(255, 0, 0, 0.9) !important;
          color: white !important;
          padding: 8px 12px !important;
          margin: 4px 0 !important;
          border-radius: 6px !important;
          font-family: monospace !important;
          font-size: 11px !important;
          font-weight: bold !important;
          display: block !important;
        `;
        errorDisplay.innerHTML = `❌ Log Error: ${errorMessage}`;

        // Inserisci come sibling successivo
        if (el.parentNode) {
          el.parentNode.insertBefore(errorDisplay, el.nextSibling);
        }
      });
    }

    _generateInlineLogContent(el, savedDirectiveInfo) {
      // Usa le informazioni delle direttive salvate al momento della configurazione
      const vNode = {
        tag: savedDirectiveInfo.tag || el.tagName.toLowerCase(),
        directives: savedDirectiveInfo.directives || {},
        subDirectives: savedDirectiveInfo.subDirectives || {}
      };

      const ctx = {};

      let html = `<div style="color: #66ccff; font-weight: bold; margin-bottom: 6px;">📊 &lt;${vNode.tag}&gt;</div>`;

      let hasTrackedDirectives = false;
      let directiveCount = 0;

      // Processa ogni direttiva con i logger dedicati
      Object.keys(vNode.directives).forEach(directive => {
        if (directive === '@log') return; // Non mostrare @log stesso

        directiveCount++;

        if (this.centralLogger.loggers[directive]) {
          hasTrackedDirectives = true;
          try {
            const logData = this.centralLogger.loggers[directive].log(vNode, ctx, this.state);
            html += this._formatDirectiveLog(directive, logData.data);
          } catch (error) {
            html += `<div style="color: #ff6b6b; margin: 2px 0;">
              <span style="color: #ff9999;">${directive}</span>: 
              <span style="color: #ffcccc;">❌ ${error.message}</span>
            </div>`;
          }
        } else {
          // Direttiva non tracciata - mostra solo valore base
          html += `<div style="color: #999; margin: 2px 0;">
            <span style="color: #ccc;">${directive}</span>: 
            <span style="color: #aaa;">${this._truncateValue(vNode.directives[directive])}</span>
            <span style="color: #777; font-size: 10px;"> [untracked]</span>
          </div>`;
        }
      });

      // Processa le sub-direttive
      Object.entries(vNode.subDirectives || {}).forEach(([directive, events]) => {
        Object.keys(events).forEach(event => {
          directiveCount++;
          const fullDirective = `${directive}:${event}`;
          if (this.centralLogger.loggers[directive]) {
            hasTrackedDirectives = true;
            try {
              const logData = this.centralLogger.loggers[directive].log(vNode, ctx, this.state);
              html += this._formatDirectiveLog(fullDirective, logData.data, true);
            } catch (error) {
              html += `<div style="color: #ff6b6b; margin: 2px 0;">
                <span style="color: #ff9999;">${fullDirective}</span>: 
                <span style="color: #ffcccc;">❌ ${error.message}</span>
              </div>`;
            }
          } else {
            html += `<div style="color: #999; margin: 2px 0;">
              <span style="color: #ccc;">${fullDirective}</span>: 
              <span style="color: #aaa;">${this._truncateValue(events[event])}</span>
              <span style="color: #777; font-size: 10px;"> [untracked]</span>
            </div>`;
          }
        });
      });

      // Se non ci sono direttive tracciate ma ci sono direttive totali
      if (directiveCount === 0) {
        html += `<div style="color: #ff9966; font-style: italic; margin: 4px 0;">
          ⚠️ Element has @log but no other directives
        </div>`;
      } else if (!hasTrackedDirectives) {
        html += `<div style="color: #ffa726; font-style: italic; margin: 4px 0;">
          Found ${directiveCount} directive(s) but none are tracked by loggers
        </div>`;
      }

      // Informazioni sull'elemento
      if (savedDirectiveInfo.elementInfo) {
        const info = savedDirectiveInfo.elementInfo;
        if (info.className || info.id) {
          html += `<div style="color: #666; font-size: 10px; margin-top: 4px; padding-top: 2px; border-top: 1px solid #333;">
            ${info.className ? `Class: ${info.className}` : ''}${info.className && info.id ? ' | ' : ''}${info.id ? `ID: ${info.id}` : ''}
          </div>`;
        }
      }

      // Timestamp
      html += `<div style="color: #666; font-size: 10px; margin-top: 4px; border-top: 1px solid #333; padding-top: 2px;">
        ${new Date().toLocaleTimeString()}
      </div>`;

      return html;
    }

    _formatDirectiveLog(directiveType, data, isSubDirective = false) {
      const icon = isSubDirective ? '📎' : '📋';
      const color = this._getDirectiveColor(directiveType.split(':')[0]);

      let html = `<div style="margin: 4px 0; padding: 4px; background: rgba(255,255,255,0.03); border-radius: 3px;">`;
      html += `<div style="color: ${color}; font-weight: bold; font-size: 11px; margin-bottom: 2px;">
        ${icon} ${directiveType}
      </div>`;

      if (!data) {
        html += `<div style="color: #999;">No data available</div>`;
        html += `</div>`;
        return html;
      }

      // Formato specifico per ogni tipo di direttiva
      switch (directiveType.split(':')[0]) {
        case '@for':
          html += `<div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
            Array: <strong style="color: #ffcc66;">${data.arrayVariable || 'unknown'}</strong> (${data.length || 0} items)<br>
            Status: <span style="color: ${this._getStatusColor(data.status)};">${data.status || 'unknown'}</span><br>
            Item var: <span style="color: #66ccff;">${data.itemVariable || 'unknown'}</span>
            ${data.indexVariable ? `, Index var: <span style="color: #66ccff;">${data.indexVariable}</span>` : ''}
          </div>`;
          break;

        case '@fetch':
          const url = data.url || '';
          html += `<div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
            URL: <strong style="color: #66ff66;">${url.slice(0, 35)}${url.length > 35 ? '...' : ''}</strong><br>
            Result var: <span style="color: #ffcc66;">${data.resultVariable || 'result'}</span><br>
            Status: <span style="color: ${this._getStatusColor(data.status)};">${data.status || 'unknown'}</span><br>
            Size: <span style="color: #ccc;">${data.responseSize || 'N/A'}</span>
          </div>`;
          break;

        case '@model':
          const value = data.currentValue;
          const displayValue = typeof value === 'string'
            ? `"${value.slice(0, 20)}${value.length > 20 ? '...' : ''}"`
            : JSON.stringify(value);
          html += `<div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
            Variable: <strong style="color: #66ccff;">${data.variable || 'unknown'}</strong><br>
            Value: <span style="color: #ffcc66;">${displayValue}</span> 
            <span style="color: #999;">(${data.valueType})</span><br>
            ${data.validation ? `Validation: <span style="color: ${this._getStatusColor(data.validation.status)};">${data.validation.status}</span>` : 'No validation'}
          </div>`;
          break;

        case '@if':
        case '@show':
        case '@hide':
          const condition = data.condition || '';
          html += `<div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
            Condition: <strong style="color: #ffcc66;">${condition.slice(0, 25)}${condition.length > 25 ? '...' : ''}</strong><br>
            Result: <span style="color: #66ccff;">${data.result}</span> → 
            <span style="color: ${data.isVisible ? '#66bb6a' : '#ff6b6b'};">${data.isVisible ? 'Visible' : 'Hidden'}</span>
          </div>`;
          break;

        case '@click':
          const action = data.action || '';
          html += `<div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
            Action: <strong style="color: #ffcc66;">${action.slice(0, 25)}${action.length > 25 ? '...' : ''}</strong><br>
            Clicks: <span style="color: #66ccff;">${data.clickCount || 0}</span><br>
            Last: <span style="color: #999;">${data.lastClick || 'Never'}</span>
          </div>`;
          break;

        case '@component':
          const source = data.source || '';
          html += `<div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
            Source: <strong style="color: #66ccff;">${source.slice(0, 30)}${source.length > 30 ? '...' : ''}</strong><br>
            Status: <span style="color: ${this._getStatusColor(data.status)};">${data.status || 'unknown'}</span><br>
            Cached: <span style="color: ${data.cached ? '#66bb6a' : '#ff9800'};">${data.cached ? 'Yes' : 'No'}</span>
          </div>`;
          break;

        case '@input':
          const inputAction = data.action || '';
          html += `<div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
            Action: <strong style="color: #ffcc66;">${inputAction.slice(0, 25)}${inputAction.length > 25 ? '...' : ''}</strong><br>
            Inputs: <span style="color: #66ccff;">${data.inputCount || 0}</span><br>
            Last: <span style="color: #999;">${data.lastInput || 'Never'}</span>
          </div>`;
          break;

        case '@focus':
          const focusAction = data.action || '';
          html += `<div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
            Action: <strong style="color: #ffcc66;">${focusAction.slice(0, 25)}${focusAction.length > 25 ? '...' : ''}</strong><br>
            Focus events: <span style="color: #66ccff;">${data.focusCount || 0}</span><br>
            Last: <span style="color: #999;">${data.lastFocus || 'Never'}</span>
          </div>`;
          break;

        case '@blur':
          const blurAction = data.action || '';
          html += `<div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
            Action: <strong style="color: #ffcc66;">${blurAction.slice(0, 25)}${blurAction.length > 25 ? '...' : ''}</strong><br>
            Blur events: <span style="color: #66ccff;">${data.blurCount || 0}</span><br>
            Last: <span style="color: #999;">${data.lastBlur || 'Never'}</span>
          </div>`;
          break;

        case '@change':
          const changeAction = data.action || '';
          html += `<div style="color: #cccccc; font-size: 10px; line-height: 1.3;">
            Action: <strong style="color: #ffcc66;">${changeAction.slice(0, 25)}${changeAction.length > 25 ? '...' : ''}</strong><br>
            Change events: <span style="color: #66ccff;">${data.changeCount || 0}</span><br>
            Last: <span style="color: #999;">${data.lastChange || 'Never'}</span>
          </div>`;
          break;

        default:
          html += `<div style="color: #cccccc; font-size: 10px;">
            Expression: <span style="color: #ffcc66;">${data.expression || 'N/A'}</span><br>
            Status: <span style="color: #999;">${data.status || 'unknown'}</span>
          </div>`;
      }

      if (data.error) {
        html += `<div style="color: #ff6b6b; font-size: 9px; margin-top: 2px; padding: 2px; background: rgba(255,0,0,0.1); border-radius: 2px;">
          💥 ${data.error}
        </div>`;
      }

      html += `</div>`;
      return html;
    }

    _getDirectiveColor(type) {
      const colors = {
        '@for': '#ff9800',
        '@fetch': '#4caf50',
        '@model': '#2196f3',
        '@if': '#9c27b0',
        '@show': '#9c27b0',
        '@hide': '#9c27b0',
        '@click': '#f44336',
        '@component': '#00bcd4',
        'generic': '#666666'
      };
      return colors[type] || '#666666';
    }

    _getStatusColor(status) {
      if (!status) return '#cccccc';
      if (typeof status === 'string') {
        if (status.includes('error') || status.includes('❌')) return '#ff6b6b';
        if (status.includes('loading') || status.includes('⏳')) return '#ffa726';
        if (status.includes('success') || status.includes('✅')) return '#66bb6a';
      }
      return '#cccccc';
    }

    _getStatusIcon(status) {
      if (!status) return '📊';
      if (status === 'error') return '❌';
      if (status === 'loading') return '⏳';
      if (status === 'success') return '✅';
      if (status === 'unknown') return '❓';
      return '📊';
    }

    _truncateValue(value, maxLength = 30) {
      if (typeof value !== 'string') value = String(value);
      return value.length > maxLength ? value.slice(0, maxLength) + '...' : value;
    }

    _renderVNode(vNode, ctx) {
      if (!vNode) return null;

      // Sposta la logica di filtro @page DOPO il caricamento/caching del componente
      // In questo modo tutti i componenti vengono fetchati/cachati, ma solo quello attivo viene renderizzato

      Object.entries(vNode.directives || {}).forEach(([dir, expr]) => {
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr.trim())) {
          if (dir === '@model') this.evaluator.ensureVarInState(expr, true);
          else this.evaluator.ensureVarInState(expr);
        }
      });

      Object.values(vNode.subDirectives || {}).forEach(ev =>
        Object.values(ev).forEach(expr => {
          if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr.trim())) {
            this.evaluator.ensureVarInState(expr);
          }
        })
      );

      let unknownDirective = null;
      let unknownSubDirective = null;
      let unknownSubDirectiveEvt = null;

      if (vNode && vNode.directives) {
        for (const dir of Object.keys(vNode.directives)) {
          if (dir === '@src' && vNode.tag === 'component') continue;
          // Allow @attr as a valid directive
          if (dir === '@attr') continue;
          // Allow @then as a valid directive
          if (dir === '@then') continue;
          // Allow @finally as a valid directive
          if (dir === '@finally') continue;
          if (!this.helpSystem.isValidDirective(dir)) {
            unknownDirective = dir;
            break;
          }
        }
      }

      if (!unknownDirective && vNode && vNode.subDirectives) {
        for (const [dir, evs] of Object.entries(vNode.subDirectives)) {
          for (const evt of Object.keys(evs)) {
            const key = `${dir}:${evt}`;
            if (!this.helpSystem.isValidDirective(key)) {
              unknownSubDirective = dir;
              unknownSubDirectiveEvt = evt;
              break;
            }
          }
          if (unknownSubDirective) break;
        }
      }

      if (unknownDirective || unknownSubDirective) {
        let msg = '';
        if (unknownDirective) {
          msg = `Error: Unknown directive <b>${unknownDirective}</b>.`;
          msg += '<br>' + this.directiveHelp(unknownDirective);
        } else {
          const key = `${unknownSubDirective}:${unknownSubDirectiveEvt}`;
          msg = `Error: Unknown sub-directive <b>${key}</b>.`;
          msg += '<br>' + this.directiveHelp(key);
        }
        return this.errorHandler.createErrorElement(msg);
      }

      if (vNode.type === 'text') {
        return document.createTextNode(this.evaluator.evalText(vNode.text, ctx));
      }

      if (vNode.tag === 'fragment') {
        const frag = document.createDocumentFragment();
        vNode.children.forEach(child => {
          const node = this._renderVNode(child, ctx);
          if (node) frag.appendChild(node);
        });
        return frag;
      }

      if (vNode.directives['@if'] && !this.evaluator.evalExpr(vNode.directives['@if'], ctx)) return null;
      if (vNode.directives['@show'] && !this.evaluator.evalExpr(vNode.directives['@show'], ctx)) return null;
      if (vNode.directives['@hide'] && this.evaluator.evalExpr(vNode.directives['@hide'], ctx)) return null;

      if (vNode.directives['@for']) {
        return this._handleForDirective(vNode, ctx);
      }

      if (vNode.directives['@switch']) {
        return this._handleSwitchDirective(vNode, ctx);
      }

      if (vNode.directives['@source']) {
        return this._handleFunctionalDirectives(vNode, ctx);
      }

      if (vNode.tag === 'component') {
        if (vNode.directives['@page']) {
          const pageName = vNode.directives['@page'];
          const currentPage = this.state._currentPage || this.state.currentPage;
          if (String(pageName) !== String(currentPage)) {
            this._handleComponentDirective(vNode, ctx);
            return null;
          }
        }
        return this._handleComponentDirective(vNode, ctx);
      }

      if (vNode.tag === 'no') {
        return this._handleNoDirective(vNode, ctx);
      }

      const el = document.createElement(vNode.tag);

      Object.entries(vNode.attrs).forEach(([k, v]) => {
        el.setAttribute(k, this.evaluator.evalAttrValue(v, ctx));
      });

      // 1. Handle all directives except @then
      this._handleSpecialDirectives(el, vNode, ctx);
      this._handleStandardDirectives(el, vNode, ctx);

      vNode.children.forEach(child => {
        const node = this._renderVNode(child, ctx);
        if (node) el.appendChild(node);
      });

      this._handleSubDirectives(el, vNode, ctx);

      // 2. Handle @then directives (can be multiple, separated by ;; or as array)
      if (vNode.directives && vNode.directives['@then']) {
        let thenExprs = vNode.directives['@then'];
        // Support multiple @then separated by ;; or as array
        if (Array.isArray(thenExprs)) {
          thenExprs = thenExprs.flat().filter(Boolean);
        } else if (typeof thenExprs === 'string') {
          thenExprs = thenExprs.split(/;;|\n/).map(s => s.trim()).filter(Boolean);
        } else {
          thenExprs = [thenExprs];
        }
        thenExprs.forEach(expr => {
          try {
            // Use the same context as @set
            if (!this.evaluator.executeDirectiveExpression(expr, ctx, null, false)) {
              const cleanExpr = String(expr).replace(/\bstate\./g, '');
              new Function('state', 'ctx', `with(state){with(ctx||{}){${cleanExpr}}}`)(this.state, ctx);
            }
          } catch (e) {
            console.error('Error in @then directive:', e, 'Expression:', expr);
            el.setAttribute('data-ayisha-then-error', e.message);
          }
        });
      }

      if (vNode.directives && vNode.directives['@finally']) {
        let finallyExprs = vNode.directives['@finally'];
        if (Array.isArray(finallyExprs)) {
          finallyExprs = finallyExprs.flat().filter(Boolean);
        } else if (typeof finallyExprs === 'string') {
          finallyExprs = finallyExprs.split(/;;|\n/).map(s => s.trim()).filter(Boolean);
        } else {
          finallyExprs = [finallyExprs];
        }
        finallyExprs.forEach(expr => {
          try {
            if (!this.evaluator.executeDirectiveExpression(expr, ctx, null, false)) {
              const cleanExpr = String(expr).replace(/\bstate\./g, '');
              new Function('state', 'ctx', `with(state){with(ctx||{}){${cleanExpr}}}`)(this.state, ctx);
            }
          } catch (e) {
            console.error('Error in @finally directive:', e, 'Expression:', expr);
            el.setAttribute('data-ayisha-finally-error', e.message);
          }
        });
      }

      return el;
    }

    _handleForDirective(vNode, ctx) {
      let match = vNode.directives['@for'].match(/(\w+),\s*(\w+) in (.+)/);
      if (match) {
        const [, indexVar, itemVar, expr] = match;
        let arr = this.evaluator.evalExpr(expr, ctx) || [];
        if (typeof arr === 'object' && !Array.isArray(arr)) arr = Object.values(arr);
        const frag = document.createDocumentFragment();
        arr.forEach((val, index) => {
          const clone = JSON.parse(JSON.stringify(vNode));
          delete clone.directives['@for'];
          const subCtx = {
            ...ctx,
            [itemVar]: val,
            [indexVar]: index,
            [`${itemVar}_index`]: index,
            [`${itemVar}_ref`]: `${expr.split('.')[0]}[${index}]`
          };
          const node = this._renderVNode(clone, subCtx);
          if (node) frag.appendChild(node);
        });
        return frag;
      }

      match = vNode.directives['@for'].match(/(\w+) in (.+)/);
      if (match) {
        const [, it, expr] = match;
        let arr = this.evaluator.evalExpr(expr, ctx) || [];
        if (typeof arr === 'object' && !Array.isArray(arr)) arr = Object.values(arr);

        const originalArrayName = expr.split('.')[0];
        const isFiltered = expr.includes('.filter');

        const frag = document.createDocumentFragment();
        arr.forEach((val, index) => {
          const clone = JSON.parse(JSON.stringify(vNode));
          delete clone.directives['@for'];

          let originalIndex = index;
          if (isFiltered && this.state[originalArrayName]) {
            originalIndex = this.state[originalArrayName].findIndex(item =>
              item.id === val.id || JSON.stringify(item) === JSON.stringify(val)
            );
          }

          const subCtx = {
            ...ctx,
            [it]: val,
            $index: index,
            $originalIndex: originalIndex,
            $arrayName: originalArrayName
          };
          const node = this._renderVNode(clone, subCtx);
          if (node) frag.appendChild(node);
        });
        return frag;
      }
      return null;
    }

    _handleSwitchDirective(vNode, ctx) {
      const swVal = this.evaluator.evalExpr(vNode.directives['@switch'], ctx);
      let defaultNode = null;
      for (const child of vNode.children) {
        if (!child.directives) continue;
        if (child.directives['@case'] != null) {
          let cv = child.directives['@case'];
          if (/^['"].*['"]$/.test(cv)) cv = cv.slice(1, -1);
          if (String(cv) === String(swVal)) return this._renderVNode(child, ctx);
        }
        if (child.directives['@default'] != null) defaultNode = child;
      }
      return defaultNode ? this._renderVNode(defaultNode, ctx) : document.createComment('noswitch');
    }

    _handleFunctionalDirectives(vNode, ctx) {
      let sourceData = this.evaluator.evalExpr(vNode.directives['@source'], ctx);

      let arr = [];
      if (Array.isArray(sourceData)) {
        arr = sourceData;
      } else if (sourceData && typeof sourceData === 'object') {
        arr = Object.values(sourceData);
      } else if (sourceData == null) {
        arr = [];
      } else {
        arr = [sourceData];
      }

      const setState = (key, val) => {
        if (JSON.stringify(this.state[key]) !== JSON.stringify(val)) {
          Object.defineProperty(this.state, key, { value: val, writable: true, configurable: true, enumerable: true });
        }
      };
      let used = false;

      if (vNode.directives['@map']) {
        used = true;
        try {
          const mapExpr = vNode.directives['@map'];
          let fn;

          // Handle arrow functions
          if (mapExpr.includes('=>')) {
            const [param, body] = mapExpr.split('=>').map(s => s.trim());
            fn = new Function(param.trim(), `return (${body})`);
          } else {
            fn = new Function('item', `return (${mapExpr})`);
          }

          const result = arr.map(fn);
          setState(vNode.directives['@result'] || 'result', result);
        } catch (error) {
          console.error('Error in @map directive:', error);
          setState(vNode.directives['@result'] || 'result', []);
        }
      }

      if (vNode.directives['@filter']) {
        used = true;
        try {
          const filterExpr = vNode.directives['@filter'];
          let fn;

          // Handle arrow functions
          if (filterExpr.includes('=>')) {
            const [param, body] = filterExpr.split('=>').map(s => s.trim());
            fn = new Function(param.trim(), `return (${body})`);
          } else {
            fn = new Function('item', `return (${filterExpr})`);
          }

          const result = arr.filter(fn);
          setState(vNode.directives['@result'] || 'result', result);
        } catch (error) {
          console.error('Error in @filter directive:', error);
          setState(vNode.directives['@result'] || 'result', []);
        }
      }

      if (vNode.directives['@reduce']) {
        used = true;
        try {
          const str = vNode.directives['@reduce'];
          let redFn;
          if (str.includes('=>')) {
            const [params, body] = str.split('=>').map(s => s.trim());
            const [a, b] = params.replace(/[()]/g, '').split(',').map(s => s.trim());
            redFn = new Function(a, b, `return (${body})`);
          } else {
            redFn = new Function('acc', 'item', `return (${str})`);
          }
          const initial = vNode.directives['@initial'] ? this.evaluator.evalExpr(vNode.directives['@initial'], ctx) : undefined;

          let result;
          if (arr.length === 0) {
            result = initial !== undefined ? initial : undefined;
          } else {
            result = initial !== undefined ? arr.reduce(redFn, initial) : arr.reduce(redFn);
          }
          setState(vNode.directives['@result'] || 'result', result);
        } catch (error) {
          console.error('Error in @reduce directive:', error);
          const initial = vNode.directives['@initial'] ? this.evaluator.evalExpr(vNode.directives['@initial'], ctx) : undefined;
          setState(vNode.directives['@result'] || 'result', initial !== undefined ? initial : undefined);
        }
      }

      if (used) return document.createComment('functional');
      return null;
    }

    _handleComponentDirective(vNode, ctx) {
      if (!vNode.directives['@src']) {
        return this.errorHandler.createErrorElement(`Error: <b>&lt;component&gt;</b> requires the <b>@src</b> attribute`);
      }

      let srcUrl = null;
      try {
        srcUrl = this.evaluator.evalExpr(vNode.directives['@src'], ctx);
      } catch (e) {
        console.warn('Error evaluating @src:', e);
      }

      if (!srcUrl) {
        const rawSrc = vNode.directives['@src'].trim();
        if (/^['\"].*['\"]$/.test(rawSrc)) {
          srcUrl = rawSrc.slice(1, -1);
        } else {
          srcUrl = rawSrc;
        }
      }

      if (!srcUrl || srcUrl === 'undefined' || srcUrl === 'null') {
        return this.errorHandler.createErrorElement(`Error: Invalid component URL`);
      }

      // Risolvi path relativi
      if (srcUrl.startsWith('./')) {
        // Rimuovi il ./ iniziale
        srcUrl = srcUrl.substring(2);
      }

      console.log(`ComponentManager: Attempting to load component from ${srcUrl}`);

      // Se già in cache, mostra subito
      if (this.componentManager.getCachedComponent(srcUrl)) {
        console.log(`ComponentManager: Component ${srcUrl} found in cache`);
        const componentHtml = this.componentManager.getCachedComponent(srcUrl);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = componentHtml;
        this._processComponentInitBlocks(tempDiv);
        const componentVNode = this.parse(tempDiv);
        if (componentVNode && componentVNode.children) {
          const frag = document.createDocumentFragment();
          componentVNode.children.forEach(child => {
            const node = this._renderVNode(child, ctx);
            if (node) frag.appendChild(node);
          });
          return frag;
        }
      }

      // Se il componente non è in cache, avvia il caricamento
      if (!this.componentManager.getCachedComponent(srcUrl)) {
        console.log(`ComponentManager: Starting load for ${srcUrl}`);
        this.componentManager.loadExternalComponent(srcUrl).then(html => {
          if (html) {
            console.log(`ComponentManager: Successfully loaded component ${srcUrl} (${html.length} chars)`);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            this._processComponentInitBlocks(tempDiv);
            // Il caricamento è gestito dal ComponentManager
            if (!this._isRendering) {
              // Usa un debounce per evitare troppi re-render
              clearTimeout(this._componentRenderTimeout);
              this._componentRenderTimeout = setTimeout(() => this.render(), 10);
            }
          } else {
            console.error(`ComponentManager: Failed to load component ${srcUrl}`);
          }
        }).catch(err => {
          console.error('Error loading component:', err);
          this.componentManager.cache[srcUrl] = `<div class='component-error' style='padding: 10px; background: #ffe6e6; border: 1px solid #ff6b6b; border-radius: 4px; color: #d32f2f;'>Errore: ${err.message}</div>`;
          if (!this._isRendering) {
            clearTimeout(this._componentRenderTimeout);
            this._componentRenderTimeout = setTimeout(() => this.render(), 10);
          }
        });
      }

      // Placeholder di caricamento più elegante
      const placeholder = document.createElement('div');
      placeholder.className = 'component-loading';
      placeholder.style.cssText = 'padding: 10px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; color: #6c757d; font-size: 14px; text-align: center;';
      placeholder.innerHTML = `� Loading component: <code>${srcUrl}</code>`;
      return placeholder;
    }

    _processComponentInitBlocks(tempDiv) {
      // Process all init blocks in the component before parsing
      const initElements = tempDiv.querySelectorAll('init');
      const newInitBlocks = [];

      initElements.forEach(initEl => {
        const initContent = initEl.textContent.trim();
        if (initContent) {
          // Check if this init block was already processed to avoid duplicates
          if (!this._initBlocks.includes(initContent)) {
            newInitBlocks.push(initContent);
            this._initBlocks.push(initContent);
          }
        }
        // Remove the init element after processing
        initEl.remove();
      });

      // Run only the new init blocks immediately (without triggering render)
      this._runInitBlocksImmediate(newInitBlocks);
    }

    _runInitBlocksImmediate(initBlocks) {
      initBlocks.forEach(code => {
        // Skip empty or whitespace-only code
        if (!code || !code.trim()) {
          return;
        }

        // Clean and normalize the code while preserving JavaScript syntax
        let cleanCode = code.trim()
          .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
          .replace(/\r\n/g, '\n') // Normalize line endings
          .replace(/\r/g, '\n') // Normalize line endings
          .replace(/\n\s*\n/g, '\n') // Remove empty lines
          .replace(/\n\s+/g, '\n') // Remove leading whitespace from lines
          .trim();

        // Trasforma "foo = ..." in "state.foo = ..." solo se non già prefissato
        let transformed = cleanCode;

        // Applica la trasformazione solo alle righe che non contengono parole chiave JS
        const lines = transformed.split('\n');
        const transformedLines = lines.map(line => {
          const trimmedLine = line.trim();

          // Skip empty lines, comments, and control structures
          if (!trimmedLine ||
            trimmedLine.startsWith('//') ||
            trimmedLine.startsWith('/*') ||
            trimmedLine.startsWith('function') ||
            trimmedLine.includes('function(') ||
            trimmedLine.includes('=>') ||
            /^(if|else|for|while|switch|case|default|try|catch|finally|return|var|let|const)\b/.test(trimmedLine)) {
            return line;
          }

          // Transform assignment statements: "foo = ..." to "state.foo = ..."
          // But only if not already prefixed with state, this, window, etc.
          const assignmentMatch = trimmedLine.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+)$/);
          if (assignmentMatch &&
            !trimmedLine.includes('state.') &&
            !trimmedLine.includes('this.') &&
            !trimmedLine.includes('window.') &&
            !trimmedLine.includes('console.') &&
            !trimmedLine.includes('localStorage.') &&
            !trimmedLine.includes('sessionStorage.')) {
            const [, varName, value] = assignmentMatch;
            // Don't transform JavaScript globals
            const jsGlobals = ['JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Math', 'RegExp'];
            if (!jsGlobals.includes(varName)) {
              return line.replace(assignmentMatch[0], `state.${varName} = ${value}`);
            }
          }

          return line;
        });

        transformed = transformedLines.join('\n');

        try {
          new Function('state', transformed)(this.state);
        } catch (e) {
          console.error('Component init error:', e, 'Original code:', code, 'Cleaned:', cleanCode, 'Transformed:', transformed);
        }
      });
    }

    _handleNoDirective(vNode, ctx) {
      // Create a span element to hold the raw content as text
      const span = document.createElement('span');

      // Use the raw content stored during parsing
      if (vNode.rawContent !== undefined) {
        span.textContent = vNode.rawContent;
      } else {
        // Fallback: reconstruct content without processing
        let rawContent = '';

        const collectTextContent = (node) => {
          if (typeof node === 'string') {
            return node;
          } else if (node.type === 'text') {
            return node.content || '';
          } else if (node.tag) {
            // Reconstruct the HTML tag with all attributes and content
            let attrs = '';
            if (node.attrs) {
              attrs = Object.entries(node.attrs)
                .map(([k, v]) => ` ${k}="${v}"`)
                .join('');
            }

            let directives = '';
            if (node.directives) {
              directives = Object.entries(node.directives)
                .map(([k, v]) => ` ${k}="${v}"`)
                .join('');
            }

            let subDirectives = '';
            if (node.subDirectives) {
              Object.entries(node.subDirectives).forEach(([dir, events]) => {
                Object.entries(events).forEach(([event, value]) => {
                  subDirectives += ` ${dir}:${event}="${value}"`;
                });
              });
            }

            const innerContent = node.children ? node.children.map(collectTextContent).join('') : '';
            return `<${node.tag}${attrs}${directives}${subDirectives}>${innerContent}</${node.tag}>`;
          }
          return '';
        };

        if (vNode.children && vNode.children.length > 0) {
          rawContent = vNode.children.map(collectTextContent).join('');
        }

        span.textContent = rawContent;
      }

      return span;
    }

    _handleSpecialDirectives(el, vNode, ctx) {
      // --- @set as one-time init ---
      if (vNode.directives && vNode.directives['@set']) {
        // Create a unique identifier for this @set directive
        const setExpr = vNode.directives['@set'];
        const setId = `${vNode.tag}-${JSON.stringify(vNode.attrs)}-${setExpr}`;

        // Only execute if not already processed
        if (!this._processedSetDirectives.has(setId)) {
          this._processedSetDirectives.add(setId);

          try {
            const expr = vNode.directives['@set'];

            // Use the new helper that supports multiple expressions
            if (!this.evaluator.executeDirectiveExpression(expr, ctx, null, false)) {
              // Fallback to old method if helper fails
              const cleanExpr = String(expr).replace(/\bstate\./g, '');
              new Function('state', 'ctx', `with(state){with(ctx||{}){${cleanExpr}}}`)(this.state, ctx);
            }
          } catch (e) {
            console.error('Error in @set directive:', e, 'Expression:', vNode.directives['@set']);
            el.setAttribute('data-ayisha-set-error', e.message);
          }
        }

        // Always remove @set from the current vNode to prevent re-execution in this render cycle
        delete vNode.directives['@set'];
      }


      // @state
      if (vNode.directives.hasOwnProperty('@state')) {
        const wrapper = document.createElement('div');
        wrapper.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        wrapper.style.color = '#fff';
        wrapper.style.padding = '1em';
        wrapper.style.borderRadius = '4px';
        wrapper.style.marginTop = '1em';
        wrapper.style.overflow = 'auto';

        let stateValue = this.state;
        let titleText = 'CURRENT STATE';
        // Check if @state has an expression (e.g. @state="foo")
        const stateExpr = vNode.directives['@state'];
        if (typeof stateExpr === 'string' && stateExpr.trim()) {
          // Evaluate the expression in the current context
          try {
            stateValue = this.evaluator.evalExpr(stateExpr, ctx);
            titleText = `STATE: ${stateExpr}`;
          } catch (e) {
            stateValue = { error: 'Invalid expression', details: e.message };
            titleText = `STATE: ${stateExpr}`;
          }
        }

        const title = document.createElement('h3');
        title.textContent = titleText;
        title.style.margin = '0.5em 0 2em';
        title.style.fontSize = '1.1em';
        title.style.fontWeight = 'bold';
        title.style.color = '#fff';
        wrapper.appendChild(title);

        const pre = document.createElement('pre');
        pre.style.margin = '0';
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.fontFamily = 'monospace';
        pre.textContent = JSON.stringify(stateValue, null, 2);
        wrapper.appendChild(pre);

        el.appendChild(wrapper);
      }

      // @attr
      if (vNode.directives.hasOwnProperty('@attr')) {
        const wrapper = document.createElement('div');
        wrapper.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        wrapper.style.color = '#fff';
        wrapper.style.padding = '1em';
        wrapper.style.borderRadius = '4px';
        wrapper.style.marginTop = '1em';
        wrapper.style.overflow = 'auto';

        const title = document.createElement('h3');
        title.textContent = 'STATE ATTRIBUTES';
        title.style.margin = '0.5em 0 2em';
        title.style.fontSize = '1.1em';
        title.style.fontWeight = 'bold';
        title.style.color = '#fff';
        wrapper.appendChild(title);

        const ul = document.createElement('ul');
        ul.style.margin = '0';
        ul.style.padding = '0 0 0 1.2em';
        ul.style.fontFamily = 'monospace';
        ul.style.fontSize = '1em';

        Object.keys(this.state).forEach(key => {
          const li = document.createElement('li');
          li.textContent = key;
          ul.appendChild(li);
        });

        wrapper.appendChild(ul);
        el.appendChild(wrapper);
      }

      // @log come sibling invece che come figlio
      if (vNode.directives.hasOwnProperty('@log')) {
        // Assicurati che il logger sia inizializzato
        if (!this.centralLogger || !this.centralLogger.loggers || Object.keys(this.centralLogger.loggers).length === 0) {
          console.warn('⚠️ CentralLogger not initialized, initializing now...');
          this.centralLogger.initializeLoggers(this.evaluator, this.fetchManager, this.componentManager);
        }

        try {
          const elementInfo = {
            tagName: el.tagName,
            className: el.className,
            id: el.id
          };

          this.centralLogger.addLog(elementInfo, vNode, ctx, this.state, el);

          // CORREZIONE: Salva le informazioni complete delle direttive originali
          const directiveInfo = {
            tag: vNode.tag,
            directives: { ...vNode.directives },
            subDirectives: { ...vNode.subDirectives },
            elementInfo
          };

          el.setAttribute('data-ayisha-log', 'true');
          el.setAttribute('data-ayisha-log-info', JSON.stringify(directiveInfo));

          // Se l'elemento ha @click, configura il logger specifico
          if (vNode.directives['@click']) {
            const clickLogger = this.centralLogger.loggers['@click'];
            if (clickLogger) {
              this.centralLogger.clickLoggers.set(el, clickLogger);

              el.addEventListener('click', () => {
                clickLogger.recordClick();
                this.centralLogger.addLog(elementInfo, vNode, ctx, this.state, el);
              });
            }
          }

        } catch (error) {
          el.setAttribute('data-ayisha-log-error', error.message);
        }
      }
    }

    _handleStandardDirectives(el, vNode, ctx) {
      if (vNode.directives['@click']) {
        el.addEventListener('click', e => {
          if (el.tagName === 'BUTTON') {
            e.preventDefault();
          }
          const expr = vNode.directives['@click'];
          this.evaluator.ensureVarInState(expr);
          let codeToRun = expr;
          if (this.evaluator.hasInterpolation(expr)) {
            codeToRun = this.evaluator.evalAttrValue(expr, ctx);
          }

          let processedCode = codeToRun.replace(/\bstate\./g, '');



          try {
            // Handle context object operations (e.g., post.likes++, post.editing = !post.editing)
            const contextObjMatch = processedCode.match(/^(\w+)\.(\w+)(\+\+|--|=.+)$/);
            if (contextObjMatch) {
              const [, objName, propName, operation] = contextObjMatch;

              if (ctx && ctx[objName]) {
                const targetObj = ctx[objName];

                // Check if the target object has an id (most context objects from @for loops do)
                if (targetObj && typeof targetObj === 'object' && targetObj.id) {
                  // Search all state arrays for the object with matching id
                  for (const [stateKey, stateValue] of Object.entries(this.state)) {
                    if (Array.isArray(stateValue)) {
                      const index = stateValue.findIndex(item =>
                        item && typeof item === 'object' && item.id === targetObj.id
                      );
                      if (index !== -1) {
                        if (operation === '++') {
                          this.state[stateKey][index][propName] = (this.state[stateKey][index][propName] || 0) + 1;
                          setTimeout(() => this.render(), 0);
                          return;
                        } else if (operation === '--') {
                          this.state[stateKey][index][propName] = (this.state[stateKey][index][propName] || 0) - 1;
                          setTimeout(() => this.render(), 0);
                          return;
                        } else if (operation.startsWith('=')) {
                          const valueExpr = operation.substring(1).trim();
                          const value = this.evaluator.evalExpr(valueExpr, ctx);
                          this.state[stateKey][index][propName] = value;
                          setTimeout(() => this.render(), 0);
                          return;
                        }
                      }
                    }
                  }
                }

                // If no id or not found in state arrays, try direct modification
                // This handles cases where the context object is directly from state
                if (operation === '++') {
                  targetObj[propName] = (targetObj[propName] || 0) + 1;
                  setTimeout(() => this.render(), 0);
                  return;
                } else if (operation === '--') {
                  targetObj[propName] = (targetObj[propName] || 0) - 1;
                  setTimeout(() => this.render(), 0);
                  return;
                } else if (operation.startsWith('=')) {
                  const valueExpr = operation.substring(1).trim();
                  const value = this.evaluator.evalExpr(valueExpr, ctx);
                  targetObj[propName] = value;
                  setTimeout(() => this.render(), 0);
                  return;
                }
              }
            }

            // Handle array filter operations (e.g., posts = posts.filter(p => p.id !== post.id))
            const filterMatch = processedCode.match(/^(\w+)\s*=\s*(\w+)\.filter\((.+)\)$/);
            if (filterMatch) {
              const [, targetVar, sourceVar, filterExpr] = filterMatch;

              if (ctx && filterExpr.includes('!==') && targetVar === sourceVar) {
                const varMatch = filterExpr.match(/!==\s*(\w+)\.id/);
                let objectToDelete = null;

                if (varMatch) {
                  const varName = varMatch[1];
                  objectToDelete = ctx[varName];
                } else {
                  // Find any object with an id in the context (fallback)
                  for (const [ctxKey, ctxValue] of Object.entries(ctx)) {
                    if (ctxValue && typeof ctxValue === 'object' && ctxValue.id && ctxKey !== 'users') {
                      objectToDelete = ctxValue;
                      break;
                    }
                  }
                }

                if (objectToDelete && objectToDelete.id) {
                  const itemToDeleteId = objectToDelete.id;
                  this.state[targetVar] = this.state[targetVar].filter(p => p.id !== itemToDeleteId);
                  setTimeout(() => this.render(), 0);
                  return;
                }
              }
            }

            const arrayMatches = processedCode.match(/([\w$]+)\.(push|pop|shift|unshift|filter|map|reduce|forEach|slice|splice)/g);
            if (arrayMatches) {
              arrayMatches.forEach(match => {
                const varName = match.split('.')[0];
                if (!(varName in this.state) || !Array.isArray(this.state[varName])) {
                  this.state[varName] = [];
                }
              });
            }

            const incrementMatch = processedCode.match(/^(\w+)\+\+$/);
            if (incrementMatch) {
              const varName = incrementMatch[1];
              if (!(varName in this.state)) {
                this.state[varName] = 0;
              }
              let currentValue = Number(this.state[varName]) || 0;
              this.state[varName] = currentValue + 1;
              setTimeout(() => this.render(), 0);
              return;
            }

            const decrementMatch = processedCode.match(/^(\w+)--$/);
            if (decrementMatch) {
              const varName = decrementMatch[1];
              let currentValue = Number(this.state[varName]) || 0;
              this.state[varName] = currentValue - 1;
              setTimeout(() => this.render(), 0);
              return;
            }

            const arithMatch = processedCode.match(/^(\w+)\s*([+\-*\/])=\s*(.+)$/);
            if (arithMatch) {
              const [, varName, operator, valueExpr] = arithMatch;
              let currentValue = Number(this.state[varName]) || 0;
              let operandValue = Number(this.evaluator.evalExpr(valueExpr, ctx)) || 0;
              switch (operator) {
                case '+': this.state[varName] = currentValue + operandValue; break;
                case '-': this.state[varName] = currentValue - operandValue; break;
                case '*': this.state[varName] = currentValue * operandValue; break;
                case '/': this.state[varName] = operandValue !== 0 ? currentValue / operandValue : currentValue; break;
              }
              setTimeout(() => this.render(), 0);
              return;
            }

            // Check for multiple expressions first (semicolon-separated)
            if (processedCode.includes(';')) {
              try {
                if (this.evaluator.executeMultipleExpressions(processedCode, ctx, e)) {
                  setTimeout(() => this.render(), 0);
                  return;
                }
              } catch (multiError) {
                console.warn('Multiple expressions handler failed:', multiError);
                // Continue to try individual assignment handling
              }
            }

            const assignMatch = processedCode.match(/^(\w+)\s*=\s*(.+)$/);
            if (assignMatch) {
              const [, varName, valueExpr] = assignMatch;
              // Skip assignment pattern if the value expression contains arrow functions
              // Let it fall through to the generic handler
              if (valueExpr.includes('=>')) {
                throw new Error('Assignment with arrow function, using fallback');
              }
              const value = this.evaluator.evalExpr(valueExpr, ctx);
              this.state[varName] = value;
              setTimeout(() => this.render(), 0);
              return;
            }

            // Fallback to multiple expressions handler if all individual handlers fail
            try {
              if (this.evaluator.executeMultipleExpressions(processedCode, ctx, e)) {
                return;
              }
            } catch (multiError) {
              console.warn('Multiple expressions handler also failed:', multiError);
            }

            // Final fallback to single expression handlers - with render trigger
            const func = new Function('state', 'ctx', `with(state){with(ctx||{}){${processedCode}}}`);
            func(this.state, ctx || {});
            setTimeout(() => this.render(), 0);
          } catch (err) {
            this.errorHandler.showAyishaError(el, err, processedCode);
          }
        });
      }

      if (vNode.directives['@hover']) {
        const rawExpr = vNode.directives['@hover'];
        const applyHover = e => {
          try {
            // Use the new helper that supports multiple expressions
            if (!this.evaluator.executeDirectiveExpression(rawExpr, ctx, e, true)) {
              // Fallback to old method
              let codeToRun = rawExpr;
              if (this.evaluator.hasInterpolation(rawExpr)) {
                codeToRun = this.evaluator.evalAttrValue(rawExpr, ctx);
              }
              const cleanCode = codeToRun.replace(/\bstate\./g, '');
              new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${cleanCode}}}`)
                (this.state, ctx, e);
            }
          } catch (err) {
            this.errorHandler.showAyishaError(el, err, rawExpr);
          }
        };
        el.addEventListener('mouseover', applyHover);
        el.addEventListener('mouseout', applyHover);
      }

      // @input directive handler
      if (vNode.directives['@input']) {
        el.addEventListener('input', e => {
          const expr = vNode.directives['@input'];
          this.evaluator.ensureVarInState(expr);

          try {
            // Use the new helper that supports multiple expressions
            if (!this.evaluator.executeDirectiveExpression(expr, ctx, e, true)) {
              // Fallback to old method
              let codeToRun = expr;
              if (this.evaluator.hasInterpolation(expr)) {
                codeToRun = this.evaluator.evalAttrValue(expr, ctx);
              }
              const cleanCode = codeToRun.replace(/\bstate\./g, '');
              new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${cleanCode}}}`)
                (this.state, ctx, e);
            }
          } catch (err) {
            this.errorHandler.showAyishaError(el, err, expr);
          }
        });
      }

      // @focus directive handler
      if (vNode.directives['@focus']) {
        el.addEventListener('focus', e => {
          const expr = vNode.directives['@focus'];
          this.evaluator.ensureVarInState(expr);

          try {
            // Use the new helper that supports multiple expressions
            if (!this.evaluator.executeDirectiveExpression(expr, ctx, e, true)) {
              // Fallback to old method
              let codeToRun = expr;
              if (this.evaluator.hasInterpolation(expr)) {
                codeToRun = this.evaluator.evalAttrValue(expr, ctx);
              }
              const cleanCode = codeToRun.replace(/\bstate\./g, '');
              new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${cleanCode}}}`)
                (this.state, ctx, e);
            }
          } catch (err) {
            this.errorHandler.showAyishaError(el, err, expr);
          }
        });
      }

      // @blur directive handler
      if (vNode.directives['@blur']) {
        el.addEventListener('blur', e => {
          const expr = vNode.directives['@blur'];
          this.evaluator.ensureVarInState(expr);

          try {
            // Use the new helper that supports multiple expressions
            if (!this.evaluator.executeDirectiveExpression(expr, ctx, e, true)) {
              // Fallback to old method
              let codeToRun = expr;
              if (this.evaluator.hasInterpolation(expr)) {
                codeToRun = this.evaluator.evalAttrValue(expr, ctx);
              }
              const cleanCode = codeToRun.replace(/\bstate\./g, '');
              new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${cleanCode}}}`)
                (this.state, ctx, e);
            }
          } catch (err) {
            this.errorHandler.showAyishaError(el, err, expr);
          }
        });
      }

      // @change directive handler
      if (vNode.directives['@change']) {
        el.addEventListener('change', e => {
          const expr = vNode.directives['@change'];
          this.evaluator.ensureVarInState(expr);

          try {
            // Use the new helper that supports multiple expressions
            if (!this.evaluator.executeDirectiveExpression(expr, ctx, e, true)) {
              // Fallback to old method
              let codeToRun = expr;
              if (this.evaluator.hasInterpolation(expr)) {
                codeToRun = this.evaluator.evalAttrValue(expr, ctx);
              }
              const cleanCode = codeToRun.replace(/\bstate\./g, '');
              new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${cleanCode}}}`)
                (this.state, ctx, e);
            }
          } catch (err) {
            this.errorHandler.showAyishaError(el, err, expr);
          }
        });
      }

      if (vNode.directives['@fetch'] && !vNode.subDirectives['@fetch']) {
        const expr = this.evaluator.autoVarExpr(vNode.directives['@fetch']);
        const rk = vNode.directives['@result'] || 'result';
        this.fetchManager.setupFetch(expr, rk, ctx);

        if (vNode.directives['@watch']) {
          this._handleWatchDirective(vNode, expr, rk);
        }
      }

      if (vNode.directives['@watch'] && !vNode.directives['@fetch']) {
        this._handleGenericWatchDirective(vNode);
      }

      if (vNode.directives['@text'] && !vNode.subDirectives['@text']) {
        try {
          const expr = vNode.directives['@text'];

          // Check if this is a multiple assignment expression that should be executed
          const isMultiple = this.evaluator.hasMultipleAssignments(expr);

          if (isMultiple) {
            // For multiple expressions, execute them and don't set text
            this.evaluator.executeDirectiveExpression(expr, ctx, null, false);
          } else {
            // For single expressions, evaluate to get the text value
            const textValue = this.evaluator.evalExpr(expr, ctx);
            if (textValue === undefined) {
              el.textContent = '';
            } else if (textValue === null) {
              el.textContent = 'null';
            } else {
              el.textContent = String(textValue);
            }
          }
        } catch (error) {
          console.error('Error in @text directive:', error, 'Expression:', vNode.directives['@text']);
          el.textContent = `[Error: ${error.message}]`;
        }
      }

      if (vNode.directives['@model']) {
        this.bindingManager.bindModel(el, vNode.directives['@model'], ctx);
      }

      if (vNode.directives['@class'] && !vNode.subDirectives['@class']) {
        const clsMap = this.evaluator.evalExpr(vNode.directives['@class'], ctx) || {};
        Object.entries(clsMap).forEach(([cls, cond]) => el.classList.toggle(cls, !!cond));
      }

      if (vNode.directives['@style']) {
        try {
          const styles = this.evaluator.evalExpr(vNode.directives['@style'], ctx) || {};
          if (typeof styles === 'object' && styles !== null && !Array.isArray(styles)) {
            Object.entries(styles).forEach(([prop, val]) => {
              if (typeof prop === 'string' && prop.trim()) {
                el.style[prop] = val;
              }
            });
          }
        } catch (e) {
          console.warn('Error applying @style directive:', e);
        }
      }

      if (vNode.directives['@validate']) {
        const modelVar = vNode.directives['@model'] || null;
        this.bindingManager.bindValidation(el, vNode.directives['@validate'], modelVar);
      }

      if (vNode.directives['@link']) {
        el.setAttribute('href', vNode.directives['@link']);
        el.addEventListener('click', e => {
          e.preventDefault();
          this.state._currentPage = vNode.directives['@link'];
        });
      }

      // RIMOSSO: la logica di esclusione per @page è ora gestita in _renderVNode

      if (vNode.directives['@animate']) {
        const animationClass = vNode.directives['@animate'];
        el.classList.add(animationClass);
        if (animationClass === 'fadeIn' || animationClass === 'fade-in') {
          el.style.opacity = '1';
          el.style.transition = 'opacity 0.3s ease-in-out';
        }
      }

      if (vNode.directives['@component']) {
        const n = vNode.directives['@component'];
        if (this.componentManager.getComponent(n)) {
          const frag = document.createRange().createContextualFragment(this.componentManager.getComponent(n));
          const compVNode = this.parse(frag);
          const compEl = this._renderVNode(compVNode, ctx);
          if (compEl) el.appendChild(compEl);
        }
      }
    }

    _handleSubDirectives(el, vNode, ctx) {
      Object.entries(vNode.subDirectives).forEach(([dir, evs]) => {
        Object.entries(evs).forEach(([evt, expr]) => {
          const eventName = evt === 'hover' ? 'mouseover' : evt;
          const isEvent = (
            dir === '@click' || dir === '@hover' || dir === '@set' || dir === '@fetch' ||
            dir === '@model' || dir === '@focus' || dir === '@blur' || dir === '@change' ||
            dir === '@input' || dir === '@class' || dir === '@text'
          ) && (
              evt === 'click' || evt === 'hover' || evt === 'focus' || evt === 'input' || evt === 'change' || evt === 'blur'
            );

          if (isEvent) {
            const getEvaluatedExpr = () => {
              if (dir === '@class' && expr.trim().startsWith('{')) {
                return this.evaluator.evalExpr(expr, ctx);
              }
              return this.evaluator.evalAttrValue(expr, ctx);
            };

            if (dir === '@fetch') {
              this._handleFetchSubDirective(el, eventName, expr, vNode, ctx);
              return;
            }

            if (dir === '@class') {
              this._handleClassSubDirective(el, evt, getEvaluatedExpr, ctx);
              return;
            }

            if (dir === '@text') {
              this._handleTextSubDirective(el, evt, getEvaluatedExpr, ctx);
              return;
            }

            el.addEventListener(eventName, e => {
              let codeToRun = getEvaluatedExpr();
              try {
                const cleanCode = String(codeToRun).replace(/\bstate\./g, '');

                // Try multiple expressions handler first
                if (!this.evaluator.executeMultipleExpressions(cleanCode, ctx, e)) {
                  // Fallback to single expression
                  new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${cleanCode}}}`)
                    (this.state, ctx, e);
                }
              } catch (err) {
                this.errorHandler.showAyishaError(el, err, codeToRun);
              }
            });
          }
        });
      });
    }

    _handleFetchSubDirective(el, eventName, expr, vNode, ctx) {
      el.addEventListener(eventName, e => {
        const resultVar = vNode.directives['@result'] || 'result';

        try {
          let url = this.evaluator.evalExpr(expr, ctx);
          if (url === undefined) {
            url = expr;
          }
          this.fetchManager.setupFetch(url, resultVar, ctx, e, true);
        } catch (err) {
          this.fetchManager.setupFetch(expr, resultVar, ctx, e, true);
        }
      });
    }

    _handleClassSubDirective(el, evt, getEvaluatedExpr, ctx) {
      if (evt === 'hover') {
        el.addEventListener('mouseover', e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.add(cls);
            });
          } catch (error) {
            console.error('Error in hover class directive:', error);
          }
        });
        el.addEventListener('mouseout', e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.remove(cls);
            });
          } catch (error) {
            console.error('Error in hover class directive:', error);
          }
        });
      } else if (evt === 'focus') {
        el.addEventListener('focus', e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.add(cls);
            });
          } catch (error) {
            console.error('Error in focus class directive:', error);
          }
        });
        el.addEventListener('blur', e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.remove(cls);
            });
          } catch (error) {
            console.error('Error in blur class directive:', error);
          }
        });
      } else if (evt === 'input') {
        el.addEventListener('input', e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.add(cls);
            });
          } catch (error) {
            console.error('Error in input class directive:', error);
          }
        });
        el.addEventListener('blur', e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.remove(cls);
            });
          } catch (error) {
            console.error('Error in input blur class directive:', error);
          }
        });
      } else if (evt === 'click') {
        el.addEventListener('click', e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) {
                el.classList.toggle(cls);
              }
            });
          } catch (error) {
            console.error('Error in click class directive:', error);
          }
        });
      } else {
        el.addEventListener(evt, e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) {
                el.classList.add(cls);
              }
            });
          } catch (error) {
            console.error('Error in class directive:', error);
          }
        });
      }
    }

    _handleTextSubDirective(el, evt, getInterpolatedExpr, ctx) {
      if (!el._ayishaOriginalText) {
        el._ayishaOriginalText = el.textContent || el.innerText || '';
      }

      if (evt === 'click') {
        el.addEventListener('click', e => {
          const newText = this.evaluator.evalExpr(getInterpolatedExpr(), ctx, e);
          el.textContent = newText;
        });
      } else if (evt === 'hover') {
        el.addEventListener('mouseover', e => {
          const newText = this.evaluator.evalExpr(getInterpolatedExpr(), ctx, e);
          el.textContent = newText;
        });
        el.addEventListener('mouseout', () => {
          el.textContent = el._ayishaOriginalText || '';
        });
      } else if (evt === 'input' || evt === 'focus' || evt === 'blur') {
        el.addEventListener(evt, e => {
          const newText = this.evaluator.evalExpr(getInterpolatedExpr(), ctx, e);
          el.textContent = newText;
        });
      }
    }

    _handleWatchDirective(vNode, expr, rk) {
      vNode.directives['@watch'].split(',').forEach(watchExpr => {
        watchExpr = watchExpr.trim();
        let match = watchExpr.match(/^([\w$]+)\s*=>\s*(.+)$/) || watchExpr.match(/^([\w$]+)\s*:\s*(.+)$/);
        if (match) {
          const prop = match[1];
          const code = match[2];
          this.evaluator.ensureVarInState(code);

          this.addWatcher(prop, function (newVal) {
            const state = window.ayisha.state;
            try {
              window.ayisha.evaluator.ensureVarInState(code);
              // Use the new helper that supports multiple expressions
              if (!window.ayisha.evaluator.executeDirectiveExpression(code, {}, { newVal }, true)) {
                // Fallback to old method
                new Function('state', 'newVal', `with(state) { ${code} }`)(state, newVal);
              }
            } catch (e) {
              console.error('Watcher error:', e, 'Code:', code, 'Prop:', prop, 'NewVal:', newVal);
            }
          });
        } else {
          this.addWatcher(watchExpr, () => this.fetchManager.setupFetch(expr, rk, undefined, undefined, true));
        }
      });
    }

    _handleGenericWatchDirective(vNode) {
      vNode.directives['@watch'].split(',').forEach(watchExpr => {
        watchExpr = watchExpr.trim();
        const match = watchExpr.match(/^(\w+)\s*=>\s*(.+)$/)
          || watchExpr.match(/^(\w+)\s*:\s*(.+)$/);
        if (match) {
          const prop = match[1];
          const code = match[2];

          this.addWatcher(prop, function (newVal) {
            const state = window.ayisha.state;
            window.ayisha.evaluator.ensureVarInState(code);
            try {
              // Use the new helper that supports multiple expressions
              if (!window.ayisha.evaluator.executeDirectiveExpression(code, {}, { newVal }, true)) {
                // Fallback to old method
                new Function('state', 'newVal', `with(state){ ${code} }`)(state, newVal);
              }
            } catch (e) {
              console.error('Generic watcher error:', e, 'Code:', code);
            }
          });
        }
      });
    }

    mount() {
      // First pass: process all init blocks
      this.root.childNodes.forEach(child => {
        if (child.nodeType === 1 && child.tagName && child.tagName.toLowerCase() === 'init') {
          this.parser.parse(child);
        }
      });

      // Second pass: build the VDOM (excluding init blocks)
      if (this.root.childNodes.length > 1) {
        const fragVNode = { tag: 'fragment', attrs: {}, directives: {}, subDirectives: {}, children: [] };
        this.root.childNodes.forEach(child => {
          if (child.nodeType === 1 && child.tagName && child.tagName.toLowerCase() === 'init') return;
          const cn = this.parse(child);
          if (cn) fragVNode.children.push(cn);
        });
        this._vdom = fragVNode;
      } else {
        this._vdom = this.parse(this.root);
      }

      if (!this.state._currentPage) {
        const firstPage = this._findFirstPageDirective(this._vdom);
        if (firstPage) this.state._currentPage = firstPage.directives['@page'];
      }

      this._preInitializeEssentialVariables();
      this._makeReactive();
      this._runInitBlocks();
      this.reactivitySystem.enableWatchers();
      this._setupRouting();
      this.router.setupCurrentPageProperty();

      // Precarica i componenti in background - non bloccante
      this.preloadComponents().then(() => {
        console.log('Component preloading completed, triggering re-render');
        if (!this._isRendering) {
          this.render();
        }
      });

      // Primo render immediato
      this.render();

      this.root.addEventListener('click', e => {
        let el = e.target;
        while (el && el !== this.root) {
          if (el.hasAttribute('@link')) {
            e.preventDefault();
            this.state._currentPage = el.getAttribute('@link');
            this.render();
            return;
          }
          el = el.parentNode;
        }
      }, true);

    }
  }

  // Set up global reference
  window.AyishaVDOM = AyishaVDOM;

  // Add default animation styles
  const addDefaultAnimationStyles = () => {
    const existingStyle = document.getElementById('ayisha-default-animations');
    if (!existingStyle) {
      const style = document.createElement('style');
      style.id = 'ayisha-default-animations';
      style.textContent = `
        .fadeIn, .fade-in {
          animation: ayishaFadeIn 0.3s ease-in-out;
        }
        
        @keyframes ayishaFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .slide-down {
          overflow: hidden;
          transition: height 0.3s ease-in-out;
        }
        
        /* Stili per @log display come sibling */
        .ayisha-log-display {
          background: rgba(0, 20, 40, 0.95) !important;
          color: #fff !important;
          padding: 8px 12px !important;
          margin: 4px 0 !important;
          border-radius: 6px !important;
          font-family: 'JetBrains Mono', 'Courier New', monospace !important;
          font-size: 11px !important;
          border-left: 4px solid #0066cc !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
          max-width: 400px !important;
          overflow-x: auto !important;
          line-height: 1.4 !important;
          display: block !important;
        }
        
        .ayisha-log-error-display {
          background: rgba(255, 0, 0, 0.9) !important;
          color: white !important;
          padding: 8px 12px !important;
          margin: 4px 0 !important;
          border-radius: 6px !important;
          font-family: monospace !important;
          font-size: 11px !important;
          font-weight: bold !important;
          display: block !important;
        }
      `;
      document.head.appendChild(style);
    }
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      addDefaultAnimationStyles();
      new AyishaVDOM(document.body).mount();
    });
  } else {
    addDefaultAnimationStyles();
    new AyishaVDOM(document.body).mount();
  }

})();