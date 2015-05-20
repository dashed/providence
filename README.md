# providence [![Build Status](https://travis-ci.org/Dashed/providence.svg)](https://travis-ci.org/Dashed/providence)

> Reference a sub-structure of any data structure.

## Usage

```
$ npm install --save providence
```

### API

##### `Providence(options)`

Creates a new `Providence` cursor instance. May be called without the `new` keyword.

**options**:  May either be a plain object or an `Immutable.Map`.

```js
const Providence = require('providence');

const cursor = new Providence({
    root: {
        data: Immutable.Map()
    }
});

const cursor2 = Providence({
    root: {
        data: Immutable.Map()
    }
});
```

##### `options`

**options.root.data** 

The "boxed" root data structure. The user must provide this.

**options.keyPath**

An array of the keypath.

**options.root.unbox** 

Function that will given value at `options.root.data`, and "unbox" into the value used in `deref()`/`valueOf()`, `update()`, and `delete()`/`remove()`.

By default this is an identity function (e.g. `function(x) {return x;}`).

*NOTE:* It's expected that this is the inverse of `options.root.box`.

**options.root.box** 

Function that will "box" a value back into a new value that will be written into `options.root.data`.

This is used for updating/modifying values done through `update()` and `delete()` methods.

By default this is an identity function (e.g. `function(x) {return x;}`).

*NOTE:* It's expected that this is the inverse of `options.root.unbox`.

**options.getIn** 

A higher order function, which given the unboxed root data, shall return a function, `getIn`, with the signature: `getIn(keypath[, notSetValue])`.

This is used internally for `deref()` and `update()`.

By default this is:
```js
function _defaultGetIn(rootData) {
    return rootData.getIn.bind(rootData);
}
```

**options.setIn** 

A higher order function, which given the unboxed root data, shall return a function, `setIn`, with the signature: `setIn(keypath, newvalue)`.

This is used internally for `update()`.

By default this is:
```js
function _defaultSetIn(rootData) {
    return rootData.setIn.bind(rootData);
}
```

**options.deleteIn** 

A higher order function, which given the unboxed root data, shall return a function, `deleteIn`, with the signature: `deleteIn(keypath)`.

This is used internally for `delete()`.

```js
function _defaultDeleteIn(rootData) {
    return rootData.deleteIn.bind(rootData);
}
```

**options.onUpdate**

Called when there is a new value change in either `update()` or `delete()` operations.

**options._onUpdate**

Called when there is a new value change in either `update()` or `delete()` operations.

If you're extending the `Providence` constructor and want to subscribe to changes of either `update()` or `delete()` operations; set your function `options._onUpdate`.

*NOTE:* The end-user shall not set their function at `options._onUpdate`, and should instead set it at `options.onUpdate`.

##### `Providence.prototype.constructor`

By default, this points to `Providence`. This is
If you're extending `Providence`, ensure that `constructor` is set: `AnotherConstructor.prototype.constructor = AnotherConstructor`.

##### `Providence.prototype.toString()`

Returns string representation of `this.deref()`.

##### `Providence.prototype.valueOf([notSetValue])`

Alias of `Providence.prototype.deref([notSetValue])`.

##### `Providence.prototype.deref([notSetValue])`

Dereference by unboxing the root data and getting the value at keypath.

If keypath happens to not exist, `notSetValue` is, instead, returned.
If `notSetValue` is not provided, it becomes value: `void 0`.

##### `Providence.prototype.exists()`

Return true if a keypath exists within the unboxed root data.

##### `Providence.prototype.keyPath()`

Returns the array representation of the keypath.

##### `Providence.prototype.keypath()`

Alias of `Providence.prototype.keyPath()`.

##### `Providence.prototype.options()`

Returns providence cursor's options which will be an `Immutable.Map` object. It is safe to modify this object since it is an Immutable Map object; and any changes will not reflect back to the originating cursor, unless it is used as the new options.

##### `Providence.prototype.new(newOptions)`

Create a new Providence object with options via this instance.

##### `Providence.prototype.cursor([keyValue])`

When given no arguments, return itself.

By default, this is the same behaviour as cursor() method for immutable-js cursors:
- Returns a sub-cursor following the path keyValue starting from this cursor.
- If keyValue is not an array, an array containing keyValue is instead used.

##### `Providence.prototype.update([notSetValue,] updater)`

Update value in the unboxed root data at keypath using the updater function.
If the keypath exists, updater is called using:
- the value at keypath
- unboxed root data
- boxed root data

If keypath doesn't exist, notSetValue is used as the initial value.
If notSetValue is not defined, it has value void 0.

If updater returns the same value the value at keypath (or notSetValue),
then no changes has truly occured, and the current cursor is instead returned.

Otherwise, the new value is replaced at keypath of the unboxed root data, and a new providence cursor is returned with the new boxed root data.
In addition, any defined functions at onUpdate and/or _onUpdate within options will be called with the following:
- options
- cursor keypath
- new unboxed root data with the new value
- previous unboxed root data

##### `Providence.prototype.delete()`

Delete value at keypath.

If the new unboxed root data is the same as the previous, original unboxed root data, then the current cursor is returned.

Otherwise, any defined functions at onUpdate and/or _onUpdate within options will be called with the following:
- options
- cursor keypath
- new unboxed root data with the new value
- previous unboxed root data

In addition, the new providence cursor containing the new unboxed root data will be returned.

##### `Providence.prototype.remove()`

Alias of `Providence.prototype.delete()`.



## License

MIT
