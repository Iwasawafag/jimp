// JavaScript Image Resizer (c) 2012 - Grant Galitz
// Released to public domain 29 July 2013: https://github.com/grantgalitz/JS-Image-Resizer/issues/4

function Resize(widthOriginal, heightOriginal, targetWidth, targetHeight, blendAlpha, interpolationPass, resizeCallback) {
    this.widthOriginal = Math.abs(parseInt(widthOriginal) || 0);
    this.heightOriginal = Math.abs(parseInt(heightOriginal) || 0);
    this.targetWidth = Math.abs(parseInt(targetWidth) || 0);
    this.targetHeight = Math.abs(parseInt(targetHeight) || 0);
    this.colorChannels = (!!blendAlpha) ? 4 : 3;
    this.interpolationPass = !!interpolationPass;
    this.resizeCallback = (typeof resizeCallback == "function") ? resizeCallback : function (returnedArray) {};
    this.targetWidthMultipliedByChannels = this.targetWidth * this.colorChannels;
    this.originalWidthMultipliedByChannels = this.widthOriginal * this.colorChannels;
    this.originalHeightMultipliedByChannels = this.heightOriginal * this.colorChannels;
    this.widthPassResultSize = this.targetWidthMultipliedByChannels * this.heightOriginal;
    this.finalResultSize = this.targetWidthMultipliedByChannels * this.targetHeight;
    this.initialize();
}

Resize.prototype.initialize = function () {
    //Perform some checks:
    if (this.widthOriginal > 0 && this.heightOriginal > 0 && this.targetWidth > 0 && this.targetHeight > 0) {
        this.configurePasses();
    } else {
        throw (new Error("Invalid settings specified for the resizer."));
    }
}

Resize.prototype.configurePasses = function () {
    if (this.widthOriginal == this.targetWidth) {
        //Bypass the width resizer pass:
        this.resizeWidth = this.bypassResizer;
    } else {
        //Setup the width resizer pass:
        this.ratioWeightWidthPass = this.widthOriginal / this.targetWidth;
        if (this.ratioWeightWidthPass < 1 && this.interpolationPass) {
            this.initializeFirstPassBuffers(true);
            this.resizeWidth = (this.colorChannels == 4) ? this.resizeWidthInterpolatedRGBA : this.resizeWidthInterpolatedRGB;
        } else {
            this.initializeFirstPassBuffers(false);
            this.resizeWidth = (this.colorChannels == 4) ? this.resizeWidthRGBA : this.resizeWidthRGB;
        }
    }
    if (this.heightOriginal == this.targetHeight) {
        //Bypass the height resizer pass:
        this.resizeHeight = this.bypassResizer;
    } else {
        //Setup the height resizer pass:
        this.ratioWeightHeightPass = this.heightOriginal / this.targetHeight;
        if (this.ratioWeightHeightPass < 1 && this.interpolationPass) {
            this.initializeSecondPassBuffers(true);
            this.resizeHeight = this.resizeHeightInterpolated;
        } else {
            this.initializeSecondPassBuffers(false);
            this.resizeHeight = (this.colorChannels == 4) ? this.resizeHeightRGBA : this.resizeHeightRGB;
        }
    }
}

Resize.prototype._resizeWidthInterpolatedChannels = function (buffer, fourthChannel) {
    var channelsNum = fourthChannel ? 4 : 3;
    var ratioWeight = this.ratioWeightWidthPass;
    var weight = 0;
    var finalOffset = 0;
    var pixelOffset = 0;
    var firstWeight = 0;
    var secondWeight = 0;
    var outputBuffer = this.widthBuffer;
    //Handle for only one interpolation input being valid for start calculation:
    for (var targetPosition = 0; weight < 1 / channelsNum; targetPosition += channelsNum, weight += ratioWeight) {
        for (finalOffset = targetPosition, pixelOffset = 0; finalOffset < this.widthPassResultSize; pixelOffset += this.originalWidthMultipliedByChannels, finalOffset += this.targetWidthMultipliedByChannels) {
            outputBuffer[finalOffset] = buffer[pixelOffset];
            outputBuffer[finalOffset + 1] = buffer[pixelOffset + 1];
            outputBuffer[finalOffset + 2] = buffer[pixelOffset + 2];
            if (!fourthChannel) continue;
            outputBuffer[finalOffset + 3] = buffer[pixelOffset + 3];
        }
    }
    //Adjust for overshoot of the last pass's counter:
    weight -= 1 / 3;
    for (var interpolationWidthSourceReadStop = this.widthOriginal - 1; weight < interpolationWidthSourceReadStop; targetPosition += channelsNum, weight += ratioWeight) {
        //Calculate weightings:
        secondWeight = weight % 1;
        firstWeight = 1 - secondWeight;
        //Interpolate:
        for (finalOffset = targetPosition, pixelOffset = Math.floor(weight) * channelsNum; finalOffset < this.widthPassResultSize; pixelOffset += this.originalWidthMultipliedByChannels, finalOffset += this.targetWidthMultipliedByChannels) {

            outputBuffer[finalOffset] = (buffer[pixelOffset] * firstWeight) + (buffer[pixelOffset + channelsNum] * secondWeight);
            outputBuffer[finalOffset + 1] = (buffer[pixelOffset + 1] * firstWeight) + (buffer[pixelOffset + channelsNum + 1] * secondWeight);
            outputBuffer[finalOffset + 2] = (buffer[pixelOffset + 2] * firstWeight) + (buffer[pixelOffset + channelsNum + 1] * secondWeight);
            if (!fourthChannel) continue;
            outputBuffer[finalOffset + 3] = (buffer[pixelOffset + 3] * firstWeight) + (buffer[pixelOffset + channelsNum + 1] * secondWeight);
        }
    }
    //Handle for only one interpolation input being valid for end calculation:
    for (interpolationWidthSourceReadStop = this.originalWidthMultipliedByChannels - channelsNum; targetPosition < this.targetWidthMultipliedByChannels; targetPosition += channelsNum) {
        for (finalOffset = targetPosition, pixelOffset = interpolationWidthSourceReadStop; finalOffset < this.widthPassResultSize; pixelOffset += this.originalWidthMultipliedByChannels, finalOffset += this.targetWidthMultipliedByChannels) {
            outputBuffer[finalOffset] = buffer[pixelOffset];
            outputBuffer[finalOffset + 1] = buffer[pixelOffset + 1];
            outputBuffer[finalOffset + 2] = buffer[pixelOffset + 2];
            if (!fourthChannel) continue;
            outputBuffer[finalOffset + 3] = buffer[pixelOffset + 3];
        }
    }
    return outputBuffer;
}

Resize.prototype._resizeWidthRGBComponent = function (buffer, fourthChannel) {
    var channelsNum = fourthChannel ? 4 : 3;
    var ratioWeight = this.ratioWeightWidthPass;
    var ratioWeightDivisor = 1 / ratioWeight;
    var weight = 0;
    var amountToNext = 0;
    var actualPosition = 0;
    var currentPosition = 0;
    var line = 0;
    var pixelOffset = 0;
    var outputOffset = 0;
    var nextLineOffsetOriginalWidth = this.originalWidthMultipliedByChannels - channelsNum + 1;
    var nextLineOffsetTargetWidth = this.targetWidthMultipliedByChannels - channelsNum + 1;
    var output = this.outputWidthWorkBench;
    var outputBuffer = this.widthBuffer;
    do {
        for (line = 0; line < this.originalHeightMultipliedByChannels;) {
            output[line++] = 0;
            output[line++] = 0;
            output[line++] = 0;
            if (!fourthChannel) continue;
            output[line++] = 0;
        }
        weight = ratioWeight;
        do {
            amountToNext = 1 + actualPosition - currentPosition;
            if (weight >= amountToNext) {
                for (line = 0, pixelOffset = actualPosition; line < this.originalHeightMultipliedByChannels; pixelOffset += nextLineOffsetOriginalWidth) {
                    pixelOffset--;
                    output[line++] += buffer[++pixelOffset] * amountToNext;
                    output[line++] += buffer[++pixelOffset] * amountToNext;
                    output[line++] += buffer[++pixelOffset] * amountToNext;
                    if (!fourthChannel) continue;
                    output[line++] += buffer[++pixelOffset] * amountToNext;
                }
                currentPosition = actualPosition = actualPosition + channelsNum;
                weight -= amountToNext;
            } else {
                for (line = 0, pixelOffset = actualPosition; line < this.originalHeightMultipliedByChannels; pixelOffset += nextLineOffsetOriginalWidth) {
                    pixelOffset--;
                    output[line++] += buffer[++pixelOffset] * weight;
                    output[line++] += buffer[++pixelOffset] * weight;
                    output[line++] += buffer[++pixelOffset] * weight;
                    if (!fourthChannel) continue;
                    output[line++] += buffer[++pixelOffset] * weight;
                }
                currentPosition += weight;
                break;
            }
        } while (weight > 0 && actualPosition < this.originalWidthMultipliedByChannels);
        for (line = 0, pixelOffset = outputOffset; line < this.originalHeightMultipliedByChannels; pixelOffset += nextLineOffsetTargetWidth) {
            pixelOffset--;
            outputBuffer[++pixelOffset] = output[line++] * ratioWeightDivisor;
            outputBuffer[++pixelOffset] = output[line++] * ratioWeightDivisor;
            outputBuffer[++pixelOffset] = output[line++] * ratioWeightDivisor;
            if (!fourthChannel) continue;
            outputBuffer[++pixelOffset] = output[line++] * ratioWeightDivisor;
        }
        outputOffset += channelsNum;
    } while (outputOffset < this.targetWidthMultipliedByChannels);
    return outputBuffer;
}

Resize.prototype._resizeHeightRGBChannels = function(buffer, fourthChannel) {
    var ratioWeight = this.ratioWeightHeightPass;
    var ratioWeightDivisor = 1 / ratioWeight;
    var weight = 0;
    var amountToNext = 0;
    var actualPosition = 0;
    var currentPosition = 0;
    var pixelOffset = 0;
    var outputOffset = 0;
    var output = this.outputHeightWorkBench;
    var outputBuffer = this.heightBuffer;
    do {
        for (pixelOffset = 0; pixelOffset < this.targetWidthMultipliedByChannels;) {
            output[pixelOffset++] = 0;
            output[pixelOffset++] = 0;
            output[pixelOffset++] = 0;
            if (!fourthChannel) continue;
            output[pixelOffset++] = 0;
        }
        weight = ratioWeight;
        do {
            amountToNext = 1 + actualPosition - currentPosition;
            if (weight >= amountToNext) {
                for (pixelOffset = 0; pixelOffset < this.targetWidthMultipliedByChannels;) {
                    output[pixelOffset++] += buffer[actualPosition++] * amountToNext;
                    output[pixelOffset++] += buffer[actualPosition++] * amountToNext;
                    output[pixelOffset++] += buffer[actualPosition++] * amountToNext;
                    if (!fourthChannel) continue;
                    output[pixelOffset++] += buffer[actualPosition++] * amountToNext;
                }
                currentPosition = actualPosition;
                weight -= amountToNext;
            } else {
                for (pixelOffset = 0, amountToNext = actualPosition; pixelOffset < this.targetWidthMultipliedByChannels;) {
                    output[pixelOffset++] += buffer[amountToNext++] * weight;
                    output[pixelOffset++] += buffer[amountToNext++] * weight;
                    output[pixelOffset++] += buffer[amountToNext++] * weight;
                    if (!fourthChannel) continue;
                    output[pixelOffset++] += buffer[amountToNext++] * weight;
                }
                currentPosition += weight;
                break;
            }
        } while (weight > 0 && actualPosition < this.widthPassResultSize);
        for (pixelOffset = 0; pixelOffset < this.targetWidthMultipliedByChannels;) {
            outputBuffer[outputOffset++] = Math.round(output[pixelOffset++] * ratioWeightDivisor);
            outputBuffer[outputOffset++] = Math.round(output[pixelOffset++] * ratioWeightDivisor);
            outputBuffer[outputOffset++] = Math.round(output[pixelOffset++] * ratioWeightDivisor);
            if (!fourthChannel) continue;
            outputBuffer[outputOffset++] = Math.round(output[pixelOffset++] * ratioWeightDivisor);
        }
    } while (outputOffset < this.finalResultSize);
    return outputBuffer;
}

Resize.prototype.resizeWidthInterpolatedRGB = function (buffer) {
    return this._resizeWidthInterpolatedChannels(buffer, false);
}

Resize.prototype.resizeWidthInterpolatedRGBA = function (buffer) {
    return this._resizeWidthInterpolatedChannels(buffer, true);
}

Resize.prototype.resizeWidthRGB = function (buffer) {
    return this._resizeWidthRGBComponent(buffer, false);
}

Resize.prototype.resizeWidthRGBA = function (buffer) {
    return this._resizeWidthRGBComponent(buffer, true);
}

Resize.prototype.resizeHeightInterpolated = function (buffer) {
    var ratioWeight = this.ratioWeightHeightPass;
    var weight = 0;
    var finalOffset = 0;
    var pixelOffset = 0;
    var pixelOffsetAccumulated = 0;
    var pixelOffsetAccumulated2 = 0;
    var firstWeight = 0;
    var secondWeight = 0;
    var outputBuffer = this.heightBuffer;
    //Handle for only one interpolation input being valid for start calculation:
    for (; weight < 1 / 3; weight += ratioWeight) {
        for (pixelOffset = 0; pixelOffset < this.targetWidthMultipliedByChannels;) {
            outputBuffer[finalOffset++] = Math.round(buffer[pixelOffset++]);
        }
    }
    //Adjust for overshoot of the last pass's counter:
    weight -= 1 / 3;
    for (var interpolationHeightSourceReadStop = this.heightOriginal - 1; weight < interpolationHeightSourceReadStop; weight += ratioWeight) {
        //Calculate weightings:
        secondWeight = weight % 1;
        firstWeight = 1 - secondWeight;
        //Interpolate:
        pixelOffsetAccumulated = Math.floor(weight) * this.targetWidthMultipliedByChannels;
        pixelOffsetAccumulated2 = pixelOffsetAccumulated + this.targetWidthMultipliedByChannels;
        for (pixelOffset = 0; pixelOffset < this.targetWidthMultipliedByChannels; ++pixelOffset) {
            outputBuffer[finalOffset++] = Math.round((buffer[pixelOffsetAccumulated++] * firstWeight) + (buffer[pixelOffsetAccumulated2++] * secondWeight));
        }
    }
    //Handle for only one interpolation input being valid for end calculation:
    while (finalOffset < this.finalResultSize) {
        for (pixelOffset = 0, pixelOffsetAccumulated = interpolationHeightSourceReadStop * this.targetWidthMultipliedByChannels; pixelOffset < this.targetWidthMultipliedByChannels; ++pixelOffset) {
            outputBuffer[finalOffset++] = Math.round(buffer[pixelOffsetAccumulated++]);
        }
    }
    return outputBuffer;
}

Resize.prototype.resizeHeightRGB = function (buffer) {
    return this._resizeHeightRGBChannels(buffer, false);
}

Resize.prototype.resizeHeightRGBA = function (buffer) {
    return this._resizeHeightRGBChannels(buffer, true);
}

Resize.prototype.resize = function (buffer) {
    this.resizeCallback(this.resizeHeight(this.resizeWidth(buffer)));
}

Resize.prototype.bypassResizer = function (buffer) {
    //Just return the buffer passsed:
    return buffer;
}

Resize.prototype.initializeFirstPassBuffers = function (BILINEARAlgo) {
    //Initialize the internal width pass buffers:
    this.widthBuffer = this.generateFloatBuffer(this.widthPassResultSize);
    if (!BILINEARAlgo) {
        this.outputWidthWorkBench = this.generateFloatBuffer(this.originalHeightMultipliedByChannels);
    }
}

Resize.prototype.initializeSecondPassBuffers = function (BILINEARAlgo) {
    //Initialize the internal height pass buffers:
    this.heightBuffer = this.generateUint8Buffer(this.finalResultSize);
    if (!BILINEARAlgo) {
        this.outputHeightWorkBench = this.generateFloatBuffer(this.targetWidthMultipliedByChannels);
    }
}

Resize.prototype.generateFloatBuffer = function (bufferLength) {
    //Generate a float32 typed array buffer:
    try {
        return new Float32Array(bufferLength);
    } catch (error) {
        return [];
    }
}

Resize.prototype.generateUint8Buffer = function (bufferLength) {
    //Generate a uint8 typed array buffer:
    try {
        return new Uint8Array(bufferLength);
    } catch (error) {
        return [];
    }
}

module.exports = Resize;
