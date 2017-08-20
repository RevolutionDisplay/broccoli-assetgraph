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
      enabled: true,        // Enables fingerprinting if true
      prepend: null,        // A string to prepend to all of the assets. Useful for CDN urls like https://subdomain.cloudfront.net/
      exclude: null,        // An array of string globs. If a path matches any item in the exclude array, it will not be fingerprinted
      customHash: 'md5Hex', // When specified, this is appended to fingerprinted filenames instead of the md5. Pass null to suppress the hash, which can be useful when using prepend
      loadAssets: ['**/*.css', '**/*.html', '**/*.js'],  // An array of string globs. Defines initial assets to load then search for dependencies
      assetOrder: ['Html', 'JavaScript', 'Json', 'Css', 'Font', 'Jpeg', 'Gif', 'Png', 'Text'],  // Order in which assets are processed. Ordered last to first.
      prependExcludeAssets: ['Html'], // Assets types to exclude from pre-pending. Careful as not excluding assets will result in all paths becoming relative. By default html types are excluded.
    };
    const options = Object.assign(defaultOptions, optionsIn);

    const inputNodes = Array.isArray(node) ? node : [node];
    super(inputNodes, options);

    //
    this.options = options;

    //
    if (false === ('customHash' in optionsIn)) {
      // default to assetgraph's md5hex
      this.hashFunc = (asset) => asset.md5Hex;
    } else if ('function' === typeof options.customHash) {
      // use a custom hash function
      this.hashFunc = (asset) => options.customHash(asset.rawSrc);
    } else {
      // disable hash function (no fingerprinting)
      this.hashFunc = null;
    }

    this.exclude = [];
    if (Array.isArray(this.options.exclude)) {
      this.exclude = this.options.exclude.map((ex) => new Minimatch(ex));
    }

    this.prependedTypes = this.options.assetOrder.filter((a) => {
      return -1 === this.options.prependExcludeAssets.indexOf(a);
    });
  }

  build() {
    return new Promise((resolve, reject) => {
      const inputPath = this.inputPaths[0];
      const assetGraph = new AssetGraph({
        root: inputPath
      });

      let ag = assetGraph
        .loadAssets(this.options.loadAssets)
        .populate()
        // pre-pend assets
        .if(this.options.prepend)
          .moveAssetsInOrder({type: this.prependedTypes}, (asset) => {
            if (!this.options.enabled) return;

            const assetPath = path.relative(inputPath, url.parse(asset.url).pathname);
            return this.options.prepend + assetPath;
          })
        .endif()

        // update populated assets
        .moveAssetsInOrder({type: this.options.assetOrder}, (asset) => {
          if (!this.options.enabled) return;

          const assetPath = path.relative(inputPath, url.parse(asset.url).pathname);
          const p = path.parse(assetPath);
          if (!this.hashFunc || this.exclude.find((ex) => ex.match(assetPath))) return;

          return p.name + '-' + this.hashFunc(asset) + p.ext;
        })

        // write local assets (pre-pended are done next)
        .writeAssetsToDisc({ url: /^file:\/\// }, this.outputPath)

        // write pre-pended assets
        .if(this.options.prepend)
          .writeAssetsToDisc({}, this.outputPath, this.options.prepend)
        .endif()

        .run((err) => {
          if (err) return reject(err);
          return resolve();
        })
      ;
    });
  }
};
