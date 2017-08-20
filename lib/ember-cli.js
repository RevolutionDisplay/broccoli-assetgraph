module.exports = {
  name: 'broccoli-assetgraph',
  included: function(app) {
    this._super.included.apply(this, arguments);

    this.options = app.options.fingerprint || {};

    if (!('enabled' in this.options)) {
      this.options.enabled = ('production' === app.env);
    }
  },
  postprocessTree: function(type, tree) {
    const options = this.options || {};
    if (type === 'all' && options.enabled) {
      const BroccoliAssetGraph = require('./index');
      return new BroccoliAssetGraph(tree, options);
    } else {
      return tree;
    }
  }
};
