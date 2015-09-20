/**
 *
 * Abstract Om-style cursors that may be adapted to data structures of any type.
 * This intended to be an alternative to immutable-js Cursors.
 *
 * By default, Providence cursors will be unboxed to an Immutable object type.
 * However, Providence will not provide the default initial root data, which
 * should be provided by the caller.
 *
 */
const Immutable = require('immutable');
const { Map, Iterable } = Immutable;

const isPlainObject = require('lodash.isplainobject');
const objGet = require('lodash.get');
const objSet = require('lodash.set');
const objHas = require('lodash.has');

const utils = require('./utils');
// TODO: make these overridable externally
const { valToPath, newPath } = utils;

/* constants */
const NOT_SET = {}; // sentinel value
const IDENTITY = (x) => x;
const INITIAL_PATH = [];
// paths
const UNBOXER_PATH = ['root', 'unbox'];
const BOXER_PATH = ['root', 'box'];
const DATA_PATH = ['root', 'data'];
const PATH_PATH = ['path'];
const GETIN_PATH = ['getIn'];
const SETIN_PATH = ['setIn'];
const DELETEIN_PATH = ['deleteIn'];
const FOREACH_PATH = ['forEach'];
const REDUCE_PATH = ['reduce'];
const ONUPDATE_PATH = ['onUpdate'];
// Internal _onUpdate function; useful for when Providence is inherited.
// Whereas, onUpdate function is used by users.
const _ONUPDATE_PATH = ['_onUpdate'];

// DEFAULTS is an array of 2-tuple arrays where the first element of the tuple is the key path
// to be checked, and the second element is the function that will be called to generate the value
// to be used to set on the key path in the case that there is no value set in the key path.
const DEFAULTS = [
    [UNBOXER_PATH, IDENTITY],
    [BOXER_PATH, IDENTITY],
    [PATH_PATH, INITIAL_PATH],
    [GETIN_PATH, _default.bind(null, 'getIn')],
    [SETIN_PATH, _default.bind(null, 'setIn')],
    [DELETEIN_PATH, _default.bind(null, 'deleteIn')],
    [FOREACH_PATH, _default.bind(null, 'forEach')],
    [REDUCE_PATH, _default.bind(null, 'reduce')]
];
const PATH = 0;
const VALUE = 1;

module.exports = Providence;

/**
 * Create a Providence cursor given options.
 * Options may either be plain object or an Immutable Map.
 *
 * @param {Object | Immutable Map} options Defines the character of the providence cursor.
 */
function Providence(options = NOT_SET, skipDataCheck = false, skipProcessOptions = false) {

    if(options === NOT_SET) {
        throw new Error('Expected options to be a plain object or an Immutable Map');
    }

    // This will not support constructors that are extending Providence.
    // They should provide their own setup in their constructor function.
    if(!(this instanceof Providence)) {
        return new Providence(options, skipDataCheck, skipProcessOptions);
    }

    this._options = skipProcessOptions ? options : processOptions(options);

    // Used for caching value of the Providence object.
    // When the unboxed root data and this._refUnboxedRootData are equal,
    // then unboxed root data hasn't changed since the previous look up, and thus
    // this._cachedValue and value at path also hasn't changed.
    this._refUnboxedRootData = NOT_SET;
    this._cachedValue = NOT_SET;

    if(!skipDataCheck && this._options.getIn(DATA_PATH, NOT_SET) === NOT_SET) {
        throw new Error("value at path ['root', 'data'] is required!")
    }
}

Providence.prototype.constructor = Providence;
Providence.prototype.__utils = utils;

/**
 * Returns string representation of `this.deref()`.
 *
 * @return {String}
 */
Providence.prototype.toString = function() {
    return String(this.deref());
}

/**
 * Dereference by unboxing the root data and getting the value at path.
 * If path happens to not exist, notSetValue is, instead, returned.
 * If notSetValue is not provided, it becomes value: void 0.
 *
 * @param  {any} notSetValue
 * @return {any}             The sub-structure value at path relative to
 *                           root data.
 */
Providence.prototype.valueOf =
Providence.prototype.deref = function(notSetValue) {

    const options = this._options;

    // unbox root data
    const { rootData, unboxed } = this.unboxRootData();

    // check if value was cached
    if(this._refUnboxedRootData === unboxed) {
        const resolvedValue = this._cachedValue;
        return resolvedValue === NOT_SET ? notSetValue : resolvedValue;
    }

    const path = options.getIn(PATH_PATH);
    const fetchGetIn = options.getIn(GETIN_PATH);
    const getIn = fetchGetIn(unboxed);

    const resolvedValue = getIn(path, NOT_SET);

    // cache
    this._refUnboxedRootData = unboxed;
    this._cachedValue = resolvedValue;

    return resolvedValue === NOT_SET ? notSetValue : resolvedValue;
}

/**
 * Return true if a path exists within the unboxed root data.
 *
 * @return {Bool}
 */
Providence.prototype.exists = function() {
    return(this.deref(NOT_SET) !== NOT_SET);
}

/**
 * Returns the array representation of the path.
 *
 * @type {Array}
 */
Providence.prototype.path = function() {
    return this._options.getIn(PATH_PATH).slice();
}

/**
 * Returns providence cursor's options. It is safe to modify this object since
 * it is an Immutable Map object; and any changes will not reflect back to the
 * originating cursor, unless it is used as the new options.
 *
 * @return {Immutable Map}
 */
Providence.prototype.options = function() {
    return this._options;
}

/**
 * Create a new Providence object with options via this instance.
 *
 * @param  {Immutable Map | Object} newOptions
 * @return {Providence}
 */
Providence.prototype.new = function(newOptions) {
    return new (this.constructor)(newOptions);
}

/**
 * When given no arguments, return itself.
 *
 * By default, this is the same behaviour as cursor() method for immutable-js
 * cursors:
 * - Returns a sub-cursor following the path keyValue starting from this cursor.
 * - If keyValue is not an array, an array containing keyValue is instead used.
 *
 * @param  {any | array } keyValue
 * @return {Providence}
 */
Providence.prototype.cursor = function(keyValue) {

    if(arguments.length === 0) {
        return this;
    }

    // TODO: overridable valToPath; expect this to be a pure function
    // valToPath converts keyValue to path
    const subpath = valToPath(keyValue);

    // TODO: validateKeyPath that returns bool; expect this to be a pure function
    // be able to abort cursor procedure. aborting returns this instead.
    if(subpath.length === 0) {
        return this;
    }

    const options = this._options;

    const path = options.getIn(PATH_PATH);
    const newOptions = options.setIn(PATH_PATH, newPath(path, subpath));

    return new (this.constructor)(newOptions, true, true);
}


/**
 * Update value in the unboxed root data at path using the updater function.
 * If the path exists, updater is called using:
 * - the value at path
 * - unboxed root data
 * - boxed root data
 *
 * If path doesn't exist, notSetValue is used as the initial value.
 * If notSetValue is not defined, it has value void 0.
 *
 * If updater returns the same value the value at path (or notSetValue),
 * then no changes has truly occured, and the current cursor is instead returned.
 *
 * Otherwise, the new value is replaced at path of the unboxed root data,
 * and a new providence cursor is returned with the new boxed root data.
 * In addition, any defined functions at onUpdate and/or _onUpdate within options
 * will be called with the following:
 * - options
 * - cursor path
 * - new unboxed root data with the new value
 * - previous unboxed root data
 *
 * @param  {any} notSetValue
 * @param  {Function} updater
 * @return {Providence}
 */
Providence.prototype.update = function(notSetValue, updater) {

    if(!updater) {
        updater = notSetValue;
        notSetValue = void 0;
    }

    const options = this._options;

    // unbox root data
    const { rootData, unboxed } = this.unboxRootData();

    // fetch state at path
    const fetchGetIn = options.getIn(GETIN_PATH);
    const getIn = fetchGetIn(unboxed);
    const path = options.getIn(PATH_PATH);
    const state = getIn(path, NOT_SET);

    // get new state
    //
    // call updater with:
    // - state      the object to be updated
    // - unboxed    unboxed root data
    // - rootData   boxed root data
    const newState = updater.call(null, state === NOT_SET ? notSetValue : state, unboxed, rootData);

    // TODO: delegate to an overridable: confirmChange(prev, next)
    if(state === newState) {
        return this;
    }

    // merge new state at path into root data
    const fetchSetIn = options.getIn(SETIN_PATH);
    const setIn = fetchSetIn(unboxed);
    const newRootData = setIn(path, newState);

    // box new root data
    const boxer = options.getIn(BOXER_PATH);
    const boxed = boxer(newRootData, rootData);

    callOnUpdate(options, path, newRootData, unboxed);

    const newOptions = options.setIn(DATA_PATH, boxed);

    return new (this.constructor)(newOptions, true, true);
}

/**
 * Delete value at path.
 *
 * If the new unboxed root data is the same as the previous, original unboxed root data,
 * then the current cursor is returned.
 *
 * Otherwise, any defined functions at onUpdate and/or _onUpdate within options
 * will be called with the following:
 * - options
 * - cursor path
 * - new unboxed root data with the new value
 * - previous unboxed root data
 *
 * In addition, the new providence cursor containing the new unboxed root data
 * will be returned.
 *
 * @type {Providence}
 */
Providence.prototype.remove =
Providence.prototype.delete = function() {

    const options = this._options;

    // unbox root data
    const { rootData, unboxed } = this.unboxRootData();

    const fetchDeleteIn = options.getIn(DELETEIN_PATH);
    const deleteIn = fetchDeleteIn(unboxed);
    const path = options.getIn(PATH_PATH);
    const newRootData = deleteIn(path);

    // TODO: delegate to an overridable: confirmChange(prev, next)
    if(unboxed === newRootData) {
        return this;
    }

    // box new root data
    const boxer = options.getIn(BOXER_PATH);
    const boxed = boxer(newRootData, rootData);

    callOnUpdate(options, path, newRootData, unboxed);

    const newOptions = options.setIn(DATA_PATH, boxed);

    return new (this.constructor)(newOptions, true, true);
}

Providence.prototype.forEach = function(sideEffect, ...rest) {

    const state = this.deref(NOT_SET);
    if(state === NOT_SET) {
        return;
    }

    const fetchForEach = this._options.getIn(FOREACH_PATH);
    const forEach = fetchForEach(state);

    const wrapped = (value, key, ..._rest) => {
        const cursor = this.cursor(key);
        return sideEffect.call(sideEffect, cursor, key, ..._rest);
    }

    return forEach(wrapped, ...rest);
}

Providence.prototype.reduce = function(reducer, ...rest) {

    const state = this.deref(NOT_SET);
    if(state === NOT_SET) {
        return;
    }

    const fetchReduce = this._options.getIn(REDUCE_PATH);
    const reduce = fetchReduce(state);

    const wrapped = (accumulator, value, key, ..._rest) => {
        const cursor = this.cursor(key);
        return reducer.call(reducer, accumulator, cursor, key, ..._rest);
    }

    return reduce(wrapped, ...rest);
}

Providence.prototype.root = function() {
    const newOptions = this._options.setIn(PATH_PATH, []);
    return new (this.constructor)(newOptions, true, true);
}

Providence.prototype.unboxRootData = function() {
    const options = this._options;

    const unboxer = options.getIn(UNBOXER_PATH);
    const rootData = options.getIn(DATA_PATH);
    return {
        rootData: rootData,
        unboxed: unboxer(rootData)
    };
}

/* helpers */

// Process and convert options to an Immutable Map if it isn't one already.
//
// processOptions is called whenever a new Providence object is created.
//
// We take advantage of structural sharing (a la flyweight) when a child
// Providence object inherit options from its parent.
function processOptions(options) {
    options = validateOptions(options);

    return options;
}

const __immutableSetIfNotSet = setIfNotSet.bind(null, _ImmutableHasIn, _ImmutableSetIn);
const immutableValidateOptions = __validateOptions.bind(null, __immutableSetIfNotSet);

const __plainSetIfNotSet = setIfNotSet.bind(null, _plainHasIn, _plainSetIn);
const plainValidateOptions = __validateOptions.bind(null, __plainSetIfNotSet);

function validateOptions(options) {

    if(Map.isMap(options)) {
        return immutableValidateOptions(options);
    }

    if(Iterable.isIterable(options)) {
        throw new Error('Expected options to be an Immutable Map!');
    }

    if(!isPlainObject(options)) {
        throw new Error('Expected options to be a plain object');
    }

    options = plainValidateOptions(options);

    // preserve values that Immutable.fromJS may transform; which is undesirable.
    const getIn = _plainGetIn(options);
    const setIn = _plainSetIn(options);

    const rootData = getIn(DATA_PATH, NOT_SET);
    const path = getIn(PATH_PATH, NOT_SET);

    // Set null values for paths so that they're not transformed by Immutable.fromJS().
    // We do this in case that rootData is a deeply nested plain object.
    //
    // NOTE: This is a side-effect; we restore the values later.
    //
    // TODO: document this side-effect and potential for unintended effect
    // with Object.observe(...)
    if(rootData !== NOT_SET) {
        setIn(DATA_PATH, null);
    }

    if(path !== NOT_SET) {
        setIn(PATH_PATH, null);
    }

    options = Immutable.fromJS(options);

    // restore values
    if(rootData !== NOT_SET) {
        options = options.setIn(DATA_PATH, rootData);
        setIn(DATA_PATH, rootData);
    }

    if(path !== NOT_SET) {
        options = options.setIn(PATH_PATH, path);
        setIn(PATH_PATH, path);
    }

    return options;
}

function __validateOptions(_setIfNotSet, _options) {

    let options = _options;
    let n = DEFAULTS.length;

    while(n-- > 0) {
        const current = DEFAULTS[n];
        options = _setIfNotSet(options, current[PATH], current[VALUE]);
    }

    return options;
}

function setIfNotSet(_fetchHasIn, _fetchSetIn, options, path, value) {

    const _hasIn = _fetchHasIn(options);

    if(!_hasIn(path)) {
        const _setIn = _fetchSetIn(options);
        return _setIn(path, value);
    }

    return options;
}

function callOnUpdate(options, path, newRoot, oldRoot) {
    const _onUpdate = options.getIn(_ONUPDATE_PATH, NOT_SET);
    if(_onUpdate !== NOT_SET) {
        _onUpdate.call(null, options, path.slice(), newRoot, oldRoot);
    }

    const onUpdate = options.getIn(ONUPDATE_PATH, NOT_SET);
    if(onUpdate !== NOT_SET) {
        onUpdate.call(null, options, path.slice(), newRoot, oldRoot);
    }
}

function _plainHasIn(obj) {
    return objHas.bind(objHas, obj);
}

function _plainSetIn(obj) {
    return objSet.bind(objSet, obj);
}

function _plainGetIn(obj) {
    return objGet.bind(objGet, obj);
}

function _ImmutableHasIn(obj) {
    return obj.hasIn.bind(obj);
}

function _ImmutableSetIn(obj) {
    return obj.setIn.bind(obj);
}

function _default(method, rootData) {
    return rootData[method].bind(rootData);
}
