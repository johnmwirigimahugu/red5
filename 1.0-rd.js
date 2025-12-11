/** Red5.js - Universal Enterprise Full-Stack Framework - version 1.0 */
/**
 * Red5.js - Universal Enterprise Full-Stack Framework
 * Version: 1.0.0
 * 
 * Combines PA.js backend and go.js frontend capabilities into one universal framework
 * 
 * @Author: John Mwirigi Mahugu - "Kesh"
 * @License: MIT
 * @Repository: https://github.com/red5js/red5
 * @Updated: December 2024
 */

(function(global) {
    "use strict";

    // Environment Detection
    const isServer = typeof window === 'undefined';
    const isBrowser = !isServer;
    const isNode = isServer && typeof process !== 'undefined' && process.versions && process.versions.node;

    // Core Framework Container
    const Red5 = {
        version: '1.0.0',
        env: isServer ? 'server' : 'client',
        
        // Core utilities
        utils: {},
        
        // Server-specific modules (will be populated on server)
        server: {},
        
        // Client-specific modules (will be populated in browser)
        client: {},
        
        // Shared modules
        shared: {},
        
        // Plugin system
        plugins: new Map(),
        
        // Event emitter
        events: null
    };

    // Initialize Event Emitter (universal)
    class RdEventEmitter {
        constructor() {
            this.events = new Map();
        }
        
        on(event, listener) {
            if (!this.events.has(event)) {
                this.events.set(event, []);
            }
            this.events.get(event).push(listener);
            return this;
        }
        
        emit(event, ...args) {
            if (this.events.has(event)) {
                this.events.get(event).forEach(listener => listener(...args));
            }
            return this;
        }
        
        off(event, listener) {
            if (this.events.has(event)) {
                const listeners = this.events.get(event);
                const index = listeners.indexOf(listener);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }
            return this;
        }
    }

    Red5.events = new RdEventEmitter();

    // Universal Utilities
    Red5.utils = {
        // UUID generation
        uuid: () => {
            if (isNode) {
                const { randomUUID } = require('crypto');
                return randomUUID();
            } else {
                return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
                    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
            }
        },

        // Hashing
        hash: (data) => {
            if (isNode) {
                const { createHash } = require('crypto');
                return createHash('sha256').update(data).digest('hex');
            } else {
                // Simple browser hash (consider using crypto.subtle in production)
                let hash = 0;
                for (let i = 0; i < data.length; i++) {
                    const char = data.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                return Math.abs(hash).toString(16);
            }
        },

        // Debounce
        debounce: (fn, ms) => {
            let t;
            return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
        },

        // Deep merge
        merge: (target, source) => {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    target[key] = target[key] || {};
                    Red5.utils.merge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
            return target;
        },

        // Cookie handling (browser only)
        cookie: isBrowser ? {
            get: () => Object.fromEntries(document.cookie.split(';').map(c => 
                c.trim().split('=').map(decodeURIComponent))),
            set: (name, value, options = {}) => {
                let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
                if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
                if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
                if (options.domain) cookie += `; Domain=${options.domain}`;
                if (options.path) cookie += `; Path=${options.path}`;
                if (options.secure) cookie += `; Secure`;
                if (options.httpOnly) cookie += `; HttpOnly`;
                if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
                document.cookie = cookie;
            }
        } : null,

        // File system utilities (server only)
        fs: isNode ? require('fs').promises : null,

        // HTTP utilities
        http: {
            // Make HTTP request (universal)
            request: async (url, options = {}) => {
                if (isNode) {
                    const https = require('https');
                    const http = require('http');
                    const { URL } = require('url');
                    
                    return new Promise((resolve, reject) => {
                        const parsedUrl = new URL(url);
                        const lib = parsedUrl.protocol === 'https:' ? https : http;
                        
                        const req = lib.request(url, options, (res) => {
                            let data = '';
                            res.on('data', chunk => data += chunk);
                            res.on('end', () => {
                                try {
                                    resolve({
                                        status: res.statusCode,
                                        headers: res.headers,
                                        data: options.json ? JSON.parse(data) : data
                                    });
                                } catch (e) {
                                    resolve({ status: res.statusCode, headers: res.headers, data });
                                }
                            });
                        });
                        
                        req.on('error', reject);
                        if (options.body) req.write(options.body);
                        req.end();
                    });
                } else {
                    const response = await fetch(url, options);
                    const data = options.json ? await response.json() : await response.text();
                    return {
                        status: response.status,
                        headers: Object.fromEntries(response.headers.entries()),
                        data
                    };
                }
            }
        }
    };

    // Template Engine (Universal)
    class RdTemplate {
        constructor() {
            this.cache = new Map();
        }

        // Parse template string
        parse(template) {
            return template.replace(/{{\s*([^}]+)\s*}}/g, (match, expr) => {
                return `\${this.evalExpression('${expr}', data)}`;
            });
        }

        // Evaluate expression safely
        evalExpression(expr, data) {
            try {
                // Simple expression evaluation (consider using a proper expression parser)
                const parts = expr.split('.');
                let value = data;
                for (const part of parts) {
                    value = value?.[part];
                }
                return value !== undefined ? value : '';
            } catch (e) {
                return '';
            }
        }

        // Render template with data
        render(template, data) {
            const parsed = this.parse(template);
            return new Function('data', `return \`${parsed}\``)(data);
        }
    }

    Red5.shared.Template = new RdTemplate();

    // ==================== SERVER-SIDE COMPONENTS ====================
    if (isServer && isNode) {
        const { createServer } = require('http');
        const { parse } = require('url');
        const path = require('path');

        // Red5 Server Class
        class RdServer extends RdEventEmitter {
            constructor() {
                super();
                this.middleware = [];
                this.routes = {};
                this.config = {};
                this.services = new Map();
                this.staticDirs = [];
                this.sessionStore = new Map();
                this.cache = new Map();
            }

            // Use middleware
            use(middleware) {
                this.middleware.push(middleware);
                return this;
            }

            // Define route
            route(method, path, handler) {
                const key = `${method.toUpperCase()} ${path}`;
                this.routes[key] = { handler, middleware: [...this.middleware] };
                return this;
            }

            // Shorthand methods
            get(path, handler) { return this.route('GET', path, handler); }
            post(path, handler) { return this.route('POST', path, handler); }
            put(path, handler) { return this.route('PUT', path, handler); }
            delete(path, handler) { return this.route('DELETE', path, handler); }

            // Handle requests
            async handleRequest(req, res) {
                // Enhance response
                res.status = (code) => { res.statusCode = code; return res; };
                res.json = (data) => {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                };
                res.send = (data) => res.end(data);
                res.redirect = (url, code = 302) => {
                    res.writeHead(code, { Location: url });
                    res.end();
                };

                try {
                    const parsedUrl = parse(req.url, true);
                    req.pathname = parsedUrl.pathname;
                    req.query = parsedUrl.query;
                    req.body = {};

                    // Find route
                    const routeKey = `${req.method} ${req.pathname}`;
                    const route = this.routes[routeKey];

                    if (!route) {
                        res.status(404).json({ error: 'Not Found' });
                        return;
                    }

                    // Execute middleware
                    let index = 0;
                    const next = async (err) => {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        if (index < route.middleware.length) {
                            await route.middleware[index++](req, res, next);
                        } else {
                            await route.handler(req, res);
                        }
                    };

                    await next();
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            }

            // Start server
            listen(port, callback) {
                const server = createServer(this.handleRequest.bind(this));
                server.listen(port, callback);
                return server;
            }
        }

        // ORM (Red5 Database)
        class RdDatabase {
            constructor() {
                this.tables = new Map();
                this.schemas = new Map();
                this.dbPath = './.red5_data';
            }

            // Setup database
            async setup(config = {}) {
                this.dbPath = config.dbPath || this.dbPath;
                await Red5.utils.fs.mkdir(this.dbPath, { recursive: true });
                await this.loadSchemas();
            }

            // Load schemas
            async loadSchemas() {
                try {
                    const data = await Red5.utils.fs.readFile(
                        path.join(this.dbPath, '_schemas.json'), 'utf8'
                    );
                    const schemas = JSON.parse(data);
                    for (const [table, schema] of Object.entries(schemas)) {
                        this.schemas.set(table, schema);
                    }
                } catch (e) {
                    // File doesn't exist yet
                }
            }

            // Save schemas
            async saveSchemas() {
                const schemas = Object.fromEntries(this.schemas);
                await Red5.utils.fs.writeFile(
                    path.join(this.dbPath, '_schemas.json'),
                    JSON.stringify(schemas, null, 2)
                );
            }

            // Migrate table
            async migrate(table, schema) {
                this.schemas.set(table, schema);
                await this.saveSchemas();
                
                const tablePath = path.join(this.dbPath, `${table}.json`);
                try {
                    await Red5.utils.fs.access(tablePath);
                } catch {
                    await Red5.utils.fs.writeFile(tablePath, '[]');
                }
                
                return this;
            }

            // Create new record
            async dispense(table) {
                if (!this.schemas.has(table)) {
                    await this.migrate(table, { id: 'string' });
                }
                return { id: Red5.utils.uuid(), __type: table };
            }

            // Save record
            async store(record) {
                const table = record.__type;
                if (!table || !record.id) {
                    throw new Error('Record must have __type and id');
                }

                const tablePath = path.join(this.dbPath, `${table}.json`);
                let records = [];
                
                try {
                    const data = await Red5.utils.fs.readFile(tablePath, 'utf8');
                    records = JSON.parse(data);
                } catch (e) {
                    // File doesn't exist
                }

                const index = records.findIndex(r => r.id === record.id);
                if (index > -1) {
                    records[index] = record;
                } else {
                    records.push(record);
                }

                await Red5.utils.fs.writeFile(tablePath, JSON.stringify(records, null, 2));
                return record;
            }

            // Find records
            async find(table, conditions = {}) {
                const tablePath = path.join(this.dbPath, `${table}.json`);
                try {
                    const data = await Red5.utils.fs.readFile(tablePath, 'utf8');
                    let records = JSON.parse(data);
                    
                    if (Object.keys(conditions).length > 0) {
                        records = records.filter(record => {
                            return Object.entries(conditions).every(([key, value]) => {
                                return record[key] === value;
                            });
                        });
                    }
                    
                    return records;
                } catch (e) {
                    return [];
                }
            }

            // Find one record
            async findOne(table, conditions) {
                const records = await this.find(table, conditions);
                return records[0] || null;
            }

            // Load by ID
            async load(table, id) {
                return this.findOne(table, { id });
            }

            // Delete record
            async trash(record) {
                const table = record.__type;
                const tablePath = path.join(this.dbPath, `${table}.json`);
                
                try {
                    const data = await Red5.utils.fs.readFile(tablePath, 'utf8');
                    let records = JSON.parse(data);
                    records = records.filter(r => r.id !== record.id);
                    await Red5.utils.fs.writeFile(tablePath, JSON.stringify(records, null, 2));
                    return true;
                } catch (e) {
                    return false;
                }
            }
        }

        // Initialize server components
        Red5.server = {
            Server: RdServer,
            Database: RdDatabase,
            db: new RdDatabase()
        };
    }

    // ==================== CLIENT-SIDE COMPONENTS ====================
    if (isBrowser) {
        // Red5 Client Router
        class RdRouter {
            constructor() {
                this.routes = new Map();
                this.current = null;
                this.middleware = [];
            }

            // Add route
            add(path, component, middleware = []) {
                this.routes.set(path, { component, middleware });
                return this;
            }

            // Navigate to route
            navigate(path) {
                window.history.pushState({}, '', path);
                this.match(path);
            }

            // Match route
            match(path) {
                for (const [routePath, route] of this.routes) {
                    const regex = new RegExp(`^${routePath.replace(/:[^/]+/g, '([^/]+)')}$`);
                    const match = path.match(regex);
                    if (match) {
                        const params = {};
                        const paramNames = (routePath.match(/:[^/]+/g) || []).map(p => p.substring(1));
                        paramNames.forEach((name, i) => {
                            params[name] = match[i + 1];
                        });
                        
                        this.current = { path, component: route.component, params };
                        this.emit('route', this.current);
                        return this.current;
                    }
                }
                return null;
            }
        }

        // Red5 Reactive State
        class RdState {
            constructor(initial = {}) {
                this.state = initial;
                this.watchers = [];
            }

            // Get state
            get(key) {
                return key ? this.state[key] : this.state;
            }

            // Set state
            set(key, value) {
                if (typeof key === 'object') {
                    this.state = { ...this.state, ...key };
                } else {
                    this.state[key] = value;
                }
                this.notify();
            }

            // Watch state changes
            watch(callback) {
                this.watchers.push(callback);
                return () => {
                    const index = this.watchers.indexOf(callback);
                    if (index > -1) this.watchers.splice(index, 1);
                };
            }

            // Notify watchers
            notify() {
                this.watchers.forEach(w => w(this.state));
            }
        }

        // Red5 Component System
        class RdComponent {
            constructor(name, options = {}) {
                this.name = name;
                this.data = options.data || (() => ({}));
                this.template = options.template || '';
                this.methods = options.methods || {};
                this.mounted = options.mounted || (() => {});
                this.state = new RdState(this.data());
                this.el = null;
            }

            // Mount component
            mount(selector) {
                this.el = document.querySelector(selector);
                if (this.el) {
                    this.render();
                    this.bindEvents();
                    this.mounted();
                    this.state.watch(() => this.render());
                }
            }

            // Render component
            render() {
                if (!this.el) return;
                
                const data = { ...this.state.get(), ...this.methods };
                this.el.innerHTML = Red5.shared.Template.render(this.template, data);
                
                // Process directives
                this.processDirectives();
            }

            // Process directives
            processDirectives() {
                const directives = {
                    'rd-show': (el, value) => {
                        el.style.display = value ? '' : 'none';
                    },
                    'rd-hide': (el, value) => {
                        el.style.display = value ? 'none' : '';
                    },
                    'rd-text': (el, value) => {
                        el.textContent = value;
                    },
                    'rd-html': (el, value) => {
                        el.innerHTML = value;
                    },
                    'rd-model': (el, value) => {
                        el.value = value;
                        el.addEventListener('input', (e) => {
                            const key = el.getAttribute('rd-model');
                            this.state.set(key, e.target.value);
                        });
                    },
                    'rd-click': (el, value) => {
                        el.addEventListener('click', (e) => {
                            const method = this.methods[value];
                            if (method) method.call(this, e);
                        });
                    },
                    'rd-submit': (el, value) => {
                        el.addEventListener('submit', (e) => {
                            e.preventDefault();
                            const method = this.methods[value];
                            if (method) method.call(this, e);
                        });
                    }
                };

                // Process all elements with directives
                this.el.querySelectorAll('[rd-show], [rd-hide], [rd-text], [rd-html], [rd-model], [rd-click], [rd-submit]').forEach(el => {
                    for (const [attr, handler] of Object.entries(directives)) {
                        if (el.hasAttribute(attr)) {
                            const value = el.getAttribute(attr);
                            const evaluated = this.evaluateExpression(value);
                            handler(el, evaluated);
                        }
                    }
                });
            }

            // Evaluate expression
            evaluateExpression(expr) {
                const data = this.state.get();
                try {
                    return new Function('data', `with(data) { return ${expr} }`)(data);
                } catch (e) {
                    return null;
                }
            }

            // Bind events
            bindEvents() {
                // Events are bound in processDirectives
            }
        }

        // Red5 HTTP Client
        class RdHttpClient {
            constructor(baseURL = '') {
                this.baseURL = baseURL;
                this.headers = {};
            }

            // Set header
            setHeader(name, value) {
                this.headers[name] = value;
            }

            // Make request
            async request(method, url, options = {}) {
                const fullUrl = this.baseURL + url;
                const response = await fetch(fullUrl, {
                    method,
                    headers: { ...this.headers, ...options.headers },
                    body: options.body ? JSON.stringify(options.body) : undefined,
                    ...options
                });
                
                const data = await response.json();
                return { status: response.status, data, headers: response.headers };
            }

            // Shorthand methods
            get(url, options) { return this.request('GET', url, options); }
            post(url, body, options) { return this.request('POST', url, { body, ...options }); }
            put(url, body, options) { return this.request('PUT', url, { body, ...options }); }
            delete(url, options) { return this.request('DELETE', url, options); }
        }

        // Initialize client components
        Red5.client = {
            Router: RdRouter,
            State: RdState,
            Component: RdComponent,
            Http: RdHttpClient,
            router: new RdRouter(),
            http: new RdHttpClient(),
            components: new Map(),
            
            // Register component
            component(name, options) {
                const component = new RdComponent(name, options);
                this.components.set(name, component);
                return component;
            },
            
            // Mount app
            mount(selector) {
                // Auto-mount components based on element tags
                document.querySelectorAll('[rd-component]').forEach(el => {
                    const name = el.getAttribute('rd-component');
                    const component = this.components.get(name);
                    if (component) {
                        component.mount(el);
                    }
                });
            }
        };

        // Auto-initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                Red5.client.mount('[rd-app]');
            });
        } else {
            Red5.client.mount('[rd-app]');
        }
    }

    // ==================== UNIVERSAL API ====================
    
    // Universal Component Factory
    Red5.component = function(name, options) {
        if (isBrowser) {
            return Red5.client.component(name, options);
        } else {
            // Server-side component registration
            return options;
        }
    };

    // Universal HTTP client
    Red5.http = function(baseURL) {
        if (isBrowser) {
            return new Red5.client.Http(baseURL);
        } else {
            return Red5.utils.http;
        }
    };

    // Universal Database access
    Red5.db = isServer ? Red5.server.db : null;

    // Universal Router
    Red5.router = isBrowser ? Red5.client.router : null;

    // Plugin System
    Red5.use = function(plugin) {
        if (typeof plugin === 'function') {
            plugin(Red5);
        } else if (plugin && typeof plugin.install === 'function') {
            plugin.install(Red5);
        }
        return Red5;
    };

    // Export based on environment
    if (isServer && isNode) {
        module.exports = Red5;
    } else {
        global.Red5 = Red5;
    }

})(typeof window !== 'undefined' ? window : global);
