
import _ from 'lodash';
import validate from 'simple-validator';
import createLogger from './logger';
import awsElasticSearchMixin from 'aws-elasticsearch-mixin';
const logger = createLogger('lambda-fn-save-repos');

// @ tod make injectable
const paramMap = require('./param_map');
const searchableFields = ['name', 'description'];

const DEFAULT_SIZE = 20;
const DEFAULT_SORT = 'latest-commit-desc';

export default class RepoFetcher {

	constructor(settings = {}, AWS) {
		awsElasticSearchMixin(this, settings.elasticsearch, AWS);
		this.esIndex = settings.elasticsearch.index;
		this.esType = settings.elasticsearch.type;
		validate.required(this, 'esIndex', _.isString);
		validate.required(this, 'esType', _.isString);
	}

	_validate(search) {
		if (!_.isObject(search)) {
			throw new validate.ValidationError('Must provide Search Object');
		}

		validate.optional(search, 'text', _.isString);
		validate.optional(search, 'per_page', _.isInteger);
		validate.optional(search, 'page', _.isInteger);
		validate.optional(search, 'sort', _.isString);
	}

	_buildSearchObject(search) {
		const tSearch = this.transformInput(search);
		this._validate(tSearch);
		const searchBody = (() => {
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
		})();

		const esSearch = {
			index : this.esIndex,
			type : this.esType,
			body : searchBody
		};

		esSearch.sort = paramMap[tSearch.sort] || paramMap[DEFAULT_SORT];
		esSearch.size = tSearch.per_page;
		esSearch.from = tSearch.page * esSearch.size;

		return esSearch;
	}

	transformInput(input) {
		var res = _.extend(
			{},
			input,
			{
				// this is an exception to camelCase in that it is a config value
				// @todo auto config to camelcase conversion
				per_page : (input.per_page ? parseInt(input.per_page, 10) : DEFAULT_SIZE), // eslint-disable-line
				page : (input.page ? parseInt(input.page, 10) : 0)
			}
		);
		return res;
	}

	transformOutput(response) {
		return {
			total : response.hits.total,
			results : response.hits.hits.map((x) => x._source)
		};
	};

	run(search) {
		return this.getESClient()
			.then(client => {
				logger.info('getting repos');
				return client.search(this._buildSearchObject(search))
					.then(this.transformOutput.bind(this));
			});
	}

}

RepoFetcher.DEFAULT_SIZE = DEFAULT_SIZE;
RepoFetcher.DEFAULT_SORT = DEFAULT_SORT;
