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
        'main.js':
          'const translations = {'
          +   'en: "translations/en.json",'
          +   'zz: "translations/missing.json"'
        + '};'
        + 'define("test/templates/application", ["exports"], function (exports) {'
        + '  exports["default"] = Ember.HTMLBars.template({ "id": "id", "block": "{\"statements\":[[\"open-element\",\"img\",[]],[\"dynamic-attr\",\"src\",[\"concat\",[[\"unknown\",[\"rootURL\"]],\"images/logo.svg\"]]],[\"static-attr\",\"height\",\"20px\"],[\"flush-element\"],[\"close-element\"]]}" });'
        + '});'
        + 'console.log("Hello World");'
        ,
        'test.html':
          '<html>'
        +   '<head>'
        +     '<style type="text/css">body {background-image: url(../images/header.jpg);}</style>'
        +     '<script src="main.js"></script>'
        +     '<link rel="stylesheet" href="/assets/vendor.css">'
        +   '</head>'
        +   '<body>'
        +     '<img src="../images/some.png">'
        +   '</body>'
        + '</html>'
        ,
        'translations': {
          'en.json': '{ "bacon": "bacon" }'
        }
      },
      'fonts': {
        'font1.ttf': 'ttf data',
        'font2.otf': 'otf data'
      },
      'images': {
        'a.gif': 'gif data',
        'header.jpg': 'jpeg data',
        'logo.svg': 'svg data',
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
          'main-367e4c4dd57b31166213a286163eb74e.js':
            'const translations = {'
          +   'en: "translations/en.json",'
          +   'zz: "translations/missing.json"'
          + '};'
          + 'define("test/templates/application", ["exports"], function (exports) {'
          + '  exports["default"] = Ember.HTMLBars.template({ "id": "id", "block": "{\"statements\":[[\"open-element\",\"img\",[]],[\"dynamic-attr\",\"src\",[\"concat\",[[\"unknown\",[\"rootURL\"]],\"images/logo.svg\"]]],[\"static-attr\",\"height\",\"20px\"],[\"flush-element\"],[\"close-element\"]]}" });'
          + '});'
          + 'console.log("Hello World");'
          ,
          'test-489bc512b5ccf7f937566848d6a60168.html':
            '<html>'
          +   '<head>'
          +     '<style type="text/css">body {background-image: url(../images/header-3c2af4a748ce22f8eb1db184738614c6.jpg);}</style>'
          +     '<script src="main-367e4c4dd57b31166213a286163eb74e.js"></script>'
          +     '<link rel="stylesheet" href="/assets/vendor-4c9bb3cb867d322a50e39c791d6825fe.css">'
          +   '</head>'
          +   '<body>'
          +     '<img src="../images/some-e8e7c184735fc6d8cf121392bee5b7cd.png">'
          +   '</body>'
          + '</html>'
          ,
          'translations': {
            'en-5920c9edcccd1283fed797dc9e415e4a.json': '{ "bacon": "bacon" }'
          }
        },
        'fonts': {
          'font1-726a1d7d854fb98ff2e0635b6ae1ed88.ttf': 'ttf data',
          'font2-8861b27c7001a3144633a6f7e25ad9f4.otf': 'otf data'
        },
        'images': {
          'a-eef42d897235312daa2e5999dc48fc6b.gif': 'gif data',
          'header-3c2af4a748ce22f8eb1db184738614c6.jpg': 'jpeg data',
          'logo-d317ec7c599382ef3e417d6a1a455e0b.svg': 'svg data',
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
          'main-b5cb087d79e043042d8340fd1ce28a22c0f95963.js':
            'const translations = {'
          +   'en: "translations/en.json",'
          +   'zz: "translations/missing.json"'
          + '};'
          + 'define("test/templates/application", ["exports"], function (exports) {'
          + '  exports["default"] = Ember.HTMLBars.template({ "id": "id", "block": "{\"statements\":[[\"open-element\",\"img\",[]],[\"dynamic-attr\",\"src\",[\"concat\",[[\"unknown\",[\"rootURL\"]],\"images/logo.svg\"]]],[\"static-attr\",\"height\",\"20px\"],[\"flush-element\"],[\"close-element\"]]}" });'
          + '});'
          + 'console.log("Hello World");'
          ,
          'test-6eb5fb0134a6c0f28132fc0a896c79a728565123.html':
            '<html>'
          +   '<head>'
          +     '<style type="text/css">body {background-image: url(../images/header-33bfaafd55213b9c72e383c37a930aadc3733cb5.jpg);}</style>'
          +     '<script src="main-b5cb087d79e043042d8340fd1ce28a22c0f95963.js"></script>'
          +     '<link rel="stylesheet" href="/assets/vendor-b5226058653bf61eb8c5e057e3418a84a0b89ee8.css">'
          +   '</head>'
          +   '<body>'
          +     '<img src="../images/some-212215994f162bde98c95eeab47a27ba74f55f41.png">'
          +   '</body>'
          + '</html>'
          ,
          'translations': {
            'en-28a1cda252378b30885ecf2e6b5420ec41c853d5.json': '{ "bacon": "bacon" }'
          }
        },
        'fonts': {
          'font1-cd9d6cc3a73503a08bcdfa301f2ec34a602857c0.ttf': 'ttf data',
          'font2-2bf69b3fe3a9c39b29aa32422b780f5610277f80.otf': 'otf data'
        },
        'images': {
          'a-162bbb1eb36958691ff64699d249964a6cd01bb5.gif': 'gif data',
          'header-33bfaafd55213b9c72e383c37a930aadc3733cb5.jpg': 'jpeg data',
          'logo-eed733f265a6f41c7372902accd0abeff83aa906.svg': 'svg data',
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
          'main-367e4c4dd57b31166213a286163eb74e.js':
            'const translations = {'
          +   'en: "translations/en.json",'
          +   'zz: "translations/missing.json"'
          + '};'
          + 'define("test/templates/application", ["exports"], function (exports) {'
          + '  exports["default"] = Ember.HTMLBars.template({ "id": "id", "block": "{\"statements\":[[\"open-element\",\"img\",[]],[\"dynamic-attr\",\"src\",[\"concat\",[[\"unknown\",[\"rootURL\"]],\"images/logo.svg\"]]],[\"static-attr\",\"height\",\"20px\"],[\"flush-element\"],[\"close-element\"]]}" });'
          + '});'
          + 'console.log("Hello World");'
          ,
          'test-24b396d1620696921fa6822bdf571d99.html':
            '<html>'
          +   '<head>'
          +     '<style type="text/css">body {background-image: url(../images/header-3c2af4a748ce22f8eb1db184738614c6.jpg);}</style>'
          +     '<script src="main-367e4c4dd57b31166213a286163eb74e.js"></script>'
          +     '<link rel="stylesheet" href="/assets/vendor-13bb5de4cd2e216442fdd4ec95e5a7fc.css">'
          +   '</head>'
          +   '<body>'
          +     '<img src="../images/some-e8e7c184735fc6d8cf121392bee5b7cd.png">'
          +   '</body>'
          + '</html>'
          ,
          'translations': {
            'en-5920c9edcccd1283fed797dc9e415e4a.json': '{ "bacon": "bacon" }'
          }
        },
        'fonts': {
          'font1.ttf': 'ttf data',
          'font2-8861b27c7001a3144633a6f7e25ad9f4.otf': 'otf data'
        },
        'images': {
          'a.gif': 'gif data',
          'header-3c2af4a748ce22f8eb1db184738614c6.jpg': 'jpeg data',
          'logo-d317ec7c599382ef3e417d6a1a455e0b.svg': 'svg data',
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
          'main-367e4c4dd57b31166213a286163eb74e.js':
            'const translations = {'
          +   'en: "translations/en.json",'
          +   'zz: "translations/missing.json"'
          + '};'
          + 'define("test/templates/application", ["exports"], function (exports) {'
          + '  exports["default"] = Ember.HTMLBars.template({ "id": "id", "block": "{\"statements\":[[\"open-element\",\"img\",[]],[\"dynamic-attr\",\"src\",[\"concat\",[[\"unknown\",[\"rootURL\"]],\"images/logo.svg\"]]],[\"static-attr\",\"height\",\"20px\"],[\"flush-element\"],[\"close-element\"]]}" });'
          + '});'
          + 'console.log("Hello World");'
          ,
          'test-9ca0d5053c3d10ad2082a98fbb32e684.html':
            '<html>'
          +   '<head>'
          +     '<style type="text/css">body {background-image: url(\'http://www.example.com/something/images/header-3c2af4a748ce22f8eb1db184738614c6.jpg\');}</style>'
          +     '<script src="http://www.example.com/something/assets/main-367e4c4dd57b31166213a286163eb74e.js"></script>'
          +     '<link rel="stylesheet" href="http://www.example.com/something/assets/vendor-4c9bb3cb867d322a50e39c791d6825fe.css">'
          +   '</head>'
          +   '<body>'
          +     '<img src="http://www.example.com/something/images/some-e8e7c184735fc6d8cf121392bee5b7cd.png">'
          +   '</body>'
          + '</html>'
          ,
          'translations': {
            'en-5920c9edcccd1283fed797dc9e415e4a.json': '{ "bacon": "bacon" }'
          }
        },
        'fonts': {
          'font1-726a1d7d854fb98ff2e0635b6ae1ed88.ttf': 'ttf data',
          'font2-8861b27c7001a3144633a6f7e25ad9f4.otf': 'otf data'
        },
        'images': {
          'a-eef42d897235312daa2e5999dc48fc6b.gif': 'gif data',
          'header-3c2af4a748ce22f8eb1db184738614c6.jpg': 'jpeg data',
          'logo-d317ec7c599382ef3e417d6a1a455e0b.svg': 'svg data',
          'some-e8e7c184735fc6d8cf121392bee5b7cd.png': 'png data'
        }
      };
      assert.deepEqual(outFixture, expectedFixture);
    }));
  });
});
