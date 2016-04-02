
import _ from 'lodash';
import validate from 'simple-validator';
import createLogger from './logger';
import awsElasticSearchMixin from 'aws-elasticsearch-mixin';
const logger = createLogger('lambda-fn-save-repos');

// @ tod make injectable
const paramMap = require('./param_map');
const searchableFields = ['name', 'description'];

const DEFAULT_SIZE = 1000;
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
		const searchBody = [(() => {
			if (search.text) {
				return {
					'query': {
						'multi_match': {
							'query': search.text,
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
		})()];

		const esSearch = {
			index : this.esIndex,
			type : this.esType,
			body : searchBody
		};

		esSearch.sort = paramMap[search.sort] || paramMap[DEFAULT_SORT];
		esSearch.size = search.per_page || DEFAULT_SIZE;
		esSearch.from = search.page ? search.page * esSearch.size : 0;

		return esSearch;
	}

	run(search) {
		return this.getESClient()
			.then(client => {

				if (search.perPage) {
					search.perPage = parseInt(search.perPage, 10);
				}

				if (search.page) {
					search.page = parseInt(search.page, 10);
				}

				this._validate(search);
				logger.info('getting repos');
				return client.search(this._buildSearchObject(search));
			});
	}

}

RepoFetcher.DEFAULT_SIZE = DEFAULT_SIZE;
RepoFetcher.DEFAULT_SORT = DEFAULT_SORT;
