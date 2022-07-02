const fg = require('fast-glob');
const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');
const minimatch = require('minimatch');

class SpriteMetadataLoader {

  cache = {};

  getDataForPath (currentDirectory, root) {
    let data = this.cache[currentDirectory];

    while (!data && currentDirectory !== '.') {
      currentDirectory = path.dirname(currentDirectory);
      data = this.cache[currentDirectory];
    }

    return data || {};
  }

  async load (targetPath) {
    const filesList = await fg(path.join('**', 'metadata.json'), { cwd: targetPath });

    const fileDepths = filesList.reduce((fileDepths, file, index) => {
      // Mutate the filesList to prepend the target path
      filesList[index] = file;
      fileDepths[file] = file.split(path.sep).length;
      return fileDepths;
    }, {});

    filesList.sort((a, b) => fileDepths[a] - fileDepths[b]);

    const filesContents = await Promise.all(filesList.map((fileName) => fs.readJSON(path.join(targetPath, fileName))));

    filesList.forEach((fileName, index) => {

      const directory = path.dirname(fileName);
      const parentData = this.getDataForPath(directory);
      const data = filesContents[index];

      const merged = _.mergeWith(_.cloneDeep(parentData), data, (destinationValue, sourceValue) => {
        if (Array.isArray(destinationValue) && Array.isArray(sourceValue)) {
          return _.cloneDeep(destinationValue).concat(_.cloneDeep(sourceValue));
        }
      });

      if (merged.rules) {
        for (const rule of merged.rules) {
          rule.baseDir = directory;
        }
      }

      this.cache[directory] = merged;

    });
  }

  getGroupOptions (fileName) {
    const { rules, ...pathData } = this.getDataForPath(fileName);
    const { group = 'default', scale = 1, sprite = true } = Object.assign(pathData, this.getDataForRules(fileName, rules));
    return { group, scale, sprite };
  }

  matchAgainst (fileName, files) {
    for (const file of files) {

      if (fileName === file) {
        return true;
      }

      const isDirectory = fileName.startsWith(file) && (file.endsWidth('/') || fileName[file.length] === '/');

      if (isDirectory) {
        return true;
      }

      if (minimatch(fileName, file)) {
        return true;
      }
    }

    return false;
  }

  getDataForRules (fileName, rules) {
    if (rules) {
      for (let i = rules.length - 1; i >= 0; i--) {
        const { baseDir, files, ...rest } = rules[i];
        if (this.matchAgainst(path.relative(baseDir, fileName), files)) {
          return rest;
        }
      }
    }

    return null;
  }

}

module.exports = SpriteMetadataLoader;
