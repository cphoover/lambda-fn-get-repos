'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _simpleValidator = require('simple-validator');

var _simpleValidator2 = _interopRequireDefault(_simpleValidator);

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _awsElasticsearchMixin = require('aws-elasticsearch-mixin');

var _awsElasticsearchMixin2 = _interopRequireDefault(_awsElasticsearchMixin);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var logger = (0, _logger2.default)('lambda-fn-save-repos');

// @ tod make injectable
var paramMap = require('./param_map');
var searchableFields = ['name', 'description'];

var DEFAULT_SIZE = 20;
var DEFAULT_SORT = 'latest-commit-desc';

var RepoFetcher = function () {
	function RepoFetcher() {
		var settings = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
		var AWS = arguments[1];

		_classCallCheck(this, RepoFetcher);

		(0, _awsElasticsearchMixin2.default)(this, settings.elasticsearch, AWS);
		this.esIndex = settings.elasticsearch.index;
		this.esType = settings.elasticsearch.type;
		_simpleValidator2.default.required(this, 'esIndex', _lodash2.default.isString);
		_simpleValidator2.default.required(this, 'esType', _lodash2.default.isString);
	}

	_createClass(RepoFetcher, [{
		key: '_validate',
		value: function _validate(search) {
			if (!_lodash2.default.isObject(search)) {
				throw new _simpleValidator2.default.ValidationError('Must provide Search Object');
			}

			_simpleValidator2.default.optional(search, 'text', _lodash2.default.isString);
			_simpleValidator2.default.optional(search, 'per_page', _lodash2.default.isInteger);
			_simpleValidator2.default.optional(search, 'page', _lodash2.default.isInteger);
			_simpleValidator2.default.optional(search, 'sort', _lodash2.default.isString);
		}
	}, {
		key: '_buildSearchObject',
		value: function _buildSearchObject(search) {
			var tSearch = this.transformInput(search);
			this._validate(tSearch);
			var searchBody = function () {
				if (tSearch.text) {
					return {
						'query': {
							'multi_match': {
								'query': tSearch.text,
								'fields': searchableFields
							}
						}
					};
				}
				return {
					'query': {
						'match_all': {}
					}
				};
			}();

			var esSearch = {
				index: this.esIndex,
				type: this.esType,
				body: searchBody
			};

			esSearch.sort = paramMap[tSearch.sort] || paramMap[DEFAULT_SORT];
			esSearch.size = tSearch.per_page;
			esSearch.from = tSearch.page * esSearch.size;

			return esSearch;
		}
	}, {
		key: 'transformInput',
		value: function transformInput(input) {
			var res = _lodash2.default.extend({}, input, {
				// this is an exception to camelCase in that it is a config value
				// @todo auto config to camelcase conversion
				per_page: input.per_page ? parseInt(input.per_page, 10) : DEFAULT_SIZE, // eslint-disable-line
				page: input.page ? parseInt(input.page, 10) : 0
			});
			return res;
		}
	}, {
		key: 'transformOutput',
		value: function transformOutput(response) {
			return {
				total: response.hits.total,
				results: response.hits.hits.map(function (x) {
					return x._source;
				})
			};
		}
	}, {
		key: 'run',
		value: function run(search) {
			var _this = this;

			return this.getESClient().then(function (client) {
				logger.info('getting repos');
				return client.search(_this._buildSearchObject(search)).then(function (response) {
					return _this.transformOutput(response);
				});
			});
		}
	}]);

	return RepoFetcher;
}();

exports.default = RepoFetcher;


RepoFetcher.DEFAULT_SIZE = DEFAULT_SIZE;
RepoFetcher.DEFAULT_SORT = DEFAULT_SORT;