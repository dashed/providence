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
const { valToKeyPath, newKeyPath } = utils;

/* constants */
const NOT_SET = {}; // sentinel value
const IDENTITY = (x) => x;
const INITIAL_KEYPATH = [];
// paths
const UNBOXER_PATH = ['root', 'unbox'];
const BOXER_PATH = ['root', 'box'];
const DATA_PATH = ['root', 'data'];
const KEYPATH_PATH = ['keyPath'];
const GETIN_PATH = ['getIn'];
const SETIN_PATH = ['setIn'];
const DELETEIN_PATH = ['deleteIn'];
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
    [KEYPATH_PATH, INITIAL_KEYPATH],
    [GETIN_PATH, _defaultGetIn],
    [SETIN_PATH, _defaultSetIn],
    [DELETEIN_PATH, _defaultDeleteIn]
];
const PATH = 0;
const VALUE = 1;

module.exports = Providence;

/**
 * Create a Providence cursor given options.
 * Options may either be plain object or an Immutable Map.
 *
 * @param {Object | Immutable Map} options [description]
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
    // this._cachedValue and value at keypath also hasn't changed.
    this._refUnboxedRootData = NOT_SET;
    this._cachedValue = NOT_SET;

    if(!skipDataCheck && this._options.getIn(DATA_PATH, NOT_SET) === NOT_SET) {
        throw new Error("value at path ['root', 'data'] is required!")
    }
}

Providence.prototype.constructor = Providence;
Providence.prototype.__utils = utils;

// TODO: add test case
Providence.prototype.toString = function() {
    return String(this.deref());
}

/**
 * Dereference by unboxing the root data and getting the value at keypath.
 *
 * @param  {[type]} notSetValue [description]
 * @return {[type]}             [description]
 */
// TODO: add test case for valueOf
Providence.prototype.valueOf =
Providence.prototype.deref = function(notSetValue) {

    const options = this._options;

    // unbox root data
    const { rootData, unboxed } = unboxRootData(options);

    // check if value was cached
    if(this._refUnboxedRootData === unboxed) {
        const resolvedValue = this._cachedValue;
        return resolvedValue === NOT_SET ? notSetValue : resolvedValue;
    }

    const keyPath = options.getIn(KEYPATH_PATH);
    const fetchGetIn = options.getIn(GETIN_PATH);
    const getIn = fetchGetIn(unboxed);

    const resolvedValue = getIn(keyPath, NOT_SET);

    // cache
    this._refUnboxedRootData = unboxed;
    this._cachedValue = resolvedValue;

    return resolvedValue === NOT_SET ? notSetValue : resolvedValue;
}

Providence.prototype.exists = function() {
    return(this.deref(NOT_SET) !== NOT_SET);
}

Providence.prototype.keypath =
Providence.prototype.keyPath = function() {
    return this._options.getIn(KEYPATH_PATH);
}

/**
 * Returns providence cursor's options. It is safe to modify this object since
 * it is an Immutable Map object.
 *
 * @return {Immutable Map}            Returns
 */
Providence.prototype.options = function() {
    return this._options;
}

/**
 * Create a new Providence object with options via this instance.
 *
 * @param  {[type]} newOptions [description]
 * @return {[type]}            [description]
 */
// TODO: consider a better name?
// TODO: might be better to consider instance.constructor. bikeshed?
Providence.prototype.new = function(newOptions) {
    return new (this.constructor)(newOptions);
}

/**
 * When given no arguments, return itself.
 *
 * @param  {[type]} keyValue [description]
 * @return {[type]}            [description]
 */
Providence.prototype.cursor = function(keyValue) {

    if(arguments.length === 0) {
        return this;
    }

    // TODO: overridable valToKeyPath; expect this to be a pure function
    // valToKeyPath converts keyValue to keyPath
    const subKeyPath = valToKeyPath(keyValue);

    // TODO: validateKeyPath that returns bool; expect this to be a pure function
    // be able to abort cursor procedure. aborting returns this instead.
    if(subKeyPath.length === 0) {
        return this;
    }

    const options = this._options;

    const keyPath = options.getIn(KEYPATH_PATH);
    const newOptions = options.setIn(KEYPATH_PATH, newKeyPath(keyPath, subKeyPath));

    return new (this.constructor)(newOptions, true, true);
}


/**
 * Update state at keypath.
 *
 * @param  {Function} updater [description]
 * @return {Providence}         [description]
 */
Providence.prototype.update = function(notSetValue, updater) {

    if(!updater) {
        updater = notSetValue;
        notSetValue = void 0;
    }

    const options = this._options;

    // unbox root data
    const { rootData, unboxed } = unboxRootData(options);

    // fetch state at keypath
    const fetchGetIn = options.getIn(GETIN_PATH);
    const getIn = fetchGetIn(unboxed);
    const keyPath = options.getIn(KEYPATH_PATH);
    const state = getIn(keyPath, notSetValue);

    // get new state
    //
    // call updater with:
    // - state      the object to be updated
    // - unboxed    unboxed root data
    // - rootData   boxed root data
    const newState = updater.call(null, state, unboxed, rootData);

    // TODO: delegate to an overridable: confirmChange(prev, next)
    if(state === newState) {
        return this;
    }

    // merge new state at keyPath into root data
    const fetchSetIn = options.getIn(SETIN_PATH);
    const setIn = fetchSetIn(unboxed);
    const newRootData = setIn(keyPath, newState);

    // box new root data
    const boxer = options.getIn(BOXER_PATH);
    const boxed = boxer(newRootData, rootData);

    callOnUpdate(options, keyPath, newRootData, unboxed);

    const newOptions = options.setIn(DATA_PATH, boxed);

    return new (this.constructor)(newOptions, true, true);
}

Providence.prototype.remove =
Providence.prototype.delete = function() {

    const options = this._options;

    // unbox root data
    const { rootData, unboxed } = unboxRootData(options);

    const fetchDeleteIn = options.getIn(DELETEIN_PATH);
    const deleteIn = fetchDeleteIn(unboxed);
    const keyPath = options.getIn(KEYPATH_PATH);
    const newRootData = deleteIn(keyPath);

    // TODO: delegate to an overridable: confirmChange(prev, next)
    if(unboxed === newRootData) {
        return this;
    }

    // box new root data
    const boxer = options.getIn(BOXER_PATH);
    const boxed = boxer(newRootData, rootData);

    callOnUpdate(options, keyPath, newRootData, unboxed);

    const newOptions = options.setIn(DATA_PATH, boxed);

    return new (this.constructor)(newOptions, true, true);
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
    const keyPath = getIn(KEYPATH_PATH, NOT_SET);

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

    if(keyPath !== NOT_SET) {
        setIn(KEYPATH_PATH, null);
    }

    options = Immutable.fromJS(options);

    // restore values
    if(rootData !== NOT_SET) {
        options = options.setIn(DATA_PATH, rootData);
        setIn(DATA_PATH, rootData);
    }

    if(keyPath !== NOT_SET) {
        options = options.setIn(KEYPATH_PATH, keyPath);
        setIn(KEYPATH_PATH, keyPath);
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

function unboxRootData(options) {
    const unboxer = options.getIn(UNBOXER_PATH);
    const rootData = options.getIn(DATA_PATH);
    return {
        rootData: rootData,
        unboxed: unboxer(rootData)
    };
}

function callOnUpdate(options, keyPath, newRoot, oldRoot) {
    const _onUpdate = options.getIn(_ONUPDATE_PATH, NOT_SET);
    if(_onUpdate !== NOT_SET) {
        _onUpdate.call(null, options, keyPath, newRoot, oldRoot);
    }

    const onUpdate = options.getIn(ONUPDATE_PATH, NOT_SET);
    if(onUpdate !== NOT_SET) {
        onUpdate.call(null, options, keyPath, newRoot, oldRoot);
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

function _defaultGetIn(rootData) {
    return rootData.getIn.bind(rootData);
}

function _defaultSetIn(rootData) {
    return rootData.setIn.bind(rootData);
}

function _defaultDeleteIn(rootData) {
    return rootData.deleteIn.bind(rootData);
}
