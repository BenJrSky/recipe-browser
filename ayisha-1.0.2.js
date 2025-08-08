/*!
 * Ayisha.js - Complete Modular Directive System
 * (c) 2023 devBen - Benito Massidda
 * License: MIT
 */

(function () {
  if (window.AyishaVDOM) return;

  class AyishaErrorBus {
    constructor() {
      this.errors = [];
      this.listeners = [];
    }
    report(error, context = {}) {
      const errObj = {
        error,
        context,
        timestamp: Date.now()
      };
      this.errors.push(errObj);
      this.listeners.forEach(fn => {
        try { fn(errObj); } catch { }
      });
    }
    getAll() {
      return this.errors;
    }
    clear() {
      this.errors = [];
    }
    onError(fn) {
      this.listeners.push(fn);
    }
  }

  class DirectiveCompletionListener {
    constructor(vNode, ctx, ayishaInstance) {
      this.vNode = vNode;
      this.ctx = ctx;
      this.ayisha = ayishaInstance;
      this.total = 0;
      this.completed = 0;
      this.thenQueue = [];
      this.finallyQueue = [];
      this.done = false;
      this.syncCompleted = false;
    }

    addTask(promiseOrFn) {
      this.total++;
      Promise.resolve(typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn)
        .then(() => this._onComplete())
        .catch(() => this._onComplete());
    }

    addAsyncTask() {
      this.total++;
      return () => this._onComplete();
    }

    addThen(expr) {
      if (Array.isArray(expr)) {
        expr.forEach(e => this.thenQueue.push(e));
      } else if (typeof expr === 'string') {
        expr.split(/;;|\n/).map(s => s.trim()).filter(Boolean).forEach(e => this.thenQueue.push(e));
      } else {
        this.thenQueue.push(expr);
      }

      // NUOVO: Pre-inizializza le variabili target degli assignment
      this._preInitializeVariablesFromExpressions(expr);
    }

    addFinally(expr) {
      if (Array.isArray(expr)) {
        expr.forEach(e => this.finallyQueue.push(e));
      } else if (typeof expr === 'string') {
        expr.split(/;;|\n/).map(s => s.trim()).filter(Boolean).forEach(e => this.finallyQueue.push(e));
      } else {
        this.finallyQueue.push(expr);
      }

      // NUOVO: Pre-inizializza le variabili target degli assignment
      this._preInitializeVariablesFromExpressions(expr);
    }

    // NUOVO METODO: Estrae e pre-inizializza le variabili target degli assignment
    _preInitializeVariablesFromExpressions(expr) {
      if (!expr || !this.ayisha?.evaluator) return;

      let expressions = [];

      if (Array.isArray(expr)) {
        expressions = expr.flat().filter(Boolean);
      } else if (typeof expr === 'string') {
        expressions = expr.split(/;;|\n/).map(s => s.trim()).filter(Boolean);
      } else {
        expressions = [expr];
      }

      expressions.forEach(expression => {
        if (typeof expression !== 'string') return;

        // Estrai tutte le assegnazioni: variabile = valore
        const assignmentRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\s*=\s*[^=]/g;
        let match;

        while ((match = assignmentRegex.exec(expression)) !== null) {
          const fullVariablePath = match[1].trim();

          // Gestisci sia variabili semplici che nested (es: user.name)
          if (fullVariablePath.includes('.')) {
            // Per variabili nested come "user.name", inizializza l'oggetto root
            const rootVar = fullVariablePath.split('.')[0];
            this._ensureVariableInState(rootVar, 'object');

            // Crea la struttura nested se necessario
            this._ensureNestedPath(fullVariablePath);
          } else {
            // Per variabili semplici, prova a indovinare il tipo dal contesto
            this._ensureVariableInState(fullVariablePath, 'auto');
          }
        }
      });
    }

    // NUOVO: Helper per assicurarsi che una variabile esista nello state
    _ensureVariableInState(varName, type = 'auto') {
      if (!varName || !this.ayisha?.evaluator?.state) return;

      // Verifica che sia un nome di variabile valido
      if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(varName)) return;

      // Non sovrascrivere se esiste già
      if (varName in this.ayisha.evaluator.state) return;

      // Skip variabili globali JavaScript
      const jsGlobals = [
        'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Math', 'RegExp',
        'console', 'window', 'document', 'setTimeout', 'setInterval', 'fetch', 'localStorage',
        'sessionStorage', 'history', 'location', 'navigator', 'undefined', 'null', 'true', 'false'
      ];

      if (jsGlobals.includes(varName)) return;

      let initialValue;

      if (type === 'object') {
        initialValue = {};
      } else if (type === 'array') {
        initialValue = [];
      } else {
        if (/items|list|array|data|results|errors|posts|todos|users|cats|dogs|products|content/.test(varName)) {
          initialValue = [];
        } else if (/count|total|index|id|size|length|number|num|page|limit|offset/.test(varName)) {
          initialValue = 0;
        } else if (/show|hide|is|has|can|should|valid|enable|subscribed|loading|visible/.test(varName)) {
          initialValue = false;
        } else if (/user|config|form|settings|profile|metadata|info/.test(varName)) {
          initialValue = {};
        } else {
          initialValue = undefined;
        }
      }
      this.ayisha.evaluator.state[varName] = initialValue;
    }

    _ensureNestedPath(fullPath) {
      // Usa la utility centralizzata per la gestione dei path annidati
      if (!fullPath || !this.ayisha?.evaluator?.state) return;
      AyishaNestedUtil.setNested(this.ayisha.evaluator.state, fullPath, undefined);
    }

    _onComplete() {
      if (this.done) return; // Prevent further completions if already done
      this.completed++;
      if (this.completed > this.total) this.completed = this.total;
      this._checkCompletion();
    }

    markSyncDone() {
      this.syncCompleted = true;
      this._checkCompletion();
    }

    _checkCompletion() {
      if (this.done) return;
      if (this.completed >= this.total && this.syncCompleted) {
        this.done = true;
        this._executeThenAndFinally();
      }
    }

    _executeThenAndFinally() {
      if (this.thenQueue.length > 0) {
        setTimeout(() => {
          this.thenQueue.forEach(expr => {
            try {
              if (typeof expr === 'function') {
                expr();
              } else {
                if (this.ctx && typeof this.ctx._eventResult !== 'undefined') {
                  this.ayisha.evaluator.executeDirectiveExpression(expr, this.ctx, this.ctx._eventResult, true);
                } else {
                  this.ayisha.evaluator.executeDirectiveExpression(expr, this.ctx, null, true);
                }
              }
            } catch (e) {
              console.error('Error executing @then:', e, 'Expression:', expr);
            }
          });
          setTimeout(() => {
            if (this.finallyQueue.length > 0) {
              this.finallyQueue.forEach(expr => {
                try {
                  if (typeof expr === 'function') {
                    expr();
                  } else {
                    this.ayisha.evaluator.executeDirectiveExpression(expr, this.ctx, null, true);
                  }
                } catch (e) {
                  console.error('Error executing @finally:', e, 'Expression:', expr);
                }
              });
            }
          }, 1500);
        }, 1500);
      } else {
        setTimeout(() => {
          if (this.finallyQueue.length > 0) {
            this.finallyQueue.forEach(expr => {
              try {
                if (typeof expr === 'function') {
                  expr();
                } else {
                  this.ayisha.evaluator.executeDirectiveExpression(expr, this.ctx, null, true);
                }
              } catch (e) {
                console.error('Error executing @finally:', e, 'Expression:', expr);
              }
            });
          }
        }, 1500);
      }
    }
  }

  class ExpressionEvaluator {
    autoPageName(expr) {
      if (typeof expr === 'string' && expr.trim() && !expr.trim().startsWith("'") && !expr.trim().startsWith('"') && /^[a-zA-Z0-9_]+$/.test(expr.trim())) {
        return `'${expr.trim()}'`;
      }
      return expr;
    }

    extractDependencies(expr) {
      if (typeof expr !== 'string') return [];
      const matches = expr.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g);
      if (!matches) return [];
      const jsGlobals = [
        'true', 'false', 'null', 'undefined', 'if', 'else', 'for', 'while', 'switch', 'case', 'default', 'try', 'catch', 'finally', 'return', 'var', 'let', 'const', 'function', 'new', 'typeof', 'instanceof', 'in', 'do', 'break', 'continue', 'this', 'window', 'document', 'Math', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'JSON', 'console', 'setTimeout', 'setInterval', 'fetch', 'localStorage', 'sessionStorage', 'history', 'location', 'navigator'
      ];
      return matches.filter((v, i, arr) => arr.indexOf(v) === i && !jsGlobals.includes(v));
    }
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

    executeMultipleExpressions(expr, ctx = {}, event) {
      const trimmed = expr.trim();

      if (!this.hasMultipleAssignments(trimmed)) {
        return false;
      }

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

    executeDirectiveExpression(expr, ctx = {}, event = null, triggerRender = true) {
      let codeToRun = expr;

      if (this.hasInterpolation(expr)) {
        codeToRun = this.evalAttrValue(expr, ctx);
      }

      const processedCode = codeToRun.replace(/\bstate\./g, '');

      try {
        if (this.executeMultipleExpressions(processedCode, ctx, event)) {
          if (triggerRender) {
            setTimeout(() => window.ayisha && window.ayisha.render(), 0);
          }
          return true;
        }

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

    hasMultipleAssignments(expr) {
      if (expr.includes('=>')) {
        return false;
      }

      if (expr.includes('(') && expr.includes(')')) {
        const result = expr.includes(';');
        return result;
      }

      if (expr.includes(';')) {
        return true;
      }

      if (expr.includes(',') && !expr.includes('(')) {
        return true;
      }

      const spacePattern = /\w+\s*=\s*[^=\s]+\s+\w+\s*=\s*/;
      const spaceResult = spacePattern.test(expr);
      return spaceResult;
    }

    parseMultipleExpressions(expr) {
      if (expr.includes(';')) {
        return expr.split(';').map(e => e.trim()).filter(e => e);
      }

      if (expr.includes(',') && !expr.includes('(')) {
        return expr.split(',').map(e => e.trim()).filter(e => e);
      }

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
          const remaining = expr.substring(i + 1).trim();
          if (remaining.match(/^\w+\s*=/) && currentExpr.trim().includes('=')) {
            expressions.push(currentExpr.trim());
            currentExpr = '';
          } else {
            currentExpr += char;
          }
        } else {
          currentExpr += char;
        }
        i++;
      }

      if (currentExpr.trim()) {
        expressions.push(currentExpr.trim());
      }

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

      // Reject expressions that contain operators or invalid characters
      if (expr.includes('=') || expr.includes('<') || expr.includes('>') ||
        expr.includes('!') || expr.includes('&') || expr.includes('|') ||
        expr.includes("'") || expr.includes('"') || expr.includes('(') ||
        expr.includes(')') || expr.includes(' ') || expr.includes('+') ||
        expr.includes('-') || expr.includes('*') || expr.includes('/') ||
        expr.includes('%') || expr.includes('[') || expr.includes(']') ||
        expr.includes('{') || expr.includes('}') || expr.includes('?') ||
        expr.includes(':') || expr.includes(';') || expr.includes(',')) {
        return; // Don't create variables for complex expressions
      }

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

      // Additional check: only allow valid JavaScript identifier names
      if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(varName)) {
        return; // Don't create variables with invalid names
      }

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

        // Additional check for dot notation
        if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(rootVar)) {
          return;
        }

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

      if (tag === 'no') {
        return {
          tag: 'no',
          attrs: {},
          directives: {},
          subDirectives: {},
          children: [],
          rawContent: node.innerHTML
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

  class ComponentManager {
    constructor() {
      this.components = {};
      this.cache = {};
      this.loadingComponents = new Map();
    }

    component(name, html) {
      this.components[name] = html;
    }

    async loadExternalComponent(url) {
      if (this.cache[url]) {
        return this.cache[url];
      }

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

    async _fetchComponent(url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const html = await response.text();
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
  }

  class ReactivitySystem {

    constructor(state, renderCallback) {
      this.state = state;
      this.watchers = {};
      this._prevValues = {};
      this._historyValues = {};
      this._watcherOneShotFired = {};
      this._watcherTypes = {};
      this.renderCallback = renderCallback;
      this.watchersReady = false;
      this._isUpdating = false;
      this._renderTimeout = null;
    }

    _safeStringify(obj) {
      const seen = new WeakSet();
      try {
        return JSON.stringify(obj, function (key, value) {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
          }
          if (key === '_ayishaInstance') return '[AyishaInstance]';
          return value;
        });
      } catch (e) {
        return String(obj);
      }
    }

    makeReactive() {
      Object.defineProperty(this.state, '_historyValues', {
        value: this._historyValues,
        enumerable: false,
        writable: true,
        configurable: true
      });
      Object.defineProperty(this.state, '_ayishaReactivity', {
        value: this,
        enumerable: false,
        writable: true,
        configurable: true
      });
      Object.defineProperty(this.state, '_prevValues', {
        value: this._prevValues,
        enumerable: false,
        writable: true,
        configurable: true
      });

      // Helper to wrap array mutating methods
      const renderCallback = this.renderCallback;
      const wrapArray = (arr, prop) => {
        if (!Array.isArray(arr) || arr._ayishaWrapped) return arr;
        const mutatingMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];
        mutatingMethods.forEach(method => {
          if (typeof arr[method] === 'function') {
            const original = arr[method];
            arr[method] = function(...args) {
              const result = original.apply(this, args);
              if (typeof renderCallback === 'function') renderCallback();
              return result;
            };
          }
        });
        Object.defineProperty(arr, '_ayishaWrapped', {
          value: true,
          enumerable: false,
          writable: false,
          configurable: false
        });
        return arr;
      };

      this.state = new Proxy(this.state, {
        set: (obj, prop, val) => {
          if (Array.isArray(val)) {
            val = wrapArray(val, prop);
          }
          if (this._isUpdating) {
            obj[prop] = val;
            return true;
          }

          // --- Track previous value in a parallel state ---
          if (!obj._prevValues) obj._prevValues = {};
          obj._prevValues[prop] = obj[prop];

          // --- Track history (optional, legacy) ---
          if (!this._historyValues[prop]) this._historyValues[prop] = [];
          if (Object.prototype.hasOwnProperty.call(obj, prop)) {
            this._historyValues[prop].push(obj[prop]);
            if (this._historyValues[prop].length > 20) this._historyValues[prop].shift();
          }

          const old = obj[prop];
          if (this._safeStringify(old) === this._safeStringify(val)) {
            obj[prop] = val;
            return true;
          }

          this._isUpdating = true;
          obj[prop] = val;

          if (this.watchersReady && this.watchers[prop]) {
            // Check watcher type: oneShot or reactive
            if (this._watcherTypes[prop] === 'oneShot') {
              if (!this._watcherOneShotFired[prop]) {
                this._watcherOneShotFired[prop] = true;
                this._prevValues[prop] = val;
                this.watchers[prop].forEach(fn => {
                  try {
                    fn(val);
                  } catch (error) {
                    console.error('Watcher execution error:', error, 'for property:', prop);
                  }
                });
              }
            } else {
              // reactive: trigger on every change
              if (this._safeStringify(this._prevValues[prop]) !== this._safeStringify(val)) {
                this._prevValues[prop] = val;
                this.watchers[prop].forEach(fn => {
                  try {
                    fn(val);
                  } catch (error) {
                    console.error('Watcher execution error:', error, 'for property:', prop);
                  }
                });
              }
            }
          }

          if (this._renderTimeout) {
            clearTimeout(this._renderTimeout);
          }

          this._renderTimeout = setTimeout(() => {
            this._isUpdating = false;
            this._renderTimeout = null;
            this.renderCallback();
          }, 10);

          return true;
        },
        get: (obj, prop) => {
          const value = obj[prop];
          if (Array.isArray(value)) {
            return wrapArray(value, prop);
          }
          return value;
        }
      });
      return this.state;
    }

    /**
     * Add a watcher for a property.
     * @param {string} prop - property to watch
     * @param {function} fn - callback
     * @param {object} options - { oneShot: true } for one-shot watcher (default for @watch/@do)
     */
    addWatcher(prop, fn, options = {}) {
      this.watchers[prop] = this.watchers[prop] || [];
      if (!(prop in this._prevValues)) {
        this._prevValues[prop] = this.state[prop];
      }
      // NEW: set watcher type
      if (options.oneShot) {
        this._watcherTypes[prop] = 'oneShot';
        this._watcherOneShotFired[prop] = false;
      } else {
        this._watcherTypes[prop] = 'reactive';
      }
      this.watchers[prop].push(fn);
    }

    enableWatchers() {
      this.watchersReady = true;
      // reset all one-shot flags on enable (e.g. on remount)
      Object.keys(this._watcherOneShotFired).forEach(k => {
        this._watcherOneShotFired[k] = false;
      });
    }
  }

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
        const newPath = location.pathname.replace(/^\//, '') || '';
        this.state._currentPage = newPath;
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
            const url = v ? '/' + v : '/';
            history.pushState({}, '', url);
            self.renderCallback();
          }
        }
      });
    }

    // Nuovo metodo per navigare programmaticamente
    navigate(path) {
      if (path.startsWith('/')) {
        this.state._currentPage = path.substring(1);
      } else {
        this.state._currentPage = path;
      }
    }
  }

  class FetchManager {
    constructor(evaluator) {
      this.evaluator = evaluator;
      this.pendingFetches = {};
      this.lastFetchUrl = {};
      this.fetched = {};
      this.readyPromise = {};
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
      if (!url) return Promise.resolve(undefined);

      // FIX: Se l'URL è assoluto (http/https), non modificarlo
      if (!/^https?:\/\//.test(url)) {
        url = url.replace(/\/+$/, ''); // rimuove slash finale
        url = url.replace(/\?$/, ''); // rimuove ? finale
        url = url.replace(/\?&/, '?'); // rimuove & subito dopo ?
        url = url.replace(/\?$/, ''); // rimuove ? finale ancora
        url = url.replace(/\&+$/, ''); // rimuove & finale
        url = url.replace(/\?page=(&|$)/, '?').replace(/\?$/, ''); // rimuove page vuoto
        url = url.replace(/\/\//g, '/'); // rimuove doppio slash
        // Se l'URL non inizia con "/", aggiungi la base
        if (!url.startsWith('/')) {
          url = '/' + url;
        }
        url = location.origin + url;
      }

      const fid = `${url}::${rk}`;


      if (!force && !event && this.lastFetchUrl[fid]) {
        if (!this.readyPromise[fid]) {
          this.readyPromise[fid] = Promise.resolve(this.evaluator.state[rk]);
          return this.readyPromise[fid];
        }
        return;
      }

      if (!force && this.lastFetchUrl[fid] && JSON.stringify(this.lastFetchUrl[fid]) === JSON.stringify({ url, value: this.evaluator.state[rk] })) {
        if (!this.readyPromise[fid]) {
          this.readyPromise[fid] = Promise.resolve(this.evaluator.state[rk]);
          return this.readyPromise[fid];
        }
        return;
      }

      if (this.pendingFetches[fid]) return Promise.resolve(this.evaluator.state[rk]);

      if (rk && typeof rk === 'string' && rk in this.evaluator.state) {
        this.evaluator.state[rk] = null;
      }

      if (this.readyPromise[fid]) delete this.readyPromise[fid];

      this.pendingFetches[fid] = true;
      this.lastFetchUrl[fid] = { url, value: this.evaluator.state[rk] };

      this.pendingFetches[fid] = true;
      this.lastFetchUrl[rk] = url;

      if (!(rk in this.evaluator.state)) {
        this.evaluator.state[rk] = null;
      }

      let method = 'GET';
      let payload = null;
      let customHeaders = null;
      if (ctx && ctx._vNode) {
        let m = null;
        if (ctx._vNode.directives && ctx._vNode.directives['@method']) {
          m = ctx._vNode.directives['@method'];
        } else if (ctx._vNode.subDirectives && ctx._vNode.subDirectives['@method']) {
          m = ctx._vNode.subDirectives['@method'];
        }
        if (m) {
          let evalM = this.evaluator.evalExpr(m, ctx, event);
          if (typeof evalM === 'string' && evalM.trim() !== '') {
            method = evalM.toUpperCase();
          } else if (typeof m === 'string' && m.trim() !== '') {
            method = m.trim().toUpperCase();
          } else {
            method = 'GET';
          }
        }
        // PATCH: payload anche per PUT/PATCH/DELETE oltre che POST
        if (ctx._vNode.directives && ctx._vNode.directives['@payload']) {
          payload = this.evaluator.evalExpr(ctx._vNode.directives['@payload'], ctx, event);
        }
        if (ctx._vNode.directives && ctx._vNode.directives['@headers']) {
          customHeaders = this.evaluator.evalExpr(ctx._vNode.directives['@headers'], ctx, event);
        }
      }

      const fetchOptions = { method };
      let headers = {};
      // PATCH: payload per tutti i metodi diversi da GET/HEAD
      if (payload != null && method && !['GET', 'HEAD'].includes(method.toUpperCase())) {
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

      const fetchPromise = fetch(url, fetchOptions)
        .then(res => {
          if (!res.ok) {
            if (!this.fetched[url]) this.fetched[url] = {};
            this.fetched[url].error = `${res.status} ${res.statusText || 'errore di rete'}`;
            let errorVar = '_error';
            if (ctx && ctx._vNode && ctx._vNode.directives && ctx._vNode.directives['@error']) {
              errorVar = ctx._vNode.directives['@error'] || '_error';
            }
            return res.text().then(errorBody => {
              let parsedError;
              try {
                parsedError = JSON.parse(errorBody);
              } catch (e) {
                parsedError = errorBody || `${res.status} ${res.statusText || 'errore di rete'}`;
              }
              // Always set _error and custom errorVar, and also window._error for debugging
              const errorObj = {
                error: parsedError && parsedError.error ? parsedError.error : `${res.status} ${res.statusText}`,
                details: parsedError && parsedError.details ? parsedError.details : parsedError
              };
              this.evaluator.state['_error'] = errorObj;
              window._error = errorObj;
              if (errorVar !== '_error') {
                this.evaluator.state[errorVar] = errorObj;
                window[errorVar] = errorObj;
              }
              throw new Error(`${res.status} ${res.statusText}`);
            });
          }
          return res.json().catch(() => res.text());
        })
        .then(data => {
          const oldVal = this.evaluator.state[rk];
          const isEqual = JSON.stringify(oldVal) === JSON.stringify(data);
          if (!isEqual) {
            this.evaluator.state[rk] = data;
          }
          if (this.fetched[url]) delete this.fetched[url].error;
          // Always clear both _error and custom errorVar
          this.evaluator.state['_error'] = null;
          let errorVar = '_error';
          if (ctx && ctx._vNode && ctx._vNode.directives && ctx._vNode.directives['@error']) {
            errorVar = ctx._vNode.directives['@error'] || '_error';
          }
          if (errorVar !== '_error') {
            this.evaluator.state[errorVar] = null;
          }
          return data;
        })
        .catch(err => {
          console.error('🌐 Fetch error:', { url, error: err.message, resultVariable: rk });
          if (!this.fetched[url]) this.fetched[url] = {};
          this.fetched[url].error = err.message;
          let errorVar = '_error';
          if (ctx && ctx._vNode && ctx._vNode.directives && ctx._vNode.directives['@error']) {
            errorVar = ctx._vNode.directives['@error'] || '_error';
          }
          // Always set _error as well as custom errorVar
          this.evaluator.state['_error'] = {
            error: err && err.message ? err.message : (err || 'Errore sconosciuto'),
            details: err && err.stack ? err.stack : undefined
          };
          if (errorVar !== '_error') {
            this.evaluator.state[errorVar] = this.evaluator.state['_error'];
          }
          console.error('@fetch error:', err);
        })
        .finally(() => {
          this.pendingFetches[fid] = false;
        });

      return fetchPromise;
    }


  }

  class DirectiveHelpSystem {
    constructor() {
      this.helpTexts = {
        '@error': `Esempio: <div @fetch=\"url\" @error=\"myErrorVar\"></div> (variabile dove viene salvato l'errore della fetch, di default _error)`,
        '@when': `Esempio: <span @when=\"condizione\" @do=\"azione\"></span> oppure <span @when=\"condizione\" @go=\"pagina\"></span>`,
        '@do': `Esempio: <span @when=\"condizione\" @do=\"azione\"></span>`,
        '@go': `Esempio: <span @when=\"condizione\" @go=\"pagina\"></span>`,
        '@wait': `Esempio: <span @when=\"condizione\" @wait=\"1000\" @go=\"pagina\"></span>`,
        '@if': `Esempio: <div @if=\"condizione\">Mostra se condizione è true</div>`,
        '@not': `Esempio: <div @not=\"condizione\">Mostra se condizione è false</div>`,
        '@show': `Esempio: <div @show=\"condizione\">Mostra se condizione è true</div>`,
        '@hide': `Esempio: <div @hide=\"condizione\">Nasconde se condizione è true</div>`,
        '@for': `Esempio: <li @for="item in items">{{item}}</li> o <li @for="i, item in items">{{i}}: {{item}}</li>`,
        '@model': `Esempio: <input @model="nome">`,
        '@file': `Esempio: <input type="file" @file="pic"> (salva il file caricato come base64 nella variabile pic)`,
        '@files': `Esempio: <input type="file" multiple @files="gallery"> (salva tutti i file caricati come base64 in un array nella variabile gallery, aggiungendo se già presenti)`,
        '@click': `Esempio: <button @click="state.count++">Aumenta</button>`,
        '@fetch': `Esempio: <div @fetch="'url'" @method="'POST'" @payload="{foo:1}" @headers="{ Authorization: 'Bearer ...' }"></div>`,
        '@method': `Esempio: <div @fetch="'url'" @method="'POST'"></div>`,
        '@payload': `Esempio: <div @fetch="'url'" @method="'POST'" @payload="{foo:1}"></div>`,
        '@headers': `Esempio: <div @fetch="'url'" @headers="{ Authorization: 'Bearer ...' }"></div>`,
        '@result': `Esempio: <div @fetch="'url'" @result="data">Carica</div>`,
        '@watch': `Esempio: <div @watch="user"></div>`,
        '@text': `Esempio: <span @text="nome"></span>`,
        '@date': `Esempio: <li @date="data"></li> (formatta una data ISO come "1 agosto 2025, 08:37")`,
        '@dateonly': `Esempio: <li @dateonly="data"></li> (mostra solo giorno, mese e anno)`,
        '@time': `Esempio: <li @time="data"></li> (mostra solo ora e minuti)`,
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
        '@prev': `Esempio: <div @prev></div> (mostra valore attuale e precedente dello state)\n<div @prev="foo"></div> (solo per foo)`,
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

  class ErrorHandler {
    constructor(errorBus) {
      this.errorBus = errorBus;
    }

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
      if (this.errorBus) {
        this.errorBus.report(err, { expr, el });
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
      if (this.errorBus) {
        this.errorBus.report(new Error(message), { type: 'createErrorElement', message });
      }
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

  class BindingManager {
    constructor(evaluator, renderCallback) {
      this.evaluator = evaluator;
      this.renderCallback = renderCallback;
      this.modelBindings = [];
    }

    // Utility for setting nested values (used for validation)
    static setNestedValidate(obj, path, value) {
      const keys = path.split('.');
      let current = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        if (typeof current[keys[i]] !== 'object' || current[keys[i]] === null) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
    }

    bindModel(el, key, ctx) {
      // ...existing code...
      let inputTypeForInit = null;
      if (el.type === 'number') {
        inputTypeForInit = 'number';
      } else if (el.type === 'checkbox') {
        inputTypeForInit = 'checkbox';
      }

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
          // Gestione checkbox: true/false
          el.checked = !!val;
        } else if (el.type === 'radio') {
          // Gestione radio: checked se valore === value
          el.checked = val === el.value || val === true && el.value === 'true' || val === false && el.value === 'false';
        } else if (el.type === 'color') {
          if (val && typeof val === 'string' && val.match(/^#[0-9A-Fa-f]{6}$/)) {
            el.value = val;
          } else if (val && typeof val === 'string' && val.match(/^[0-9A-Fa-f]{6}$/)) {
            el.value = '#' + val;
          } else {
            el.value = '#000000';
          }
        } else {
          const safeVal = val == null ? '' : String(val);
          if (el.value !== safeVal) el.value = safeVal;
        }
      };

      this.modelBindings.push({ el, update });
      update();

      const handleInput = () => {
        let inputTypeForInit = null;
        if (el.type === 'number') {
          inputTypeForInit = 'number';
        } else if (el.type === 'checkbox') {
          inputTypeForInit = 'checkbox';
        }

        const { root, path } = getRootAndPath(key, ctx, this.evaluator.state);
        let ref = root;
        let value;

        if (el.type === 'checkbox') {
          // Gestione checkbox: true/false
          value = el.checked;
        } else if (el.type === 'radio') {
          // Gestione radio: "true"/"false"/string
          if (el.value === 'true') value = true;
          else if (el.value === 'false') value = false;
          else value = el.value;
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
        } else {
          this.evaluator.state[key] = value;
        }
        this.renderCallback();
      };

      if (el.type === 'checkbox' || el.type === 'radio') {
        el.addEventListener('change', handleInput);
      } else {
        el.addEventListener('input', handleInput);
      }
    }

    bindValidation(el, rulesStr, modelVar = null) {
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
      for (let i = 0; i < rules.length; i++) {
        if (rules[i].includes('=')) {
          rules[i] = rules[i].replace('=', ':');
        }
      }

      if (currentRule.trim()) {
        rules.push(currentRule.trim());
      }

      if (!modelVar) {
        return;
      }

      if (!this.evaluator.state._validate) {
        this.evaluator.state._validate = {};
      }

      // Inizializza a null invece che false
      BindingManager.setNestedValidate(this.evaluator.state._validate, modelVar, null);
      const keys = modelVar.split('.');
      let current = this.evaluator.state._validate;
      for (let i = 0; i < keys.length - 1; i++) {
        if (typeof current[keys[i]] !== 'object' || current[keys[i]] === null) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      if (this.evaluator.state._validate.hasOwnProperty(modelVar)) {
        delete this.evaluator.state._validate[modelVar];
      }

      const validate = () => {
        // Se il campo è vuoto, la validazione è null
        if (el.value === '' || el.value == null) {
          BindingManager.setNestedValidate(this.evaluator.state._validate, modelVar, null);
          el.classList.remove('invalid');
          el.classList.remove('valid');
          return null;
        }

        let valid = true;

        for (const rule of rules) {
          if (/^\^.*\$$/.test(rule)) {
            try {
              const re = new RegExp(rule);
              const testResult = re.test(el.value || '');
              if (!testResult) {
                valid = false;
                break;
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
          else if (rule.startsWith('minLength:') || rule.startsWith('minLength=')) {
            const minLen = parseInt(rule.split(/:|=/)[1], 10);
            if (el.value.length < minLen) {
              valid = false;
              break;
            }
          }
          else if (rule.startsWith('maxLength:') || rule.startsWith('maxLength=')) {
            const maxLen = parseInt(rule.split(/:|=/)[1], 10);
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
            const phoneRegex = /^\+\d{1,3}\s?\d{3,4}\s?\d{3,4}\s?\d{3,4}$/;
            if (!phoneRegex.test(el.value || '')) {
              valid = false;
              break;
            }
          }
          else if (rule === 'password') {
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            if (!passwordRegex.test(el.value || '')) {
              valid = false;
              break;
            }
          }
          else if (rule.startsWith('regex:')) {
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

        BindingManager.setNestedValidate(this.evaluator.state._validate, modelVar, valid);
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


  // Base Directive Class
  class Directive {
    constructor(evaluator, bindingManager, errorHandler) {
      this.evaluator = evaluator;
      this.bindingManager = bindingManager;
      this.errorHandler = errorHandler;
    }

    apply(vNode, ctx, state, el, completionListener = null) {
      // To be implemented by subclasses
    }

    handleSubDirective(vNode, ctx, state, el, event, expression, completionListener = null) {
      // Default implementation - può essere sovrascritto
      return false;
    }

    executeExpression(expression, ctx, event = null, triggerRender = true) {
      return this.evaluator.executeDirectiveExpression(expression, ctx, event, triggerRender);
    }

    evalExpr(expression, ctx) {
      return this.evaluator.evalExpr(expression, ctx);
    }

    showError(el, error, expression) {
      this.errorHandler.showAyishaError(el, error, expression);
    }
  }

  // All Directive Classes
  // @date Directive: formats ISO date strings to human readable
  class DateDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      let value = this.evaluator.evalExpr(vNode.directives['@date'], ctx);
      let formatted = this.formatDate(value);
      el.innerText = formatted;
      if (completionListener) completionListener.markSyncDone();
    }

    formatDate(value) {
      if (!value) return '';
      let date;
      if (typeof value === 'string') {
        date = new Date(value);
      } else if (value instanceof Date) {
        date = value;
      } else {
        return String(value);
      }
      if (isNaN(date.getTime())) return String(value);
      const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      return date.toLocaleString(navigator.language || navigator.userLanguage || 'it-IT', options);
    }
  }

  // @dateonly Directive: formats ISO date strings to day/month/year
  class DateOnlyDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      let value = this.evaluator.evalExpr(vNode.directives['@dateonly'], ctx);
      let formatted = this.formatDateOnly(value);
      el.innerText = formatted;
      if (completionListener) completionListener.markSyncDone();
    }

    formatDateOnly(value) {
      if (!value) return '';
      let date;
      if (typeof value === 'string') {
        date = new Date(value);
      } else if (value instanceof Date) {
        date = value;
      } else {
        return String(value);
      }
      if (isNaN(date.getTime())) return String(value);
      return date.toLocaleDateString(navigator.language || navigator.userLanguage || 'it-IT');
    }
  }

  class TimeDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      let value = this.evaluator.evalExpr(vNode.directives['@time'], ctx);
      let formatted = this.formatTime(value);
      el.innerText = formatted;
      if (completionListener) completionListener.markSyncDone();
    }

    formatTime(value) {
      if (!value) return '';
      let date;
      if (typeof value === 'string') {
        date = new Date(value);
      } else if (value instanceof Date) {
        date = value;
      } else {
        return String(value);
      }
      if (isNaN(date.getTime())) return String(value);
      return date.toLocaleTimeString(navigator.language || navigator.userLanguage || 'it-IT', { hour: '2-digit', minute: '2-digit' });
    }
  }
  class IfDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@if'];
      let visible = false;
      try {
        visible = this.evaluator.evalExpr(expr, ctx);
      } catch { }
      if (el) el.style.display = visible ? '' : 'none';

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  // NOT Directive: renders node only if expression is falsy
  class NotDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@not'];
      let visible = false;
      try {
        visible = !this.evaluator.evalExpr(expr, ctx);
      } catch { }
      if (el) el.style.display = visible ? '' : 'none';

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class ForDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
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
          const node = state._ayishaInstance._renderVNode(clone, subCtx);
          if (node) {
            state._ayishaInstance.directiveManager.applyDirectives(clone, subCtx, state, node, completionListener);
            frag.appendChild(node);
          }
        });

        if (completionListener) {
          completionListener.addTask(() => Promise.resolve());
        }
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
          if (isFiltered && state[originalArrayName]) {
            originalIndex = state[originalArrayName].findIndex(item =>
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
          const node = state._ayishaInstance._renderVNode(clone, subCtx);
          if (node) {
            state._ayishaInstance.directiveManager.applyDirectives(clone, subCtx, state, node, completionListener);
            frag.appendChild(node);
          }
        });

        if (completionListener) {
          completionListener.addTask(() => Promise.resolve());
        }
        return frag;
      }
      return null;
    }
  }

  class ModelDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const key = vNode.directives['@model'];
      if (!key) return;
      this.bindingManager.bindModel(el, key, ctx);

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }

    handleSubDirective(vNode, ctx, state, el, event, expression, completionListener = null) {
      if (['input', 'change', 'focus', 'blur'].includes(event)) {
        this.bindingManager.bindModel(el, expression, ctx);

        if (completionListener) {
          const done = completionListener.addAsyncTask();
          el.addEventListener(event, () => {
            if (done) done();
          });
        }
        return true;
      }
      return false;
    }
  }
  // Utility class for nested object/array path operations
  class AyishaNestedUtil {
    static setNested(obj, path, value) {
      const keys = path.split('.');
      let ref = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        const arrMatch = keys[i].match(/(\w+)\[(\d+)\]/);
        if (arrMatch) {
          const arrKey = arrMatch[1];
          const arrIdx = parseInt(arrMatch[2], 10);
          if (!Array.isArray(ref[arrKey])) ref[arrKey] = [];
          if (!ref[arrKey][arrIdx]) ref[arrKey][arrIdx] = {};
          ref = ref[arrKey][arrIdx];
        } else {
          if (typeof ref[keys[i]] !== 'object' || ref[keys[i]] === null) ref[keys[i]] = {};
          ref = ref[keys[i]];
        }
      }
      const last = keys[keys.length - 1];
      const arrMatch = last.match(/(\w+)\[(\d+)\]/);
      if (arrMatch) {
        const arrKey = arrMatch[1];
        const arrIdx = parseInt(arrMatch[2], 10);
        if (!Array.isArray(ref[arrKey])) ref[arrKey] = [];
        ref[arrKey][arrIdx] = value;
      } else {
        ref[last] = value;
      }
    }
    static getNested(obj, path) {
      const keys = path.split('.');
      let ref = obj;
      for (let i = 0; i < keys.length; i++) {
        const arrMatch = keys[i].match(/(\w+)\[(\d+)\]/);
        if (arrMatch) {
          const arrKey = arrMatch[1];
          const arrIdx = parseInt(arrMatch[2], 10);
          if (!Array.isArray(ref[arrKey])) return undefined;
          ref = ref[arrKey][arrIdx];
        } else {
          if (typeof ref !== 'object' || ref === null) return undefined;
          ref = ref[keys[i]];
        }
      }
      return ref;
    }
  }

  class FileDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const key = vNode.directives['@file'];
      if (!key) return;
      if (el.tagName === 'INPUT' && el.type === 'file') {
        el.addEventListener('change', (e) => {
          const file = el.files && el.files[0];
          if (!file) {
            AyishaNestedUtil.setNested(state, key, null);
            if (completionListener) completionListener.addTask(() => Promise.resolve());
            return;
          }
          const reader = new FileReader();
          reader.onload = function (evt) {
            AyishaNestedUtil.setNested(state, key, evt.target.result);
            if (completionListener) completionListener.addTask(() => Promise.resolve());
          };
          reader.readAsDataURL(file);
        });
      }
    }
    handleSubDirective() { return false; }
  }

  class FilesDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const key = vNode.directives['@files'];
      if (!key) return;
      if (el.tagName === 'INPUT' && el.type === 'file') {
        el.addEventListener('change', (e) => {
          const files = el.files;
          if (!files || files.length === 0) {
            AyishaNestedUtil.setNested(state, key, []);
            if (completionListener) completionListener.addTask(() => Promise.resolve());
            return;
          }
          let loaded = 0;
          const base64Array = [];
          for (let i = 0; i < files.length; i++) {
            const reader = new FileReader();
            reader.onload = function (evt) {
              base64Array[i] = evt.target.result;
              loaded++;
              if (loaded === files.length) {
                const lastKey = key.split('.').pop();
                const arrMatch = lastKey.match(/\[(\d+)\]$/);
                if (arrMatch) {
                  AyishaNestedUtil.setNested(state, key, base64Array[0] || null);
                } else {
                  AyishaNestedUtil.setNested(state, key, base64Array);
                }
                if (completionListener) completionListener.addTask(() => Promise.resolve());
              }
            };
            reader.readAsDataURL(files[i]);
          }
        });
      }
    }
    handleSubDirective() { return false; }
  }
  class ShowDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@show'];
      let visible = false;
      try {
        visible = this.evaluator.evalExpr(expr, ctx);
      } catch { }
      if (el) el.style.display = visible ? '' : 'none';

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }
  class HideDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@hide'];
      let hidden = false;
      try {
        hidden = this.evaluator.evalExpr(expr, ctx);
      } catch { }
      if (el) el.style.display = hidden ? 'none' : '';

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class TextDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@text'];
      if (!expr || vNode.subDirectives?.['@text']) return;

      try {
        const isMultiple = this.evaluator.hasMultipleAssignments(expr);

        if (isMultiple) {
          this.executeExpression(expr, ctx, null, false);
        } else {
          const textValue = this.evalExpr(expr, ctx);
          el.textContent = this.formatTextValue(textValue);
        }

        if (completionListener) {
          completionListener.addTask(() => Promise.resolve());
        }
      } catch (error) {
        console.error('Error in @text directive:', error);
        el.textContent = `[Error: ${error.message}]`;
      }
    }

    formatTextValue(value) {
      if (value === undefined) return '';
      if (value === null) return 'null';
      return String(value);
    }

    handleSubDirective(vNode, ctx, state, el, event, expression, completionListener = null) {
      // CRITICAL: Save original text BEFORE any modifications
      if (!el._ayishaOriginalText) {
        // Get the text content from the original vNode children if available
        if (vNode.children && vNode.children.length > 0) {
          el._ayishaOriginalText = vNode.children
            .filter(child => child.type === 'text')
            .map(child => child.text)
            .join('');
        } else {
          el._ayishaOriginalText = el.textContent || el.innerText || '';
        }
      }

      switch (event) {
        case 'click':
          const done = completionListener ? completionListener.addAsyncTask() : null;
          el.addEventListener('click', (e) => {
            const newText = this.evalExpr(expression, ctx, e);
            el.textContent = this.formatTextValue(newText);
            if (done) done();
          });
          return true;

        case 'hover':
          el.addEventListener('mouseover', (e) => {
            const newText = this.evalExpr(expression, ctx, e);
            el.textContent = this.formatTextValue(newText);
          });
          el.addEventListener('mouseout', () => {
            el.textContent = el._ayishaOriginalText;
          });
          return true;

        case 'input':
        case 'focus':
        case 'blur':
          const asyncDone = completionListener ? completionListener.addAsyncTask() : null;
          el.addEventListener(event, (e) => {
            const newText = this.evalExpr(expression, ctx, e);
            el.textContent = this.formatTextValue(newText);
            if (asyncDone) asyncDone();
          });
          return true;

        default:
          return false;
      }
    }
  }
  class ClassDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@class'];
      if (!expr || vNode.subDirectives?.['@class']) return;

      let clsMap = {};
      try {
        let result = this.evalExpr(expr, ctx);
        if (typeof result === 'string') {
          let str = result.trim();
          // Remove outer quotes if present
          if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
            str = str.slice(1, -1);
          }
          // If looks like an object: {key:val,...}
          if (str.startsWith('{') && str.endsWith('}')) {
            str = str.slice(1, -1);
            // Split by comma, handle quoted and unquoted keys
            str.split(',').forEach(pair => {
              let [key, val] = pair.split(':');
              if (key && val !== undefined) {
                key = key.trim().replace(/^['"]|['"]$/g, '');
                try {
                  // Try to eval val as JS
                  val = this.evaluator.evalExpr(val.trim(), ctx);
                } catch {
                  val = !!val.trim();
                }
                clsMap[key] = !!val;
              }
            });
          } else {
            // fallback: treat as single class name
            clsMap = { [str]: true };
          }
        } else if (typeof result === 'object' && result !== null) {
          clsMap = result;
        }
      } catch (error) {
        console.error('Error in @class directive:', error);
        clsMap = {};
      }

      Object.keys(clsMap).forEach(cls => {
        el.classList.remove(cls);
      });
      Object.entries(clsMap).forEach(([cls, cond]) => {
        el.classList.toggle(cls, !!cond);
      });
      // Force update of class attribute
      el.setAttribute('class', el.className);

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }

    handleSubDirective(vNode, ctx, state, el, event, expression, completionListener = null) {
      const getClassMap = () => {
        try {
          return this.evalExpr(expression, ctx) || {};
        } catch (error) {
          console.error('Error evaluating class expression:', error);
          return {};
        }
      };

      switch (event) {
        case 'hover':
          el.addEventListener('mouseover', () => {
            const clsMap = getClassMap();
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.add(cls);
            });
          });
          el.addEventListener('mouseout', () => {
            const clsMap = getClassMap();
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.remove(cls);
            });
          });
          return true;

        case 'focus':
          el.addEventListener('focus', () => {
            const clsMap = getClassMap();
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.add(cls);
            });
          });
          el.addEventListener('blur', () => {
            const clsMap = getClassMap();
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.remove(cls);
            });
          });
          return true;

        case 'click':
          const done = completionListener ? completionListener.addAsyncTask() : null;
          el.addEventListener('click', () => {
            const clsMap = getClassMap();
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.toggle(cls);
            });
            if (done) done();
          });
          return true;

        case 'input':
          const asyncDone = completionListener ? completionListener.addAsyncTask() : null;
          el.addEventListener('input', () => {
            const clsMap = getClassMap();
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.add(cls);
            });
            if (asyncDone) asyncDone();
          });
          el.addEventListener('blur', () => {
            const clsMap = getClassMap();
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.remove(cls);
            });
          });
          return true;

        default:
          return false;
      }
    }
  }

  class StyleDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@style'];
      if (!expr) return;

      try {
        const styles = this.evalExpr(expr, ctx) || {};
        if (typeof styles === 'object' && styles !== null && !Array.isArray(styles)) {
          Object.entries(styles).forEach(([prop, val]) => {
            if (typeof prop === 'string' && prop.trim()) {
              el.style[prop] = val;
            }
          });
        }

        if (completionListener) {
          completionListener.addTask(() => Promise.resolve());
        }
      } catch (e) {
        console.warn('Error applying @style directive:', e);
      }
    }
  }

  class ClickDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@click'];
      if (!expr) return;

      // Only ensure simple variable names, not complex expressions
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr.trim()) &&
        !expr.includes('=') && !expr.includes('<') && !expr.includes('>') &&
        !expr.includes('!') && !expr.includes('&') && !expr.includes('|') &&
        !expr.includes("'") && !expr.includes('"') && !expr.includes('(') && !expr.includes(')')) {
        this.evaluator.ensureVarInState(expr);
      }

      const done = completionListener ? completionListener.addAsyncTask() : null;

      el.addEventListener('click', (e) => {
        this.handleClick(e, expr, ctx, state, el);
        if (done) done();
      });
    }

    handleClick(e, expr, ctx, state, el) {
      if (el.tagName === 'BUTTON') {
        e.preventDefault();
      }

      try {
        let codeToRun = expr;
        if (this.evaluator.hasInterpolation(expr)) {
          codeToRun = this.evaluator.evalAttrValue(expr, ctx);
        }

        const processedCode = codeToRun.replace(/\bstate\./g, '');

        if (this.handleSpecialClickPatterns(processedCode, ctx, state)) {
          return;
        }

        this.executeExpression(processedCode, ctx, e);

        // Ensure all assignments update the global state
        const ayishaAssignmentRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([^;,]+)/g;
        let ayishaMatch;
        while ((ayishaMatch = ayishaAssignmentRegex.exec(processedCode)) !== null) {
          const varName = ayishaMatch[1].trim();
          let value;
          // Prefer value from local context if available
          if (ctx[varName] !== undefined) {
            value = ctx[varName];
          } else {
            try {
              value = this.evaluator.evalExpr(ayishaMatch[2].trim(), ctx);
            } catch {
              value = ayishaMatch[2].trim();
            }
          }
          state[varName] = value;
        }
        setTimeout(() => window.ayisha && window.ayisha.render(), 0);

        // Patch: propagate assignments to global state if needed
        // Find assignments in the expression (e.g. foo=bar, page=index+1)
        const assignmentRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([^;]+)/g;
        let match;
        while ((match = assignmentRegex.exec(processedCode)) !== null) {
          const varName = match[1].trim();
          // Only propagate if the variable exists in global state and differs
          if (varName in state && ctx[varName] !== undefined && ctx[varName] !== state[varName]) {
            state[varName] = ctx[varName];
            setTimeout(() => window.ayisha && window.ayisha.render(), 0);
          }
        }

      } catch (err) {
        this.showError(el, err, expr);
      }
    }

    handleSpecialClickPatterns(code, ctx, state) {
      const contextObjMatch = code.match(/^(\w+)\.(\w+)(\+\+|--|=.+)$/);
      if (contextObjMatch) {
        return this.handleContextObjectOperation(contextObjMatch, ctx, state);
      }

      const filterMatch = code.match(/^(\w+)\s*=\s*(\w+)\.filter\((.+)\)$/);
      if (filterMatch) {
        return this.handleFilterOperation(filterMatch, ctx, state);
      }

      const incrementMatch = code.match(/^(\w+)\+\+$/);
      if (incrementMatch) {
        return this.handleIncrement(incrementMatch[1], state);
      }

      const decrementMatch = code.match(/^(\w+)--$/);
      if (decrementMatch) {
        return this.handleDecrement(decrementMatch[1], state);
      }

      const arithMatch = code.match(/^(\w+)\s*([+\-*\/])=\s*(.+)$/);
      if (arithMatch) {
        return this.handleArithmetic(arithMatch, ctx, state);
      }

      return false;
    }

    handleContextObjectOperation([, objName, propName, operation], ctx, state) {
      if (!ctx || !ctx[objName]) return false;

      const targetObj = ctx[objName];

      if (targetObj && typeof targetObj === 'object' && targetObj.id) {
        return this.updateObjectInState(targetObj, propName, operation, ctx, state);
      }

      if (operation === '++') {
        targetObj[propName] = (targetObj[propName] || 0) + 1;
      } else if (operation === '--') {
        targetObj[propName] = (targetObj[propName] || 0) - 1;
      } else if (operation.startsWith('=')) {
        const valueExpr = operation.substring(1).trim();
        targetObj[propName] = this.evalExpr(valueExpr, ctx);
      }

      setTimeout(() => window.ayisha?.render(), 0);
      return true;
    }

    updateObjectInState(targetObj, propName, operation, ctx, state) {
      for (const [stateKey, stateValue] of Object.entries(state)) {
        if (Array.isArray(stateValue)) {
          const index = stateValue.findIndex(item =>
            item && typeof item === 'object' && item.id === targetObj.id
          );

          if (index !== -1) {
            if (operation === '++') {
              state[stateKey][index][propName] = (state[stateKey][index][propName] || 0) + 1;
            } else if (operation === '--') {
              state[stateKey][index][propName] = (state[stateKey][index][propName] || 0) - 1;
            } else if (operation.startsWith('=')) {
              const valueExpr = operation.substring(1).trim();
              state[stateKey][index][propName] = this.evalExpr(valueExpr, ctx);
            }
            setTimeout(() => window.ayisha?.render(), 0);
            return true;
          }
        }
      }
      return false;
    }

    handleFilterOperation([, targetVar, sourceVar, filterExpr], ctx, state) {
      if (filterExpr.includes('!==') && targetVar === sourceVar) {
        const varMatch = filterExpr.match(/!==\s*(\w+)\.id/);
        let objectToDelete = null;

        if (varMatch) {
          objectToDelete = ctx[varMatch[1]];
        } else {
          for (const [ctxKey, ctxValue] of Object.entries(ctx)) {
            if (ctxValue && typeof ctxValue === 'object' && ctxValue.id && ctxKey !== 'users') {
              objectToDelete = ctxValue;
              break;
            }
          }
        }

        if (objectToDelete?.id) {
          state[targetVar] = state[targetVar].filter(p => p.id !== objectToDelete.id);
          setTimeout(() => window.ayisha?.render(), 0);
          return true;
        }
      }
      return false;
    }

    handleIncrement(varName, state) {
      if (!(varName in state)) state[varName] = 0;
      state[varName] = (Number(state[varName]) || 0) + 1;
      setTimeout(() => window.ayisha?.render(), 0);
      return true;
    }

    handleDecrement(varName, state) {
      state[varName] = (Number(state[varName]) || 0) - 1;
      setTimeout(() => window.ayisha?.render(), 0);
      return true;
    }

    handleArithmetic([, varName, operator, valueExpr], ctx, state) {
      let currentValue = Number(state[varName]) || 0;
      let operandValue = Number(this.evalExpr(valueExpr, ctx)) || 0;

      switch (operator) {
        case '+': state[varName] = currentValue + operandValue; break;
        case '-': state[varName] = currentValue - operandValue; break;
        case '*': state[varName] = currentValue * operandValue; break;
        case '/': state[varName] = operandValue !== 0 ? currentValue / operandValue : currentValue; break;
      }

      setTimeout(() => window.ayisha?.render(), 0);
      return true;
    }

    handleSubDirective(vNode, ctx, state, el, event, expression, completionListener = null) {
      if (event === 'click') {
        const done = completionListener ? completionListener.addAsyncTask() : null;
        el.addEventListener('click', (e) => {
          this.handleClick(e, expression, ctx, state, el);
          if (done) done();
        });
        return true;
      }
      return false;
    }
  }

  class FetchDirective extends Directive {
    constructor(evaluator, bindingManager, errorHandler, fetchManager) {
      super(evaluator, bindingManager, errorHandler);
      this.fetchManager = fetchManager;
    }

    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@fetch'];
      if (!expr) return;

      if (vNode.subDirectives?.['@fetch'] || vNode.directives['@when']) {
        return;
      }

      const autoExpr = this.evaluator.autoVarExpr(expr);
      const resultVar = vNode.directives['@result'] || 'result';
      const ctxWithVNode = Object.assign({}, ctx, { _vNode: vNode });

      const fetchPromise = this.fetchManager.setupFetch(autoExpr, resultVar, ctxWithVNode);
      if (completionListener && fetchPromise && typeof fetchPromise.then === 'function') {
        // Wrap the fetchPromise to also store the result in ctx._eventResult for @then
        completionListener.addTask(
          fetchPromise.then(data => {
            console.log('Fetch result:', data);
            ctxWithVNode._eventResult = data;
            return data;
          })
        );
      }

      if (vNode.directives['@watch']) {
        this.handleWatchDirective(vNode, autoExpr, resultVar);
      }
    }

    handleSubDirective(vNode, ctx, state, el, event, expression, completionListener = null) {
      const eventName = event === 'hover' ? 'mouseover' : event;

      const done = completionListener ? completionListener.addAsyncTask() : null;

      el.addEventListener(eventName, (e) => {
        const resultVar = vNode.directives['@result'] || 'result';
        const ctxWithVNode = Object.assign({}, ctx, { _vNode: vNode });

        try {
          let url = this.evaluator.evalExpr(expression, ctxWithVNode);
          if (url === undefined) {
            url = expression;
          }

          const fetchPromise = this.fetchManager.setupFetch(url, resultVar, ctxWithVNode, e, true);
          if (fetchPromise) {
            fetchPromise.then(data => {
              ctxWithVNode._eventResult = data;
            }).finally(() => { if (done) done(); });
          } else if (done) {
            done();
          }

        } catch (err) {
          this.showError(el, err, expression);
          if (done) done();
        }
      });

      return true;
    }

    handleWatchDirective(vNode, expr, resultVar) {
      vNode.directives['@watch'].split(',').forEach(watchExpr => {
        watchExpr = watchExpr.trim();
        const match = watchExpr.match(/^([\w$]+)\s*=>\s*(.+)$/) ||
          watchExpr.match(/^([\w$]+)\s*:\s*(.+)$/);

        if (match) {
          const prop = match[1];
          const code = match[2];
          this.evaluator.ensureVarInState(code);

          window.ayisha.addWatcher(prop, (newVal) => {
            try {
              this.executeExpression(code, {}, { newVal }, true);
            } catch (e) {
              console.error('Watcher error:', e);
            }
          }, { oneShot: true });
        } else {
          window.ayisha.addWatcher(watchExpr, () => {
            this.fetchManager.setupFetch(expr, resultVar, undefined, undefined, true);
          }, { oneShot: true });
        }
      });
    }
  }

  class ValidateDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@validate'];
      const modelVar = vNode.directives['@model'];

      if (el && expr && modelVar) {
        this.bindingManager.bindValidation(el, expr, modelVar);
      }

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class PrevDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      if (el) {
        const wrapper = document.createElement('div');
        wrapper.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        wrapper.style.color = '#fff';
        wrapper.style.padding = '1em';
        wrapper.style.borderRadius = '4px';
        wrapper.style.marginTop = '1em';
        wrapper.style.overflow = 'auto';

        let currentValue = state;
        let prevValue = undefined;
        let titleText = 'CURRENT & PREVIOUS VALUE';
        const prevExpr = vNode.directives['@prev'];
        let reactivity = window.ayisha && window.ayisha._reactivity ? window.ayisha._reactivity : null;

        if (typeof prevExpr === 'string' && prevExpr.trim()) {
          try {
            currentValue = this.evaluator.evalExpr(prevExpr, ctx);
            titleText = `PREV: ${prevExpr}`;
            if (state._prevValues && prevExpr in state._prevValues) {
              prevValue = state._prevValues[prevExpr];
            } else {
              prevValue = undefined;
            }
          } catch (e) {
            currentValue = { error: 'Invalid expression', details: e.message };
            titleText = `PREV: ${prevExpr}`;
          }
        } else {
          if (state._prevValues) {
            prevValue = {};
            for (const k in state) {
              if (Object.prototype.hasOwnProperty.call(state, k)) {
                prevValue[k] = state._prevValues[k];
              }
            }
          }
        }


        function safeStringify(val) {
          if (val === undefined) return 'undefined';
          if (val === null) return 'null';
          try {
            const seen = new WeakSet();
            return JSON.stringify(val, function (key, value) {
              if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) return '[Circular]';
                seen.add(value);
              }
              if (typeof value === 'undefined') return 'undefined';
              if (typeof value === 'function') return '[Function]';
              if (key === '_ayishaInstance') return undefined;
              return value;
            }, 2);
          } catch (e) {
            try {
              return String(val);
            } catch {
              return '[Unserializable]';
            }
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
        try {
          pre.textContent =
            'Current Value:\n' + safeStringify(currentValue) +
            '\n\nPrevious Value:\n' + safeStringify(prevValue);
        } catch (e) {
          pre.textContent = 'Error displaying previous value: ' + e.message;
        }
        wrapper.appendChild(pre);

        el.appendChild(wrapper);
      }
      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class StateDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      if (el) {
        const wrapper = document.createElement('div');
        wrapper.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        wrapper.style.color = '#fff';
        wrapper.style.padding = '1em';
        wrapper.style.borderRadius = '4px';
        wrapper.style.marginTop = '1em';
        wrapper.style.overflow = 'auto';

        let stateValue = state;
        let titleText = 'CURRENT STATE';
        const stateExpr = vNode.directives['@state'];
        if (typeof stateExpr === 'string' && stateExpr.trim()) {
          try {
            stateValue = this.evaluator.evalExpr(stateExpr, ctx);
            titleText = `STATE: ${stateExpr}`;
          } catch (e) {
            stateValue = { error: 'Invalid expression', details: e.message };
            titleText = `STATE: ${stateExpr}`;
          }
        }

        // Se undefined/null, mostra un valore di default generico
        if (stateValue === undefined) stateValue = null;

        function removeCircular(obj) {
          const seen = new WeakSet();
          return JSON.parse(JSON.stringify(obj, function (key, value) {
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) return undefined;
              seen.add(value);
            }
            if (key === '_ayishaInstance') return undefined;
            return value;
          }));
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
        try {
          pre.textContent = JSON.stringify(removeCircular(stateValue), null, 2);
        } catch (e) {
          pre.textContent = '[Non serializzabile]';
        }
        wrapper.appendChild(pre);

        el.appendChild(wrapper);
      }

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class LogDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      if (el) {
        el.textContent = 'Log: ' + JSON.stringify(vNode.directives, null, 2);
      }

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class AttrDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@attr'];
      let attrs = {};
      try {
        attrs = this.evaluator.evalExpr(expr, ctx);
      } catch { }
      if (el && typeof attrs === 'object') {
        Object.entries(attrs).forEach(([k, v]) => {
          el.setAttribute(k, v);
        });
      }

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class FocusDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@focus'];
      if (!expr) return;

      // Only ensure simple variable names, not complex expressions
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr.trim()) &&
        !expr.includes('=') && !expr.includes('<') && !expr.includes('>') &&
        !expr.includes('!') && !expr.includes('&') && !expr.includes('|') &&
        !expr.includes("'") && !expr.includes('"') && !expr.includes('(') && !expr.includes(')')) {
        this.evaluator.ensureVarInState(expr);
      }

      const done = completionListener ? completionListener.addAsyncTask() : null;

      el.addEventListener('focus', (e) => {
        try {
          this.executeExpression(expr, ctx, e, true);
          if (done) done();
        } catch (err) {
          this.showError(el, err, expr);
          if (done) done();
        }
      });
    }

    handleSubDirective(vNode, ctx, state, el, event, expression, completionListener = null) {
      if (event === 'focus') {
        // Only ensure simple variable names, not complex expressions
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expression.trim()) &&
          !expression.includes('=') && !expression.includes('<') && !expression.includes('>') &&
          !expression.includes('!') && !expression.includes('&') && !expression.includes('|') &&
          !expression.includes("'") && !expression.includes('"') && !expression.includes('(') && !expression.includes(')')) {
          this.evaluator.ensureVarInState(expression);
        }
        const done = completionListener ? completionListener.addAsyncTask() : null;
        el.addEventListener('focus', (e) => {
          try {
            this.executeExpression(expression, ctx, e, true);
            if (done) done();
          } catch (err) {
            this.showError(el, err, expression);
            if (done) done();
          }
        });
        return true;
      }
      return false;
    }
  }

  class BlurDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@blur'];
      if (!expr) return;

      // Only ensure simple variable names, not complex expressions
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr.trim()) &&
        !expr.includes('=') && !expr.includes('<') && !expr.includes('>') &&
        !expr.includes('!') && !expr.includes('&') && !expr.includes('|') &&
        !expr.includes("'") && !expr.includes('"') && !expr.includes('(') && !expr.includes(')')) {
        this.evaluator.ensureVarInState(expr);
      }

      const done = completionListener ? completionListener.addAsyncTask() : null;

      el.addEventListener('blur', (e) => {
        try {
          this.executeExpression(expr, ctx, e, true);
          if (done) done();
        } catch (err) {
          this.showError(el, err, expr);
          if (done) done();
        }
      });
    }

    handleSubDirective(vNode, ctx, state, el, event, expression, completionListener = null) {
      if (event === 'blur') {
        // Only ensure simple variable names, not complex expressions
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expression.trim()) &&
          !expression.includes('=') && !expression.includes('<') && !expression.includes('>') &&
          !expression.includes('!') && !expression.includes('&') && !expression.includes('|') &&
          !expression.includes("'") && !expression.includes('"') && !expression.includes('(') && !expression.includes(')')) {
          this.evaluator.ensureVarInState(expression);
        }
        const done = completionListener ? completionListener.addAsyncTask() : null;
        el.addEventListener('blur', (e) => {
          try {
            this.executeExpression(expression, ctx, e, true);
            if (done) done();
          } catch (err) {
            this.showError(el, err, expression);
            if (done) done();
          }
        });
        return true;
      }
      return false;
    }
  }

  class ChangeDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@change'];
      if (!expr) return;

      // Only ensure simple variable names, not complex expressions
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr.trim()) &&
        !expr.includes('=') && !expr.includes('<') && !expr.includes('>') &&
        !expr.includes('!') && !expr.includes('&') && !expr.includes('|') &&
        !expr.includes("'") && !expr.includes('"') && !expr.includes('(') && !expr.includes(')')) {
        this.evaluator.ensureVarInState(expr);
      }

      const done = completionListener ? completionListener.addAsyncTask() : null;

      el.addEventListener('change', (e) => {
        try {
          this.executeExpression(expr, ctx, e, true);
          if (done) done();
        } catch (err) {
          this.showError(el, err, expr);
          if (done) done();
        }
      });
    }

    handleSubDirective(vNode, ctx, state, el, event, expression, completionListener = null) {
      if (event === 'change') {
        // Only ensure simple variable names, not complex expressions
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expression.trim()) &&
          !expression.includes('=') && !expression.includes('<') && !expression.includes('>') &&
          !expression.includes('!') && !expression.includes('&') && !expression.includes('|') &&
          !expression.includes("'") && !expression.includes('"') && !expression.includes('(') && !expression.includes(')')) {
          this.evaluator.ensureVarInState(expression);
        }
        const done = completionListener ? completionListener.addAsyncTask() : null;
        el.addEventListener('change', (e) => {
          try {
            this.executeExpression(expression, ctx, e, true);
            if (done) done();
          } catch (err) {
            this.showError(el, err, expression);
            if (done) done();
          }
        });
        return true;
      }
      return false;
    }
  }

  class InputDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@input'];
      if (!expr) return;

      // Only ensure simple variable names, not complex expressions
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr.trim()) &&
        !expr.includes('=') && !expr.includes('<') && !expr.includes('>') &&
        !expr.includes('!') && !expr.includes('&') && !expr.includes('|') &&
        !expr.includes("'") && !expr.includes('"') && !expr.includes('(') && !expr.includes(')')) {
        this.evaluator.ensureVarInState(expr);
      }

      const done = completionListener ? completionListener.addAsyncTask() : null;

      el.addEventListener('input', (e) => {
        try {
          this.executeExpression(expr, ctx, e, true);
          if (done) done();
        } catch (err) {
          this.showError(el, err, expr);
          if (done) done();
        }
      });
    }

    handleSubDirective(vNode, ctx, state, el, event, expression, completionListener = null) {
      if (event === 'input') {
        // Only ensure simple variable names, not complex expressions
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expression.trim()) &&
          !expression.includes('=') && !expression.includes('<') && !expression.includes('>') &&
          !expression.includes('!') && !expression.includes('&') && !expression.includes('|') &&
          !expression.includes("'") && !expression.includes('"') && !expression.includes('(') && !expression.includes(')')) {
          this.evaluator.ensureVarInState(expression);
        }
        const done = completionListener ? completionListener.addAsyncTask() : null;
        el.addEventListener('input', (e) => {
          try {
            this.executeExpression(expression, ctx, e, true);
            if (done) done();
          } catch (err) {
            this.showError(el, err, expression);
            if (done) done();
          }
        });
        return true;
      }
      return false;
    }
  }

  class DoDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      // PATCH: esegui @do solo se NON c'è @watch, @when, @fetch, @click, @input, @change, @blur, @focus, @hover, @go, @set, @model, @validate, @key, @result, @then, @finally, @error, @payload, @headers, @method, @page, @component, @src, @state, @log, @text, @class, @style, @show, @hide, @if, @for, @switch, @case, @default, @source, @map, @filter, @reduce, @initial, @animate, @link, @key, @set, @model, @validate, @key, @result, @then, @finally, @error, @payload, @headers, @method, @page, @component, @src, @state, @log, @text, @class, @style, @show, @hide, @if, @for, @switch, @case, @default, @source, @map, @filter, @reduce, @initial, @animate, @link, @key, @set, @model, @validate, @key, @result, @then, @finally, @error, @payload, @headers, @method, @page, @component, @src, @state, @log, @text, @class, @style, @show, @hide, @if, @for, @switch, @case, @default, @source, @map, @filter, @reduce, @initial, @animate, @link
      // (in pratica: SOLO se @do è l'unica direttiva, o se usata con @when)
      const expr = vNode.directives['@do'];
      if (!expr) return;

      // Se c'è una direttiva triggerante, NON eseguire qui (sarà il watcher/evento a triggerare)
      const triggerDirectives = [
        '@watch', '@when', '@fetch', '@click', '@input', '@change', '@blur', '@focus', '@hover', '@go', '@set', '@model', '@validate', '@key', '@result', '@then', '@finally', '@error', '@payload', '@headers', '@method', '@page', '@component', '@src', '@state', '@log', '@text', '@class', '@style', '@show', '@hide', '@if', '@for', '@switch', '@case', '@default', '@source', '@map', '@filter', '@reduce', '@initial', '@animate', '@link'
      ];
      for (const dir of triggerDirectives) {
        if (vNode.directives[dir] && dir !== '@do') return;
      }

      // Se siamo qui, @do è "standalone" (o solo con @when)
      this.executeExpression(expr, ctx);
      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class WhenDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const whenExpr = vNode.directives['@when'];
      const doExpr = vNode.directives['@do'];
      const goExpr = vNode.directives['@go'];
      const waitExpr = vNode.directives['@wait'];

      if (!doExpr && !goExpr) {
        console.warn('@when richiede almeno @do o @go');
        return;
      }

      const directiveKey = `when_${whenExpr}_${doExpr || ''}_${goExpr || ''}`;
      if (!window._ayishaWhenLastState) window._ayishaWhenLastState = {};

      // Setup watcher only once per vNode
      if (!vNode._ayishaWhenWatcherSetup) {
        vNode._ayishaWhenWatcherSetup = true;
        // Estrarre tutte le dipendenze (variabili) usate nell'espressione @when
        const deps = this.evaluator.extractDependencies(whenExpr);
        if (window.ayisha && typeof window.ayisha.addWatcher === 'function') {
          deps.forEach(dep => {
            window.ayisha.addWatcher(dep, () => {
              this._ayishaWhenReactiveTrigger(vNode, ctx, state, el, directiveKey, whenExpr, doExpr, goExpr, waitExpr, completionListener);
            });
          });
        }
      }

      this._ayishaWhenReactiveTrigger(vNode, ctx, state, el, directiveKey, whenExpr, doExpr, goExpr, waitExpr, completionListener, true);
    }

    _ayishaWhenReactiveTrigger(vNode, ctx, state, el, directiveKey, whenExpr, doExpr, goExpr, waitExpr, completionListener = null, isFirstRender = false) {
      let condition = false;
      try {
        condition = this.evaluator.evalExpr(whenExpr, ctx);
      } catch (e) {
        console.error('Errore valutazione @when:', e);
        return;
      }
      const isTrue = !!condition;
      let wasTrue = window._ayishaWhenLastState[directiveKey];
      if (typeof wasTrue !== 'boolean') wasTrue = false;
      // PATCH: trigger @do/@go solo su rising edge (da false a true), MAI su ogni render o su update di variabili non rilevanti
      if (isTrue && !wasTrue) {
        let executed = false;
        const executeNow = () => {
          if (executed) return;
          executed = true;
          window._ayishaWhenLastState[directiveKey] = true;
          try {
            if (doExpr) this.executeExpression(doExpr, ctx, null, false);
            if (goExpr) {
              let page;
              try {
                let expr = this.evaluator.autoPageName(goExpr);
                page = this.evaluator.evalExpr(expr, ctx);
              } catch (e) { page = undefined; }
              if (!page && typeof goExpr === 'string' && goExpr.trim()) {
                page = goExpr.trim().replace(/^['"]|['"]$/g, '');
              }
              if (typeof page === 'string' && page.length > 0) {
                // Solo se cambia davvero la pagina
                if (state._currentPage !== page) {
                  state._currentPage = page;
                  if (window && window.history && typeof window.history.pushState === 'function') {
                    window.history.pushState({}, '', '/' + page);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }
                }
              }
            }
            if (completionListener) {
              completionListener.addTask(() => Promise.resolve());
            }
          } catch (error) {
            console.error('❌ Errore esecuzione @when:', error);
          }
        };
        const delay = waitExpr ? this.parseDelay(waitExpr, ctx, state) : 0;
        if (delay > 0) {
          if (completionListener) {
            const delayPromise = new Promise((resolve) => {
              setTimeout(() => {
                let stillTrue = false;
                try {
                  stillTrue = this.evaluator.evalExpr(whenExpr, ctx);
                } catch { }
                if (!!stillTrue) {
                  executeNow();
                } else {
                  window._ayishaWhenLastState[directiveKey] = false;
                }
                resolve();
              }, delay);
            });
            completionListener.addTask(delayPromise);
          } else {
            setTimeout(() => {
              let stillTrue = false;
              try {
                stillTrue = this.evaluator.evalExpr(whenExpr, ctx);
              } catch { }
              if (!!stillTrue) {
                executeNow();
              } else {
                window._ayishaWhenLastState[directiveKey] = false;
              }
            }, delay);
          }
        } else {
          executeNow();
        }
      } else if (!isTrue && wasTrue) {
        window._ayishaWhenLastState[directiveKey] = false;
      }
    }

    parseDelay(waitExpr, ctx, state) {
      try {
        let delay = this.evaluator.evalExpr(waitExpr, ctx);
        const parsedDelay = parseInt(delay, 10);
        return isNaN(parsedDelay) ? 0 : Math.max(0, parsedDelay);
      } catch (error) {
        console.error('❌ Errore nel parsing del delay @wait:', error, waitExpr);
        return 0;
      }
    }
  }

  class GoDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      if (vNode.directives['@when']) return;

      let expr = vNode.directives['@go'];
      if (this.evaluator && typeof this.evaluator.autoPageName === 'function') {
        expr = this.evaluator.autoPageName(expr);
      }

      let page = this.evaluator ? this.evaluator.evalExpr(expr, ctx) : expr;

      if (typeof page === 'string') {
        // Gestisci i percorsi relativi e assoluti
        let finalPage = this.resolvePath(page);

        state._currentPage = finalPage;

        if (window && window.history && typeof window.history.pushState === 'function') {
          const url = finalPage ? '/' + finalPage : '/';
          window.history.pushState({}, '', url);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }

        if (typeof window.ayisha?.render === 'function') {
          setTimeout(() => window.ayisha.render(), 0);
        }
      }

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }

    resolvePath(targetPage) {
      if (!targetPage) return '';

      // Se il percorso inizia con '/', è un percorso assoluto
      if (targetPage.startsWith('/')) {
        return targetPage.substring(1); // Rimuovi il '/' iniziale
      }

      // Se il percorso è relativo, sostituisce completamente il percorso corrente
      return targetPage;
    }
  }

  class WaitDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      // handled reactively in AyishaVDOM, no-op for SEO
      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class SetDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@set'];
      if (!expr || vNode._setProcessed) return;

      let setExprs = expr;
      if (Array.isArray(setExprs)) {
        setExprs = setExprs.flat().filter(Boolean);
      } else if (typeof setExprs === 'string') {
        setExprs = setExprs.split(/;;|\n/).map(s => s.trim()).filter(Boolean);
      } else {
        setExprs = [setExprs];
      }

      setExprs.forEach(e => {
        try {
          const assignmentRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=([^=].*)/g;
          let match;
          while ((match = assignmentRegex.exec(e)) !== null) {
            const varName = match[1];
            if (!(varName in state) || state[varName] === undefined) {
              state[varName] = this.evaluator.evalExpr(match[2], ctx);
            }
          }
        } catch (error) {
          console.error('Error in @set directive:', error);
          if (el) el.setAttribute('data-ayisha-set-error', error.message);
        }
      });

      vNode._setProcessed = true;
      delete vNode.directives['@set'];

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }

    handleSubDirective(vNode, ctx, state, el, event, expression, completionListener = null) {
      if (['click', 'input', 'change', 'focus', 'blur'].includes(event)) {
        const done = completionListener ? completionListener.addAsyncTask() : null;
        el.addEventListener(event, () => {
          try {
            this.executeExpression(expression, ctx, null, true);
            if (done) done();
          } catch (err) {
            this.showError(el, err, expression);
            if (done) done();
          }
        });
        return true;
      }
      return false;
    }
  }

  class ThenDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      // @then is handled by the completion listener system
      // This directive just marks that completion tracking is needed
      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class FinallyDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      // @finally is handled by the completion listener system
      // This directive just marks that completion tracking is needed
      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class KeyDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      if (el && vNode.directives['@key']) {
        el.setAttribute('data-ayisha-key', vNode.directives['@key']);
      }

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class SrcDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      if (el && vNode.directives['@src']) {
        const src = vNode.directives['@src'];
        const loadPromise = window.ayisha?.componentManager?.loadExternalComponent(src).then(html => {
          if (html) el.innerHTML = html;
        });

        if (completionListener && loadPromise) {
          completionListener.addTask(loadPromise);
        }
      }
    }
  }

  class PageDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      if (el && vNode.directives['@page']) {
        const page = vNode.directives['@page'];
        el.style.display = (state._currentPage === page) ? '' : 'none';
      }

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class ComponentDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      // Modular VDOM component loading (for <component @src="...">)
      const src = vNode.directives['@src'];
      if (!src) {
        return this.errorHandler.createErrorElement(`Error: <b>&lt;component&gt;</b> requires the <b>@src</b> attribute`);
      }

      let srcUrl = null;
      try {
        srcUrl = this.evaluator.evalExpr(src, ctx);
      } catch (e) {
        srcUrl = src;
      }
      // Fallback to raw attribute if still falsy
      if (!srcUrl) srcUrl = src;
      if (typeof srcUrl === 'string') srcUrl = srcUrl.trim();
      // Normalize quotes (single or double)
      if (typeof srcUrl === 'string' && /^['"].*['"]$/.test(srcUrl)) {
        srcUrl = srcUrl.slice(1, -1);
      }
      if (!srcUrl || srcUrl === 'undefined' || srcUrl === 'null') {
        return this.errorHandler.createErrorElement(`Error: Invalid component URL`);
      }
      if (srcUrl.startsWith('./')) srcUrl = srcUrl.substring(2);

      const cm = window.ayisha?.componentManager;
      if (cm && cm.getCachedComponent(srcUrl)) {
        const componentHtml = cm.getCachedComponent(srcUrl);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = componentHtml;
        window.ayisha?._processComponentInitBlocks(tempDiv);
        const componentVNode = window.ayisha?.parse(tempDiv);
        if (componentVNode && componentVNode.children) {
          const frag = document.createDocumentFragment();
          componentVNode.children.forEach(child => {
            const node = state._ayishaInstance._renderVNode(child, ctx);
            if (node) frag.appendChild(node);
          });

          if (completionListener) {
            completionListener.addTask(() => Promise.resolve());
          }
          return frag;
        }
      }

      if (cm && !cm.getCachedComponent(srcUrl)) {
        const loadPromise = cm.loadExternalComponent(srcUrl).then(html => {
          if (html) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            window.ayisha?._processComponentInitBlocks(tempDiv);
            if (!window.ayisha?._isRendering) {
              clearTimeout(window.ayisha?._componentRenderTimeout);
              window.ayisha._componentRenderTimeout = setTimeout(() => window.ayisha.render(), 10);
            }
          } else {
            console.error(`ComponentManager: Failed to load component ${srcUrl}`);
          }
        }).catch(err => {
          console.error('Error loading component:', err);
          cm.cache[srcUrl] = `<div class='component-error' style='padding: 10px; background: #ffe6e6; border: 1px solid #ff6b6b; border-radius: 4px; color: #d32f2f;'>Errore: ${err.message}</div>`;
          if (!window.ayisha?._isRendering) {
            clearTimeout(window.ayisha?._componentRenderTimeout);
            window.ayisha._componentRenderTimeout = setTimeout(() => window.ayisha.render(), 10);
          }
        });

        if (completionListener) {
          completionListener.addTask(loadPromise);
        }
      }

      const placeholder = document.createElement('div');
      placeholder.className = 'component-loading';
      placeholder.style.cssText = 'padding: 10px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; color: #6c757d; font-size: 14px; text-align: center;';
      placeholder.innerHTML = `⏳ Loading component: <code>${srcUrl}</code>`;
      return placeholder;
    }
  }

  class SwitchDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      // VDOM switch logic
      const swVal = this.evaluator.evalExpr(vNode.directives['@switch'], ctx);
      let defaultNode = null;
      for (const child of vNode.children) {
        if (!child.directives) continue;
        if (child.directives['@case'] != null) {
          let cv = child.directives['@case'];
          if (/^['"].*['"]$/.test(cv)) cv = cv.slice(1, -1);
          if (String(cv) === String(swVal)) {
            if (completionListener) {
              completionListener.addTask(() => Promise.resolve());
            }
            return state._ayishaInstance._renderVNode(child, ctx);
          }
        }
        if (child.directives['@default'] != null) defaultNode = child;
      }

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
      return defaultNode ? state._ayishaInstance._renderVNode(defaultNode, ctx) : document.createComment('noswitch');
    }
  }

  class CaseDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      // CaseDirective: gestito dal parent SwitchDirective
      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class DefaultDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      // DefaultDirective: gestito dal parent SwitchDirective
      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class SourceDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      if (el && vNode.directives['@source']) {
        const src = vNode.directives['@source'];
        const data = this.evaluator?.evalExpr(src, ctx);
        el.ayishaSourceData = data;
      }

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class MapDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      if (el && vNode.directives['@map']) {
        const mapFn = vNode.directives['@map'];
        const data = el.ayishaSourceData;
        if (Array.isArray(data)) {
          try {
            const fn = this.evaluator?.evalExpr(mapFn, ctx);
            el.ayishaSourceData = data.map(fn);
          } catch { }
        }
      }

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class FilterDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      if (el && vNode.directives['@filter']) {
        const filterFn = vNode.directives['@filter'];
        const data = el.ayishaSourceData;
        if (Array.isArray(data)) {
          try {
            const fn = this.evaluator?.evalExpr(filterFn, ctx);
            el.ayishaSourceData = data.filter(fn);
          } catch { }
        }
      }

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class ReduceDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      if (el && vNode.directives['@reduce']) {
        const reduceFn = vNode.directives['@reduce'];
        const initial = vNode.directives['@initial'];
        const data = el.ayishaSourceData;
        if (Array.isArray(data)) {
          try {
            const fn = this.evaluator?.evalExpr(reduceFn, ctx);
            el.ayishaSourceData = data.reduce(fn, initial);
          } catch { }
        }
      }

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class InitialDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      // InitialDirective: usato da ReduceDirective
      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class AnimateDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      if (el && vNode.directives['@animate']) {
        el.classList.add(vNode.directives['@animate']);
      }

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }
    }
  }

  class LinkDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      if (el && vNode.directives['@link']) {
        const done = completionListener ? completionListener.addAsyncTask() : null;
        el.addEventListener('click', e => {
          e.preventDefault();
          const targetPage = vNode.directives['@link'];

          let finalPage = this.resolvePath(targetPage);

          state._currentPage = finalPage;

          if (window && window.history && typeof window.history.pushState === 'function') {
            const url = finalPage ? '/' + finalPage : '/';
            window.history.pushState({}, '', url);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }

          setTimeout(() => {
            window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
          }, 10);

          if (typeof window.ayisha?.render === 'function') {
            setTimeout(() => window.ayisha.render(), 0);
          }

          if (done) done();
        });
      }
    }

    resolvePath(targetPage) {
      if (!targetPage) return '';

      if (targetPage.startsWith('/')) {
        return targetPage.substring(1);
      }

      return targetPage;
    }
  }

  class HoverDirective extends Directive {
    apply(vNode, ctx, state, el, completionListener = null) {
      const expr = vNode.directives['@hover'];
      if (!expr) return;

      const done = completionListener ? completionListener.addAsyncTask() : null;

      const applyHover = (e) => {
        try {
          this.executeExpression(expr, ctx, e, true);
          if (done) done();
        } catch (err) {
          this.showError(el, err, expr);
          if (done) done();
        }
      };

      el.addEventListener('mouseover', applyHover);
      el.addEventListener('mouseout', applyHover);
    }

    handleSubDirective(vNode, ctx, state, el, event, expression, completionListener = null) {
      if (event === 'hover') {
        const done = completionListener ? completionListener.addAsyncTask() : null;
        const applyHover = (e) => {
          try {
            this.executeExpression(expression, ctx, e, true);
            if (done) done();
          } catch (err) {
            this.showError(el, err, expression);
            if (done) done();
          }
        };

        el.addEventListener('mouseover', applyHover);
        el.addEventListener('mouseout', applyHover);
        return true;
      }
      return false;
    }
  }

  // Modular Directives Object
  const ModularDirectives = {
    '@if': IfDirective,
    '@not': NotDirective,
    '@for': ForDirective,
    '@model': ModelDirective,
    '@file': FileDirective,
    '@files': FilesDirective,
    '@show': ShowDirective,
    '@hide': HideDirective,
    '@text': TextDirective,
    '@class': ClassDirective,
    '@style': StyleDirective,
    '@click': ClickDirective,
    '@fetch': FetchDirective,
    '@validate': ValidateDirective,
    '@state': StateDirective,
    '@log': LogDirective,
    '@attr': AttrDirective,
    '@focus': FocusDirective,
    '@blur': BlurDirective,
    '@change': ChangeDirective,
    '@input': InputDirective,
    '@when': WhenDirective,
    '@do': DoDirective,
    '@go': GoDirective,
    '@wait': WaitDirective,
    '@set': SetDirective,
    '@then': ThenDirective,
    '@finally': FinallyDirective,
    '@key': KeyDirective,
    '@src': SrcDirective,
    '@page': PageDirective,
    '@component': ComponentDirective,
    '@switch': SwitchDirective,
    '@case': CaseDirective,
    '@default': DefaultDirective,
    '@source': SourceDirective,
    '@map': MapDirective,
    '@filter': FilterDirective,
    '@reduce': ReduceDirective,
    '@initial': InitialDirective,
    '@animate': AnimateDirective,
    '@link': LinkDirective,
    '@prev': PrevDirective,
    '@hover': HoverDirective,
    '@date': DateDirective,
    '@dateonly': DateOnlyDirective,
    '@time': TimeDirective
  };

  // Enhanced Directive Manager
  class DirectiveManager {
    constructor(evaluator, bindingManager, errorHandler, fetchManager) {
      this.directives = new Map();
      this.evaluator = evaluator;
      this.bindingManager = bindingManager;
      this.errorHandler = errorHandler;
      this.fetchManager = fetchManager;

      this.initializeDirectives();
    }

    initializeDirectives() {
      this.register('@if', new IfDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@not', new NotDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@for', new ForDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@model', new ModelDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@file', new FileDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@files', new FilesDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@hide', new HideDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@text', new TextDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@date', new DateDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@dateonly', new DateOnlyDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@time', new TimeDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@class', new ClassDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@style', new StyleDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@click', new ClickDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@fetch', new FetchDirective(this.evaluator, this.bindingManager, this.errorHandler, this.fetchManager));
      this.register('@validate', new ValidateDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@state', new StateDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@log', new LogDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@attr', new AttrDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@focus', new FocusDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@blur', new BlurDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@change', new ChangeDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@input', new InputDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@when', new WhenDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@do', new DoDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@go', new GoDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@wait', new WaitDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@set', new SetDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@then', new ThenDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@finally', new FinallyDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@key', new KeyDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@src', new SrcDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@page', new PageDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@component', new ComponentDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@switch', new SwitchDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@case', new CaseDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@default', new DefaultDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@source', new SourceDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@map', new MapDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@filter', new FilterDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@reduce', new ReduceDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@initial', new InitialDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@animate', new AnimateDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@prev', new PrevDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@link', new LinkDirective(this.evaluator, this.bindingManager, this.errorHandler));
      this.register('@hover', new HoverDirective(this.evaluator, this.bindingManager, this.errorHandler));
    }

    register(name, directive) {
      this.directives.set(name, directive);
    }

    getDirective(name) {
      return this.directives.get(name);
    }
    applyDirectives(vNode, ctx, state, el, completionListener = null) {
      if (
        vNode.directives &&
        vNode.directives['@watch'] &&
        vNode.directives['@do'] &&
        window.ayisha &&
        typeof window.ayisha.addWatcher === 'function'
      ) {
        if (!window._ayishaGlobalWatchRegistry) window._ayishaGlobalWatchRegistry = new Set();
        let uniqueId = null;
        let ancestry = [];
        let node = vNode;
        while (node) {
          let tag = node.tag || '';
          let staticAttrs = '';
          if (node.attrs) {
            staticAttrs = Object.entries(node.attrs)
              .filter(([k, v]) => typeof v === 'string' && !k.startsWith('@'))
              .map(([k, v]) => `${k}=${v}`)
              .join(';');
          }
          let forKey = node.directives && node.directives['@for'] ? `@for=${node.directives['@for']}` : '';
          ancestry.push(`${tag}|${staticAttrs}|${forKey}`);
          node = node.parent || node._parent || null;
        }
        ancestry = ancestry.reverse();
        uniqueId = ancestry.join('>') + '::' + vNode.directives['@watch'] + '::' + vNode.directives['@do'];

        vNode.directives['@__autoKey'] = uniqueId;
        vNode.directives['@watch'].split(',').forEach(watchExpr => {
          const prop = watchExpr.trim();
          const regKey = prop + '::' + vNode.directives['@do'] + '::' + uniqueId;
          if (!window._ayishaGlobalWatchRegistry.has(regKey)) {
            window._ayishaGlobalWatchRegistry.add(regKey);
            window.ayisha.addWatcher(prop, () => {
              try {
                window.ayisha.evaluator.executeDirectiveExpression(vNode.directives['@do'], ctx, null, true);
              } catch (e) {
                console.error('Watcher+@do error:', e);
              }
            }, { oneShot: false });
          }
        });
      }
      Object.keys(vNode.directives || {}).forEach(directiveName => {
        if (directiveName === '@then' || directiveName === '@finally') return;

        const directive = this.getDirective(directiveName);
        if (directive) {
          try {
            directive.apply(vNode, ctx, state, el, completionListener);
          } catch (error) {
            console.error(`Error applying directive ${directiveName}:`, error);
            this.errorHandler.showAyishaError(el, error, vNode.directives[directiveName]);
          }
        }
      });

      // Apply sub-directives
      Object.entries(vNode.subDirectives || {}).forEach(([directiveName, events]) => {
        const directive = this.getDirective(directiveName);
        if (directive) {
          Object.entries(events).forEach(([event, expression]) => {
            try {
              const handled = directive.handleSubDirective(vNode, ctx, state, el, event, expression, completionListener);
              if (!handled) {
                console.warn(`Unhandled sub-directive: ${directiveName}:${event}`);
              }
            } catch (error) {
              console.error(`Error applying sub-directive ${directiveName}:${event}:`, error);
              this.errorHandler.showAyishaError(el, error, expression);
            }
          });
        }
      });
    }
  }

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

  // === MAIN AYISHA VDOM CLASS ===

  class AyishaVDOM {
    showAllErrors(container = document.body) {
      if (!this.errorBus) return;
      const old = container.querySelector('.ayisha-error-list');
      if (old) old.remove();
      const errors = this.errorBus.getAll();
      if (!errors.length) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'ayisha-error-list';
      wrapper.style.cssText = `
      background: #fff3f3;
      color: #c00;
      border: 1px solid #c00;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 13px;
      max-width: 600px;
      box-shadow: 0 2px 8px rgba(200,0,0,0.08);
    `;
      wrapper.innerHTML = `<div style='font-weight:bold; color:#900; margin-bottom:8px;'>❌ Ayisha Error Log (${errors.length})</div>`;
      errors.forEach((err, i) => {
        const div = document.createElement('div');
        div.style.cssText = `margin-bottom:10px; padding:8px; border-bottom:1px solid #fdd;`;
        div.innerHTML = `
        <div style='font-weight:bold;'>${i + 1}. ${err.error?.message || err.error || 'Unknown error'}</div>
        <div style='color:#333; font-size:12px;'>${err.context && err.context.expr ? `<b>Expr:</b> <code>${err.context.expr}</code><br>` : ''}
          ${err.context && err.context.type ? `<b>Type:</b> ${err.context.type}<br>` : ''}
          <b>Time:</b> ${new Date(err.timestamp).toLocaleString()}
        </div>
      `;
        wrapper.appendChild(div);
      });
      container.appendChild(wrapper);
    }

    isBot() {
      const ua = navigator.userAgent.toLowerCase();
      return /bot|crawler|spider|googlebot|bingbot|facebookexternalhit|twitterbot/i.test(ua);
    }

    renderForSEO() {
      this.processAllDirectivesSync();
      this.loadAllComponentsSync();
      this.executeAllFetchSync();
      this.generateMetaTags();
    }

    processAllDirectivesSync() {
      Object.keys(ModularDirectives).forEach(dir => {
        const elements = document.querySelectorAll(`[\\${dir}]`);
        elements.forEach(el => {
          const DirectiveClass = ModularDirectives[dir];
          const directive = new DirectiveClass(this.evaluator, this.bindingManager, this.errorHandler);
          const vNode = {
            _el: el,
            directives: { [dir]: el.getAttribute(dir) }
          };
          directive.apply(vNode, this.state, this.state, el);
        });
      });
    }

    loadAllComponentsSync() {
      const components = document.querySelectorAll('[data-component]');
      components.forEach(el => {
        const componentName = el.getAttribute('data-component');
        if (this.componentManager && this.componentManager.getComponent(componentName)) {
          el.innerHTML = this.componentManager.getComponent(componentName);
        }
      });
    }

    executeAllFetchSync() {
      const fetchElements = document.querySelectorAll('[\\@fetch]');
      const fetchPromises = [];
      fetchElements.forEach(el => {
        const fetchConfig = el.getAttribute('@fetch');
        let url = fetchConfig, resultVar = 'result';
        const asMatch = fetchConfig.match(/(.+) as (\w+)/);
        if (asMatch) {
          url = asMatch[1].trim();
          resultVar = asMatch[2].trim();
        }
        try {
          url = this.evaluator.evalExpr(url, this.state);
        } catch { }
        if (!url) return;
        fetchPromises.push(
          fetch(url)
            .then(res => res.json())
            .then(data => {
              this.state[resultVar] = data;
            })
            .catch(() => { this.state[resultVar] = null; })
        );
      });
      if (fetchPromises.length > 0) {
        const start = Date.now();
        let done = false;
        Promise.all(fetchPromises).then(() => { done = true; });
        while (!done && Date.now() - start < 2000) {
          // Block
        }
      }
    }

    generateMetaTags() {
      const h1 = document.querySelector('h1');
      if (h1 && !document.title) {
        document.title = h1.textContent;
      }
      const content = document.body.textContent.slice(0, 160);
      if (!document.querySelector('meta[name="description"]')) {
        const meta = document.createElement('meta');
        meta.name = 'description';
        meta.content = content;
        document.head.appendChild(meta);
      }
    }

    static version = "1.0.2";

    constructor(root = document.body) {
      this.errorBus = new AyishaErrorBus();
      this.errorBus.onError(() => {
        setTimeout(() => this.showAllErrors(), 0);
      });

      this.root = root;
      this.state = {};
      this._initBlocks = [];
      this._vdom = null;
      this._isRendering = false;
      this._processedSetDirectives = new Set();
      this._componentRenderTimeout = null;
      this._setNodes = new WeakSet();

      this.evaluator = new ExpressionEvaluator(this.state);
      this.parser = new DOMParser(this._initBlocks);
      this.componentManager = new ComponentManager();
      this.reactivitySystem = new ReactivitySystem(this.state, () => this.render());
      this.router = new Router(this.state, () => this.render());
      this.fetchManager = new FetchManager(this.evaluator);
      this.helpSystem = new DirectiveHelpSystem();
      this.errorHandler = new ErrorHandler(this.errorBus);
      this.bindingManager = new BindingManager(this.evaluator, () => this.render());
      this.centralLogger = new CentralLogger();
      this.centralLogger.initializeLoggers(this.evaluator, this.fetchManager, this.componentManager);

      // Initialize the modular directive system
      this.directiveManager = new DirectiveManager(
        this.evaluator,
        this.bindingManager,
        this.errorHandler,
        this.fetchManager
      );

      if (!('_currentPage' in this.state) || !this.state._currentPage) {
        let firstPage = null;
        let allWithPage = [];
        try {
          allWithPage = document.querySelectorAll('[\@page]');
        } catch (e) {
          try {
            allWithPage = document.querySelectorAll('[@page]');
          } catch (e2) {
            allWithPage = [];
          }
        }
        if (allWithPage.length > 0) {
          firstPage = allWithPage[0].getAttribute('@page');
        }
        this.state._currentPage = firstPage || 'home';
      }

      if (this.isBot && typeof this.isBot === 'function' && this.isBot()) {
        this.renderForSEO();
      }
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
      if (this._isRendering) {
        return;
      }

      this._initBlocks.forEach(code => {
        if (!code || !code.trim()) {
          return;
        }
        let cleanCode = code.trim()
          .replace(/[\u200B-\u200D\uFEFF]/g, '')
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .replace(/\n\s*\n/g, '\n')
          .replace(/\n\s+/g, '\n')
          .trim();

        let transformed = cleanCode;

        const lines = transformed.split('\n');
        const transformedLines = lines.map(line => {
          const trimmedLine = line.trim();

          if (!trimmedLine ||
            trimmedLine.startsWith('function') ||
            trimmedLine.includes('function(') ||
            trimmedLine.includes('=>') ||
            /^(if|else|for|while|switch|case|default|try|catch|finally|return|var|let|const)\b/.test(trimmedLine)) {
            return line;
          }

          const assignmentMatch = trimmedLine.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+)$/);
          if (assignmentMatch &&
            !trimmedLine.includes('state.') &&
            !trimmedLine.includes('this.') &&
            !trimmedLine.includes('window.') &&
            !trimmedLine.includes('console.') &&
            !trimmedLine.includes('localStorage.') &&
            !trimmedLine.includes('sessionStorage.')) {
            const [, varName, value] = assignmentMatch;
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
          console.error('Init error:', e);
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

      // Remove any _ayishaInstance that might have been accidentally added
      if ('_ayishaInstance' in this.state) {
        delete this.state._ayishaInstance;
      }

      // Clean up invalid variable names that contain operators
      const stateKeysToRemove = Object.keys(this.state).filter(key => {
        return key.includes('=') || key.includes('<') || key.includes('>') ||
          key.includes('!') || key.includes('&') || key.includes('|') ||
          key.includes("'") || key.includes('"') || key.includes('(') || key.includes(')') ||
          key.includes(' ');
      });
      stateKeysToRemove.forEach(key => {
        console.warn(`Removing invalid state variable: "${key}"`);
        delete this.state[key];
      });
    }

    _preInitializeEssentialVariables() {
      if (!this.state._validate) this.state._validate = {};
      if (!this.state._currentPage) this.state._currentPage = '';
      if (!this.state._version) this.state._version = AyishaVDOM.version;
      if (!this.state._locale) this.state._locale = (navigator.language || navigator.userLanguage || 'en');

      // Remove any circular references
      if ('_ayishaInstance' in this.state) {
        delete this.state._ayishaInstance;
      }

      const getBreakpoint = (w) => {
        if (w < 576) return 'xs';
        if (w < 768) return 'sm';
        if (w < 992) return 'md';
        if (w < 1200) return 'lg';
        if (w < 1400) return 'xl';
        return 'xxl';
      };
      const updateScreenVars = () => {
        this.state._currentBreakpoint = getBreakpoint(window.innerWidth);
        this.state._screenSize = window.innerWidth;
      };
      updateScreenVars();
      if (!this._breakpointListenerAdded) {
        window.addEventListener('resize', updateScreenVars);
        this._breakpointListenerAdded = true;
      }
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

      const componentElements = this.root.querySelectorAll('component');

      componentElements.forEach(el => {
        let srcUrl = null;

        if (el.hasAttribute('src')) {
          srcUrl = el.getAttribute('src');
        } else if (el.hasAttribute('@src')) {
          const attrValue = el.getAttribute('@src');
          if (/^['\"].*['\"]$/.test(attrValue)) {
            srcUrl = attrValue.slice(1, -1);
          } else {
            try {
              srcUrl = this.evaluator.evalExpr(attrValue);
            } catch (e) {
              if (attrValue.includes('.html') || attrValue.startsWith('./')) {
                srcUrl = attrValue;
              }
            }
          }
        }

        if (srcUrl && !processedUrls.has(srcUrl) && !this.componentManager.getCachedComponent(srcUrl)) {
          processedUrls.add(srcUrl);
          componentPromises.push(this.componentManager.loadExternalComponent(srcUrl));
        }
      });

      if (componentPromises.length > 0) {
        try {
          await Promise.allSettled(componentPromises);
        } catch (error) {
          console.error('Error during component preloading:', error);
        }
      }
    }

    render() {
      if (this._isRendering) return;
      this._isRendering = true;

      // Preventive cleanup of circular references
      if ('_ayishaInstance' in this.state) {
        delete this.state._ayishaInstance;
      }

      // Clean up invalid variable names that contain operators (aggressive cleanup)
      const stateKeysToRemove = Object.keys(this.state).filter(key => {
        return key.includes('=') || key.includes('<') || key.includes('>') ||
          key.includes('!') || key.includes('&') || key.includes('|') ||
          key.includes("'") || key.includes('"') || key.includes('(') || key.includes(')') ||
          key.includes(' ') || key.includes('+') || key.includes('-') || key.includes('*') ||
          key.includes('/') || key.includes('%') || key.includes('[') || key.includes(']') ||
          key.includes('{') || key.includes('}') || key.includes('?') || key.includes(':') ||
          key.includes(';') || key.includes(',') || !(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key));
      });

      if (stateKeysToRemove.length > 0) {
        console.warn(`🧹 Cleaning up ${stateKeysToRemove.length} invalid state variables:`, stateKeysToRemove);
        stateKeysToRemove.forEach(key => {
          delete this.state[key];
        });
      }

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
        for (const i of focusInfo.path) {
          if (!node || !node.childNodes || !node.childNodes[i]) {
            node = undefined;
            break;
          }
          node = node.childNodes[i];
        }
        if (node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA')) {
          node.focus();
          try {
            if ((node.tagName === 'INPUT' && typeof node.selectionStart === 'number' && typeof node.setSelectionRange === 'function' && node.type !== 'number') || node.tagName === 'TEXTAREA') {
              node.setSelectionRange(focusInfo.start, focusInfo.end);
            }
          } catch (e) { }
        }
      }

      this._addLogIndicators();

      window.scrollTo(scrollX, scrollY);
      this.bindingManager.updateBindings();

      if (this._whenDirectiveWatchers) {
        this._whenDirectiveWatchers.forEach(fn => { try { fn(); } catch { } });
      }

      this._isRendering = false;
    }


    _addLogIndicators() {
      const logElements = this.root.querySelectorAll('[data-ayisha-log="true"]');

      logElements.forEach(el => {
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

          const logContent = this._generateInlineLogContent(el, savedDirectiveInfo);
          logDisplay.innerHTML = logContent;

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

        if (el.parentNode) {
          el.parentNode.insertBefore(errorDisplay, el.nextSibling);
        }
      });
    }

    _generateInlineLogContent(el, savedDirectiveInfo) {
      const vNode = {
        tag: savedDirectiveInfo.tag || el.tagName.toLowerCase(),
        directives: savedDirectiveInfo.directives || {},
        subDirectives: savedDirectiveInfo.subDirectives || {}
      };

      const ctx = {};

      let html = `<div style="color: #66ccff; font-weight: bold; margin-bottom: 6px;">📊 &lt;${vNode.tag}&gt;</div>`;

      let hasTrackedDirectives = false;
      let directiveCount = 0;

      Object.keys(vNode.directives).forEach(directive => {
        if (directive === '@log') return;

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
          html += `<div style="color: #999; margin: 2px 0;">
            <span style="color: #ccc;">${directive}</span>: 
            <span style="color: #aaa;">${this._truncateValue(vNode.directives[directive])}</span>
            <span style="color: #777; font-size: 10px;"> [untracked]</span>
          </div>`;
        }
      });

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

      if (savedDirectiveInfo.elementInfo) {
        const info = savedDirectiveInfo.elementInfo;
        if (info.className || info.id) {
          html += `<div style="color: #666; font-size: 10px; margin-top: 4px; padding-top: 2px; border-top: 1px solid #333;">
            ${info.className ? `Class: ${info.className}` : ''}${info.className && info.id ? ' | ' : ''}${info.id ? `ID: ${info.id}` : ''}
          </div>`;
        }
      }

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

      // Create completion listener if @then or @finally are present
      let completionListener = null;
      if (vNode && (vNode.directives?.['@then'] || vNode.directives?.['@finally'])) {
        completionListener = new DirectiveCompletionListener(vNode, ctx, this);

        // Register @then expressions
        if (vNode.directives['@then']) {
          completionListener.addThen(vNode.directives['@then']);
        }

        // Register @finally expressions
        if (vNode.directives['@finally']) {
          completionListener.addFinally(vNode.directives['@finally']);
        }
      }

      if (vNode.directives && vNode.directives['@set'] && !vNode._setProcessed) {
        let setExprs = vNode.directives['@set'];
        if (Array.isArray(setExprs)) {
          setExprs = setExprs.flat().filter(Boolean);
        } else if (typeof setExprs === 'string') {
          setExprs = setExprs.split(/;;|\n/).map(s => s.trim()).filter(Boolean);
        } else {
          setExprs = [setExprs];
        }
        setExprs.forEach(expr => {
          try {
            // Only assign if variable does not exist or is undefined
            const assignmentRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=([^=].*)/g;
            let match;
            while ((match = assignmentRegex.exec(expr)) !== null) {
              const varName = match[1];
              if (!(varName in this.state) || this.state[varName] === undefined) {
                this.state[varName] = this.evaluator.evalExpr(match[2], ctx);
              }
            }
          } catch (e) {
            console.error('Error in @set directive:', e, 'Expression:', expr);
            if (!vNode._setErrors) vNode._setErrors = [];
            vNode._setErrors.push(e.message);
          }
        });
        vNode._setProcessed = true;
        delete vNode.directives['@set'];
      }

      Object.entries(vNode.directives || {}).forEach(([dir, expr]) => {
        // Only ensure variables for simple variable names (no operators, quotes, etc.)
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr.trim()) &&
          !expr.includes('=') && !expr.includes('<') && !expr.includes('>') &&
          !expr.includes('!') && !expr.includes('&') && !expr.includes('|') &&
          !expr.includes("'") && !expr.includes('"') && !expr.includes('(') && !expr.includes(')')) {
          if (dir === '@model') this.evaluator.ensureVarInState(expr, true);
          else this.evaluator.ensureVarInState(expr);
        }
      });

      Object.values(vNode.subDirectives || {}).forEach(ev =>
        Object.values(ev).forEach(expr => {
          // Only ensure variables for simple variable names
          if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr.trim()) &&
            !expr.includes('=') && !expr.includes('<') && !expr.includes('>') &&
            !expr.includes('!') && !expr.includes('&') && !expr.includes('|') &&
            !expr.includes("'") && !expr.includes('"') && !expr.includes('(') && !expr.includes(')')) {
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
          if (dir === '@attr') continue;
          if (dir === '@then') continue;
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
        // Usa la classe ForDirective tramite il manager
        const forDirective = this.directiveManager.directives.get('@for');
        const stateWithInstance = { ...this.state, _ayishaInstance: this };
        return forDirective.apply(vNode, ctx, stateWithInstance, null, completionListener);
      }

      if (vNode.directives['@switch']) {
        // Usa la classe SwitchDirective tramite il manager
        const switchDirective = this.directiveManager.directives.get('@switch');
        const stateWithInstance = { ...this.state, _ayishaInstance: this };
        return switchDirective.apply(vNode, ctx, stateWithInstance, null, completionListener);
      }

      if (vNode.directives['@source']) {
        return this._handleFunctionalDirectives(vNode, ctx, completionListener);
      }

      if (vNode.tag === 'component') {
        if (vNode.directives['@page']) {
          const pageName = vNode.directives['@page'];
          const currentPage = this.state._currentPage || this.state.currentPage;
          if (String(pageName) !== String(currentPage)) {
            this._handleComponentDirective(vNode, ctx, completionListener);
            return null;
          }
        }
        return this._handleComponentDirective(vNode, ctx, completionListener);
      }

      if (vNode.tag === 'no') {
        return this._handleNoDirective(vNode, ctx);
      }

      const el = document.createElement(vNode.tag);
      // Prevent default submit for all forms (Ayisha global patch)
      if (vNode.tag === 'form') {
        el.addEventListener('submit', function (e) {
          e.preventDefault();
        });
      }
      // PATCH: Se c'è @go, aggiungi attributo identificativo
      if (vNode.directives && vNode.directives['@go'] && vNode._goId) {
        el.setAttribute('data-ayisha-go-id', vNode._goId);
        el.style.cursor = 'pointer';
      }

      Object.entries(vNode.attrs).forEach(([k, v]) => {
        el.setAttribute(k, this.evaluator.evalAttrValue(v, ctx));
      });

      // Pre-save original text for @text:hover and similar sub-directives
      if (vNode.subDirectives?.['@text']) {
        if (vNode.children && vNode.children.length > 0) {
          el._ayishaOriginalText = vNode.children
            .filter(child => child.type === 'text')
            .map(child => child.text)
            .join('');
        } else {
          el._ayishaOriginalText = el.textContent || el.innerText || '';
        }
      }

      this._handleSpecialDirectives(el, vNode, ctx);

      // Use the modular directive manager to apply all directives
      this.directiveManager.applyDirectives(vNode, ctx, this.state, el, completionListener);

      vNode.children.forEach(child => {
        const node = this._renderVNode(child, ctx);
        if (node) el.appendChild(node);
      });

      // Mark completion for sync directives if using completion listener
      // ULTRA-FIX: markSyncDone() must be called only ONCE and only if not already done, and only if total > 0
      if (completionListener && !completionListener.done && completionListener.total > 0) {
        completionListener.markSyncDone();
      }

      return el;
    }

    _handleFunctionalDirectives(vNode, ctx, completionListener = null) {
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

      if (completionListener) {
        completionListener.addTask(() => Promise.resolve());
      }

      if (used) return document.createComment('functional');
      return null;
    }

    _handleComponentDirective(vNode, ctx, completionListener = null) {
      const componentDirective = this.directiveManager.directives.get('@component');
      const stateWithInstance = { ...this.state, _ayishaInstance: this };
      return componentDirective.apply(vNode, ctx, stateWithInstance, null, completionListener);
    }

    _processComponentInitBlocks(tempDiv) {
      const initElements = tempDiv.querySelectorAll('init');
      const newInitBlocks = [];

      initElements.forEach(initEl => {
        const initContent = initEl.textContent.trim();
        if (initContent) {
          if (!this._initBlocks.includes(initContent)) {
            newInitBlocks.push(initContent);
            this._initBlocks.push(initContent);
          }
        }
        initEl.remove();
      });

      this._runInitBlocksImmediate(newInitBlocks);
    }

    _runInitBlocksImmediate(initBlocks) {
      initBlocks.forEach(code => {
        if (!code || !code.trim()) {
          return;
        }

        let cleanCode = code.trim()
          .replace(/[\u200B-\u200D\uFEFF]/g, '')
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .replace(/\n\s*\n/g, '\n')
          .replace(/\n\s+/g, '\n')
          .trim();

        let transformed = cleanCode;

        const lines = transformed.split('\n');
        const transformedLines = lines.map(line => {
          const trimmedLine = line.trim();

          if (!trimmedLine ||
            trimmedLine.startsWith('//') ||
            trimmedLine.startsWith('/*') ||
            trimmedLine.startsWith('function') ||
            trimmedLine.includes('function(') ||
            trimmedLine.includes('=>') ||
            /^(if|else|for|while|switch|case|default|try|catch|finally|return|var|let|const)\b/.test(trimmedLine)) {
            return line;
          }
          const assignmentMatch = trimmedLine.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+)$/);
          if (assignmentMatch &&
            !trimmedLine.includes('state.') &&
            !trimmedLine.includes('this.') &&
            !trimmedLine.includes('window.') &&
            !trimmedLine.includes('console.') &&
            !trimmedLine.includes('localStorage.') &&
            !trimmedLine.includes('sessionStorage.')) {
            const [, varName, value] = assignmentMatch;
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
      const span = document.createElement('span');

      if (vNode.rawContent !== undefined) {
        span.textContent = vNode.rawContent;
      } else {
        let rawContent = '';

        const collectTextContent = (node) => {
          if (typeof node === 'string') {
            return node;
          } else if (node.type === 'text') {
            return node.content || '';
          } else if (node.tag) {
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
      if (vNode.directives && vNode.directives['@set'] && !vNode._setProcessed) {
        const setExpr = vNode.directives['@set'];
        const setId = `${vNode.tag}-${JSON.stringify(vNode.attrs)}-${setExpr}`;
        if (!this._processedSetDirectives) this._processedSetDirectives = new Set();
        if (!this._processedSetDirectives.has(setId)) {
          this._processedSetDirectives.add(setId);
          try {
            // Only assign if variable does not exist or is undefined
            const assignmentRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=([^=].*)/g;
            let match;
            while ((match = assignmentRegex.exec(setExpr)) !== null) {
              const varName = match[1];
              if (!(varName in this.state) || this.state[varName] === undefined) {
                this.state[varName] = this.evaluator.evalExpr(match[2], ctx);
              }
            }
          } catch (e) {
            console.error('Error in @set directive:', e, 'Expression:', setExpr);
            el.setAttribute('data-ayisha-set-error', e.message);
          }
        }
        // Remove @set from VDOM so it doesn't interfere with other directives
        vNode._setProcessed = true;
        delete vNode.directives['@set'];
        // Remove element from DOM (if possible)
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
        return; // Do not process further directives for this node
      }

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

      if (vNode.directives.hasOwnProperty('@log')) {
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

          const directiveInfo = {
            tag: vNode.tag,
            directives: { ...vNode.directives },
            subDirectives: { ...vNode.subDirectives },
            elementInfo
          };

          el.setAttribute('data-ayisha-log', 'true');
          el.setAttribute('data-ayisha-log-info', JSON.stringify(directiveInfo));

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

    mount() {
      this.root.childNodes.forEach(child => {
        if (child.nodeType === 1 && child.tagName && child.tagName.toLowerCase() === 'init') {
          this.parser.parse(child);
        }
      });

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
      // PATCH: Make state reactive BEFORE running <init> blocks, so all assignments are tracked
      this._makeReactive();
      this._runInitBlocks();
      this.reactivitySystem.enableWatchers();
      this._setupRouting();
      this.router.setupCurrentPageProperty();

      this.preloadComponents().then(() => {
        if (!this._isRendering) {
          this.render();
        }
      });

      this.render();

      this.root.addEventListener('click', e => {
        let el = e.target;
        while (el && el !== this.root) {
          if (el.hasAttribute('@link')) {
            e.preventDefault();
            const targetPage = el.getAttribute('@link');

            // Determina il percorso corretto
            let finalPage = targetPage;
            if (targetPage.startsWith('/')) {
              finalPage = targetPage.substring(1);
            }

            this.state._currentPage = finalPage;
            this.render();
            return;
          }
          el = el.parentNode;
        }
      }, true);
    }
  }

  window.AyishaVDOM = AyishaVDOM;

  const addDefaultAnimationStyles = () => {
    const existingStyle = document.getElementById('ayisha-default-animations');
    if (!existingStyle) {
      const style = document.createElement('style');
      style.id = 'ayisha-default-animations';
      style.textContent = `
        /* FadeIn animation for both .fadeIn and .fade-in */
        .fadeIn, .fade-in {
          animation: ayishaFadeIn 0.3s ease-in-out;
        }

        @keyframes ayishaFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Slide-down animation */
        .slide-down {
          overflow: hidden;
          transition: height 0.3s ease-in-out;
        }

        /* Styles for @log display as sibling */
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

        /* Styles for @log error display */
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