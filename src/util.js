'use strict';

const BinaryPack = require('js-binarypack');
const Enum       = require('enum');

const shim = require('./webrtcShim');
const RTCPeerConnection = shim.RTCPeerConnection;

const LOG_PREFIX      = 'SkyWayJS: ';

const LogLevel = new Enum({
  NONE:  0,
  ERROR: 1,
  WARN:  2,
  FULL:  3
});

const MessageTypes = new Enum([
  'OPEN',
  'ERROR',
  'OFFER',
  'ANSWER',
  'LEAVE',
  'EXPIRE',
  'CANDIDATE'
]);

class Util {
  constructor() {
    this.CLOUD_HOST = 'skyway.io';
    this.CLOUD_PORT = 443;
    this.TURN_HOST = 'turn.skyway.io';
    this.TURN_PORT = 443;
    this.debug = false;
    this.pack = BinaryPack.pack;
    this.unpack = BinaryPack.unpack;
    this.setZeroTimeout = undefined;
    this.LOG_LEVELS = LogLevel;
    this.MESSAGE_TYPES = MessageTypes;

    this.chunkedBrowsers = {Chrome: 1};
    // Current recommended maximum chunksize is 16KB (DataChannel spec)
    // https://tools.ietf.org/html/draft-ietf-rtcweb-data-channel-13
    this.chunkedMTU = 16300;
    // Number of times DataChannel has chunked (in total)
    this.chunkedCount = 1;

    this.defaultConfig = {
      iceServers: [{
        urls: 'stun:stun.skyway.io:3478',
        url:  'stun:stun.skyway.io:3478'
      }]
    };

    // Returns the current browser.
    this.browser = (function() {
      if (window.mozRTCPeerConnection) {
        return 'Firefox';
      }
      if (window.webkitRTCPeerConnection) {
        return 'Chrome';
      }
      if (window.RTCPeerConnection) {
        return 'Supported';
      }
      return 'Unsupported';
    })();

    this.supports = (function() {
      if (typeof RTCPeerConnection === 'undefined') {
        return {};
      }

      let data = true;
      let binaryBlob = false;

      let pc;
      let dc;
      try {
        pc = new RTCPeerConnection(this.defaultConfig, {});
      } catch (e) {
        data = false;
      }

      if (data) {
        try {
          dc = pc.createDataChannel('_SKYWAYTEST');
        } catch (e) {
          data = false;
        }
      }

      if (data) {
        // Binary test
        try {
          dc.binaryType = 'blob';
          binaryBlob = true;
        } catch (e) {
          // binaryBlob is already false
        }
      }

      if (pc) {
        pc.close();
      }

      return {
        binaryBlob: binaryBlob
      };
    })();

    this._logLevel = LogLevel.NONE.value;
  }

  setLogLevel(level) {
    if (level.value) {
      level = level.value;
    }

    const decimalRadix = 10;
    let debugLevel = parseInt(level, decimalRadix);

    switch (debugLevel) {
      case 0:
        this._logLevel = LogLevel.NONE.value;
        break;
      case 1:
        this._logLevel = LogLevel.ERROR.value;
        break;
      case 2:
        this._logLevel = LogLevel.WARN.value;
        break;
      case 3:
        this._logLevel = LogLevel.FULL.value;
        break;
      default:
        this._logLevel = LogLevel.NONE.value;
        break;
    }
  }

  warn() {
    if (this._logLevel >= LogLevel.WARN.value) {
      let copy = Array.prototype.slice.call(arguments);
      copy.unshift(LOG_PREFIX);
      console.warn.apply(console, copy);
    }
  }

  error() {
    if (this._logLevel >= LogLevel.ERROR.value) {
      let copy = Array.prototype.slice.call(arguments);
      copy.unshift(LOG_PREFIX);
      console.error.apply(console, copy);
    }
  }

  log() {
    if (this._logLevel >= LogLevel.FULL.value) {
      let copy = Array.prototype.slice.call(arguments);
      copy.unshift(LOG_PREFIX);
      console.log.apply(console, copy);
    }
  }

  validateId(id) {
    // Allow empty ids
    return !id || /^[A-Za-z0-9_-]+(?:[ _-][A-Za-z0-9]+)*$/.exec(id);
  }

  validateKey(key) {
    // Allow empty keys
    return !key || /^[a-z0-9]{8}(-[a-z0-9]{4}){3}-[a-z0-9]{12}$/.exec(key);
  }

  randomToken() {
    return Math.random().toString(36).substr(2);
  }

  chunk(blob) {
    let chunks = [];
    let size = blob.size;
    let start = 0;
    let index = 0;
    let total = Math.ceil(size / this.chunkedMTU);
    while (start < size) {
      let end = Math.min(size, start + this.chunkedMTU);
      let blobSlice = blob.slice(start, end);

      let chunk = {
        parentMsgId: this.chunkedCount,
        chunkIndex:  index,
        chunkData:   blobSlice,
        totalChunks: total
      };

      chunks.push(chunk);

      start = end;
      index++;
    }
    this.chunkedCount++;
    return chunks;
  }

  blobToArrayBuffer(blob, cb) {
    let fr = new FileReader();
    fr.onload = event => {
      cb(event.target.result);
    };
    fr.readAsArrayBuffer(blob);
  }

  blobToBinaryString(blob, cb) {
    let fr = new FileReader();
    fr.onload = event => {
      cb(event.target.result);
    };
    fr.readAsBinaryString(blob);
  }

  binaryStringToArrayBuffer(binary) {
    let byteArray = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      byteArray[i] = binary.charCodeAt(i) & 0xff;
    }
    return byteArray.buffer;
  }

  isSecure() {
    return location.protocol === 'https:';
  }
}

module.exports = new Util();
