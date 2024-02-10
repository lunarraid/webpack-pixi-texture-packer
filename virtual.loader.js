const pathModule = require('path');
const plugin = require(pathModule.resolve(__dirname, './plugin.js'));

function VirtualLoader () {
  this.cacheable && this.cacheable(false);
  return `module.exports = ${ JSON.stringify(plugin.exportedData) };`;
}

module.exports = VirtualLoader;
