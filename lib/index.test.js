import assert from 'assert';
import RepoFetcher from './';
import Bluebird from 'bluebird';
import sinon from 'sinon';
import paramMap from './param_map';
// import _ from 'lodash';
// import AWS from 'aws-sdk';
// import elasticsearch from 'elasticsearch';
// import Bluebird from 'bluebird';

describe('RepoFetcher', function suite() {

	beforeEach(function beforeEach() {
		this.sandbox = sinon.sandbox.create();
	});

	afterEach(function afterEach() {
		this.sandbox.restore();
	});

	const settings = {
		'elasticsearch' : {
			'signed' : false,
			'host' : 'localhost:9200',
			'region' : 'us-east-1',
			'access_key' : 'xxxx_access',
			'secret_key' : 'xxx_secret',
			'index' : 'github',
			'type' : 'repo'
		}
	};

	it('can be instantitated', function test() {
		assert(new RepoFetcher(settings) instanceof RepoFetcher);
	});

	it('will throw if not given a payload', function test() {
		const repoFetcher = new RepoFetcher(settings);
		assert.throws(() => repoFetcher._validate());
	});

	it('will allow a valid search payload', function test() {
		const repoFetcher = new RepoFetcher(settings);
		const payload = {
			'text'   : 'Army',
			'offset' : 3,
			'size'   : 5
		};
		assert.doesNotThrow(() => repoFetcher._validate(payload));
	});

	it('will throw on an invalid search payload', function test() {
		const repoFetcher = new RepoFetcher(settings);
		const payload1 = {
			'text'     : 'Army',
			'page'     : 'asdf',
			'per_page' : 5
		};
		const payload2 = {
			'text'     : 1234,
			'page'     : 3,
			'per_page' : 5
		};
		assert.throws(() => repoFetcher._validate(payload1));
		assert.throws(() => repoFetcher._validate(payload2));
	});

	it('will generate the correct es search object with correct body', function test() {
		const repoFetcher = new RepoFetcher(settings);
		const payload = {
			'text'     : 'Army',
			'page'     : 2,
			'per_page' : 5,
			'sort'     : 'forks-asc'
		};
		const searchObject = repoFetcher._buildSearchObject(payload);
		assert.deepEqual(
			searchObject.body,
			{
				'query': {
					'multi_match': {
						'query': 'Army',
						'fields': [
							'name',
							'description'
						]
					}
				}
			}
		);
		assert.deepEqual(
			searchObject.sort,
			paramMap['forks-asc']
		);

		assert(searchObject.from === 10);
	});

	it('will generate the correct es search object with correct body when no text is given', function test() {
		const repoFetcher = new RepoFetcher(settings);
		const payload = {
			'page'     : 2,
			'per_page' : 5,
			'sort'     : 'forks-asc'
		};
		const searchObject = repoFetcher._buildSearchObject(payload);
		assert.deepEqual(searchObject.body,
			{
				'query': {
					'match_all': {}
				}
			}
		);
	});

	it('will generate use default per page option if we don\'t specify a size', function test() {
		const repoFetcher = new RepoFetcher(settings);
		const payload = {
			'page'     : 2,
			'sort'     : 'forks-asc'
		};
		const searchObject = repoFetcher._buildSearchObject(payload);
		assert(searchObject.size === RepoFetcher.DEFAULT_SIZE);
	});

	it('will set page as 0 if we don\'t provide a page', function test() {
		const repoFetcher = new RepoFetcher(settings);
		const payload = {
			'sort'     : 'forks-asc'
		};
		const searchObject = repoFetcher._buildSearchObject(payload);
		assert(searchObject.from === 0);
	});

	it('will generate using default sort option if we don\'t specify a size', function test() {
		const repoFetcher = new RepoFetcher(settings);
		const payload = {
			'page'     : 2,
			'per_page' : 5
		};
		const searchObject = repoFetcher._buildSearchObject(payload);
		assert(searchObject.sort === paramMap[RepoFetcher.DEFAULT_SORT]);
	});

	it('smoke test it will pass the correct object to client.search', function test() {

		let store = [];

		const repoFetcher = new RepoFetcher(settings);

		this.sandbox.stub(repoFetcher, 'getESClient', function stub(config) {
			return Bluebird.resolve({
				search : (_payload) => {
					store.push(_payload);
					return Bluebird.resolve();
				}
			});
		});

		const payload = {
			'page'     : 2,
			'per_page' : 5,
			'sort'     : 'forks-asc'
		};

		return repoFetcher.run(payload)
			.then(() => {
				assert.deepEqual(store[0],
					{
						'index': 'github',
						'type': 'repo',
						'body': {
								'query': {
									'match_all': {}
								}
						},
						'sort': 'forks_count:asc',
						'size': 5,
						'from': 10
					}
				);
			});

	});

	it('testing what response from es', function test() {

		const repoFetcher = new RepoFetcher(settings);

		const payload = {
			'page'     : 2,
			'per_page' : 5,
			'sort'     : 'forks-asc'
		};

		return repoFetcher.run(payload);

	});

});
