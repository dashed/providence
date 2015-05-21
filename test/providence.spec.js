const chai = require('chai');
chai.should();
const expect = chai.expect;

const Immutable = require('immutable');
const { Map } = Immutable;

const Providence = require('../src');

const NOT_SET = {};

describe('Providence', function() {

    describe('this._options', function() {

        it('should be a property', function() {
            const cursor = Providence({
                root: {
                    data: {}
                }
            });

            cursor.should.have.property('_options');
        });

        it('should be an Immutable Map', function() {
            const cursor = Providence({
                root: {
                    data: {}
                }
            });

            expect(Map.isMap(cursor._options)).to.be.true;
        });

        it('should have installed properties', function() {
            const cursor = Providence({
                root: {
                    data: {}
                }
            });

            const hasIn = function(keypath) {
                return cursor._options.hasIn(keypath);
            }

            const PATHS = [
                ['root'],
                ['root', 'unbox'],
                ['root', 'box'],
                ['root', 'data'],
                ['keyPath'],
                ['getIn'],
                ['setIn'],
                ['deleteIn']
            ];

            for (let keyPath of PATHS) {
                expect(hasIn(keyPath)).to.be.true;
            }
        });
    });

    describe('constructor', function() {

        let throwing, DATA, defaultOptions;

        beforeEach(function() {

            throwing = function(obj) {
                return function() {
                    Providence(obj);
                }
            };

            DATA = {};
            defaultOptions = {
                root: {
                    data: DATA
                }
            };
        });

        it('should throw when given no args', function() {
            expect(_ => Providence()).to.throw();
        });

        it('should preserve root data', function() {

            const preserved = function(obj) {

                // use as a factory
                const cursor = Providence({
                    root: {
                        data: obj
                    }
                });

                expect(cursor._options.getIn(['root', 'data'])).to.equal(obj);
                expect(cursor instanceof Providence).to.be.true;

                // use as a constructor
                const cursor2 = new Providence({
                    root: {
                        data: obj
                    }
                });

                expect(cursor2._options.getIn(['root', 'data'])).to.equal(obj);

            }

            preserved({});
            preserved([]);
            preserved({ map: Immutable.Map() });
            preserved(Immutable.Map());
            preserved(null);
            preserved(void 0);
            preserved(false);
            preserved(x => x);
        });

        it('should throw when given an Immutable collection that is not a map', function() {
            expect(throwing(Immutable.List())).to.throw();
        });

        it('should not throw when given a valid plain object', function() {
            expect(throwing(defaultOptions)).to.not.throw();
        });

        it('should not throw when given a valid Immutable Map object', function() {
            expect(throwing(Immutable.fromJS(defaultOptions))).to.not.throw();
        });

        it('should throw when given options of invalid type', function() {
            expect(throwing([])).to.throw();
            expect(throwing(x => x)).to.throw();
            expect(throwing(3.14)).to.throw();
            expect(throwing(42)).to.throw();
            expect(throwing(false)).to.throw();
            expect(throwing(null)).to.throw();
            expect(throwing(void 0)).to.throw();
        });

        it('should throw when given invalid options of valid type', function() {

            expect(throwing(Immutable.Map())).to.throw();
            expect(throwing({})).to.throw();
        });

        it('should set default keyPath', function() {

            const cursor = Providence(defaultOptions);

            const keyPath = cursor._options.getIn(['keyPath']);

            expect(keyPath).to.be.instanceof(Array);
            expect(keyPath).to.be.empty;
        });

        it('should be able to set keyPath', function() {

            const KEYPATH = ['a', 'b'];
            defaultOptions.keyPath = KEYPATH;

            const cursor = Providence(defaultOptions);

            const keyPath = cursor._options.getIn(['keyPath']);

            expect(keyPath).to.be.instanceof(Array);
            expect(keyPath).to.equal(KEYPATH);
        });

        it('should be able to set option root.box', function() {

            const boxer = x => x;
            defaultOptions.root.box = boxer;
            const cursor = Providence(defaultOptions);

            const ROOTBOX = cursor._options.getIn(['root', 'box']);

            expect(ROOTBOX).to.equal(boxer);
        });

        it('should be able to set option root.unbox', function() {

            const unboxer = x => x;
            defaultOptions.root.unbox = unboxer;
            const cursor = Providence(defaultOptions);

            const ROOTUNBOX = cursor._options.getIn(['root', 'unbox']);

            expect(ROOTUNBOX).to.equal(unboxer);
        });

        it('should be able to set option setIn', function() {

            const setIn = x => x;
            defaultOptions.setIn = setIn;
            const cursor = Providence(defaultOptions);

            const actualSetIn = cursor._options.getIn(['setIn']);

            expect(actualSetIn).to.equal(setIn);
        });

        it('should be able to set option getIn', function() {

            const getIn = x => x;
            defaultOptions.getIn = getIn;
            const cursor = Providence(defaultOptions);

            const actualGetIn = cursor._options.getIn(['getIn']);

            expect(actualGetIn).to.equal(getIn);
        });

        it('be able to set options using Immutable Map', function() {
            const expected = Immutable.fromJS({
                root: {
                    data: null
                }
            });
            const cursor = Providence(expected);

            expect(cursor._options).to.not.equal(expected);
            expect(cursor._options.hasIn(['root', 'data'])).to.be.true;
            expect(cursor._options.hasIn(['root', 'unbox'])).to.be.true;
            expect(cursor._options.hasIn(['root', 'box'])).to.be.true;
            expect(cursor._options.hasIn(['deleteIn'])).to.be.true;
            expect(cursor._options.hasIn(['getIn'])).to.be.true;
            expect(cursor._options.hasIn(['setIn'])).to.be.true;
            expect(cursor._options.hasIn(['keyPath'])).to.be.true;
        });

        // whitebox testing for skipDataCheck
        it('skipDataCheck', function() {
            expect(_ => Providence({}, true)).to.not.throw();
        });

        // whitebox testing for skipProcessOptions
        it('skipProcessOptions', function() {

            const expected = Immutable.fromJS({
                root: {
                    data: null
                }
            });
            const cursor = Providence(expected, false, true);

            expect(cursor._options).to.equal(expected);
        });
    });

    describe('#deref', function() {

        let DATA, defaultOptions;

        beforeEach(function(){

            DATA = Immutable.fromJS({
                foo: {
                    bar: 'baz'
                }
            });

            defaultOptions = {
                root: {
                    data: DATA
                }
            };
        });

        it('#deref and #valueOf are aliases of each other', function() {
            expect(Providence.prototype.deref).to.equal(Providence.prototype.valueOf);
        });

        it('should be able to deref unboxed root data', function() {

            defaultOptions.keyPath = [];

            const cursor = Providence(defaultOptions);
            expect(cursor.deref()).to.equal(DATA);
        });

        it('should deref path that was set', function() {

            defaultOptions.keyPath = ['foo', 'bar'];

            const cursor = Providence(defaultOptions);
            expect(cursor.deref()).to.equal('baz');
        });

        it('should deref an unset path and return notSetValue', function() {

            defaultOptions.keyPath = ['foo', 'bar', 'quz'];

            const NOT_SET = {};

            const cursor = Providence(defaultOptions);
            expect(cursor.deref(NOT_SET)).to.equal(NOT_SET);
            expect(cursor.deref()).to.equal(void 0);

        });

        it('should use unbox function', function() {

            let calls = 0;

            defaultOptions.root.unbox = (x) => {
                calls++;
                return x;
            };

            const cursor = Providence(defaultOptions);
            cursor.deref();

            expect(calls).to.equal(1);
        });

        it('should use custom getIn function', function() {

            let calls = 0;

            defaultOptions.getIn = (rootData) => {
                calls++;
                return rootData.getIn.bind(rootData);
            };

            const cursor = Providence(defaultOptions);
            cursor.deref();

            expect(calls).to.equal(1);
        });

        it('should cache dereferenced value', function() {

            let calls = 0;
            defaultOptions.getIn = (rootData) => {
                calls++;
                return rootData.getIn.bind(rootData);
            };

            const cursor = Providence(defaultOptions).cursor(['foo', 'bar']);
            expect(cursor.deref()).to.equal('baz');
            expect(cursor.deref()).to.equal('baz');

            expect(calls).to.equal(1);
        });
    });

    describe('#cachedValue', function() {

        let DATA, defaultOptions;

        beforeEach(function(){

            DATA = Immutable.fromJS({
                foo: {
                    bar: 'baz'
                }
            });

            defaultOptions = {
                root: {
                    data: DATA
                }
            };
        });

        it('should return notSetValue if not cached', function() {
            const NOT_SET = {};
            const cursor = Providence(defaultOptions);
            expect(cursor.cachedValue(NOT_SET)).to.equal(NOT_SET);
        });

        it('should return cachedValue if cached', function() {
            defaultOptions.keyPath = ['foo', 'bar'];
            const cursor = Providence(defaultOptions);
            expect(cursor.deref()).to.equal('baz');
            expect(cursor.cachedValue(null)).to.equal('baz');
            expect(cursor.cachedValue()).to.equal(cursor._cachedValue);
        });
    });

    describe('#exists', function() {

        let DATA, defaultOptions;

        beforeEach(function(){

            DATA = Immutable.fromJS({
                foo: {
                    bar: 'baz'
                }
            });

            defaultOptions = {
                root: {
                    data: DATA
                }
            };
        });

        it('should return true on path that exists', function() {
            defaultOptions.keyPath = ['foo', 'bar'];
            const cursor = Providence(defaultOptions);
            expect(cursor.exists()).to.be.true;
        });

        it('should return false on path that does not exists', function() {
            defaultOptions.keyPath = ['foo', 'qux'];
            const cursor = Providence(defaultOptions);
            expect(cursor.exists()).to.be.false;
        });
    });

    describe('#keyPath / #keypath', function() {

        let defaultOptions;

        beforeEach(function(){
            defaultOptions = {
                root: {
                    data: Immutable.fromJS({
                        foo: {
                            bar: 'baz'
                        }
                    })
                }
            };
        });

        it('#keyPath and #keypath are aliases of each other', function() {
            expect(Providence.prototype.keypath).to.equal(Providence.prototype.keyPath);
        });

        it('should return default keyPath', function() {

            // defaultOptions has no keyPath set.
            const cursor = Providence(defaultOptions);

            const keyPath = cursor.keyPath();
            const keyPath2 = cursor.keypath();

            expect(keyPath).to.equal(keyPath2);
            expect(keyPath).to.be.instanceof(Array);
            expect(keyPath).to.be.empty;
        });

        it('should return configured keyPath', function() {

            const KEYPATH = ['a', 'b'];

            defaultOptions.keyPath = KEYPATH;

            const cursor = Providence(defaultOptions);

            const keyPath = cursor.keyPath();
            const keyPath2 = cursor.keypath();

            expect(keyPath).to.equal(keyPath2);
            expect(keyPath).to.be.instanceof(Array);
            expect(keyPath).to.equal(KEYPATH);
        });
    });

    describe('#options', function() {

        it('should equal to this._options', function() {
            const cursor = Providence({
                root: {
                    data: {}
                }
            });

            const OPTIONS = cursor.options();

            expect(OPTIONS).to.equal(cursor._options);
        });
    });

    describe('#new', function() {

        const throwing = function(obj) {
            return function() {
                Providence(obj);
            }
        };

        it('should create a new Providence cursor', function() {

            const cursor = Providence({
                root: {
                    data: {}
                }
            });

            const options = cursor.options();

            const cursor2 = cursor.new(options);

            expect(cursor).to.not.equal(cursor2);
            expect(options).to.equal(cursor2.options());
            expect(cursor2 instanceof Providence).to.be.true;
        });

        it('should throw when given no root data', function() {
            expect(_ => Providence({})).to.throw();
        });

        it('should process options', function() {
            expect(_ => Providence([])).to.throw();
        });
    });

    describe('#cursor', function() {

        it('should return itself when given no sub-keyPath', function() {

            const cursor = Providence({
                root: {
                    data: {}
                }
            });

            expect(cursor.cursor()).to.equal(cursor);
            expect(cursor.cursor([])).to.equal(cursor);
        });

        it('should return new Providence object with sub-keyPath that is an array', function() {

            const cursor = Providence({
                root: {
                    data: {}
                }
            });

            const cursor2 = cursor.cursor(['a']);
            const options2 = cursor2.options();

            expect(cursor2).to.not.equal(cursor);
            expect(options2.getIn(['keyPath'])).to.eql(['a']);

            const cursor3 = Providence({
                root: {
                    data: {}
                },
                keyPath: ['x']
            });

            const cursor4 = cursor3.cursor(['y', 'z']);
            const options4 = cursor4.options();
            expect(options4.getIn(['keyPath'])).to.eql(['x', 'y', 'z']);
        });

        it('should return new Providence object with sub-keyPath that is not an array', function() {

            const cursor = Providence({
                root: {
                    data: {}
                }
            });

            const cursor2 = cursor.cursor('a');
            const options2 = cursor2.options();

            expect(cursor2).to.not.equal(cursor);
            expect(options2.getIn(['keyPath'])).to.eql(['a']);

            const cursor3 = Providence({
                root: {
                    data: {}
                },
                keyPath: ['x']
            });

            const cursor4 = cursor3.cursor('y').cursor('z');
            const options4 = cursor4.options();
            expect(options4.getIn(['keyPath'])).to.eql(['x', 'y', 'z']);
        });

        it('should only modify keyPath', function() {

            const cursor = Providence({
                root: {
                    data: {}
                },
                keyPath: ['foo']
            });

            const cursor2 = cursor.cursor(['bar', 'baz']);

            const options = cursor.options();
            const optionsExpected = options.setIn(['keyPath'], ['foo', 'bar', 'baz']);
            const optionsActual = cursor2.options();

            expect(optionsActual.toJS()).to.eql(optionsExpected.toJS());
        });

        it('should not process options when creating new Providence object with sub-keyPath', function() {

            // assuming that through design by contract, this._options isn't externally modified;
            // so there is no need to re-process the options

            const cursor = Providence({
                root: {
                    data: {}
                },
                keyPath: ['foo']
            });

            // default value is set by processOptions()
            cursor._options = cursor._options.deleteIn(['getIn']);

            const cursor2 = cursor.cursor(['foo']);

            expect(cursor2._options.hasIn(['getIn'])).to.be.false;
        });

        it('should not validate root data when creating new Providence object with sub-keyPath', function() {

            // assuming that through design by contract, this._options isn't externally modified;
            // so there is no need to re-validate root data

            const cursor = Providence({
                root: {
                    data: {}
                },
                keyPath: ['foo']
            });

            cursor._options = cursor._options.deleteIn(['root', 'data']);

            expect(_ => cursor.cursor(['foo'])).to.not.throw();
        });
    });

    describe('#update', function() {

        let data, options;
        beforeEach(function() {
            data = Immutable.fromJS({
                x: {
                    y: {
                        z: 'foo'
                    }
                }
            });

            options = {
                root: {
                    data: data
                },
                keyPath: ['x', 'y']
            };
        });

        it('should be able to update at cursor path', function() {

            const cursor = Providence(options);

            const cursor2 = cursor.update(function(m) {
                m = m.setIn(['z'], 'bar');
                return m;
            });

            expect(cursor).to.not.equal(cursor2);

            expect(cursor.options().getIn(['root', 'data']).toJS()).to.eql({
                x: {
                    y: {
                        z: 'foo'
                    }
                }
            });

            expect(cursor2.options().getIn(['root', 'data']).toJS()).to.eql({
                x: {
                    y: {
                        z: 'bar'
                    }
                }
            });

            expect(cursor.deref().toJS()).to.eql({
                z: 'foo'
            });

            expect(cursor2.deref().toJS()).to.eql({
                z: 'bar'
            });
        });

        it('should be able to update using custom setIn', function() {

            let calls = 0;

            options.setIn = (rootData) => {
                calls++;
                return rootData.setIn.bind(rootData);
            };

            const cursor = Providence(options);
            const ret = cursor.update(x => null);

            expect(calls).to.equal(1);
            expect(cursor).to.not.equal(ret);
        });

        it('should be able to update using custom getIn', function() {

            let calls = 0;

            options.getIn = (rootData) => {
                calls++;
                return rootData.getIn.bind(rootData);
            };

            const cursor = Providence(options);
            const ret = cursor.update(x => null);

            expect(calls).to.equal(1);
            expect(cursor).to.not.equal(ret);
        });

        it('should use custom unbox/box functions', function() {

            let calls = 0;

            options.root.unbox = (x) => {
                calls++;
                return x;
            };

            options.root.box = (x) => {
                calls++;
                return x;
            };

            const cursor = Providence(options);
            const ret = cursor.update(x => null);

            expect(calls).to.equal(2);
            expect(cursor).to.not.equal(ret);
        });

        it('should call onUpdate and _onUpdate', function() {

            let calls = 0;

            let cursor;
            options.onUpdate = (_options, keyPath, newRoot, oldRoot) => {
                calls++;

                expect(_options).to.equal(cursor._options);
                expect(keyPath).to.eql(['x', 'y']);
                expect(newRoot).to.not.equal(oldRoot);
            };

            options._onUpdate = (_options, keyPath, newRoot, oldRoot) => {
                calls++;

                expect(_options).to.equal(cursor._options);
                expect(keyPath).to.eql(['x', 'y']);
                expect(newRoot).to.not.equal(oldRoot);
            };

            cursor = Providence(options);
            const ret = cursor.update(x => null);

            expect(calls).to.equal(2);
            expect(cursor).to.not.equal(ret);
        });

        it('should return itself when there is no change', function() {
            const cursor = Providence(options);
            const ret = cursor.update(x => x);
            expect(cursor).to.equal(ret);
        });

        it('should not call custom setIn when there is no change', function() {

            let calls = 0;

            options.setIn = (rootData) => {
                calls++;
                return rootData.setIn.bind(rootData);
            };

            const cursor = Providence(options);
            const ret = cursor.update(x => x);

            expect(calls).to.equal(0);
            expect(cursor).to.equal(ret);
        });

        it('should only unbox when there is no change', function() {

            let calls = 0;

            options.root.unbox = (x) => {
                calls++;
                return x;
            };

            options.root.box = (x) => {
                calls++;
                return x;
            };

            const cursor = Providence(options);
            const ret = cursor.update(x => x);

            expect(calls).to.equal(1);
            expect(cursor).to.equal(ret);
        });

        it('should call not onUpdate/_onUpdate when there is no change', function() {

            let calls = 0;

            let cursor;
            options.onUpdate = () => {
                calls++;
            };
            options._onUpdate = () => {
                calls++;
            };

            cursor = Providence(options);
            const ret = cursor.update(x => x);

            expect(calls).to.equal(0);
            expect(cursor).to.equal(ret);
        });
    });

    describe('#delete', function() {

        let data, options;
        beforeEach(function() {
            data = Immutable.fromJS({
                x: {
                    y: {
                        z: 'foo'
                    }
                }
            });

            options = {
                root: {
                    data: data
                },
                keyPath: ['x', 'y']
            };
        });

        it('#remove and #delete are aliases of each other', function() {
            expect(Providence.prototype.delete).to.equal(Providence.prototype.remove);
        });

        it('should be able to delete at cursor path', function() {

            const cursor = Providence(options);
            const cursor2 = cursor.delete();

            expect(cursor).to.not.equal(cursor2);

            expect(cursor.options().getIn(['root', 'data']).toJS()).to.eql({
                x: {
                    y: {
                        z: 'foo'
                    }
                }
            });

            expect(cursor2.options().getIn(['root', 'data']).toJS()).to.eql({
                x: {
                }
            });

            expect(cursor.deref().toJS()).to.eql({
                z: 'foo'
            });

            expect(cursor2.deref(NOT_SET)).to.equal(NOT_SET);
        });

        it('should be able to delete using custom deleteIn', function() {

            let calls = 0;

            options.deleteIn = (rootData) => {
                calls++;
                return rootData.deleteIn.bind(rootData);
            };

            const cursor = Providence(options);
            const ret = cursor.delete();

            expect(calls).to.equal(1);
            expect(cursor).to.not.equal(ret);
        });

        it('should use custom unbox/box functions', function() {

            let calls = 0;

            options.root.unbox = (x) => {
                calls++;
                return x;
            };

            options.root.box = (x) => {
                calls++;
                return x;
            };

            const cursor = Providence(options);
            const ret = cursor.delete();

            expect(calls).to.equal(2);
            expect(cursor).to.not.equal(ret);
        });

        it('should call onUpdate and _onUpdate', function() {

            let calls = 0;

            let cursor;
            options.onUpdate = (_options, keyPath, newRoot, oldRoot) => {
                calls++;

                expect(_options).to.equal(cursor._options);
                expect(keyPath).to.eql(['x', 'y']);
                expect(newRoot).to.not.equal(oldRoot);
            };

            options._onUpdate = (_options, keyPath, newRoot, oldRoot) => {
                calls++;

                expect(_options).to.equal(cursor._options);
                expect(keyPath).to.eql(['x', 'y']);
                expect(newRoot).to.not.equal(oldRoot);
            };

            cursor = Providence(options);
            const ret = cursor.delete();

            expect(calls).to.equal(2);
            expect(cursor).to.not.equal(ret);
        });

        it('should return itself when there is no change', function() {
            options.keyPath = ['x', 'y', 'g'];
            const cursor = Providence(options);
            const ret = cursor.delete();
            expect(cursor).to.equal(ret);
        });

        it('should only unbox when there is no change', function() {

            let calls = 0;

            options.root.unbox = (x) => {
                calls++;
                return x;
            };

            options.root.box = (x) => {
                calls++;
                return x;
            };

            options.keyPath = ['x', 'y', 'g'];
            const cursor = Providence(options);
            const ret = cursor.delete();

            expect(calls).to.equal(1);
            expect(cursor).to.equal(ret);
        });

        it('should call not onUpdate/_onUpdate when there is no change', function() {

            let calls = 0;

            let cursor;
            options.onUpdate = () => {
                calls++;
            };
            options._onUpdate = () => {
                calls++;
            };

            options.keyPath = ['x', 'y', 'g'];
            cursor = Providence(options);
            const ret = cursor.delete();

            expect(calls).to.equal(0);
            expect(cursor).to.equal(ret);
        });
    });

    describe('extending', function() {

        let calls;
        function Inherited() {
            calls++;

            Providence.apply(this, arguments);
        }

        Inherited.prototype = Object.create(Providence.prototype);
        Inherited.prototype.constructor = Inherited;
        Inherited.prototype.method = function() {
        };

        beforeEach(function() {
            calls = 0;
        });

        it('Providence methods should create new object using extended constructor', function() {

            const cursor = new Inherited({
                root: {
                    data: Immutable.Map()
                },
                _onUpdate: () => {
                    calls++;
                },
                onUpdate: () => {
                    calls++;
                }
            });

            expect(cursor instanceof Inherited).to.be.true;
            expect(cursor instanceof Providence).to.be.true;
            expect(cursor).to.have.property('method');
            expect(calls).to.equal(1);

            const cursor2 = cursor.new(cursor.options());

            expect(cursor2 instanceof Inherited).to.be.true;
            expect(cursor2 instanceof Providence).to.be.true;
            expect(cursor2._options).to.equal(cursor._options);
            expect(cursor2).to.have.property('method');
            expect(calls).to.equal(2);

            const cursor3 = cursor.cursor(['foo']);

            expect(cursor3 instanceof Inherited).to.be.true;
            expect(cursor3 instanceof Providence).to.be.true;
            expect(cursor3).to.have.property('method');
            expect(calls).to.equal(3);

            const cursor4 = cursor3.update(x => x);

            expect(cursor4 instanceof Inherited).to.be.true;
            expect(cursor4 instanceof Providence).to.be.true;
            expect(cursor4).to.equal(cursor3);
            expect(cursor4).to.have.property('method');
            expect(calls).to.equal(3);

            const cursor5 = cursor4.update(x => Immutable.fromJS({
                x: 'x'
            }));

            expect(cursor5 instanceof Inherited).to.be.true;
            expect(cursor5 instanceof Providence).to.be.true;
            expect(cursor5).to.have.property('method');
            expect(cursor4).to.not.equal(cursor5);
            expect(calls).to.equal(6);

            const cursor6 = cursor5.delete();

            expect(cursor6 instanceof Inherited).to.be.true;
            expect(cursor6 instanceof Providence).to.be.true;
            expect(cursor6).to.have.property('method');
            expect(cursor5).to.not.equal(cursor6);
            expect(calls).to.equal(9);

        });
    });
});
