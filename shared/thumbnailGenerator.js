// This is used in addon/webextension/background/takeshot.js and
// server/src/pages/shot/controller.js . It is used in a browser
// environment.

// Resize down 1/2 at a time produces better image quality.
// Not quite as good as using a third-party filter (which will be
// slower), but good enough.
const maxResizeScaleFactor = 0.5

/**
 * @param {dataUrl} String Data URL of the original image.
 * @param {int} imageHeight Height in pixels of the original image.
 * @param {int} imageWidth Width in pixels of the original image.
 * @param {String} urlOrBlob 'blob' for a blob, otherwise data url.
 * @returns A promise that resolves to the data URL or blob of the thumbnail image, or null.
 */
function createThumbnail(dataUrl, imageWidth, imageHeight, urlOrBlob) {
  // The shot will be scaled or cropped down to 210px on x, and cropped or
  // scaled down to a maximum of 280px on y.
  // x: 210
  // y: <= 280
  const maxThumbnailWidth = 210;
  const maxThumbnailHeight = 280;

  // There's cost associated with generating, transmitting, and storing
  // thumbnails, so we'll opt out if the image size is below a certain threshold
  const thumbnailThresholdFactor = 1.20;
  const thumbnailWidthThreshold = maxThumbnailWidth * thumbnailThresholdFactor;
  const thumbnailHeightThreshold = maxThumbnailHeight * thumbnailThresholdFactor;

  if (imageWidth <= thumbnailWidthThreshold &&
      imageHeight <= thumbnailHeightThreshold) {
    // Do not create a thumbnail.
    return Promise.resolve(null);
  }

  const displayAspectRatio = 3 / 4;
  let imageAspectRatio = imageWidth / imageHeight;
  let thumbnailImageWidth, thumbnailImageHeight;
  let scaledX, scaledY;

  if (imageAspectRatio > displayAspectRatio) {
    // "Landscape" mode
    // Scale on y, crop on x
    let yScaleFactor = (imageHeight > maxThumbnailHeight) ? (maxThumbnailHeight / imageHeight) : 1.0;
    thumbnailImageHeight = scaledY = Math.round(imageHeight * yScaleFactor);
    scaledX = Math.round(imageWidth * yScaleFactor);
    thumbnailImageWidth = Math.min(scaledX, maxThumbnailWidth);
  } else {
    // "Portrait" mode
    // Scale on x, crop on y
    let xScaleFactor = (imageWidth > maxThumbnailWidth) ? (maxThumbnailWidth / imageWidth) : 1.0;
    thumbnailImageWidth = scaledX = Math.round(imageWidth * xScaleFactor);
    scaledY = Math.round(imageHeight * xScaleFactor);
    // The CSS could widen the image, in which case we crop more off of y.
    thumbnailImageHeight = Math.min(scaledY, maxThumbnailHeight,
                                    maxThumbnailHeight / (maxThumbnailWidth / imageWidth));
  }

  return new Promise((resolve, reject) => {
    let thumbnailImage = new Image();
    let srcWidth = imageWidth;
    let srcHeight = imageHeight;
    let destWidth, destHeight;

    thumbnailImage.onload = function() {
      destWidth = Math.round(srcWidth * maxResizeScaleFactor);
      destHeight = Math.round(srcHeight * maxResizeScaleFactor);
      if (destWidth <= scaledX || destHeight <= scaledY) {
        srcWidth = Math.round(srcWidth * (thumbnailImageWidth / scaledX));
        srcHeight = Math.round(srcHeight * (thumbnailImageHeight / scaledY));
        destWidth = thumbnailImageWidth;
        destHeight = thumbnailImageHeight;
      }

      const thumbnailCanvas = document.createElement('canvas');
      thumbnailCanvas.width = destWidth;
      thumbnailCanvas.height = destHeight;
      const ctx = thumbnailCanvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;

      ctx.drawImage(
        thumbnailImage,
        0, 0, srcWidth, srcHeight,
        0, 0, destWidth, destHeight);

      if (thumbnailCanvas.width <= thumbnailImageWidth ||
        thumbnailCanvas.height <= thumbnailImageHeight) {
        if (urlOrBlob === "blob") {
          thumbnailCanvas.toBlob((blob) => {
            resolve(blob);
          });
        } else {
          resolve(thumbnailCanvas.toDataURL("image/png"))
        }
        return;
      }

      srcWidth = destWidth;
      srcHeight = destHeight;
      thumbnailImage.src = thumbnailCanvas.toDataURL();
    }
    thumbnailImage.src = dataUrl;
  });
}

function createThumbnailUrl(shot) {
  const image = shot.getClip(shot.clipNames()[0]).image;
  if (!image.url) {
    return Promise.resolve(null);
  }
  return createThumbnail(
    image.url, image.dimensions.x, image.dimensions.y, "dataurl");
}

function createThumbnailBlobFromPromise(shot, blobToUrlPromise) {
  return blobToUrlPromise.then(dataUrl => {
    const image = shot.getClip(shot.clipNames()[0]).image;
    return createThumbnail(
      dataUrl, image.dimensions.x, image.dimensions.y, "blob");
  });
}

if (typeof exports != "undefined") {
  exports.createThumbnailUrl = createThumbnailUrl;
  exports.createThumbnailBlobFromPromise = createThumbnailBlobFromPromise;
}
