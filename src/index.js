'use strict';

const AssetGraph = require('assetgraph');
const Minimatch = require('minimatch').Minimatch;
const Plugin = require('broccoli-plugin');
const Promise = require('promise');
const path = require('path');
const url = require('url');

module.exports = class BroccoliAssetGraph extends Plugin {
  constructor(node, optionsIn) {
    const defaultOptions = {
      enabled: true,
    };
    const options = Object.assign(defaultOptions, optionsIn);

    super(node, options);
    this.options = options;

    this.exclude = [];
    if (Array.isArray(this.options.exclude)) {
      this.exclude = this.options.exclude.map((ex) => new Minimatch(ex));
    }
  }

  build() {
    return new Promise((resolve, reject) => {
      const inputPath = this.inputPaths[0];
      const assetGraph = new AssetGraph({
        root: inputPath
      });

      let ag = assetGraph
        .loadAssets(['**/*.css', '**/*.html', '**/*.js'])
        .populate()
      ;

      ag.moveAssetsInOrder({type: ['Html', 'JavaScript', 'Css', 'Font', 'Jpeg', 'Gif', 'Png', 'Text']}, (asset) => {
        if (!this.options.enabled) return;

        const assetPath = path.relative(inputPath, url.parse(asset.url).pathname);
        const p = path.parse(assetPath);

        if (this.exclude.find((ex) => ex.match(assetPath))) return;

        let out = p.name;
        out += '-';
        out += asset.md5Hex;
        out += p.ext;
        return out;
      }).writeAssetsToDisc({ url: /^file:\/\// }, this.outputPath);

      ag.run((err /*, ag*/) => {
        if (err) return reject(err);
        return resolve();
      });
    });
  }
};
