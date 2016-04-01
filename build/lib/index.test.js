'use strict';

var _assert = require('assert');

var _assert2 = _interopRequireDefault(_assert);

var _ = require('./');

var _2 = _interopRequireDefault(_);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

var _param_map = require('./param_map');

var _param_map2 = _interopRequireDefault(_param_map);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import _ from 'lodash';
// import AWS from 'aws-sdk';
// import elasticsearch from 'elasticsearch';
// import Bluebird from 'bluebird';

describe('RepoFetcher', function suite() {

	beforeEach(function beforeEach() {
		this.sandbox = _sinon2.default.sandbox.create();
	});

	afterEach(function afterEach() {
		this.sandbox.restore();
	});

	var settings = {
		'elasticsearch': {
			'signed': false,
			'host': 'localhost:9200',
			'region': 'us-east-1',
			'access_key': 'xxxx_access',
			'secret_key': 'xxx_secret',
			'index': 'github',
			'type': 'repo'
		}
	};

	it('can be instantitated', function test() {
		(0, _assert2.default)(new _2.default(settings) instanceof _2.default);
	});

	it('will throw if not given a payload', function test() {
		var repoFetcher = new _2.default(settings);
		_assert2.default.throws(function () {
			return repoFetcher._validate();
		});
	});

	it('will allow a valid search payload', function test() {
		var repoFetcher = new _2.default(settings);
		var payload = {
			'text': 'Army',
			'offset': 3,
			'size': 5
		};
		_assert2.default.doesNotThrow(function () {
			return repoFetcher._validate(payload);
		});
	});

	it('will throw on an invalid search payload', function test() {
		var repoFetcher = new _2.default(settings);
		var payload1 = {
			'text': 'Army',
			'page': 'asdf',
			'per_page': 5
		};
		var payload2 = {
			'text': 1234,
			'page': 3,
			'per_page': 5
		};
		_assert2.default.throws(function () {
			return repoFetcher._validate(payload1);
		});
		_assert2.default.throws(function () {
			return repoFetcher._validate(payload2);
		});
	});

	it('will generate the correct es search object with correct body', function test() {
		var repoFetcher = new _2.default(settings);
		var payload = {
			'text': 'Army',
			'page': 2,
			'per_page': 5,
			'sort': 'forks-asc'
		};
		var searchObject = repoFetcher._buildSearchObject(payload);
		_assert2.default.deepEqual(searchObject.body, [{
			'query': {
				'multi_match': {
					'query': 'Army',
					'fields': ['name', 'description']
				}
			}
		}]);
		_assert2.default.deepEqual(searchObject.sort, _param_map2.default['forks-asc']);

		(0, _assert2.default)(searchObject.from === 10);
	});

	it('will generate the correct es search object with correct body when no text is given', function test() {
		var repoFetcher = new _2.default(settings);
		var payload = {
			'page': 2,
			'per_page': 5,
			'sort': 'forks-asc'
		};
		var searchObject = repoFetcher._buildSearchObject(payload);
		_assert2.default.deepEqual(searchObject.body, [{
			'query': {
				'match_all': {}
			}
		}]);
	});

	it('will generate use default per page option if we don\'t specify a size', function test() {
		var repoFetcher = new _2.default(settings);
		var payload = {
			'page': 2,
			'sort': 'forks-asc'
		};
		var searchObject = repoFetcher._buildSearchObject(payload);
		(0, _assert2.default)(searchObject.size === _2.default.DEFAULT_SIZE);
	});

	it('will set page as 0 if we don\'t provide a page', function test() {
		var repoFetcher = new _2.default(settings);
		var payload = {
			'sort': 'forks-asc'
		};
		var searchObject = repoFetcher._buildSearchObject(payload);
		(0, _assert2.default)(searchObject.from === 0);
	});

	it('will generate using default sort option if we don\'t specify a size', function test() {
		var repoFetcher = new _2.default(settings);
		var payload = {
			'page': 2,
			'per_page': 5
		};
		var searchObject = repoFetcher._buildSearchObject(payload);
		(0, _assert2.default)(searchObject.sort === _param_map2.default[_2.default.DEFAULT_SORT]);
	});

	it('smoke test it will pass the correct object to client.search', function test() {

		var store = [];

		var repoFetcher = new _2.default(settings);

		this.sandbox.stub(repoFetcher, 'getESClient', function stub(config) {
			return _bluebird2.default.resolve({
				search: function search(_payload) {
					store.push(_payload);
					return _bluebird2.default.resolve();
				}
			});
		});

		var payload = {
			'page': 2,
			'per_page': 5,
			'sort': 'forks-asc'
		};

		return repoFetcher.run(payload).then(function () {
			_assert2.default.deepEqual(store[0], {
				'index': 'github',
				'type': 'repo',
				'body': [{
					'query': {
						'match_all': {}
					}
				}],
				'sort': [{
					'forks_count': {
						'order': 'asc'
					}
				}],
				'size': 5,
				'from': 10
			});
		});
	});
});