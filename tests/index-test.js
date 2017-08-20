'use strict';

const BroccoliTestHelper = require('broccoli-test-helper');
const buildOutput = BroccoliTestHelper.buildOutput;
const createTempDir = BroccoliTestHelper.createTempDir;
const co = require('co');
const crypto = require('crypto');
const path = require('path');

const BroccoliAssetGraph = require('../lib');

const describe = QUnit.module;
const it = QUnit.test;

function md5Hash(buf) {
  return crypto.createHash('md5').update(buf).digest('hex');
}
function sha1Hash(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex');
}

// recursively verify asset's fingerprint matches hash
function assertFixtureHashes(assert, fixtureIn, hashFunc, reExclude) {
  function assertFixtureHashes_(f, p) {
    for (const k in f) {
      if (Object.prototype.hasOwnProperty.call(f, k)) {
        if ('object' === typeof f[k]) {
          assertFixtureHashes_(f[k], p + path.sep + k)
        } else if (!reExclude || !reExclude.test(k)) {
          const m = k.match(/-([0-9a-fA-F]+)\./);
          const actHash = m && m[1];
          assert.equal(actHash, hashFunc(f[k]), `'${p}${path.sep}${k}' has incorrect fingerprint`);
        }
      }
    }
  }
  assertFixtureHashes_(fixtureIn, '');
}


describe('BroccoliAssetGraph', function(hooks) {
  let fixture, input, debug;

  hooks.beforeEach(co.wrap(function* () {
    input = yield createTempDir();
    debug = yield createTempDir();

    fixture = {
      'assets': {
        'another.css':
          '.some.css { background-image: url(../images/a.gif); }'
        ,
        'vendor.css':
          '@import "another.css";'
        + '.some.css { background-image: url(../images/some.png); }'
        + '@font-face {'
        +   'font-family: MyFont;'
        +   'src: url(../fonts/font1.ttf);'
        +   'src: url(../fonts/font2.otf);'
        + '}'
        ,
        'test.html':
          '<html>'
        +   '<head>'
        +     '<style type="text/css">body {background-image: url(../images/header.jpg);}</style>'
        +     '<link rel="stylesheet" href="/assets/vendor.css">'
        +   '</head>'
        +   '<body>'
        +     '<img src="../images/some.png">'
        +   '</body>'
        + '</html>'
        ,
      },
      'fonts': {
        'font1.ttf': 'ttf data',
        'font2.otf': 'otf data'
      },
      'images': {
        'a.gif': 'gif data',
        'header.jpg': 'jpeg data',
        'some.png': 'png data'
      }
    };
  }));
  hooks.afterEach(co.wrap(function* () {
    yield input.dispose();
    yield debug.dispose();
  }));


  describe('BroccoliAssetGraph.rewrites', function() {
    it('processes assets', co.wrap(function* (assert) {
      input.write(fixture);

      const node = new BroccoliAssetGraph([input.path()], {name: 'test-processing'});
      const output = yield buildOutput(node);

      const outFixture = output.read();
      assertFixtureHashes(assert, outFixture, md5Hash);

      const expectedFixture = {
        'assets': {
          'another-b5baaab3cdc8cb902a1f52ff21815a07.css':
            '.some.css { background-image: url(../images/a-eef42d897235312daa2e5999dc48fc6b.gif); }'
          ,
          'vendor-4c9bb3cb867d322a50e39c791d6825fe.css':
            '@import "another-b5baaab3cdc8cb902a1f52ff21815a07.css";'
          + '.some.css { background-image: url(../images/some-e8e7c184735fc6d8cf121392bee5b7cd.png); }'
          + '@font-face {'
          +   'font-family: MyFont;'
          +   'src: url(../fonts/font1-726a1d7d854fb98ff2e0635b6ae1ed88.ttf);'
          +   'src: url(../fonts/font2-8861b27c7001a3144633a6f7e25ad9f4.otf);'
          + '}'
          ,
          'test-108fde8ab079cbfff1394026948e3eda.html':
            '<html>'
          +   '<head>'
          +     '<style type="text/css">body {background-image: url(../images/header-3c2af4a748ce22f8eb1db184738614c6.jpg);}</style>'
          +     '<link rel="stylesheet" href="/assets/vendor-4c9bb3cb867d322a50e39c791d6825fe.css">'
          +   '</head>'
          +   '<body>'
          +     '<img src="../images/some-e8e7c184735fc6d8cf121392bee5b7cd.png">'
          +   '</body>'
          + '</html>'
          ,
        },
        'fonts': {
          'font1-726a1d7d854fb98ff2e0635b6ae1ed88.ttf': 'ttf data',
          'font2-8861b27c7001a3144633a6f7e25ad9f4.otf': 'otf data'
        },
        'images': {
          'a-eef42d897235312daa2e5999dc48fc6b.gif': 'gif data',
          'header-3c2af4a748ce22f8eb1db184738614c6.jpg': 'jpeg data',
          'some-e8e7c184735fc6d8cf121392bee5b7cd.png': 'png data'
        }
      };
      assert.deepEqual(outFixture, expectedFixture);
    }));


    it('can disable deep processing of assets', co.wrap(function* (assert) {
      input.write(fixture);

      const node = new BroccoliAssetGraph([input.path()], {
        name: 'test-disabled',
        enabled: false,
      });
      const output = yield buildOutput(node);
      assert.deepEqual(output.read(), fixture);
    }));


    it('can define which assets to load & search', co.wrap(function* (assert) {
      input.write(fixture);

      const node = new BroccoliAssetGraph([input.path()], {
        name: 'test-loadAssets',
        loadAssets: ['fonts/**', '**/*.gif']
      });
      const output = yield buildOutput(node);

      const outFixture = output.read();
      assertFixtureHashes(assert, outFixture, md5Hash);

      const expectedFixture = {
        'fonts': {
          'font1-726a1d7d854fb98ff2e0635b6ae1ed88.ttf': 'ttf data',
          'font2-8861b27c7001a3144633a6f7e25ad9f4.otf': 'otf data'
        },
        'images': {
          'a-eef42d897235312daa2e5999dc48fc6b.gif': 'gif data'
        }
      };
      assert.deepEqual(outFixture, expectedFixture);
    }));


    it('supports alternative hash functions', co.wrap(function* (assert) {
      input.write(fixture);

      const node = new BroccoliAssetGraph([input.path()], {
        name: 'test-hash',
        customHash: sha1Hash
      });
      const output = yield buildOutput(node);

      const outFixture = output.read();
      assertFixtureHashes(assert, outFixture, sha1Hash);

      const expectedFixture = {
        'assets': {
          'another-920915702d5839004cae0fa9c46fc2427fe4cc74.css':
            '.some.css { background-image: url(../images/a-162bbb1eb36958691ff64699d249964a6cd01bb5.gif); }'
          ,
          'vendor-b5226058653bf61eb8c5e057e3418a84a0b89ee8.css':
            '@import "another-920915702d5839004cae0fa9c46fc2427fe4cc74.css";'
          + '.some.css { background-image: url(../images/some-212215994f162bde98c95eeab47a27ba74f55f41.png); }'
          + '@font-face {'
          +   'font-family: MyFont;'
          +   'src: url(../fonts/font1-cd9d6cc3a73503a08bcdfa301f2ec34a602857c0.ttf);'
          +   'src: url(../fonts/font2-2bf69b3fe3a9c39b29aa32422b780f5610277f80.otf);'
          + '}'
          ,
          'test-ba9de2f46de6e788d6d7a1a9332229b308a30999.html':
            '<html>'
          +   '<head>'
          +     '<style type="text/css">body {background-image: url(../images/header-33bfaafd55213b9c72e383c37a930aadc3733cb5.jpg);}</style>'
          +     '<link rel="stylesheet" href="/assets/vendor-b5226058653bf61eb8c5e057e3418a84a0b89ee8.css">'
          +   '</head>'
          +   '<body>'
          +     '<img src="../images/some-212215994f162bde98c95eeab47a27ba74f55f41.png">'
          +   '</body>'
          + '</html>'
          ,
        },
        'fonts': {
          'font1-cd9d6cc3a73503a08bcdfa301f2ec34a602857c0.ttf': 'ttf data',
          'font2-2bf69b3fe3a9c39b29aa32422b780f5610277f80.otf': 'otf data'
        },
        'images': {
          'a-162bbb1eb36958691ff64699d249964a6cd01bb5.gif': 'gif data',
          'header-33bfaafd55213b9c72e383c37a930aadc3733cb5.jpg': 'jpeg data',
          'some-212215994f162bde98c95eeab47a27ba74f55f41.png': 'png data'
        }
      };
      assert.deepEqual(outFixture, expectedFixture);
    }));


    it('supports no hash functions', co.wrap(function* (assert) {
      input.write(fixture);

      const node = new BroccoliAssetGraph([input.path()], {
        name: 'test-nohash',
        customHash: null
      });
      const output = yield buildOutput(node);
      assert.deepEqual(output.read(), fixture);
    }));


    it('can exclude assets', co.wrap(function* (assert) {
      input.write(fixture);

      const node = new BroccoliAssetGraph([input.path()], {
        name: 'test-exclude',
        exclude: ['**/*.gif', '**/*.ttf'],
      });
      const output = yield buildOutput(node);

      const outFixture = output.read();
      assertFixtureHashes(assert, outFixture, md5Hash, /(.gif|.ttf)/);

      const expectedFixture = {
        'assets': {
          'another-195aa7ed19e4f0e2e161b902cc40635e.css':
            '.some.css { background-image: url(../images/a.gif); }'
          ,
          'vendor-13bb5de4cd2e216442fdd4ec95e5a7fc.css':
            '@import "another-195aa7ed19e4f0e2e161b902cc40635e.css";'
          + '.some.css { background-image: url(../images/some-e8e7c184735fc6d8cf121392bee5b7cd.png); }'
          + '@font-face {'
          +   'font-family: MyFont;'
          +   'src: url(../fonts/font1.ttf);'
          +   'src: url(../fonts/font2-8861b27c7001a3144633a6f7e25ad9f4.otf);'
          + '}'
          ,
          'test-9c4f988d6996314fff029ddc09422e50.html':
            '<html>'
          +   '<head>'
          +     '<style type="text/css">body {background-image: url(../images/header-3c2af4a748ce22f8eb1db184738614c6.jpg);}</style>'
          +     '<link rel="stylesheet" href="/assets/vendor-13bb5de4cd2e216442fdd4ec95e5a7fc.css">'
          +   '</head>'
          +   '<body>'
          +     '<img src="../images/some-e8e7c184735fc6d8cf121392bee5b7cd.png">'
          +   '</body>'
          + '</html>'
          ,
        },
        'fonts': {
          'font1.ttf': 'ttf data',
          'font2-8861b27c7001a3144633a6f7e25ad9f4.otf': 'otf data'
        },
        'images': {
          'a.gif': 'gif data',
          'header-3c2af4a748ce22f8eb1db184738614c6.jpg': 'jpeg data',
          'some-e8e7c184735fc6d8cf121392bee5b7cd.png': 'png data'
        }
      };
      assert.deepEqual(outFixture, expectedFixture);
    }));


    it('adds a prefix', co.wrap(function* (assert) {
      input.write(fixture);

      const node = new BroccoliAssetGraph([input.path()], {
        name: 'test-prefix',
        prepend: 'http://www.example.com/something/',
      });
      const output = yield buildOutput(node);

      const outFixture = output.read();
      assertFixtureHashes(assert, outFixture, md5Hash);

      const expectedFixture = {
        'assets': {
          'another-b5baaab3cdc8cb902a1f52ff21815a07.css':
            '.some.css { background-image: url(../images/a-eef42d897235312daa2e5999dc48fc6b.gif); }'
          ,
          'vendor-4c9bb3cb867d322a50e39c791d6825fe.css':
            '@import "another-b5baaab3cdc8cb902a1f52ff21815a07.css";'
          + '.some.css { background-image: url(../images/some-e8e7c184735fc6d8cf121392bee5b7cd.png); }'
          + '@font-face {'
          +   'font-family: MyFont;'
          +   'src: url(../fonts/font1-726a1d7d854fb98ff2e0635b6ae1ed88.ttf);'
          +   'src: url(../fonts/font2-8861b27c7001a3144633a6f7e25ad9f4.otf);'
          + '}'
          ,
          'test-bb8a34ac1b2b465caebc4901770566ce.html':
            '<html>'
          +   '<head>'
          +     '<style type="text/css">body {background-image: url(\'http://www.example.com/something/images/header-3c2af4a748ce22f8eb1db184738614c6.jpg\');}</style>'
          +     '<link rel="stylesheet" href="http://www.example.com/something/assets/vendor-4c9bb3cb867d322a50e39c791d6825fe.css">'
          +   '</head>'
          +   '<body>'
          +     '<img src="http://www.example.com/something/images/some-e8e7c184735fc6d8cf121392bee5b7cd.png">'
          +   '</body>'
          + '</html>'
          ,
        },
        'fonts': {
          'font1-726a1d7d854fb98ff2e0635b6ae1ed88.ttf': 'ttf data',
          'font2-8861b27c7001a3144633a6f7e25ad9f4.otf': 'otf data'
        },
        'images': {
          'a-eef42d897235312daa2e5999dc48fc6b.gif': 'gif data',
          'header-3c2af4a748ce22f8eb1db184738614c6.jpg': 'jpeg data',
          'some-e8e7c184735fc6d8cf121392bee5b7cd.png': 'png data'
        }
      };
      assert.deepEqual(outFixture, expectedFixture);
    }));
  });
});
