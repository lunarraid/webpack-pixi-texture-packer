import exportedData from './virtual.loader.js!';
import { autoDetectResource, BaseTexture, Texture, Rectangle, Loader } from 'pixi.js';

const { animations, spritesheets } = exportedData;

const textures = {};
const atlasTextureMap = {};
const textureKeys = [];

const { floor } = Math;

for (const spritesheet of spritesheets) {

  const sheetPath = __webpack_public_path__ + spritesheet.meta.image;
  const { scale } = spritesheet.meta;
  const resolution = scale !== undefined ? parseFloat(scale) : 1;

  const atlasTexture = textures[sheetPath] = new Texture(new BaseTexture(null, { mipmap: 1 }));

  if (resolution !== 1) {
    atlasTexture.baseTexture.setResolution(resolution);
  }

  BaseTexture.addToCache(atlasTexture.baseTexture, sheetPath);
  Texture.addToCache(atlasTexture, sheetPath);

  for (const spriteKey in spritesheet.frames) {
    const data = spritesheet.frames[spriteKey];
    const rect = data.frame;


    let frame = null;
    let trim = null;

    const sourceSize = data.trimmed !== false && data.sourceSize ? data.sourceSize : data.frame;
    const orig = new Rectangle(0, 0, floor(sourceSize.w / resolution), floor(sourceSize.h / resolution));

    if (data.rotated) {
      frame = new Rectangle(
        floor(rect.x / resolution),
        floor(rect.y / resolution),
        floor(rect.h / resolution),
        floor(rect.w / resolution)
      );
    } else {
      frame = new Rectangle(
        floor(rect.x / resolution),
        floor(rect.y / resolution),
        floor(rect.w / resolution),
        floor(rect.h / resolution)
      );
    }

    if (data.trimmed !== false && data.spriteSourceSize) {
      trim = new Rectangle(
        floor(data.spriteSourceSize.x / resolution),
        floor(data.spriteSourceSize.y / resolution),
        floor(rect.w / resolution),
        floor(rect.h / resolution)
      );
    }

    const frameTexture = new Texture(atlasTexture.baseTexture, frame, orig, trim, data.rotated ? 2 : 0, data.anchor);
    Texture.addToCache(frameTexture, spriteKey);

    textures[spriteKey] = frameTexture;

    atlasTextureMap[spriteKey] = sheetPath;
    textureKeys.push(spriteKey);
  }

}

function flattenLoadList (list, result = []) {
  if (Array.isArray(list)) {
    for (let i = 0, len = list.length; i < len; i++) {
      flattenLoadList(list[i], result);
    }
    return result;
  }

  for (const key of textureKeys) {
    if (key.startsWith(list)) {
      const atlasPath = atlasTextureMap[key];

      if (atlasPath && !result.includes(atlasPath)) {
        result.push(atlasPath);
      }
    }
  }

  return result;
}

function load (items) {
  const loadList = flattenLoadList(items);

  if (!loadList.length) {
    return Promise.reject(new Error('Nothing to load'));
  }

  const loadPromises = loadList.map((itemToLoad) => {
    const texture = textures[itemToLoad];

    if (!texture.baseTexture.valid) {
      if (!texture.baseTexture.resource) {
        texture.baseTexture.setResource(autoDetectResource(itemToLoad));
      }

      return texture.baseTexture.resource.load();
    }

    return null;
  });

  return Promise.all(loadPromises);
}

function getTexture (key) {
  const result = textures[key];

  if (!result) {
    return null;
  }

  if (!result.baseTexture.valid) {
    load(key);
  }

  return result;
}

export { textures, getTexture, load };
