const webpack = require('webpack');
const fs = require('fs');
const fg = require('fast-glob');

const pathModule = require('path');
const { packAsync } = require('free-tex-packer-core');
const { interpolateName } = require('loader-utils');

const SUPPORTED_EXT = [ '.png', '.jpg', '.jpeg' ];
const SUPPORTED_EXT_MAP = SUPPORTED_EXT.reduce((extMap, ext) => (extMap[ext] = true) && extMap, {});

const SpriteMetadataLoader = require('./SpriteMetadataLoader');

const ANIMATED_REGEX = /^((?:.*[/])*(?:[a-zA-Z0-9]+))_([a-zA-Z0-9]+)_\d+\.\w+$/;

class WebpackPixiTexturePacker {

  static exportedData = { animations: {}, spritesheets: [] };

  constructor (src, dest = '.', options = {}) {
    this.assetDir = pathModule.resolve(src);
    this.dest = dest;
    this.options = options;
    this.hasChanged = true;
    this.previousImageFileNames = [];
    this.imageFiles = {};
    this.lastStarted = 0;
  }

  apply (compiler) {

    compiler.hooks.watchRun.tap('WatchRun', (compiler) => {
      if (compiler.modifiedFiles && compiler.modifiedFiles.has(this.assetDir)) {
        this.hasChanged = true;
      }
    });

    compiler.hooks.beforeCompile.tapAsync('WebpackPixiTexturePacker', async (params, callback) => {

      if (this.hasChanged) {
        this.hasChanged = false;

        const started = this.lastStarted = Date.now();

        const generatedAssets = await this.generateAssets();

        if (started === this.lastStarted) {
          this.imageFiles = generatedAssets.imageFiles;
          WebpackPixiTexturePacker.exportedData.animations = generatedAssets.animations;
          WebpackPixiTexturePacker.exportedData.spritesheets = generatedAssets.spritesheets;
        }
      }

      callback();
    });

    compiler.hooks.thisCompilation.tap('WebpackPixiTexturePacker', (compilation) => {

      compilation.contextDependencies.add(this.assetDir);

      compilation.hooks.processAssets.tap(
        {
          name: 'WebpackPixiTexturePacker',
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE
        },
        (compilationAssets) => {
          for (const fileName of this.previousImageFileNames) {
            delete compilationAssets[fileName];
          }

          for (const fileName in this.imageFiles) {
            const image = this.imageFiles[fileName];
            compilationAssets[fileName] = { source: () => image.buffer, size: () => image.buffer.length };
          }

          this.previousImageFileNames = Object.keys(this.imageFiles);
        }
      );

    });
  }

  async generateAssets () {
    const filesList = await fg(pathModule.join('**', '*.{jpg,jpeg,png}'), { cwd: this.assetDir });

    if (!filesList) {
      return;
    }

    // Handle Animation frames detection

    filesList.sort((a, b) => a.localeCompare(b));

    const animations = filesList.reduce((animations, fileName) => {
      const matches = fileName.match(ANIMATED_REGEX);

      if (matches) {
        const [ spriteName, animationName ] = matches;
        animations[spriteName] = animations[spriteName] || {};
        animations[spriteName][animationName] = animations[spriteName][animationName] || [];
        animations[spriteName][animationName].push(fileName);
      }

      return animations;
    }, {});

    // Handle Sprite Groups

    const metadataLoader = new SpriteMetadataLoader();
    await metadataLoader.load(this.assetDir);

    const sheetGroups = filesList.reduce((sheetGroups, file) => {
      const { group } = metadataLoader.getGroupOptions(file);

      if (!sheetGroups[group]) {
        sheetGroups[group] = { name: group, files: [] };
      }

      sheetGroups[group].files.push(file);

      return sheetGroups;
    }, {});

    const groupFiles = await Promise.all(Object.keys(sheetGroups).map((name) => {

      const images = sheetGroups[name].files.map((path) => ({
        contents: fs.readFileSync(pathModule.join(this.assetDir, path)),
        path
      }));

      return packAsync(images, { ...this.options, textureName: name });

    }));

    const spritesheets = [];
    const imageFiles = {};

    for (const files of groupFiles) {

      const fileMap = files.reduce((fileMap, file) => {
        fileMap[file.name] = file;
        return fileMap;
      });

      for (const item of files) {
        if (item.name.endsWith('.json')) {
          const atlasData = JSON.parse(item.buffer.toString());
          const imageFile = fileMap[atlasData.meta.image];

          const interpolatedName = interpolateName(
            { resourcePath: pathModule.join(this.dest, imageFile.name) },
            '[name].[hash].[ext]',
            { content: imageFile.buffer }
          );

          const assetPath = pathModule.join(this.dest, interpolatedName);

          atlasData.meta.image = assetPath;
          imageFiles[assetPath] = imageFile;

          spritesheets.push(atlasData);
        }
      }
    }

    return { animations, imageFiles, spritesheets };
  }


}

module.exports = WebpackPixiTexturePacker;
