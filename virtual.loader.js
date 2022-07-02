const plugin = require('./plugin');

function VirtualLoader () {
  this.cacheable && this.cacheable(false);
  return `module.exports = ${ JSON.stringify(plugin.exportedData) };`;
}

module.exports = VirtualLoader;
