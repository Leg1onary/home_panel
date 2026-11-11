var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/jpeg-js/lib/encoder.js
var require_encoder = __commonJS({
  "node_modules/jpeg-js/lib/encoder.js"(exports, module) {
    var btoa = btoa || function(buf) {
      return Buffer.from(buf).toString("base64");
    };
    function JPEGEncoder(quality) {
      var self = this;
      var fround = Math.round;
      var ffloor = Math.floor;
      var YTable = new Array(64);
      var UVTable = new Array(64);
      var fdtbl_Y = new Array(64);
      var fdtbl_UV = new Array(64);
      var YDC_HT;
      var UVDC_HT;
      var YAC_HT;
      var UVAC_HT;
      var bitcode = new Array(65535);
      var category = new Array(65535);
      var outputfDCTQuant = new Array(64);
      var DU = new Array(64);
      var byteout = [];
      var bytenew = 0;
      var bytepos = 7;
      var YDU = new Array(64);
      var UDU = new Array(64);
      var VDU = new Array(64);
      var clt = new Array(256);
      var RGB_YUV_TABLE = new Array(2048);
      var currentQuality;
      var ZigZag = [
        0,
        1,
        5,
        6,
        14,
        15,
        27,
        28,
        2,
        4,
        7,
        13,
        16,
        26,
        29,
        42,
        3,
        8,
        12,
        17,
        25,
        30,
        41,
        43,
        9,
        11,
        18,
        24,
        31,
        40,
        44,
        53,
        10,
        19,
        23,
        32,
        39,
        45,
        52,
        54,
        20,
        22,
        33,
        38,
        46,
        51,
        55,
        60,
        21,
        34,
        37,
        47,
        50,
        56,
        59,
        61,
        35,
        36,
        48,
        49,
        57,
        58,
        62,
        63
      ];
      var std_dc_luminance_nrcodes = [0, 0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
      var std_dc_luminance_values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      var std_ac_luminance_nrcodes = [0, 0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 125];
      var std_ac_luminance_values = [
        1,
        2,
        3,
        0,
        4,
        17,
        5,
        18,
        33,
        49,
        65,
        6,
        19,
        81,
        97,
        7,
        34,
        113,
        20,
        50,
        129,
        145,
        161,
        8,
        35,
        66,
        177,
        193,
        21,
        82,
        209,
        240,
        36,
        51,
        98,
        114,
        130,
        9,
        10,
        22,
        23,
        24,
        25,
        26,
        37,
        38,
        39,
        40,
        41,
        42,
        52,
        53,
        54,
        55,
        56,
        57,
        58,
        67,
        68,
        69,
        70,
        71,
        72,
        73,
        74,
        83,
        84,
        85,
        86,
        87,
        88,
        89,
        90,
        99,
        100,
        101,
        102,
        103,
        104,
        105,
        106,
        115,
        116,
        117,
        118,
        119,
        120,
        121,
        122,
        131,
        132,
        133,
        134,
        135,
        136,
        137,
        138,
        146,
        147,
        148,
        149,
        150,
        151,
        152,
        153,
        154,
        162,
        163,
        164,
        165,
        166,
        167,
        168,
        169,
        170,
        178,
        179,
        180,
        181,
        182,
        183,
        184,
        185,
        186,
        194,
        195,
        196,
        197,
        198,
        199,
        200,
        201,
        202,
        210,
        211,
        212,
        213,
        214,
        215,
        216,
        217,
        218,
        225,
        226,
        227,
        228,
        229,
        230,
        231,
        232,
        233,
        234,
        241,
        242,
        243,
        244,
        245,
        246,
        247,
        248,
        249,
        250
      ];
      var std_dc_chrominance_nrcodes = [0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
      var std_dc_chrominance_values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      var std_ac_chrominance_nrcodes = [0, 0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 119];
      var std_ac_chrominance_values = [
        0,
        1,
        2,
        3,
        17,
        4,
        5,
        33,
        49,
        6,
        18,
        65,
        81,
        7,
        97,
        113,
        19,
        34,
        50,
        129,
        8,
        20,
        66,
        145,
        161,
        177,
        193,
        9,
        35,
        51,
        82,
        240,
        21,
        98,
        114,
        209,
        10,
        22,
        36,
        52,
        225,
        37,
        241,
        23,
        24,
        25,
        26,
        38,
        39,
        40,
        41,
        42,
        53,
        54,
        55,
        56,
        57,
        58,
        67,
        68,
        69,
        70,
        71,
        72,
        73,
        74,
        83,
        84,
        85,
        86,
        87,
        88,
        89,
        90,
        99,
        100,
        101,
        102,
        103,
        104,
        105,
        106,
        115,
        116,
        117,
        118,
        119,
        120,
        121,
        122,
        130,
        131,
        132,
        133,
        134,
        135,
        136,
        137,
        138,
        146,
        147,
        148,
        149,
        150,
        151,
        152,
        153,
        154,
        162,
        163,
        164,
        165,
        166,
        167,
        168,
        169,
        170,
        178,
        179,
        180,
        181,
        182,
        183,
        184,
        185,
        186,
        194,
        195,
        196,
        197,
        198,
        199,
        200,
        201,
        202,
        210,
        211,
        212,
        213,
        214,
        215,
        216,
        217,
        218,
        226,
        227,
        228,
        229,
        230,
        231,
        232,
        233,
        234,
        242,
        243,
        244,
        245,
        246,
        247,
        248,
        249,
        250
      ];
      function initQuantTables(sf) {
        var YQT = [
          16,
          11,
          10,
          16,
          24,
          40,
          51,
          61,
          12,
          12,
          14,
          19,
          26,
          58,
          60,
          55,
          14,
          13,
          16,
          24,
          40,
          57,
          69,
          56,
          14,
          17,
          22,
          29,
          51,
          87,
          80,
          62,
          18,
          22,
          37,
          56,
          68,
          109,
          103,
          77,
          24,
          35,
          55,
          64,
          81,
          104,
          113,
          92,
          49,
          64,
          78,
          87,
          103,
          121,
          120,
          101,
          72,
          92,
          95,
          98,
          112,
          100,
          103,
          99
        ];
        for (var i = 0; i < 64; i++) {
          var t = ffloor((YQT[i] * sf + 50) / 100);
          if (t < 1) {
            t = 1;
          } else if (t > 255) {
            t = 255;
          }
          YTable[ZigZag[i]] = t;
        }
        var UVQT = [
          17,
          18,
          24,
          47,
          99,
          99,
          99,
          99,
          18,
          21,
          26,
          66,
          99,
          99,
          99,
          99,
          24,
          26,
          56,
          99,
          99,
          99,
          99,
          99,
          47,
          66,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99,
          99
        ];
        for (var j = 0; j < 64; j++) {
          var u = ffloor((UVQT[j] * sf + 50) / 100);
          if (u < 1) {
            u = 1;
          } else if (u > 255) {
            u = 255;
          }
          UVTable[ZigZag[j]] = u;
        }
        var aasf = [
          1,
          1.387039845,
          1.306562965,
          1.175875602,
          1,
          0.785694958,
          0.5411961,
          0.275899379
        ];
        var k = 0;
        for (var row = 0; row < 8; row++) {
          for (var col = 0; col < 8; col++) {
            fdtbl_Y[k] = 1 / (YTable[ZigZag[k]] * aasf[row] * aasf[col] * 8);
            fdtbl_UV[k] = 1 / (UVTable[ZigZag[k]] * aasf[row] * aasf[col] * 8);
            k++;
          }
        }
      }
      function computeHuffmanTbl(nrcodes, std_table) {
        var codevalue = 0;
        var pos_in_table = 0;
        var HT = new Array();
        for (var k = 1; k <= 16; k++) {
          for (var j = 1; j <= nrcodes[k]; j++) {
            HT[std_table[pos_in_table]] = [];
            HT[std_table[pos_in_table]][0] = codevalue;
            HT[std_table[pos_in_table]][1] = k;
            pos_in_table++;
            codevalue++;
          }
          codevalue *= 2;
        }
        return HT;
      }
      function initHuffmanTbl() {
        YDC_HT = computeHuffmanTbl(std_dc_luminance_nrcodes, std_dc_luminance_values);
        UVDC_HT = computeHuffmanTbl(std_dc_chrominance_nrcodes, std_dc_chrominance_values);
        YAC_HT = computeHuffmanTbl(std_ac_luminance_nrcodes, std_ac_luminance_values);
        UVAC_HT = computeHuffmanTbl(std_ac_chrominance_nrcodes, std_ac_chrominance_values);
      }
      function initCategoryNumber() {
        var nrlower = 1;
        var nrupper = 2;
        for (var cat = 1; cat <= 15; cat++) {
          for (var nr = nrlower; nr < nrupper; nr++) {
            category[32767 + nr] = cat;
            bitcode[32767 + nr] = [];
            bitcode[32767 + nr][1] = cat;
            bitcode[32767 + nr][0] = nr;
          }
          for (var nrneg = -(nrupper - 1); nrneg <= -nrlower; nrneg++) {
            category[32767 + nrneg] = cat;
            bitcode[32767 + nrneg] = [];
            bitcode[32767 + nrneg][1] = cat;
            bitcode[32767 + nrneg][0] = nrupper - 1 + nrneg;
          }
          nrlower <<= 1;
          nrupper <<= 1;
        }
      }
      function initRGBYUVTable() {
        for (var i = 0; i < 256; i++) {
          RGB_YUV_TABLE[i] = 19595 * i;
          RGB_YUV_TABLE[i + 256 >> 0] = 38470 * i;
          RGB_YUV_TABLE[i + 512 >> 0] = 7471 * i + 32768;
          RGB_YUV_TABLE[i + 768 >> 0] = -11059 * i;
          RGB_YUV_TABLE[i + 1024 >> 0] = -21709 * i;
          RGB_YUV_TABLE[i + 1280 >> 0] = 32768 * i + 8421375;
          RGB_YUV_TABLE[i + 1536 >> 0] = -27439 * i;
          RGB_YUV_TABLE[i + 1792 >> 0] = -5329 * i;
        }
      }
      function writeBits(bs) {
        var value = bs[0];
        var posval = bs[1] - 1;
        while (posval >= 0) {
          if (value & 1 << posval) {
            bytenew |= 1 << bytepos;
          }
          posval--;
          bytepos--;
          if (bytepos < 0) {
            if (bytenew == 255) {
              writeByte(255);
              writeByte(0);
            } else {
              writeByte(bytenew);
            }
            bytepos = 7;
            bytenew = 0;
          }
        }
      }
      function writeByte(value) {
        byteout.push(value);
      }
      function writeWord(value) {
        writeByte(value >> 8 & 255);
        writeByte(value & 255);
      }
      function fDCTQuant(data2, fdtbl) {
        var d0, d1, d2, d3, d4, d5, d6, d7;
        var dataOff = 0;
        var i;
        var I8 = 8;
        var I64 = 64;
        for (i = 0; i < I8; ++i) {
          d0 = data2[dataOff];
          d1 = data2[dataOff + 1];
          d2 = data2[dataOff + 2];
          d3 = data2[dataOff + 3];
          d4 = data2[dataOff + 4];
          d5 = data2[dataOff + 5];
          d6 = data2[dataOff + 6];
          d7 = data2[dataOff + 7];
          var tmp0 = d0 + d7;
          var tmp7 = d0 - d7;
          var tmp1 = d1 + d6;
          var tmp6 = d1 - d6;
          var tmp2 = d2 + d5;
          var tmp5 = d2 - d5;
          var tmp3 = d3 + d4;
          var tmp4 = d3 - d4;
          var tmp10 = tmp0 + tmp3;
          var tmp13 = tmp0 - tmp3;
          var tmp11 = tmp1 + tmp2;
          var tmp12 = tmp1 - tmp2;
          data2[dataOff] = tmp10 + tmp11;
          data2[dataOff + 4] = tmp10 - tmp11;
          var z1 = (tmp12 + tmp13) * 0.707106781;
          data2[dataOff + 2] = tmp13 + z1;
          data2[dataOff + 6] = tmp13 - z1;
          tmp10 = tmp4 + tmp5;
          tmp11 = tmp5 + tmp6;
          tmp12 = tmp6 + tmp7;
          var z5 = (tmp10 - tmp12) * 0.382683433;
          var z2 = 0.5411961 * tmp10 + z5;
          var z4 = 1.306562965 * tmp12 + z5;
          var z3 = tmp11 * 0.707106781;
          var z11 = tmp7 + z3;
          var z13 = tmp7 - z3;
          data2[dataOff + 5] = z13 + z2;
          data2[dataOff + 3] = z13 - z2;
          data2[dataOff + 1] = z11 + z4;
          data2[dataOff + 7] = z11 - z4;
          dataOff += 8;
        }
        dataOff = 0;
        for (i = 0; i < I8; ++i) {
          d0 = data2[dataOff];
          d1 = data2[dataOff + 8];
          d2 = data2[dataOff + 16];
          d3 = data2[dataOff + 24];
          d4 = data2[dataOff + 32];
          d5 = data2[dataOff + 40];
          d6 = data2[dataOff + 48];
          d7 = data2[dataOff + 56];
          var tmp0p2 = d0 + d7;
          var tmp7p2 = d0 - d7;
          var tmp1p2 = d1 + d6;
          var tmp6p2 = d1 - d6;
          var tmp2p2 = d2 + d5;
          var tmp5p2 = d2 - d5;
          var tmp3p2 = d3 + d4;
          var tmp4p2 = d3 - d4;
          var tmp10p2 = tmp0p2 + tmp3p2;
          var tmp13p2 = tmp0p2 - tmp3p2;
          var tmp11p2 = tmp1p2 + tmp2p2;
          var tmp12p2 = tmp1p2 - tmp2p2;
          data2[dataOff] = tmp10p2 + tmp11p2;
          data2[dataOff + 32] = tmp10p2 - tmp11p2;
          var z1p2 = (tmp12p2 + tmp13p2) * 0.707106781;
          data2[dataOff + 16] = tmp13p2 + z1p2;
          data2[dataOff + 48] = tmp13p2 - z1p2;
          tmp10p2 = tmp4p2 + tmp5p2;
          tmp11p2 = tmp5p2 + tmp6p2;
          tmp12p2 = tmp6p2 + tmp7p2;
          var z5p2 = (tmp10p2 - tmp12p2) * 0.382683433;
          var z2p2 = 0.5411961 * tmp10p2 + z5p2;
          var z4p2 = 1.306562965 * tmp12p2 + z5p2;
          var z3p2 = tmp11p2 * 0.707106781;
          var z11p2 = tmp7p2 + z3p2;
          var z13p2 = tmp7p2 - z3p2;
          data2[dataOff + 40] = z13p2 + z2p2;
          data2[dataOff + 24] = z13p2 - z2p2;
          data2[dataOff + 8] = z11p2 + z4p2;
          data2[dataOff + 56] = z11p2 - z4p2;
          dataOff++;
        }
        var fDCTQuant2;
        for (i = 0; i < I64; ++i) {
          fDCTQuant2 = data2[i] * fdtbl[i];
          outputfDCTQuant[i] = fDCTQuant2 > 0 ? fDCTQuant2 + 0.5 | 0 : fDCTQuant2 - 0.5 | 0;
        }
        return outputfDCTQuant;
      }
      function writeAPP0() {
        writeWord(65504);
        writeWord(16);
        writeByte(74);
        writeByte(70);
        writeByte(73);
        writeByte(70);
        writeByte(0);
        writeByte(1);
        writeByte(1);
        writeByte(0);
        writeWord(1);
        writeWord(1);
        writeByte(0);
        writeByte(0);
      }
      function writeAPP1(exifBuffer) {
        if (!exifBuffer) return;
        writeWord(65505);
        if (exifBuffer[0] === 69 && exifBuffer[1] === 120 && exifBuffer[2] === 105 && exifBuffer[3] === 102) {
          writeWord(exifBuffer.length + 2);
        } else {
          writeWord(exifBuffer.length + 5 + 2);
          writeByte(69);
          writeByte(120);
          writeByte(105);
          writeByte(102);
          writeByte(0);
        }
        for (var i = 0; i < exifBuffer.length; i++) {
          writeByte(exifBuffer[i]);
        }
      }
      function writeSOF0(width, height) {
        writeWord(65472);
        writeWord(17);
        writeByte(8);
        writeWord(height);
        writeWord(width);
        writeByte(3);
        writeByte(1);
        writeByte(17);
        writeByte(0);
        writeByte(2);
        writeByte(17);
        writeByte(1);
        writeByte(3);
        writeByte(17);
        writeByte(1);
      }
      function writeDQT() {
        writeWord(65499);
        writeWord(132);
        writeByte(0);
        for (var i = 0; i < 64; i++) {
          writeByte(YTable[i]);
        }
        writeByte(1);
        for (var j = 0; j < 64; j++) {
          writeByte(UVTable[j]);
        }
      }
      function writeDHT() {
        writeWord(65476);
        writeWord(418);
        writeByte(0);
        for (var i = 0; i < 16; i++) {
          writeByte(std_dc_luminance_nrcodes[i + 1]);
        }
        for (var j = 0; j <= 11; j++) {
          writeByte(std_dc_luminance_values[j]);
        }
        writeByte(16);
        for (var k = 0; k < 16; k++) {
          writeByte(std_ac_luminance_nrcodes[k + 1]);
        }
        for (var l = 0; l <= 161; l++) {
          writeByte(std_ac_luminance_values[l]);
        }
        writeByte(1);
        for (var m = 0; m < 16; m++) {
          writeByte(std_dc_chrominance_nrcodes[m + 1]);
        }
        for (var n = 0; n <= 11; n++) {
          writeByte(std_dc_chrominance_values[n]);
        }
        writeByte(17);
        for (var o = 0; o < 16; o++) {
          writeByte(std_ac_chrominance_nrcodes[o + 1]);
        }
        for (var p = 0; p <= 161; p++) {
          writeByte(std_ac_chrominance_values[p]);
        }
      }
      function writeCOM(comments) {
        if (typeof comments === "undefined" || comments.constructor !== Array) return;
        comments.forEach((e) => {
          if (typeof e !== "string") return;
          writeWord(65534);
          var l = e.length;
          writeWord(l + 2);
          var i;
          for (i = 0; i < l; i++)
            writeByte(e.charCodeAt(i));
        });
      }
      function writeSOS() {
        writeWord(65498);
        writeWord(12);
        writeByte(3);
        writeByte(1);
        writeByte(0);
        writeByte(2);
        writeByte(17);
        writeByte(3);
        writeByte(17);
        writeByte(0);
        writeByte(63);
        writeByte(0);
      }
      function processDU(CDU, fdtbl, DC, HTDC, HTAC) {
        var EOB = HTAC[0];
        var M16zeroes = HTAC[240];
        var pos;
        var I16 = 16;
        var I63 = 63;
        var I64 = 64;
        var DU_DCT = fDCTQuant(CDU, fdtbl);
        for (var j = 0; j < I64; ++j) {
          DU[ZigZag[j]] = DU_DCT[j];
        }
        var Diff = DU[0] - DC;
        DC = DU[0];
        if (Diff == 0) {
          writeBits(HTDC[0]);
        } else {
          pos = 32767 + Diff;
          writeBits(HTDC[category[pos]]);
          writeBits(bitcode[pos]);
        }
        var end0pos = 63;
        for (; end0pos > 0 && DU[end0pos] == 0; end0pos--) {
        }
        ;
        if (end0pos == 0) {
          writeBits(EOB);
          return DC;
        }
        var i = 1;
        var lng;
        while (i <= end0pos) {
          var startpos = i;
          for (; DU[i] == 0 && i <= end0pos; ++i) {
          }
          var nrzeroes = i - startpos;
          if (nrzeroes >= I16) {
            lng = nrzeroes >> 4;
            for (var nrmarker = 1; nrmarker <= lng; ++nrmarker)
              writeBits(M16zeroes);
            nrzeroes = nrzeroes & 15;
          }
          pos = 32767 + DU[i];
          writeBits(HTAC[(nrzeroes << 4) + category[pos]]);
          writeBits(bitcode[pos]);
          i++;
        }
        if (end0pos != I63) {
          writeBits(EOB);
        }
        return DC;
      }
      function initCharLookupTable() {
        var sfcc = String.fromCharCode;
        for (var i = 0; i < 256; i++) {
          clt[i] = sfcc(i);
        }
      }
      this.encode = function(image, quality2) {
        var time_start = (/* @__PURE__ */ new Date()).getTime();
        if (quality2) setQuality(quality2);
        byteout = new Array();
        bytenew = 0;
        bytepos = 7;
        writeWord(65496);
        writeAPP0();
        writeCOM(image.comments);
        writeAPP1(image.exifBuffer);
        writeDQT();
        writeSOF0(image.width, image.height);
        writeDHT();
        writeSOS();
        var DCY = 0;
        var DCU = 0;
        var DCV = 0;
        bytenew = 0;
        bytepos = 7;
        this.encode.displayName = "_encode_";
        var imageData = image.data;
        var width = image.width;
        var height = image.height;
        var quadWidth = width * 4;
        var tripleWidth = width * 3;
        var x, y = 0;
        var r, g, b;
        var start, p, col, row, pos;
        while (y < height) {
          x = 0;
          while (x < quadWidth) {
            start = quadWidth * y + x;
            p = start;
            col = -1;
            row = 0;
            for (pos = 0; pos < 64; pos++) {
              row = pos >> 3;
              col = (pos & 7) * 4;
              p = start + row * quadWidth + col;
              if (y + row >= height) {
                p -= quadWidth * (y + 1 + row - height);
              }
              if (x + col >= quadWidth) {
                p -= x + col - quadWidth + 4;
              }
              r = imageData[p++];
              g = imageData[p++];
              b = imageData[p++];
              YDU[pos] = (RGB_YUV_TABLE[r] + RGB_YUV_TABLE[g + 256 >> 0] + RGB_YUV_TABLE[b + 512 >> 0] >> 16) - 128;
              UDU[pos] = (RGB_YUV_TABLE[r + 768 >> 0] + RGB_YUV_TABLE[g + 1024 >> 0] + RGB_YUV_TABLE[b + 1280 >> 0] >> 16) - 128;
              VDU[pos] = (RGB_YUV_TABLE[r + 1280 >> 0] + RGB_YUV_TABLE[g + 1536 >> 0] + RGB_YUV_TABLE[b + 1792 >> 0] >> 16) - 128;
            }
            DCY = processDU(YDU, fdtbl_Y, DCY, YDC_HT, YAC_HT);
            DCU = processDU(UDU, fdtbl_UV, DCU, UVDC_HT, UVAC_HT);
            DCV = processDU(VDU, fdtbl_UV, DCV, UVDC_HT, UVAC_HT);
            x += 32;
          }
          y += 8;
        }
        if (bytepos >= 0) {
          var fillbits = [];
          fillbits[1] = bytepos + 1;
          fillbits[0] = (1 << bytepos + 1) - 1;
          writeBits(fillbits);
        }
        writeWord(65497);
        if (typeof module === "undefined") return new Uint8Array(byteout);
        return Buffer.from(byteout);
        var jpegDataUri = "data:image/jpeg;base64," + btoa(byteout.join(""));
        byteout = [];
        var duration = (/* @__PURE__ */ new Date()).getTime() - time_start;
        return jpegDataUri;
      };
      function setQuality(quality2) {
        if (quality2 <= 0) {
          quality2 = 1;
        }
        if (quality2 > 100) {
          quality2 = 100;
        }
        if (currentQuality == quality2) return;
        var sf = 0;
        if (quality2 < 50) {
          sf = Math.floor(5e3 / quality2);
        } else {
          sf = Math.floor(200 - quality2 * 2);
        }
        initQuantTables(sf);
        currentQuality = quality2;
      }
      function init() {
        var time_start = (/* @__PURE__ */ new Date()).getTime();
        if (!quality) quality = 50;
        initCharLookupTable();
        initHuffmanTbl();
        initCategoryNumber();
        initRGBYUVTable();
        setQuality(quality);
        var duration = (/* @__PURE__ */ new Date()).getTime() - time_start;
      }
      init();
    }
    if (typeof module !== "undefined") {
      module.exports = encode;
    } else if (typeof window !== "undefined") {
      window["jpeg-js"] = window["jpeg-js"] || {};
      window["jpeg-js"].encode = encode;
    }
    function encode(imgData, qu) {
      if (typeof qu === "undefined") qu = 50;
      var encoder = new JPEGEncoder(qu);
      var data2 = encoder.encode(imgData, qu);
      return {
        data: data2,
        width: imgData.width,
        height: imgData.height
      };
    }
  }
});

// node_modules/jpeg-js/lib/decoder.js
var require_decoder = __commonJS({
  "node_modules/jpeg-js/lib/decoder.js"(exports, module) {
    var JpegImage = (function jpegImage() {
      "use strict";
      var dctZigZag = new Int32Array([
        0,
        1,
        8,
        16,
        9,
        2,
        3,
        10,
        17,
        24,
        32,
        25,
        18,
        11,
        4,
        5,
        12,
        19,
        26,
        33,
        40,
        48,
        41,
        34,
        27,
        20,
        13,
        6,
        7,
        14,
        21,
        28,
        35,
        42,
        49,
        56,
        57,
        50,
        43,
        36,
        29,
        22,
        15,
        23,
        30,
        37,
        44,
        51,
        58,
        59,
        52,
        45,
        38,
        31,
        39,
        46,
        53,
        60,
        61,
        54,
        47,
        55,
        62,
        63
      ]);
      var dctCos1 = 4017;
      var dctSin1 = 799;
      var dctCos3 = 3406;
      var dctSin3 = 2276;
      var dctCos6 = 1567;
      var dctSin6 = 3784;
      var dctSqrt2 = 5793;
      var dctSqrt1d2 = 2896;
      function constructor() {
      }
      function buildHuffmanTable(codeLengths, values) {
        var k = 0, code = [], i, j, length = 16;
        while (length > 0 && !codeLengths[length - 1])
          length--;
        code.push({ children: [], index: 0 });
        var p = code[0], q;
        for (i = 0; i < length; i++) {
          for (j = 0; j < codeLengths[i]; j++) {
            p = code.pop();
            p.children[p.index] = values[k];
            while (p.index > 0) {
              if (code.length === 0)
                throw new Error("Could not recreate Huffman Table");
              p = code.pop();
            }
            p.index++;
            code.push(p);
            while (code.length <= i) {
              code.push(q = { children: [], index: 0 });
              p.children[p.index] = q.children;
              p = q;
            }
            k++;
          }
          if (i + 1 < length) {
            code.push(q = { children: [], index: 0 });
            p.children[p.index] = q.children;
            p = q;
          }
        }
        return code[0].children;
      }
      function decodeScan(data2, offset, frame, components, resetInterval, spectralStart, spectralEnd, successivePrev, successive, opts) {
        var precision = frame.precision;
        var samplesPerLine = frame.samplesPerLine;
        var scanLines = frame.scanLines;
        var mcusPerLine = frame.mcusPerLine;
        var progressive = frame.progressive;
        var maxH = frame.maxH, maxV = frame.maxV;
        var startOffset = offset, bitsData = 0, bitsCount = 0;
        function readBit() {
          if (bitsCount > 0) {
            bitsCount--;
            return bitsData >> bitsCount & 1;
          }
          bitsData = data2[offset++];
          if (bitsData == 255) {
            var nextByte = data2[offset++];
            if (nextByte) {
              throw new Error("unexpected marker: " + (bitsData << 8 | nextByte).toString(16));
            }
          }
          bitsCount = 7;
          return bitsData >>> 7;
        }
        function decodeHuffman(tree) {
          var node = tree, bit;
          while ((bit = readBit()) !== null) {
            node = node[bit];
            if (typeof node === "number")
              return node;
            if (typeof node !== "object")
              throw new Error("invalid huffman sequence");
          }
          return null;
        }
        function receive(length) {
          var n2 = 0;
          while (length > 0) {
            var bit = readBit();
            if (bit === null) return;
            n2 = n2 << 1 | bit;
            length--;
          }
          return n2;
        }
        function receiveAndExtend(length) {
          var n2 = receive(length);
          if (n2 >= 1 << length - 1)
            return n2;
          return n2 + (-1 << length) + 1;
        }
        function decodeBaseline(component2, zz) {
          var t = decodeHuffman(component2.huffmanTableDC);
          var diff = t === 0 ? 0 : receiveAndExtend(t);
          zz[0] = component2.pred += diff;
          var k2 = 1;
          while (k2 < 64) {
            var rs = decodeHuffman(component2.huffmanTableAC);
            var s = rs & 15, r = rs >> 4;
            if (s === 0) {
              if (r < 15)
                break;
              k2 += 16;
              continue;
            }
            k2 += r;
            var z = dctZigZag[k2];
            zz[z] = receiveAndExtend(s);
            k2++;
          }
        }
        function decodeDCFirst(component2, zz) {
          var t = decodeHuffman(component2.huffmanTableDC);
          var diff = t === 0 ? 0 : receiveAndExtend(t) << successive;
          zz[0] = component2.pred += diff;
        }
        function decodeDCSuccessive(component2, zz) {
          zz[0] |= readBit() << successive;
        }
        var eobrun = 0;
        function decodeACFirst(component2, zz) {
          if (eobrun > 0) {
            eobrun--;
            return;
          }
          var k2 = spectralStart, e = spectralEnd;
          while (k2 <= e) {
            var rs = decodeHuffman(component2.huffmanTableAC);
            var s = rs & 15, r = rs >> 4;
            if (s === 0) {
              if (r < 15) {
                eobrun = receive(r) + (1 << r) - 1;
                break;
              }
              k2 += 16;
              continue;
            }
            k2 += r;
            var z = dctZigZag[k2];
            zz[z] = receiveAndExtend(s) * (1 << successive);
            k2++;
          }
        }
        var successiveACState = 0, successiveACNextValue;
        function decodeACSuccessive(component2, zz) {
          var k2 = spectralStart, e = spectralEnd, r = 0;
          while (k2 <= e) {
            var z = dctZigZag[k2];
            var direction = zz[z] < 0 ? -1 : 1;
            switch (successiveACState) {
              case 0:
                var rs = decodeHuffman(component2.huffmanTableAC);
                var s = rs & 15, r = rs >> 4;
                if (s === 0) {
                  if (r < 15) {
                    eobrun = receive(r) + (1 << r);
                    successiveACState = 4;
                  } else {
                    r = 16;
                    successiveACState = 1;
                  }
                } else {
                  if (s !== 1)
                    throw new Error("invalid ACn encoding");
                  successiveACNextValue = receiveAndExtend(s);
                  successiveACState = r ? 2 : 3;
                }
                continue;
              case 1:
              // skipping r zero items
              case 2:
                if (zz[z])
                  zz[z] += (readBit() << successive) * direction;
                else {
                  r--;
                  if (r === 0)
                    successiveACState = successiveACState == 2 ? 3 : 0;
                }
                break;
              case 3:
                if (zz[z])
                  zz[z] += (readBit() << successive) * direction;
                else {
                  zz[z] = successiveACNextValue << successive;
                  successiveACState = 0;
                }
                break;
              case 4:
                if (zz[z])
                  zz[z] += (readBit() << successive) * direction;
                break;
            }
            k2++;
          }
          if (successiveACState === 4) {
            eobrun--;
            if (eobrun === 0)
              successiveACState = 0;
          }
        }
        function decodeMcu(component2, decode2, mcu2, row, col) {
          var mcuRow = mcu2 / mcusPerLine | 0;
          var mcuCol = mcu2 % mcusPerLine;
          var blockRow = mcuRow * component2.v + row;
          var blockCol = mcuCol * component2.h + col;
          if (component2.blocks[blockRow] === void 0 && opts.tolerantDecoding)
            return;
          decode2(component2, component2.blocks[blockRow][blockCol]);
        }
        function decodeBlock(component2, decode2, mcu2) {
          var blockRow = mcu2 / component2.blocksPerLine | 0;
          var blockCol = mcu2 % component2.blocksPerLine;
          if (component2.blocks[blockRow] === void 0 && opts.tolerantDecoding)
            return;
          decode2(component2, component2.blocks[blockRow][blockCol]);
        }
        var componentsLength = components.length;
        var component, i, j, k, n;
        var decodeFn;
        if (progressive) {
          if (spectralStart === 0)
            decodeFn = successivePrev === 0 ? decodeDCFirst : decodeDCSuccessive;
          else
            decodeFn = successivePrev === 0 ? decodeACFirst : decodeACSuccessive;
        } else {
          decodeFn = decodeBaseline;
        }
        var mcu = 0, marker;
        var mcuExpected;
        if (componentsLength == 1) {
          mcuExpected = components[0].blocksPerLine * components[0].blocksPerColumn;
        } else {
          mcuExpected = mcusPerLine * frame.mcusPerColumn;
        }
        if (!resetInterval) resetInterval = mcuExpected;
        var h, v;
        while (mcu < mcuExpected) {
          for (i = 0; i < componentsLength; i++)
            components[i].pred = 0;
          eobrun = 0;
          if (componentsLength == 1) {
            component = components[0];
            for (n = 0; n < resetInterval; n++) {
              decodeBlock(component, decodeFn, mcu);
              mcu++;
            }
          } else {
            for (n = 0; n < resetInterval; n++) {
              for (i = 0; i < componentsLength; i++) {
                component = components[i];
                h = component.h;
                v = component.v;
                for (j = 0; j < v; j++) {
                  for (k = 0; k < h; k++) {
                    decodeMcu(component, decodeFn, mcu, j, k);
                  }
                }
              }
              mcu++;
              if (mcu === mcuExpected) break;
            }
          }
          if (mcu === mcuExpected) {
            do {
              if (data2[offset] === 255) {
                if (data2[offset + 1] !== 0) {
                  break;
                }
              }
              offset += 1;
            } while (offset < data2.length - 2);
          }
          bitsCount = 0;
          marker = data2[offset] << 8 | data2[offset + 1];
          if (marker < 65280) {
            throw new Error("marker was not found");
          }
          if (marker >= 65488 && marker <= 65495) {
            offset += 2;
          } else
            break;
        }
        return offset - startOffset;
      }
      function buildComponentData(frame, component) {
        var lines = [];
        var blocksPerLine = component.blocksPerLine;
        var blocksPerColumn = component.blocksPerColumn;
        var samplesPerLine = blocksPerLine << 3;
        var R = new Int32Array(64), r = new Uint8Array(64);
        function quantizeAndInverse(zz, dataOut, dataIn) {
          var qt = component.quantizationTable;
          var v0, v1, v2, v3, v4, v5, v6, v7, t;
          var p = dataIn;
          var i2;
          for (i2 = 0; i2 < 64; i2++)
            p[i2] = zz[i2] * qt[i2];
          for (i2 = 0; i2 < 8; ++i2) {
            var row = 8 * i2;
            if (p[1 + row] == 0 && p[2 + row] == 0 && p[3 + row] == 0 && p[4 + row] == 0 && p[5 + row] == 0 && p[6 + row] == 0 && p[7 + row] == 0) {
              t = dctSqrt2 * p[0 + row] + 512 >> 10;
              p[0 + row] = t;
              p[1 + row] = t;
              p[2 + row] = t;
              p[3 + row] = t;
              p[4 + row] = t;
              p[5 + row] = t;
              p[6 + row] = t;
              p[7 + row] = t;
              continue;
            }
            v0 = dctSqrt2 * p[0 + row] + 128 >> 8;
            v1 = dctSqrt2 * p[4 + row] + 128 >> 8;
            v2 = p[2 + row];
            v3 = p[6 + row];
            v4 = dctSqrt1d2 * (p[1 + row] - p[7 + row]) + 128 >> 8;
            v7 = dctSqrt1d2 * (p[1 + row] + p[7 + row]) + 128 >> 8;
            v5 = p[3 + row] << 4;
            v6 = p[5 + row] << 4;
            t = v0 - v1 + 1 >> 1;
            v0 = v0 + v1 + 1 >> 1;
            v1 = t;
            t = v2 * dctSin6 + v3 * dctCos6 + 128 >> 8;
            v2 = v2 * dctCos6 - v3 * dctSin6 + 128 >> 8;
            v3 = t;
            t = v4 - v6 + 1 >> 1;
            v4 = v4 + v6 + 1 >> 1;
            v6 = t;
            t = v7 + v5 + 1 >> 1;
            v5 = v7 - v5 + 1 >> 1;
            v7 = t;
            t = v0 - v3 + 1 >> 1;
            v0 = v0 + v3 + 1 >> 1;
            v3 = t;
            t = v1 - v2 + 1 >> 1;
            v1 = v1 + v2 + 1 >> 1;
            v2 = t;
            t = v4 * dctSin3 + v7 * dctCos3 + 2048 >> 12;
            v4 = v4 * dctCos3 - v7 * dctSin3 + 2048 >> 12;
            v7 = t;
            t = v5 * dctSin1 + v6 * dctCos1 + 2048 >> 12;
            v5 = v5 * dctCos1 - v6 * dctSin1 + 2048 >> 12;
            v6 = t;
            p[0 + row] = v0 + v7;
            p[7 + row] = v0 - v7;
            p[1 + row] = v1 + v6;
            p[6 + row] = v1 - v6;
            p[2 + row] = v2 + v5;
            p[5 + row] = v2 - v5;
            p[3 + row] = v3 + v4;
            p[4 + row] = v3 - v4;
          }
          for (i2 = 0; i2 < 8; ++i2) {
            var col = i2;
            if (p[1 * 8 + col] == 0 && p[2 * 8 + col] == 0 && p[3 * 8 + col] == 0 && p[4 * 8 + col] == 0 && p[5 * 8 + col] == 0 && p[6 * 8 + col] == 0 && p[7 * 8 + col] == 0) {
              t = dctSqrt2 * dataIn[i2 + 0] + 8192 >> 14;
              p[0 * 8 + col] = t;
              p[1 * 8 + col] = t;
              p[2 * 8 + col] = t;
              p[3 * 8 + col] = t;
              p[4 * 8 + col] = t;
              p[5 * 8 + col] = t;
              p[6 * 8 + col] = t;
              p[7 * 8 + col] = t;
              continue;
            }
            v0 = dctSqrt2 * p[0 * 8 + col] + 2048 >> 12;
            v1 = dctSqrt2 * p[4 * 8 + col] + 2048 >> 12;
            v2 = p[2 * 8 + col];
            v3 = p[6 * 8 + col];
            v4 = dctSqrt1d2 * (p[1 * 8 + col] - p[7 * 8 + col]) + 2048 >> 12;
            v7 = dctSqrt1d2 * (p[1 * 8 + col] + p[7 * 8 + col]) + 2048 >> 12;
            v5 = p[3 * 8 + col];
            v6 = p[5 * 8 + col];
            t = v0 - v1 + 1 >> 1;
            v0 = v0 + v1 + 1 >> 1;
            v1 = t;
            t = v2 * dctSin6 + v3 * dctCos6 + 2048 >> 12;
            v2 = v2 * dctCos6 - v3 * dctSin6 + 2048 >> 12;
            v3 = t;
            t = v4 - v6 + 1 >> 1;
            v4 = v4 + v6 + 1 >> 1;
            v6 = t;
            t = v7 + v5 + 1 >> 1;
            v5 = v7 - v5 + 1 >> 1;
            v7 = t;
            t = v0 - v3 + 1 >> 1;
            v0 = v0 + v3 + 1 >> 1;
            v3 = t;
            t = v1 - v2 + 1 >> 1;
            v1 = v1 + v2 + 1 >> 1;
            v2 = t;
            t = v4 * dctSin3 + v7 * dctCos3 + 2048 >> 12;
            v4 = v4 * dctCos3 - v7 * dctSin3 + 2048 >> 12;
            v7 = t;
            t = v5 * dctSin1 + v6 * dctCos1 + 2048 >> 12;
            v5 = v5 * dctCos1 - v6 * dctSin1 + 2048 >> 12;
            v6 = t;
            p[0 * 8 + col] = v0 + v7;
            p[7 * 8 + col] = v0 - v7;
            p[1 * 8 + col] = v1 + v6;
            p[6 * 8 + col] = v1 - v6;
            p[2 * 8 + col] = v2 + v5;
            p[5 * 8 + col] = v2 - v5;
            p[3 * 8 + col] = v3 + v4;
            p[4 * 8 + col] = v3 - v4;
          }
          for (i2 = 0; i2 < 64; ++i2) {
            var sample2 = 128 + (p[i2] + 8 >> 4);
            dataOut[i2] = sample2 < 0 ? 0 : sample2 > 255 ? 255 : sample2;
          }
        }
        requestMemoryAllocation(samplesPerLine * blocksPerColumn * 8);
        var i, j;
        for (var blockRow = 0; blockRow < blocksPerColumn; blockRow++) {
          var scanLine = blockRow << 3;
          for (i = 0; i < 8; i++)
            lines.push(new Uint8Array(samplesPerLine));
          for (var blockCol = 0; blockCol < blocksPerLine; blockCol++) {
            quantizeAndInverse(component.blocks[blockRow][blockCol], r, R);
            var offset = 0, sample = blockCol << 3;
            for (j = 0; j < 8; j++) {
              var line = lines[scanLine + j];
              for (i = 0; i < 8; i++)
                line[sample + i] = r[offset++];
            }
          }
        }
        return lines;
      }
      function clampTo8bit(a) {
        return a < 0 ? 0 : a > 255 ? 255 : a;
      }
      constructor.prototype = {
        load: function load(path) {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", path, true);
          xhr.responseType = "arraybuffer";
          xhr.onload = (function() {
            var data2 = new Uint8Array(xhr.response || xhr.mozResponseArrayBuffer);
            this.parse(data2);
            if (this.onload)
              this.onload();
          }).bind(this);
          xhr.send(null);
        },
        parse: function parse(data2) {
          var maxResolutionInPixels = this.opts.maxResolutionInMP * 1e3 * 1e3;
          var offset = 0, length = data2.length;
          function readUint16() {
            var value = data2[offset] << 8 | data2[offset + 1];
            offset += 2;
            return value;
          }
          function readDataBlock() {
            var length2 = readUint16();
            var array = data2.subarray(offset, offset + length2 - 2);
            offset += array.length;
            return array;
          }
          function prepareComponents(frame2) {
            var maxH2 = 1, maxV2 = 1;
            var component2, componentId2;
            for (componentId2 in frame2.components) {
              if (frame2.components.hasOwnProperty(componentId2)) {
                component2 = frame2.components[componentId2];
                if (maxH2 < component2.h) maxH2 = component2.h;
                if (maxV2 < component2.v) maxV2 = component2.v;
              }
            }
            var mcusPerLine = Math.ceil(frame2.samplesPerLine / 8 / maxH2);
            var mcusPerColumn = Math.ceil(frame2.scanLines / 8 / maxV2);
            for (componentId2 in frame2.components) {
              if (frame2.components.hasOwnProperty(componentId2)) {
                component2 = frame2.components[componentId2];
                var blocksPerLine = Math.ceil(Math.ceil(frame2.samplesPerLine / 8) * component2.h / maxH2);
                var blocksPerColumn = Math.ceil(Math.ceil(frame2.scanLines / 8) * component2.v / maxV2);
                var blocksPerLineForMcu = mcusPerLine * component2.h;
                var blocksPerColumnForMcu = mcusPerColumn * component2.v;
                var blocksToAllocate = blocksPerColumnForMcu * blocksPerLineForMcu;
                var blocks = [];
                requestMemoryAllocation(blocksToAllocate * 256);
                for (var i2 = 0; i2 < blocksPerColumnForMcu; i2++) {
                  var row = [];
                  for (var j2 = 0; j2 < blocksPerLineForMcu; j2++)
                    row.push(new Int32Array(64));
                  blocks.push(row);
                }
                component2.blocksPerLine = blocksPerLine;
                component2.blocksPerColumn = blocksPerColumn;
                component2.blocks = blocks;
              }
            }
            frame2.maxH = maxH2;
            frame2.maxV = maxV2;
            frame2.mcusPerLine = mcusPerLine;
            frame2.mcusPerColumn = mcusPerColumn;
          }
          var jfif = null;
          var adobe = null;
          var pixels = null;
          var frame, resetInterval;
          var quantizationTables = [], frames = [];
          var huffmanTablesAC = [], huffmanTablesDC = [];
          var fileMarker = readUint16();
          var malformedDataOffset = -1;
          this.comments = [];
          if (fileMarker != 65496) {
            throw new Error("SOI not found");
          }
          fileMarker = readUint16();
          while (fileMarker != 65497) {
            var i, j, l;
            switch (fileMarker) {
              case 65280:
                break;
              case 65504:
              // APP0 (Application Specific)
              case 65505:
              // APP1
              case 65506:
              // APP2
              case 65507:
              // APP3
              case 65508:
              // APP4
              case 65509:
              // APP5
              case 65510:
              // APP6
              case 65511:
              // APP7
              case 65512:
              // APP8
              case 65513:
              // APP9
              case 65514:
              // APP10
              case 65515:
              // APP11
              case 65516:
              // APP12
              case 65517:
              // APP13
              case 65518:
              // APP14
              case 65519:
              // APP15
              case 65534:
                var appData = readDataBlock();
                if (fileMarker === 65534) {
                  var comment = String.fromCharCode.apply(null, appData);
                  this.comments.push(comment);
                }
                if (fileMarker === 65504) {
                  if (appData[0] === 74 && appData[1] === 70 && appData[2] === 73 && appData[3] === 70 && appData[4] === 0) {
                    jfif = {
                      version: { major: appData[5], minor: appData[6] },
                      densityUnits: appData[7],
                      xDensity: appData[8] << 8 | appData[9],
                      yDensity: appData[10] << 8 | appData[11],
                      thumbWidth: appData[12],
                      thumbHeight: appData[13],
                      thumbData: appData.subarray(14, 14 + 3 * appData[12] * appData[13])
                    };
                  }
                }
                if (fileMarker === 65505) {
                  if (appData[0] === 69 && appData[1] === 120 && appData[2] === 105 && appData[3] === 102 && appData[4] === 0) {
                    this.exifBuffer = appData.subarray(5, appData.length);
                  }
                }
                if (fileMarker === 65518) {
                  if (appData[0] === 65 && appData[1] === 100 && appData[2] === 111 && appData[3] === 98 && appData[4] === 101 && appData[5] === 0) {
                    adobe = {
                      version: appData[6],
                      flags0: appData[7] << 8 | appData[8],
                      flags1: appData[9] << 8 | appData[10],
                      transformCode: appData[11]
                    };
                  }
                }
                break;
              case 65499:
                var quantizationTablesLength = readUint16();
                var quantizationTablesEnd = quantizationTablesLength + offset - 2;
                while (offset < quantizationTablesEnd) {
                  var quantizationTableSpec = data2[offset++];
                  requestMemoryAllocation(64 * 4);
                  var tableData = new Int32Array(64);
                  if (quantizationTableSpec >> 4 === 0) {
                    for (j = 0; j < 64; j++) {
                      var z = dctZigZag[j];
                      tableData[z] = data2[offset++];
                    }
                  } else if (quantizationTableSpec >> 4 === 1) {
                    for (j = 0; j < 64; j++) {
                      var z = dctZigZag[j];
                      tableData[z] = readUint16();
                    }
                  } else
                    throw new Error("DQT: invalid table spec");
                  quantizationTables[quantizationTableSpec & 15] = tableData;
                }
                break;
              case 65472:
              // SOF0 (Start of Frame, Baseline DCT)
              case 65473:
              // SOF1 (Start of Frame, Extended DCT)
              case 65474:
                readUint16();
                frame = {};
                frame.extended = fileMarker === 65473;
                frame.progressive = fileMarker === 65474;
                frame.precision = data2[offset++];
                frame.scanLines = readUint16();
                frame.samplesPerLine = readUint16();
                frame.components = {};
                frame.componentsOrder = [];
                var pixelsInFrame = frame.scanLines * frame.samplesPerLine;
                if (pixelsInFrame > maxResolutionInPixels) {
                  var exceededAmount = Math.ceil((pixelsInFrame - maxResolutionInPixels) / 1e6);
                  throw new Error(`maxResolutionInMP limit exceeded by ${exceededAmount}MP`);
                }
                var componentsCount = data2[offset++], componentId;
                var maxH = 0, maxV = 0;
                for (i = 0; i < componentsCount; i++) {
                  componentId = data2[offset];
                  var h = data2[offset + 1] >> 4;
                  var v = data2[offset + 1] & 15;
                  var qId = data2[offset + 2];
                  if (h <= 0 || v <= 0) {
                    throw new Error("Invalid sampling factor, expected values above 0");
                  }
                  frame.componentsOrder.push(componentId);
                  frame.components[componentId] = {
                    h,
                    v,
                    quantizationIdx: qId
                  };
                  offset += 3;
                }
                prepareComponents(frame);
                frames.push(frame);
                break;
              case 65476:
                var huffmanLength = readUint16();
                for (i = 2; i < huffmanLength; ) {
                  var huffmanTableSpec = data2[offset++];
                  var codeLengths = new Uint8Array(16);
                  var codeLengthSum = 0;
                  for (j = 0; j < 16; j++, offset++) {
                    codeLengthSum += codeLengths[j] = data2[offset];
                  }
                  requestMemoryAllocation(16 + codeLengthSum);
                  var huffmanValues = new Uint8Array(codeLengthSum);
                  for (j = 0; j < codeLengthSum; j++, offset++)
                    huffmanValues[j] = data2[offset];
                  i += 17 + codeLengthSum;
                  (huffmanTableSpec >> 4 === 0 ? huffmanTablesDC : huffmanTablesAC)[huffmanTableSpec & 15] = buildHuffmanTable(codeLengths, huffmanValues);
                }
                break;
              case 65501:
                readUint16();
                resetInterval = readUint16();
                break;
              case 65500:
                readUint16();
                readUint16();
                break;
              case 65498:
                var scanLength = readUint16();
                var selectorsCount = data2[offset++];
                var components = [], component;
                for (i = 0; i < selectorsCount; i++) {
                  component = frame.components[data2[offset++]];
                  var tableSpec = data2[offset++];
                  component.huffmanTableDC = huffmanTablesDC[tableSpec >> 4];
                  component.huffmanTableAC = huffmanTablesAC[tableSpec & 15];
                  components.push(component);
                }
                var spectralStart = data2[offset++];
                var spectralEnd = data2[offset++];
                var successiveApproximation = data2[offset++];
                var processed = decodeScan(
                  data2,
                  offset,
                  frame,
                  components,
                  resetInterval,
                  spectralStart,
                  spectralEnd,
                  successiveApproximation >> 4,
                  successiveApproximation & 15,
                  this.opts
                );
                offset += processed;
                break;
              case 65535:
                if (data2[offset] !== 255) {
                  offset--;
                }
                break;
              default:
                if (data2[offset - 3] == 255 && data2[offset - 2] >= 192 && data2[offset - 2] <= 254) {
                  offset -= 3;
                  break;
                } else if (fileMarker === 224 || fileMarker == 225) {
                  if (malformedDataOffset !== -1) {
                    throw new Error(`first unknown JPEG marker at offset ${malformedDataOffset.toString(16)}, second unknown JPEG marker ${fileMarker.toString(16)} at offset ${(offset - 1).toString(16)}`);
                  }
                  malformedDataOffset = offset - 1;
                  const nextOffset = readUint16();
                  if (data2[offset + nextOffset - 2] === 255) {
                    offset += nextOffset - 2;
                    break;
                  }
                }
                throw new Error("unknown JPEG marker " + fileMarker.toString(16));
            }
            fileMarker = readUint16();
          }
          if (frames.length != 1)
            throw new Error("only single frame JPEGs supported");
          for (var i = 0; i < frames.length; i++) {
            var cp = frames[i].components;
            for (var j in cp) {
              cp[j].quantizationTable = quantizationTables[cp[j].quantizationIdx];
              delete cp[j].quantizationIdx;
            }
          }
          this.width = frame.samplesPerLine;
          this.height = frame.scanLines;
          this.jfif = jfif;
          this.adobe = adobe;
          this.components = [];
          for (var i = 0; i < frame.componentsOrder.length; i++) {
            var component = frame.components[frame.componentsOrder[i]];
            this.components.push({
              lines: buildComponentData(frame, component),
              scaleX: component.h / frame.maxH,
              scaleY: component.v / frame.maxV
            });
          }
        },
        getData: function getData(width, height) {
          var scaleX = this.width / width, scaleY = this.height / height;
          var component1, component2, component3, component4;
          var component1Line, component2Line, component3Line, component4Line;
          var x, y;
          var offset = 0;
          var Y, Cb, Cr, K, C, M, Ye, R, G, B;
          var colorTransform;
          var dataLength = width * height * this.components.length;
          requestMemoryAllocation(dataLength);
          var data2 = new Uint8Array(dataLength);
          switch (this.components.length) {
            case 1:
              component1 = this.components[0];
              for (y = 0; y < height; y++) {
                component1Line = component1.lines[0 | y * component1.scaleY * scaleY];
                for (x = 0; x < width; x++) {
                  Y = component1Line[0 | x * component1.scaleX * scaleX];
                  data2[offset++] = Y;
                }
              }
              break;
            case 2:
              component1 = this.components[0];
              component2 = this.components[1];
              for (y = 0; y < height; y++) {
                component1Line = component1.lines[0 | y * component1.scaleY * scaleY];
                component2Line = component2.lines[0 | y * component2.scaleY * scaleY];
                for (x = 0; x < width; x++) {
                  Y = component1Line[0 | x * component1.scaleX * scaleX];
                  data2[offset++] = Y;
                  Y = component2Line[0 | x * component2.scaleX * scaleX];
                  data2[offset++] = Y;
                }
              }
              break;
            case 3:
              colorTransform = true;
              if (this.adobe && this.adobe.transformCode)
                colorTransform = true;
              else if (typeof this.opts.colorTransform !== "undefined")
                colorTransform = !!this.opts.colorTransform;
              component1 = this.components[0];
              component2 = this.components[1];
              component3 = this.components[2];
              for (y = 0; y < height; y++) {
                component1Line = component1.lines[0 | y * component1.scaleY * scaleY];
                component2Line = component2.lines[0 | y * component2.scaleY * scaleY];
                component3Line = component3.lines[0 | y * component3.scaleY * scaleY];
                for (x = 0; x < width; x++) {
                  if (!colorTransform) {
                    R = component1Line[0 | x * component1.scaleX * scaleX];
                    G = component2Line[0 | x * component2.scaleX * scaleX];
                    B = component3Line[0 | x * component3.scaleX * scaleX];
                  } else {
                    Y = component1Line[0 | x * component1.scaleX * scaleX];
                    Cb = component2Line[0 | x * component2.scaleX * scaleX];
                    Cr = component3Line[0 | x * component3.scaleX * scaleX];
                    R = clampTo8bit(Y + 1.402 * (Cr - 128));
                    G = clampTo8bit(Y - 0.3441363 * (Cb - 128) - 0.71413636 * (Cr - 128));
                    B = clampTo8bit(Y + 1.772 * (Cb - 128));
                  }
                  data2[offset++] = R;
                  data2[offset++] = G;
                  data2[offset++] = B;
                }
              }
              break;
            case 4:
              if (!this.adobe)
                throw new Error("Unsupported color mode (4 components)");
              colorTransform = false;
              if (this.adobe && this.adobe.transformCode)
                colorTransform = true;
              else if (typeof this.opts.colorTransform !== "undefined")
                colorTransform = !!this.opts.colorTransform;
              component1 = this.components[0];
              component2 = this.components[1];
              component3 = this.components[2];
              component4 = this.components[3];
              for (y = 0; y < height; y++) {
                component1Line = component1.lines[0 | y * component1.scaleY * scaleY];
                component2Line = component2.lines[0 | y * component2.scaleY * scaleY];
                component3Line = component3.lines[0 | y * component3.scaleY * scaleY];
                component4Line = component4.lines[0 | y * component4.scaleY * scaleY];
                for (x = 0; x < width; x++) {
                  if (!colorTransform) {
                    C = component1Line[0 | x * component1.scaleX * scaleX];
                    M = component2Line[0 | x * component2.scaleX * scaleX];
                    Ye = component3Line[0 | x * component3.scaleX * scaleX];
                    K = component4Line[0 | x * component4.scaleX * scaleX];
                  } else {
                    Y = component1Line[0 | x * component1.scaleX * scaleX];
                    Cb = component2Line[0 | x * component2.scaleX * scaleX];
                    Cr = component3Line[0 | x * component3.scaleX * scaleX];
                    K = component4Line[0 | x * component4.scaleX * scaleX];
                    C = 255 - clampTo8bit(Y + 1.402 * (Cr - 128));
                    M = 255 - clampTo8bit(Y - 0.3441363 * (Cb - 128) - 0.71413636 * (Cr - 128));
                    Ye = 255 - clampTo8bit(Y + 1.772 * (Cb - 128));
                  }
                  data2[offset++] = 255 - C;
                  data2[offset++] = 255 - M;
                  data2[offset++] = 255 - Ye;
                  data2[offset++] = 255 - K;
                }
              }
              break;
            default:
              throw new Error("Unsupported color mode");
          }
          return data2;
        },
        copyToImageData: function copyToImageData(imageData, formatAsRGBA) {
          var width = imageData.width, height = imageData.height;
          var imageDataArray = imageData.data;
          var data2 = this.getData(width, height);
          var i = 0, j = 0, x, y;
          var Y, K, C, M, R, G, B;
          switch (this.components.length) {
            case 1:
              for (y = 0; y < height; y++) {
                for (x = 0; x < width; x++) {
                  Y = data2[i++];
                  imageDataArray[j++] = Y;
                  imageDataArray[j++] = Y;
                  imageDataArray[j++] = Y;
                  if (formatAsRGBA) {
                    imageDataArray[j++] = 255;
                  }
                }
              }
              break;
            case 3:
              for (y = 0; y < height; y++) {
                for (x = 0; x < width; x++) {
                  R = data2[i++];
                  G = data2[i++];
                  B = data2[i++];
                  imageDataArray[j++] = R;
                  imageDataArray[j++] = G;
                  imageDataArray[j++] = B;
                  if (formatAsRGBA) {
                    imageDataArray[j++] = 255;
                  }
                }
              }
              break;
            case 4:
              for (y = 0; y < height; y++) {
                for (x = 0; x < width; x++) {
                  C = data2[i++];
                  M = data2[i++];
                  Y = data2[i++];
                  K = data2[i++];
                  R = 255 - clampTo8bit(C * (1 - K / 255) + K);
                  G = 255 - clampTo8bit(M * (1 - K / 255) + K);
                  B = 255 - clampTo8bit(Y * (1 - K / 255) + K);
                  imageDataArray[j++] = R;
                  imageDataArray[j++] = G;
                  imageDataArray[j++] = B;
                  if (formatAsRGBA) {
                    imageDataArray[j++] = 255;
                  }
                }
              }
              break;
            default:
              throw new Error("Unsupported color mode");
          }
        }
      };
      var totalBytesAllocated = 0;
      var maxMemoryUsageBytes = 0;
      function requestMemoryAllocation(increaseAmount = 0) {
        var totalMemoryImpactBytes = totalBytesAllocated + increaseAmount;
        if (totalMemoryImpactBytes > maxMemoryUsageBytes) {
          var exceededAmount = Math.ceil((totalMemoryImpactBytes - maxMemoryUsageBytes) / 1024 / 1024);
          throw new Error(`maxMemoryUsageInMB limit exceeded by at least ${exceededAmount}MB`);
        }
        totalBytesAllocated = totalMemoryImpactBytes;
      }
      constructor.resetMaxMemoryUsage = function(maxMemoryUsageBytes_) {
        totalBytesAllocated = 0;
        maxMemoryUsageBytes = maxMemoryUsageBytes_;
      };
      constructor.getBytesAllocated = function() {
        return totalBytesAllocated;
      };
      constructor.requestMemoryAllocation = requestMemoryAllocation;
      return constructor;
    })();
    if (typeof module !== "undefined") {
      module.exports = decode;
    } else if (typeof window !== "undefined") {
      window["jpeg-js"] = window["jpeg-js"] || {};
      window["jpeg-js"].decode = decode;
    }
    function decode(jpegData, userOpts = {}) {
      var defaultOpts = {
        // "undefined" means "Choose whether to transform colors based on the image’s color model."
        colorTransform: void 0,
        useTArray: false,
        formatAsRGBA: true,
        tolerantDecoding: true,
        maxResolutionInMP: 100,
        // Don't decode more than 100 megapixels
        maxMemoryUsageInMB: 512
        // Don't decode if memory footprint is more than 512MB
      };
      var opts = { ...defaultOpts, ...userOpts };
      var arr = new Uint8Array(jpegData);
      var decoder = new JpegImage();
      decoder.opts = opts;
      JpegImage.resetMaxMemoryUsage(opts.maxMemoryUsageInMB * 1024 * 1024);
      decoder.parse(arr);
      var channels = opts.formatAsRGBA ? 4 : 3;
      var bytesNeeded = decoder.width * decoder.height * channels;
      try {
        JpegImage.requestMemoryAllocation(bytesNeeded);
        var image = {
          width: decoder.width,
          height: decoder.height,
          exifBuffer: decoder.exifBuffer,
          data: opts.useTArray ? new Uint8Array(bytesNeeded) : Buffer.alloc(bytesNeeded)
        };
        if (decoder.comments.length > 0) {
          image["comments"] = decoder.comments;
        }
      } catch (err) {
        if (err instanceof RangeError) {
          throw new Error("Could not allocate enough memory for the image. Required: " + bytesNeeded);
        }
        if (err instanceof ReferenceError) {
          if (err.message === "Buffer is not defined") {
            throw new Error("Buffer is not globally defined in this environment. Consider setting useTArray to true");
          }
        }
        throw err;
      }
      decoder.copyToImageData(image, opts.formatAsRGBA);
      return image;
    }
  }
});

// node_modules/jpeg-js/index.js
var require_jpeg_js = __commonJS({
  "node_modules/jpeg-js/index.js"(exports, module) {
    var encode = require_encoder();
    var decode = require_decoder();
    module.exports = {
      encode,
      decode
    };
  }
});

// server/index.js
import http from "node:http";
import { readFile, stat, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { spawn } from "node:child_process";
import { isIP } from "node:net";
import { randomBytes as randomBytes4, createHash as createHash3, timingSafeEqual } from "node:crypto";
import Database from "better-sqlite3";

// config/house.json
var house_default = {
  version: 1,
  name: "\u0414\u043E\u043C",
  location: "\u041D\u043E\u0432\u043E\u0436\u0438\u0432\u043E\u0442\u0438\u043D\u043D\u043E\u0435",
  rooms: [
    { id: "living", name: "\u0413\u043E\u0441\u0442\u0438\u043D\u0430\u044F / \u043A\u0443\u0445\u043D\u044F", short: "\u0413\u043E\u0441\u0442\u0438\u043D\u0430\u044F", icon: "sofa", description: "\u0414\u0432\u0435 \u0437\u043E\u043D\u044B \u043E\u0434\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u0430", channels: [{ name: "\u0417\u043E\u043D\u0430 \u0433\u043E\u0441\u0442\u0438\u043D\u043E\u0439", note: "\u0411\u043B\u0438\u0436\u0435 \u043A \u0442\u0435\u0440\u0440\u0430\u0441\u0435", demoOn: true }, { name: "\u0417\u043E\u043D\u0430 \u043A\u0443\u0445\u043D\u0438", note: "\u041A\u0443\u0445\u043E\u043D\u043D\u044B\u0439 \u0441\u0432\u0435\u0442", demoOn: true }], climate: true },
    { id: "hall", name: "\u041F\u0440\u0438\u0445\u043E\u0436\u0430\u044F", short: "\u041F\u0440\u0438\u0445\u043E\u0436\u0430\u044F", icon: "door-open", description: "\u041F\u0440\u0430\u0432\u044B\u0439 \u043A\u0430\u043D\u0430\u043B \u0432\u044B\u043A\u043B\u044E\u0447\u0430\u0442\u0435\u043B\u044F \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u0442 \u0441\u0432\u0435\u0442\u043E\u043C \u0442\u0435\u0440\u0440\u0430\u0441\u044B", channels: [{ name: "\u041F\u0440\u0438\u0445\u043E\u0436\u0430\u044F", note: "\u041B\u0435\u0432\u0430\u044F \u043A\u043B\u0430\u0432\u0438\u0448\u0430", demoOn: false }, { name: "\u0422\u0435\u0440\u0440\u0430\u0441\u0430", note: "\u041F\u0440\u0430\u0432\u0430\u044F \u043A\u043B\u0430\u0432\u0438\u0448\u0430 \xB7 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0430\u044F \u0437\u043E\u043D\u0430", demoOn: false }], rgb: true },
    { id: "office", name: "\u041A\u0430\u0431\u0438\u043D\u0435\u0442", short: "\u041A\u0430\u0431\u0438\u043D\u0435\u0442", icon: "armchair", description: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u0434\u0432\u0443\u0445 \u043B\u0438\u043D\u0438\u0439 \u0443\u0442\u043E\u0447\u043D\u0438\u043C \u043F\u0440\u0438 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0438", channels: [{ name: "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430 1", demoOn: true }, { name: "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430 2", demoOn: false }] },
    { id: "bedroom", name: "\u0421\u043F\u0430\u043B\u044C\u043D\u044F", short: "\u0421\u043F\u0430\u043B\u044C\u043D\u044F", icon: "bed-double", channels: [{ name: "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430 1", demoOn: false }, { name: "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430 2", demoOn: false }] },
    { id: "children", name: "\u0414\u0435\u0442\u0441\u043A\u0430\u044F", short: "\u0414\u0435\u0442\u0441\u043A\u0430\u044F", icon: "blocks", channels: [{ name: "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430 1", demoOn: false }, { name: "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430 2", demoOn: false }] },
    { id: "bath", name: "\u0412\u0430\u043D\u043D\u0430\u044F", short: "\u0412\u0430\u043D\u043D\u0430\u044F", icon: "bath", channels: [{ name: "\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0441\u0432\u0435\u0442", note: "\u041B\u0435\u0432\u0430\u044F \u043A\u043B\u0430\u0432\u0438\u0448\u0430 \xB7 \u0441\u043F\u043E\u0442\u044B", demoOn: false }, { name: "\u041F\u043E\u0442\u043E\u043B\u043E\u0447\u043D\u0430\u044F \u043B\u0435\u043D\u0442\u0430", note: "\u041F\u0440\u0430\u0432\u0430\u044F \u043A\u043B\u0430\u0432\u0438\u0448\u0430 \xB7 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430", demoOn: false }] },
    { id: "utility", name: "\u0422\u0443\u0430\u043B\u0435\u0442 / \u043A\u043E\u0442\u0435\u043B\u044C\u043D\u0430\u044F", short: "\u041A\u043E\u0442\u0435\u043B\u044C\u043D\u0430\u044F", icon: "heater", description: "\u041E\u0434\u043D\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435, \u0434\u0432\u0435 \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0437\u043E\u043D\u044B", channels: [{ name: "\u0421\u0432\u0435\u0442 \u0442\u0443\u0430\u043B\u0435\u0442\u0430", demoOn: false }], pump: true },
    { id: "pantry", name: "\u041A\u043B\u0430\u0434\u043E\u0432\u0430\u044F", short: "\u041A\u043B\u0430\u0434\u043E\u0432\u0430\u044F", icon: "archive", channels: [{ name: "\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0441\u0432\u0435\u0442", demoOn: false }] },
    { id: "corridor", name: "\u041A\u043E\u0440\u0438\u0434\u043E\u0440", short: "\u041A\u043E\u0440\u0438\u0434\u043E\u0440", icon: "move-up-right", description: "\u041E\u0434\u043D\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u0430\u044F \u043B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430", channels: [] },
    { id: "terrace", name: "\u0422\u0435\u0440\u0440\u0430\u0441\u0430", short: "\u0422\u0435\u0440\u0440\u0430\u0441\u0430", icon: "trees", description: "\u0421\u0432\u0435\u0442 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D \u043A \u043F\u0440\u0430\u0432\u043E\u0439 \u043A\u043B\u0430\u0432\u0438\u0448\u0435 \u0432 \u043F\u0440\u0438\u0445\u043E\u0436\u0435\u0439", channels: [], terrace: true }
  ]
};

// src/compat.js
if (!Array.prototype.flat) {
  Object.defineProperty(Array.prototype, "flat", { configurable: true, writable: true, value: function(depth = 1) {
    const out = [];
    const walk = (list, n) => {
      list.forEach((value) => {
        if (Array.isArray(value) && n > 0) walk(value, n - 1);
        else out.push(value);
      });
    };
    walk(this, depth);
    return out;
  } });
}
if (!Array.prototype.flatMap) {
  Object.defineProperty(Array.prototype, "flatMap", { configurable: true, writable: true, value: function(fn, thisArg) {
    return this.map(fn, thisArg).flat();
  } });
}
if (!Object.fromEntries) {
  Object.fromEntries = (entries) => {
    const out = {};
    for (const [key, value] of entries) Object.defineProperty(out, key, { value, writable: true, enumerable: true, configurable: true });
    return out;
  };
}

// src/device-types.js
var types = {
  light: { label: "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430", icon: "lightbulb", module: "lights", domains: ["light", "switch"], controllable: true, capabilities: ["power"] },
  rgb: { label: "RGB-\u043B\u0430\u043C\u043F\u0430", icon: "lightbulb", module: "lights", domains: ["light"], controllable: true, capabilities: ["power", "brightness", "color"] },
  temperature: { label: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430", icon: "thermometer", module: "sensors", domains: ["sensor"], unit: "\xB0C" },
  humidity: { label: "\u0412\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u044C", icon: "droplets", module: "sensors", domains: ["sensor"], unit: "%" },
  illuminance: { label: "\u041E\u0441\u0432\u0435\u0449\u0451\u043D\u043D\u043E\u0441\u0442\u044C", icon: "sun", module: "sensors", domains: ["sensor"], unit: "lx" },
  door: { label: "\u041E\u0442\u043A\u0440\u044B\u0442\u0438\u0435", icon: "door-open", module: "sensors", domains: ["binary_sensor", "sensor"], classes: ["door", "opening", "window", "garage_door", "enum"] },
  smoke: { label: "\u0414\u044B\u043C", icon: "radio", module: "sensors", domains: ["binary_sensor"], classes: ["smoke"] },
  motion: { label: "\u0414\u0432\u0438\u0436\u0435\u043D\u0438\u0435", icon: "scan-eye", module: "sensors", domains: ["binary_sensor", "sensor"], classes: ["motion", "occupancy", "enum"] },
  battery: { label: "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430", icon: "radio", module: "sensors", domains: ["sensor"], unit: "%" },
  button_event: { label: "\u041C\u0430\u0441\u0442\u0435\u0440-\u043A\u043D\u043E\u043F\u043A\u0430 \xB7 \u0441\u043E\u0431\u044B\u0442\u0438\u0435", icon: "power", module: "sensors", domains: ["sensor"], classes: ["enum"] },
  station: { label: "\u041C\u0435\u0434\u0438\u0430\u043F\u043B\u0435\u0435\u0440 / \u0441\u0442\u0430\u043D\u0446\u0438\u044F", icon: "audio-lines", module: "media", domains: ["media_player"], controllable: true, capabilities: ["play", "pause", "volume"] },
  leak: { label: "\u041F\u0440\u043E\u0442\u0435\u0447\u043A\u0430", icon: "droplets", module: "sensors", domains: ["binary_sensor", "sensor"], classes: ["moisture", "safety", "problem", "enum"] },
  camera: { label: "\u041A\u0430\u043C\u0435\u0440\u0430", icon: "camera", module: "cameras", domains: ["camera"], capabilities: ["snapshot", "live"] },
  curtain: { label: "\u0428\u0442\u043E\u0440\u044B / \u043A\u0430\u0440\u043D\u0438\u0437 \xB7 \u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u0435", icon: "door-open", module: "covers", domains: ["cover"], locked: true, capabilities: ["state", "position"] },
  vacuum: { label: "\u0420\u043E\u0431\u043E\u0442-\u043F\u044B\u043B\u0435\u0441\u043E\u0441 \xB7 \u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u0435", icon: "radio", module: "cleaning", domains: ["vacuum"], locked: true, capabilities: ["state", "battery"] },
  gate: { label: "\u041E\u0442\u043A\u0430\u0442\u043D\u044B\u0435 \u0432\u043E\u0440\u043E\u0442\u0430", icon: "door-open", module: "engineering", domains: ["cover"], locked: true },
  heating: { label: "\u041E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u0435 / \u043A\u043E\u0442\u0451\u043B", icon: "heater", module: "engineering", domains: ["climate"], locked: true },
  pump: { label: "\u041F\u0438\u0442\u0430\u043D\u0438\u0435 \u043D\u0430\u0441\u043E\u0441\u0430", icon: "heater", module: "engineering", domains: ["switch"], locked: true }
};
function freeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === "object") freeze(child);
  return Object.freeze(value);
}
var deviceTypes = freeze(types);

// src/catalog.js
var areas = [
  ...house_default.rooms.map((r) => ({ id: r.id, name: r.name })),
  { id: "attic", name: "\u0427\u0435\u0440\u0434\u0430\u043A" },
  { id: "well", name: "\u0421\u043A\u0432\u0430\u0436\u0438\u043D\u0430" },
  { id: "yard", name: "\u0414\u0432\u043E\u0440" }
];
var areaName = (id) => areas.find((a) => a.id === id)?.name || id;
var lightIDs = {
  living: ["living:0", "living:1"],
  hall: ["hall:0", "hall:1"],
  office: ["office:0", "office:1"],
  bedroom: ["bedroom:0", "bedroom:1"],
  children: ["children:0", "children:1"],
  bath: ["bath:0", "bath:1"],
  utility: ["utility:0"],
  pantry: ["pantry:0"]
};
var make = (id, type, room, name, extra2 = {}) => ({ id, type, room, name, status: "installed", masterOff: type === "light", note: "", ...extra2 });
function defaultDevices() {
  return [
    ...house_default.rooms.flatMap((r) => r.channels.map((c, i) => make(lightIDs[r.id][i], "light", r.id === "hall" && i === 1 ? "terrace" : r.id, c.name, { status: c.planned ? "planned" : "installed", note: c.note || "", demoOn: c.demoOn }))),
    ...[["living", 20.4, 53], ["attic", 40, 24], ["well", 16.5, 86]].flatMap(([id, t, h]) => [
      make(`temperature:${id}`, "temperature", id, `\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \xB7 ${areaName(id)}`, { note: "miaomiaoce.sensor_ht.t2 \xB7 BLE; \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043A HA \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E", demoValue: t, demoStale: id === "attic" }),
      make(`humidity:${id}`, "humidity", id, `\u0412\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u044C \xB7 ${areaName(id)}`, { note: "miaomiaoce.sensor_ht.t2 \xB7 BLE; \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043A HA \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E", demoValue: h, demoStale: id === "attic" })
    ]),
    make("door", "door", "hall", "\u0412\u0445\u043E\u0434\u043D\u0430\u044F \u0434\u0432\u0435\u0440\u044C", { note: "isa.magnet.dw2hl \xB7 BLE; \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043A HA \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E", demoValue: "off" }),
    make("terrace-door", "door", "living", "\u0414\u0432\u0435\u0440\u044C \u043D\u0430 \u0442\u0435\u0440\u0440\u0430\u0441\u0443", { note: "\u042F\u043D\u0434\u0435\u043A\u0441 \xB7 Zigbee \u0447\u0435\u0440\u0435\u0437 \u0441\u0442\u0430\u043D\u0446\u0438\u044E; \u0434\u0432\u0435\u0440\u044C \u0433\u043E\u0441\u0442\u0438\u043D\u0430\u044F\u2013\u0442\u0435\u0440\u0440\u0430\u0441\u0430", demoValue: "off" }),
    make("leak:utility", "leak", "utility", "\u041F\u0440\u043E\u0442\u0435\u0447\u043A\u0430 \u0432 \u043A\u043E\u0442\u0435\u043B\u044C\u043D\u043E\u0439", { note: "\u042F\u043D\u0434\u0435\u043A\u0441 \xB7 Zigbee \u0447\u0435\u0440\u0435\u0437 \u0441\u0442\u0430\u043D\u0446\u0438\u044E; \u043F\u0440\u0438\u0432\u044F\u0436\u0438 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C HA", demoValue: "off" }),
    make("leak:bath", "leak", "bath", "\u041F\u0440\u043E\u0442\u0435\u0447\u043A\u0430 \u0432 \u0432\u0430\u043D\u043D\u043E\u0439", { note: "\u042F\u043D\u0434\u0435\u043A\u0441 \xB7 Zigbee \u0447\u0435\u0440\u0435\u0437 \u0441\u0442\u0430\u043D\u0446\u0438\u044E; \u043F\u0440\u0438\u0432\u044F\u0436\u0438 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C HA", demoValue: "off" }),
    make("smoke", "smoke", "living", "\u0414\u0430\u0442\u0447\u0438\u043A \u0434\u044B\u043C\u0430 \u043D\u0430\u0434 \u043A\u0443\u0445\u043D\u0435\u0439", { note: "DIGMA SmartLife \xB7 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043E\u0442\u043B\u043E\u0436\u0435\u043D\u043E", demoValue: "off" }),
    make("terrace-motion", "motion", "terrace", "\u0414\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u043D\u0430 \u0442\u0435\u0440\u0440\u0430\u0441\u0435", { note: "lumi.motion.agl02 \xB7 Zigbee; \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u043F\u043E\u043A\u0430 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0432 \u0410\u043B\u0438\u0441\u0435" }),
    make("terrace-lux", "illuminance", "terrace", "\u041E\u0441\u0432\u0435\u0449\u0451\u043D\u043D\u043E\u0441\u0442\u044C \u0442\u0435\u0440\u0440\u0430\u0441\u044B", { note: "lumi.motion.agl02 \xB7 Zigbee; \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043A HA \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E" }),
    make("camera-yard", "camera", "yard", "\u0414\u0432\u043E\u0440 \xB7 Tapo C320WS", { note: "\u0423\u0447\u0451\u0442\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u043A\u0430\u043C\u0435\u0440\u044B \u0441\u043E\u0437\u0434\u0430\u043D\u0430; ONVIF \u0432 HA \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D" }),
    make("corridor-main", "light", "corridor", "\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0441\u0432\u0435\u0442", { masterOff: false, note: "\u041E\u0434\u043D\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u0430\u044F \u043B\u0438\u043D\u0438\u044F \xB7 \u0432\u044B\u0431\u0435\u0440\u0438 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C HA" }),
    make("camera-extra-1", "camera", "yard", "\u041A\u0430\u043C\u0435\u0440\u0430 2 \xB7 \u043F\u043B\u0430\u043D\u0438\u0440\u0443\u0435\u0442\u0441\u044F", { status: "planned", note: "\u041C\u0435\u0441\u0442\u043E \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0435\u0449\u0451 \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043E" }),
    make("camera-extra-2", "camera", "yard", "\u041A\u0430\u043C\u0435\u0440\u0430 3 \xB7 \u0440\u0435\u0437\u0435\u0440\u0432", { status: "planned", note: "\u041D\u0435 \u043A\u0443\u043F\u043B\u0435\u043D\u0430; \u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435" }),
    make("sliding-gate", "gate", "yard", "\u041E\u0442\u043A\u0430\u0442\u043D\u044B\u0435 \u0432\u043E\u0440\u043E\u0442\u0430", { status: "planned", note: "\u041C\u043E\u0434\u0435\u043B\u044C \u043F\u0440\u0438\u0432\u043E\u0434\u0430, \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0438 \u0434\u0430\u0442\u0447\u0438\u043A\u0438 \u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B" }),
    make("boiler", "heating", "utility", "\u0413\u0430\u0437\u043E\u0432\u044B\u0439 \u043A\u043E\u0442\u0451\u043B Kentatsu", { note: "\u0412\u043D\u0435\u0448\u043D\u0435\u0435 \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0438 \u0441\u043E\u0432\u043C\u0435\u0441\u0442\u0438\u043C\u043E\u0441\u0442\u044C \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B" }),
    make("pump", "pump", "utility", "\u041D\u0430\u0441\u043E\u0441 \u0442\u0451\u043F\u043B\u043E\u0433\u043E \u043F\u043E\u043B\u0430", { note: "yeelink.switch.sw1 \xB7 \u043A\u0430\u043D\u0430\u043B \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D; \u043F\u0438\u0442\u0430\u043D\u0438\u0435 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442 \u0440\u0430\u0431\u043E\u0442\u0443 \u043D\u0430\u0441\u043E\u0441\u0430" })
  ];
}
var bindingDefinitions = (devices = defaultDevices()) => devices.map((d) => ({
  id: d.id,
  type: d.type,
  name: `${areaName(d.room)} \xB7 ${d.name}`,
  domains: deviceTypes[d.type].domains,
  device: d
}));
var findDevice = (devices, id) => devices.find((d) => d.id === id);
var sensorTypes = Object.keys(deviceTypes).filter((t) => deviceTypes[t].module === "sensors");
function resolveAction(id, devices) {
  const normalized = id.startsWith("rgb:") ? "rgb/" + id.slice(4) : id;
  const slash = normalized.lastIndexOf("/");
  const key = slash < 0 ? normalized : normalized.slice(0, slash), action = slash < 0 ? "on" : normalized.slice(slash + 1);
  return { device: findDevice(devices, key), key, action };
}
function validateDevices(input) {
  if (!Array.isArray(input) || input.length > 128) throw new Error("\u0412 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 128 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432.");
  const defaults = defaultDevices(), used = /* @__PURE__ */ new Set();
  return input.map((raw) => {
    if (!raw || typeof raw !== "object" || !Object.prototype.hasOwnProperty.call(deviceTypes, raw.type) || !areas.some((a) => a.id === raw.room)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0442\u0438\u043F \u0438\u043B\u0438 \u0437\u043E\u043D\u0430 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430.");
    if (typeof raw.id !== "string" || !/^[a-z][a-z0-9:_-]{1,63}$/.test(raw.id) || used.has(raw.id)) throw new Error("ID \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0438\u043B\u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F.");
    used.add(raw.id);
    const seed = defaults.find((d) => d.id === raw.id);
    if (seed && seed.type !== raw.type) throw new Error("\u0422\u0438\u043F \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0433\u043E \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u043D\u0435\u043B\u044C\u0437\u044F \u043F\u043E\u0434\u043C\u0435\u043D\u044F\u0442\u044C.");
    if (!["installed", "planned"].includes(raw.status)) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0441\u0442\u0430\u0442\u0443\u0441 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438.");
    if (typeof raw.name !== "string" || !raw.name.trim() || raw.name.trim().length > 64) throw new Error("\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430: \u043E\u0442 1 \u0434\u043E 64 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.");
    if (raw.note !== void 0 && (typeof raw.note !== "string" || raw.note.length > 240)) throw new Error("\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435: \u0434\u043E 240 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.");
    return {
      id: raw.id,
      type: raw.type,
      room: raw.room,
      name: raw.name.trim(),
      status: raw.status,
      note: raw.note || "",
      masterOff: ["light", "rgb"].includes(raw.type) && raw.masterOff === true && !seed?.powerId,
      ...seed?.powerId ? { powerId: seed.powerId } : {},
      ...seed?.demoOn !== void 0 ? { demoOn: seed.demoOn } : {},
      ...seed?.demoValue !== void 0 ? { demoValue: seed.demoValue } : {},
      ...seed?.demoStale ? { demoStale: true } : {}
    };
  });
}
function samePhysicalDevice(a, b) {
  return !!a && !!b && a.type === b.type && a.room === b.room && a.status === b.status && a.powerId === b.powerId;
}

// src/night.js
var TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function isTime(value) {
  return typeof value === "string" && TIME_RE.test(value);
}

// src/station.js
var mediaFeatures = { PAUSE: 1, VOLUME_SET: 4, PREVIOUS_TRACK: 16, NEXT_TRACK: 32, PLAY: 16384 };
function stationAvailable(e) {
  return !!e && ["playing", "paused", "idle", "on", "buffering"].includes(e.state);
}
function stationSupports(e, action, value) {
  if (!stationAvailable(e)) return false;
  const mask = Number(e.attributes?.supported_features) || 0;
  if (action === "volume") return !!(mask & mediaFeatures.VOLUME_SET) && Number.isFinite(e.attributes?.volume_level);
  if (action === "playing") return typeof value === "boolean" && !!(mask & (value ? mediaFeatures.PLAY : mediaFeatures.PAUSE));
  if (action === "next") return value === true && !!(mask & mediaFeatures.NEXT_TRACK);
  if (action === "previous") return value === true && !!(mask & mediaFeatures.PREVIOUS_TRACK);
  return false;
}

// src/device-model.js
var DEVICE_MODEL_VERSION = 1;
var object = (v) => v && typeof v === "object" && !Array.isArray(v);
var modes = ["room", "none"];
function seedDeviceModel(devices) {
  const groups = [];
  const add = (id, name, ids) => {
    const members = ids.filter((id2) => devices.some((d) => d.id === id2));
    const found = members.map((id2) => devices.find((d) => d.id === id2));
    if (members.length < 2 || new Set(found.map((d) => d.room)).size !== 1) return;
    groups.push({ id: "unit-" + id, name, room: found[0].room, members, visual: { mode: "room" } });
  };
  for (const [id, label] of [["living", "\u0433\u043E\u0441\u0442\u0438\u043D\u0430\u044F"], ["attic", "\u0447\u0435\u0440\u0434\u0430\u043A"], ["well", "\u0441\u043A\u0432\u0430\u0436\u0438\u043D\u0430"]]) {
    add("climate-" + id, "\u0414\u0430\u0442\u0447\u0438\u043A \u043A\u043B\u0438\u043C\u0430\u0442\u0430 \xB7 " + label, ["temperature:" + id, "humidity:" + id, "battery:" + id]);
  }
  add("door", "\u0412\u0445\u043E\u0434\u043D\u0430\u044F \u0434\u0432\u0435\u0440\u044C", ["door", "battery:door"]);
  add("terrace-motion", "\u0414\u0430\u0442\u0447\u0438\u043A \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u044F \xB7 \u0442\u0435\u0440\u0440\u0430\u0441\u0430", ["terrace-motion", "terrace-lux", "battery:terrace"]);
  add("master-button", "\u041C\u0430\u0441\u0442\u0435\u0440-\u043A\u043D\u043E\u043F\u043A\u0430", ["master-event", "battery:master"]);
  add("yard-camera", "\u041A\u0430\u043C\u0435\u0440\u0430 \u0434\u0432\u043E\u0440\u0430", ["camera-yard", "yard-motion"]);
  add("terrace-door", "\u0414\u0432\u0435\u0440\u044C \u043D\u0430 \u0442\u0435\u0440\u0440\u0430\u0441\u0443", ["terrace-door", "battery:terrace-door"]);
  add("leak-utility", "\u041F\u0440\u043E\u0442\u0435\u0447\u043A\u0430 \u0432 \u043A\u043E\u0442\u0435\u043B\u044C\u043D\u043E\u0439", ["leak:utility", "battery:leak-utility"]);
  add("leak-bath", "\u041F\u0440\u043E\u0442\u0435\u0447\u043A\u0430 \u0432 \u0432\u0430\u043D\u043D\u043E\u0439", ["leak:bath", "battery:leak-bath"]);
  return { version: DEVICE_MODEL_VERSION, groups };
}
function validateDeviceModel(input, devices, areas2) {
  if (input === void 0) return seedDeviceModel(devices);
  if (!object(input) || input.version !== DEVICE_MODEL_VERSION) throw new Error("\u0412\u0435\u0440\u0441\u0438\u044F \u043C\u043E\u0434\u0435\u043B\u0438 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432 \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F.");
  if (!Array.isArray(input.groups) || input.groups.length > 128) throw new Error("\u041D\u0435 \u0431\u043E\u043B\u0435\u0435 128 \u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432.");
  const ids = /* @__PURE__ */ new Set(), assigned = /* @__PURE__ */ new Set(), byId = new Map(devices.map((d) => [d.id, d]));
  const groups = input.groups.map((g) => {
    if (!object(g) || typeof g.id !== "string" || !/^unit-[a-z0-9][a-z0-9_-]{1,58}$/.test(g.id) || ids.has(g.id)) throw new Error("ID \u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0438\u043B\u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F.");
    ids.add(g.id);
    if (typeof g.name !== "string" || !g.name.trim() || g.name.trim().length > 64) throw new Error("\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430: \u043E\u0442 1 \u0434\u043E 64 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.");
    if (!areas2.some((a) => a.id === g.room)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u0437\u043E\u043D\u0430 \u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430.");
    if (!Array.isArray(g.members) || !g.members.length || g.members.length > 32) throw new Error("\u0412 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435 \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u043E\u0442 1 \u0434\u043E 32 \u043A\u0430\u043D\u0430\u043B\u043E\u0432.");
    const members = g.members.map((id) => {
      if (typeof id !== "string" || !byId.has(id) || assigned.has(id)) throw new Error("\u041A\u0430\u043D\u0430\u043B \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0438\u043B\u0438 \u0443\u0436\u0435 \u0432\u043A\u043B\u044E\u0447\u0451\u043D \u0432 \u0434\u0440\u0443\u0433\u043E\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E.");
      assigned.add(id);
      return id;
    });
    if (g.visual !== void 0 && !object(g.visual)) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430.");
    const mode = g.visual?.mode ?? "room";
    if (!modes.includes(mode)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430.");
    return { id: g.id, name: g.name.trim(), room: g.room, members, visual: { mode } };
  });
  return { version: DEVICE_MODEL_VERSION, groups };
}
function detachChannel(model, id) {
  return { ...model, groups: model.groups.map((g) => ({ ...g, members: g.members.filter((m) => m !== id) })).filter((g) => g.members.length) };
}
function roleFor(type) {
  return { light: "power", rgb: "power", station: "media", camera: "camera", button_event: "event" }[type] || type;
}
function effectiveCapabilities(channel, entity) {
  const type = deviceTypes[channel.type];
  if (!type) return [];
  const result = ["state"];
  if (!entity || ["unknown", "unavailable", ""].includes(entity.state)) return result;
  if (channel.type === "curtain" && Number.isFinite(entity.attributes?.current_position)) result.push("position");
  if (channel.type === "vacuum" && Number.isFinite(entity.attributes?.battery_level)) result.push("battery");
  if (type.controllable && channel.status === "installed" && !type.locked) {
    if (["light", "rgb"].includes(channel.type) && ["on", "off"].includes(entity.state)) {
      result.push("power");
      const colors = entity.attributes?.supported_color_modes || [];
      if (channel.type === "rgb" && colors.some((c) => c !== "onoff")) result.push("brightness");
      if (channel.type === "rgb" && colors.includes("rgb")) result.push("color");
    }
    if (channel.type === "station") {
      if (stationSupports(entity, "playing", true)) result.push("play");
      if (stationSupports(entity, "playing", false)) result.push("pause");
      if (stationSupports(entity, "volume")) result.push("volume");
    }
  }
  if (channel.type === "camera") result.push("snapshot", "live");
  return result;
}
function buildDeviceModel(preferences, entities = {}, online) {
  const devices = preferences.devices, model = preferences.deviceModel || seedDeviceModel(devices);
  const assigned = new Set(model.groups.flatMap((g) => g.members));
  const groups = [...model.groups, ...devices.filter((d) => !assigned.has(d.id)).map((d) => ({
    id: "channel:" + d.id,
    name: d.name,
    room: d.room,
    members: [d.id],
    visual: { mode: "room" },
    implicit: true
  }))];
  const byId = new Map(devices.map((d) => [d.id, d]));
  return groups.map((g) => {
    const components = g.members.map((id) => {
      const d = byId.get(id), b = preferences.bindings[id], t = deviceTypes[d.type];
      const entity = online && d.status === "installed" && b?.verified ? entities[b.entityId] : void 0;
      const available2 = !!entity && !["unknown", "unavailable", ""].includes(entity.state);
      return {
        id: d.id,
        role: roleFor(d.type),
        type: d.type,
        room: d.room,
        name: d.name,
        module: t.module,
        installed: d.status === "installed",
        verified: b?.verified === true,
        available: available2,
        state: available2 ? entity.state : null,
        unit: t.unit || null,
        capabilities: effectiveCapabilities(d, entity),
        locked: !!t.locked
      };
    });
    const primary = components.find((c) => c.type !== "battery") || components[0];
    const count = components.filter((c) => c.installed).length, available = components.filter((c) => c.available).length;
    return {
      id: g.id,
      name: g.name,
      room: g.room,
      visual: g.visual,
      implicit: g.implicit === true,
      module: primary.module,
      modules: [...new Set(components.map((c) => c.module))],
      icon: deviceTypes[primary.type].icon,
      components,
      availability: !count ? "planned" : online === void 0 ? "unobserved" : !online ? "offline" : !available ? "unavailable" : available === count ? "available" : "partial"
    };
  });
}

// src/preferences.js
var defaultPreferences = () => ({
  version: 3,
  theme: "dark",
  favorites: ["living", "hall", "terrace", "bedroom", "office", "bath"],
  nightMode: "auto",
  nightStart: "23:00",
  nightEnd: "07:00",
  idleSeconds: 90,
  kiosk: false,
  mode: "demo",
  ambientMode: true,
  autoTheme: false,
  devices: defaultDevices(),
  bindings: Object.fromEntries(defaultDevices().map((d) => [d.id, { entityId: "", verified: false }])),
  userScenarios: [],
  // ONVIF-события движения двора: creds хранятся серверно (в профиле SQLite),
  // пароль не отдаётся клиенту — index.js вырезает его из ответов API.
  yard_onvif_user: "",
  yard_onvif_pass: "",
  yard_onvif_host: "192.168.8.204",
  yard_onvif_enabled: true,
  // Показания счётчика ТНС (снимаются раз в месяц) и тариф. Отсутствие ключей
  // в старых профилях = пусто (обратная совместимость).
  energy_readings: [],
  energy_tariff: null
});
var USER_SCENARIO_LIMITS = { max: 8, maxSteps: 12, minBrightness: 30, maxBrightness: 100 };
var scenarioIdOk = (id) => typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id);
function sanitizeUserScenarios(raw, devices) {
  if (!Array.isArray(raw)) return [];
  const ids = /* @__PURE__ */ new Set(), out = [];
  for (const s of raw) {
    const name = typeof s?.name === "string" ? s.name.trim() : "";
    if (!scenarioIdOk(s?.id) || ids.has(s.id) || name.length < 1 || name.length > 30 || !Array.isArray(s.steps)) continue;
    const steps = [];
    let ok = s.steps.length <= USER_SCENARIO_LIMITS.maxSteps && s.steps.length > 0;
    for (const st of s.steps) {
      if (!ok) break;
      const target = devices.find((d) => d.id === st?.deviceId), type = target && deviceTypes[target.type];
      if (!target || !type || type.module !== "lights" || !type.controllable || !["on", "off", "brightness"].includes(st?.action) || st.action !== "brightness" && st.value !== void 0) {
        ok = false;
        break;
      }
      const step = { deviceId: st.deviceId, action: st.action };
      if (st.action === "brightness") {
        if (!Number.isInteger(st.value) || st.value < 1 || st.value > 100) {
          ok = false;
          break;
        }
        step.value = st.value;
      }
      steps.push(step);
    }
    if (!ok) continue;
    ids.add(s.id);
    out.push({ id: s.id, name, steps });
    if (out.length >= USER_SCENARIO_LIMITS.max) break;
  }
  return out;
}
var MAX_ENERGY_READINGS = 36;
function sanitizeEnergyReadings(raw) {
  if (raw === void 0 || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error("\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u0441\u0447\u0451\u0442\u0447\u0438\u043A\u0430: \u043D\u0443\u0436\u0435\u043D \u043C\u0430\u0441\u0441\u0438\u0432.");
  const byDate = /* @__PURE__ */ new Map();
  for (const r of raw) {
    if (!r || typeof r !== "object" || Array.isArray(r)) throw new Error("\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u0435 \u0441\u0447\u0451\u0442\u0447\u0438\u043A\u0430: \u043D\u0443\u0436\u0435\u043D \u043E\u0431\u044A\u0435\u043A\u0442 \u0441 \u0434\u0430\u0442\u043E\u0439 \u0438 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435\u043C.");
    const md = /^(\d{4})-(\d{2})-(\d{2})$/.exec(r.date);
    const dt = md ? new Date(Date.UTC(Number(md[1]), Number(md[2]) - 1, Number(md[3]))) : null;
    if (!dt || dt.getUTCFullYear() !== Number(md[1]) || dt.getUTCMonth() !== Number(md[2]) - 1 || dt.getUTCDate() !== Number(md[3])) throw new Error("\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u0435 \u0441\u0447\u0451\u0442\u0447\u0438\u043A\u0430: \u0434\u0430\u0442\u0430 \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 \u0413\u0413\u0413\u0413-\u041C\u041C-\u0414\u0414.");
    if (!Number.isInteger(r.value) || r.value <= 0) throw new Error("\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u0435 \u0441\u0447\u0451\u0442\u0447\u0438\u043A\u0430: \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u2014 \u0446\u0435\u043B\u043E\u0435 \u0447\u0438\u0441\u043B\u043E \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0443\u043B\u044F.");
    byDate.set(r.date, r.value);
  }
  const out = [...byDate].map(([date, value]) => ({ date, value })).sort((a, b) => a.date < b.date ? -1 : 1);
  if (out.length > MAX_ENERGY_READINGS) throw new Error(`\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u0439 \u043D\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 ${MAX_ENERGY_READINGS}.`);
  return out;
}
function sanitizeEnergyTariff(raw) {
  if (raw === void 0 || raw === null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0.01 || raw > 99) throw new Error("\u0422\u0430\u0440\u0438\u0444: \u0447\u0438\u0441\u043B\u043E \u043E\u0442 0,01 \u0434\u043E 99 \u20BD/\u043A\u0412\u0442\xB7\u0447.");
  return raw;
}
function validatePreferences(input, { importing = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("\u041D\u0443\u0436\u0435\u043D \u043E\u0431\u044A\u0435\u043A\u0442 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A.");
  if (input.version !== 3) throw new Error("\u0412\u0435\u0440\u0441\u0438\u044F \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F. \u041D\u0443\u0436\u043D\u0430 \u043A\u043E\u043F\u0438\u044F v3.");
  const raw = input, p = defaultPreferences();
  if (Number.isInteger(raw.housePresetVersion) && raw.housePresetVersion >= 0 && raw.housePresetVersion <= 5) p.housePresetVersion = raw.housePresetVersion;
  p.houseProfileConfirmed = !importing && raw.houseProfileConfirmed === true;
  if (!["dark", "light"].includes(raw.theme)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u0442\u0435\u043C\u0430.");
  if (!["auto", "on", "off"].includes(raw.nightMode)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u043D\u043E\u0447\u043D\u043E\u0439 \u0440\u0435\u0436\u0438\u043C.");
  if (raw.nightStart !== void 0 || raw.nightEnd !== void 0) {
    if (!isTime(raw.nightStart) || !isTime(raw.nightEnd)) throw new Error("\u0412\u0440\u0435\u043C\u044F \u043D\u043E\u0447\u0438 \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0441\u0442\u0440\u043E\u043A\u043E\u0439 \u0427\u0427:\u041C\u041C.");
    if (raw.nightStart === raw.nightEnd) throw new Error("\u041D\u0430\u0447\u0430\u043B\u043E \u0438 \u043A\u043E\u043D\u0435\u0446 \u043D\u043E\u0447\u0438 \u043D\u0435 \u0434\u043E\u043B\u0436\u043D\u044B \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0442\u044C.");
  }
  if (![0, 10, 60, 90, 180].includes(raw.idleSeconds)) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0437\u0430\u0434\u0435\u0440\u0436\u043A\u0430 \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u044F.");
  if (raw.ambientMode !== void 0 && typeof raw.ambientMode !== "boolean") throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0442\u0438\u0445\u0438\u0439 \u0440\u0435\u0436\u0438\u043C.");
  if (!Array.isArray(raw.favorites) || raw.favorites.length > 6 || new Set(raw.favorites).size !== raw.favorites.length || raw.favorites.some((id) => !areas.some((r) => r.id === id))) throw new Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0441\u043F\u0438\u0441\u043E\u043A \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u044B\u0445 \u043A\u043E\u043C\u043D\u0430\u0442.");
  if (!["demo", "live"].includes(raw.mode)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0434\u0430\u043D\u043D\u044B\u0445.");
  Object.assign(p, { theme: raw.theme, nightMode: raw.nightMode, nightStart: raw.nightStart === void 0 ? p.nightStart : raw.nightStart, nightEnd: raw.nightEnd === void 0 ? p.nightEnd : raw.nightEnd, idleSeconds: raw.idleSeconds, favorites: [...raw.favorites], kiosk: raw.kiosk === true, mode: importing ? "demo" : raw.mode, ambientMode: raw.ambientMode !== false, devices: validateDevices(raw.devices) });
  p.deviceModel = validateDeviceModel(raw.deviceModel, p.devices, areas);
  p.autoTheme = raw.autoTheme === true;
  p.yard_onvif_user = typeof raw.yard_onvif_user === "string" ? raw.yard_onvif_user.trim().slice(0, 64) : "";
  p.yard_onvif_pass = typeof raw.yard_onvif_pass === "string" ? raw.yard_onvif_pass.slice(0, 120) : "";
  p.yard_onvif_host = typeof raw.yard_onvif_host === "string" && raw.yard_onvif_host.trim() ? raw.yard_onvif_host.trim().slice(0, 120) : "192.168.8.204";
  p.yard_onvif_enabled = raw.yard_onvif_enabled !== false;
  p.energy_readings = sanitizeEnergyReadings(raw.energy_readings);
  p.energy_tariff = sanitizeEnergyTariff(raw.energy_tariff);
  const used = /* @__PURE__ */ new Set();
  p.bindings = {};
  for (const definition of bindingDefinitions(p.devices)) {
    const b = raw.bindings?.[definition.id] || {}, entityId = typeof b.entityId === "string" ? b.entityId.trim() : "";
    if (entityId && (!/^[a-z_]+\.[a-z0-9_]+$/.test(entityId) || !definition.domains.includes(entityId.split(".")[0]))) throw new Error(`\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C: ${definition.name}`);
    if (entityId && used.has(entityId)) throw new Error("\u041E\u0434\u043D\u0430 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D\u0430 \u043A \u0434\u0432\u0443\u043C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430\u043C.");
    if (entityId) used.add(entityId);
    if (definition.device.status === "planned" && b.verified && !importing) throw new Error("\u041F\u043B\u0430\u043D\u0438\u0440\u0443\u0435\u043C\u043E\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u043D\u0435\u043B\u044C\u0437\u044F \u043E\u0442\u043C\u0435\u0447\u0430\u0442\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u043C.");
    p.bindings[definition.id] = { entityId, verified: !importing && definition.device.status === "installed" && !!entityId && b.verified === true };
  }
  p.userScenarios = sanitizeUserScenarios(raw.userScenarios, p.devices);
  return p;
}

// server/ha.js
import WebSocket from "ws";
var energyHistoryCache = /* @__PURE__ */ new Map();
var ENERGY_BAD = ["unknown", "unavailable", ""];
var energyDeltas = (points, now = Date.now()) => {
  const valid = (Array.isArray(points) ? points : []).filter((p) => p && Number.isFinite(p.at) && Number.isFinite(p.value)).sort((a, b) => a.at - b.at);
  const inWindow = (fromMs) => {
    const w = valid.filter((p) => p.at >= fromMs);
    return w.length >= 2 ? Math.round((w.at(-1).value - w[0].value) * 10) / 10 : null;
  };
  return { day: inWindow(now - 24 * 36e5), week: inWindow(-Infinity) };
};
var HomeAssistant = class {
  constructor({ url = "", token = "", preview: preview2 = false } = {}) {
    this.enabled = !!url && !!token && !preview2;
    this.token = token;
    this.url = null;
    this.pending = /* @__PURE__ */ new Set();
    if (this.enabled) {
      let u;
      try {
        u = new URL(url);
      } catch {
        throw new Error("HA_URL \u0438\u043C\u0435\u0435\u0442 \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442.");
      }
      if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || u.search || u.hash) throw new Error("HA_URL \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C HTTP(S)-\u0430\u0434\u0440\u0435\u0441\u043E\u043C \u0431\u0435\u0437 \u043F\u0430\u0440\u043E\u043B\u044F, query \u0438 fragment.");
      this.url = u.href.replace(/\/$/, "");
    }
  }
  async request(path, body2, { timeout = 6e3 } = {}) {
    if (!this.enabled) throw new Error("Home Assistant \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D. \u041D\u0430 \u043C\u0435\u0441\u0442\u0435 \u0434\u043E\u0431\u0430\u0432\u0438\u043C HA_URL \u0438 HA_TOKEN \u0432 .env \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0441\u0435\u0440\u0432\u0435\u0440\u0430.");
    let response;
    try {
      response = await fetch(this.url + path, {
        method: body2 === void 0 ? "GET" : "POST",
        redirect: "error",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        ...body2 === void 0 ? {} : { body: JSON.stringify(body2) },
        signal: AbortSignal.timeout(timeout)
      });
    } catch {
      throw new Error("\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438 \u0441 Home Assistant. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0441\u0435\u0442\u044C \u0438 \u0430\u0434\u0440\u0435\u0441 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0441\u0435\u0440\u0432\u0435\u0440\u0430.");
    }
    if (response.status === 401 || response.status === 403) throw new Error("Home Assistant \u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u044E. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0442\u043E\u043A\u0435\u043D.");
    if (!response.ok) throw new Error(`Home Assistant: \u0437\u0430\u043F\u0440\u043E\u0441 \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D (${response.status}).`);
    try {
      return await response.json();
    } catch {
      throw new Error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442 Home Assistant.");
    }
  }
  // Raw-ответ (кадр камеры): та же авторизация, но без JSON-парсинга.
  // Одноразовый WebSocket-вызов сервиса с ответом (ws — зависимость аддона).
  callService(domain, service, data2, timeout = 15e3) {
    if (!this.enabled) return Promise.reject(new Error("Home Assistant \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D."));
    return new Promise((resolve2, reject) => {
      const wsURL = this.url.replace(/^http/, "ws") + "/api/websocket";
      let ws, done = false;
      const fail = (message) => {
        if (done) return;
        done = true;
        try {
          ws?.close();
        } catch {
        }
        reject(new Error(message));
      };
      const timer = setTimeout(() => fail("Home Assistant \u043D\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u043B \u043D\u0430 \u0432\u044B\u0437\u043E\u0432 \u0441\u0435\u0440\u0432\u0438\u0441\u0430 \u0432\u043E\u0432\u0440\u0435\u043C\u044F."), timeout);
      const send = (obj) => ws.send(JSON.stringify(obj));
      try {
        ws = new WebSocket(wsURL);
      } catch (error) {
        clearTimeout(timer);
        return fail("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0435\u0434\u0438\u043D\u0438\u0442\u044C\u0441\u044F \u0441 Home Assistant WebSocket.");
      }
      ws.on("message", (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw);
        } catch {
          return;
        }
        if (msg.type === "auth_required") {
          send({ type: "auth", access_token: this.token });
          return;
        }
        if (msg.type === "auth_invalid") {
          clearTimeout(timer);
          return fail("Home Assistant \u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u044E. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0442\u043E\u043A\u0435\u043D.");
        }
        if (msg.type === "auth_ok") {
          send({ id: 1, type: "call_service", domain, service, target: {}, return_response: true, ...data2 ? { service_data: data2 } : {} });
          return;
        }
        if (msg.type === "result") {
          clearTimeout(timer);
          if (done) return;
          done = true;
          try {
            ws.close();
          } catch {
          }
          if (msg.success) return resolve2(msg.result?.response);
          const detail = msg.error?.message || "\u0412\u044B\u0437\u043E\u0432 \u0441\u0435\u0440\u0432\u0438\u0441\u0430 \u043D\u0435 \u0443\u0434\u0430\u043B\u0441\u044F.";
          return reject(new Error(`Home Assistant: ${detail}`));
        }
      });
      ws.on("error", () => fail("\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438 \u0441 Home Assistant \u043F\u043E WebSocket. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0441\u0435\u0442\u044C \u0438 \u0430\u0434\u0440\u0435\u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u0430."));
      ws.on("close", () => fail("Home Assistant \u0437\u0430\u043A\u0440\u044B\u043B WebSocket \u0434\u043E \u043E\u0442\u0432\u0435\u0442\u0430 \u0441\u0435\u0440\u0432\u0438\u0441\u0430."));
    });
  }
  // Возвращает {type,bytes}; не-изображение → null (детектор не паникует).
  async requestRaw(path, { timeout = 1e4 } = {}) {
    if (!this.enabled) throw new Error("Home Assistant \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D. \u041D\u0430 \u043C\u0435\u0441\u0442\u0435 \u0434\u043E\u0431\u0430\u0432\u0438\u043C HA_URL \u0438 HA_TOKEN \u0432 .env \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0441\u0435\u0440\u0432\u0435\u0440\u0430.");
    let response;
    try {
      response = await fetch(this.url + path, { redirect: "error", headers: { Authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(timeout) });
    } catch {
      throw new Error("\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438 \u0441 Home Assistant. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0441\u0435\u0442\u044C \u0438 \u0430\u0434\u0440\u0435\u0441 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0441\u0435\u0440\u0432\u0435\u0440\u0430.");
    }
    if (response.status === 401 || response.status === 403) throw new Error("Home Assistant \u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u044E. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0442\u043E\u043A\u0435\u043D.");
    if (!response.ok) throw new Error(`Home Assistant: \u0437\u0430\u043F\u0440\u043E\u0441 \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D (${response.status}).`);
    const type = response.headers.get("content-type")?.split(";")[0];
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return null;
    const reader = response.body.getReader(), parts = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 5 * 1024 * 1024) throw new Error("\u041A\u0430\u0434\u0440 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 5 \u041C\u0411.");
        parts.push(Buffer.from(value));
      }
    } finally {
      await reader.cancel();
    }
    return { type, bytes: Buffer.concat(parts) };
  }
  sanitize(e) {
    const keys = ["friendly_name", "device_class", "state_class", "unit_of_measurement", "temperature_unit", "brightness", "rgb_color", "supported_color_modes", "current_position", "battery_level", "current_temperature", "temperature", "hvac_action", "supported_features", "volume_level", "media_title", "media_artist", "alice_state", "assumed_state", "humidity", "wind_speed", "wind_bearing", "pressure", "carbon_intensity", "fossil_fuel_percentage", "fossil_percentage", "code_format", "changed_by", "next_dawn", "next_dusk", "next_rising", "next_setting"];
    return {
      entity_id: e.entity_id,
      state: e.state,
      last_changed: e.last_changed,
      last_updated: e.last_updated,
      last_reported: e.last_reported,
      attributes: Object.fromEntries(keys.filter((k) => e.attributes?.[k] !== void 0).map((k) => [k, e.attributes[k]]))
    };
  }
  async states() {
    const all = await this.request("/api/states");
    if (!Array.isArray(all)) throw new Error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0435\u0439.");
    return all.filter((e) => /^(light|switch|sensor|binary_sensor|camera|cover|climate|media_player|vacuum|weather|todo|alarm_control_panel|update|sun)\.[a-z0-9_]+$/.test(e.entity_id)).map((e) => this.sanitize(e));
  }
  async weatherForecast(entityId) {
    if (!/^weather\.[a-z0-9_]+$/.test(entityId)) throw new Error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C \u043F\u043E\u0433\u043E\u0434\u044B.");
    if (!this.enabled) throw new Error("Home Assistant \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D. \u041F\u0440\u043E\u0433\u043D\u043E\u0437 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D.");
    const answer = await this.callService("weather", "get_forecasts", { type: "daily", entity_id: [entityId] }, 15e3);
    const raw = answer?.[entityId]?.forecast ?? answer?.service_response?.[entityId]?.forecast;
    if (!Array.isArray(raw)) throw new Error("Home Assistant \u043D\u0435 \u0432\u0435\u0440\u043D\u0443\u043B \u043F\u0440\u043E\u0433\u043D\u043E\u0437 \u043F\u043E\u0433\u043E\u0434\u044B.");
    return raw.filter((p) => p && typeof p.datetime === "string" && Number.isFinite(Date.parse(p.datetime)) && Number.isFinite(Number(p.temperature))).sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime)).slice(0, 8).map((p) => {
      const item = { datetime: p.datetime, condition: p.condition, temperature: Number(p.temperature) };
      if (Number.isFinite(Number(p.templow))) item.templow = Number(p.templow);
      if (Number.isFinite(Number(p.precipitation_probability))) item.precipitationProbability = Math.round(Number(p.precipitation_probability));
      if (Number.isFinite(Number(p.precipitation))) item.precipitation = Number(p.precipitation);
      return item;
    });
  }
  // История показаний счётчика за окно hours∈[24,168] как в loadHistory:
  // /api/history/period/<ISO start>?filter_entity_id=…&minimal_response&no_attributes.
  // Возвращает только валидные точки {at, value}: state — число, не unavailable/unknown.
  async energyHistory(entityId, hours) {
    if (!/^sensor\.[a-z0-9_]+$/.test(entityId)) throw new Error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C \u0441\u0447\u0451\u0442\u0447\u0438\u043A\u0430.");
    if (![24, 168].includes(hours)) throw new Error("\u041F\u0435\u0440\u0438\u043E\u0434 \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u0440\u0430\u0441\u0445\u043E\u0434\u0430: 24 \u0438\u043B\u0438 168 \u0447\u0430\u0441\u043E\u0432.");
    if (!this.enabled) throw new Error("Home Assistant \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D. \u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0440\u0430\u0441\u0445\u043E\u0434\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430.");
    const key = [this.url, entityId, hours].join("|");
    const saved = energyHistoryCache.get(key);
    if (saved && Date.now() - saved.at < 6e4) return saved.data;
    const end = Date.now(), start = end - hours * 36e5;
    const query = new URLSearchParams({ filter_entity_id: entityId, end_time: new Date(end).toISOString(), minimal_response: "", no_attributes: "", significant_changes_only: "0" });
    const promise = (async () => {
      let raw;
      try {
        raw = await this.request("/api/history/period/" + encodeURIComponent(new Date(start).toISOString()) + "?" + query);
      } catch (error) {
        throw new Error("\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0440\u0430\u0441\u0445\u043E\u0434\u0430 HA \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C History/Recorder \u0434\u043B\u044F \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0438 \u0441\u0447\u0451\u0442\u0447\u0438\u043A\u0430. " + error.message);
      }
      const group = (Array.isArray(raw) ? raw : []).find((g) => Array.isArray(g) && g[0]?.entity_id === entityId) || [];
      return group.map((r) => ({ at: Date.parse(r.last_changed || r.last_updated), state: String(r.state ?? "") })).filter((r) => Number.isFinite(r.at) && !ENERGY_BAD.includes(r.state) && Number.isFinite(Number(r.state))).sort((a, b) => a.at - b.at).map((r) => ({ at: r.at, value: Number(r.state) }));
    })();
    if (energyHistoryCache.size >= 12) energyHistoryCache.delete(energyHistoryCache.keys().next().value);
    energyHistoryCache.set(key, { at: Date.now(), promise });
    try {
      return await promise;
    } catch (error) {
      energyHistoryCache.delete(key);
      throw error;
    }
  }
  cameraEntity(id, p) {
    const d = p.devices.find((d2) => d2.id === id), b = p.bindings[id];
    if (p.mode !== "live" || d?.type !== "camera" || d.status !== "installed" || !b?.verified || !/^camera\.[a-z0-9_]+$/.test(b.entityId)) throw new Error("\u041A\u0430\u043C\u0435\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u0438\u043B\u0438 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u0430.");
    if (!this.enabled) throw new Error("\u041A\u0430\u043C\u0435\u0440\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0432 \u0434\u0435\u043C\u043E\u043F\u0440\u0435\u0432\u044C\u044E.");
    return b.entityId;
  }
  async camera(id, p) {
    const entity = this.cameraEntity(id, p);
    let response;
    try {
      response = await fetch(this.url + "/api/camera_proxy/" + entity, { headers: { Authorization: `Bearer ${this.token}` }, redirect: "error", signal: AbortSignal.timeout(1e4) });
    } catch {
      throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043A\u0430\u0434\u0440 \u043A\u0430\u043C\u0435\u0440\u044B.");
    }
    const type = response.headers.get("content-type")?.split(";")[0];
    if (!response.ok || !["image/jpeg", "image/png", "image/webp"].includes(type)) throw new Error("Home Assistant \u043D\u0435 \u0432\u0435\u0440\u043D\u0443\u043B \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u043A\u0430\u043C\u0435\u0440\u044B.");
    const reader = response.body.getReader(), parts = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 5 * 1024 * 1024) throw new Error("\u041A\u0430\u0434\u0440 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 5 \u041C\u0411.");
        parts.push(Buffer.from(value));
      }
    } finally {
      await reader.cancel();
    }
    return { type, bytes: Buffer.concat(parts) };
  }
  async command(request, p) {
    if (p.mode !== "live") throw new Error("\u041A\u043E\u043C\u0430\u043D\u0434\u044B Home Assistant \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u0440\u0430\u0431\u043E\u0447\u0435\u043C \u0440\u0435\u0436\u0438\u043C\u0435.");
    if (!request || typeof request.id !== "string") throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430.");
    if (request.id.startsWith("station:")) return this.stationCommand(request, p);
    const { key, action, device } = resolveAction(request.id, p.devices);
    const def = bindingDefinitions(p.devices).find((b) => b.id === key), binding = p.bindings[key];
    if (!def || device.status !== "installed" || !["light", "rgb"].includes(def.type) || !binding?.verified || !binding.entityId) throw new Error("\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u044D\u0442\u0438\u043C \u043A\u0430\u043D\u0430\u043B\u043E\u043C \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043E.");
    const entity = binding.entityId, domain = entity.split(".")[0];
    if (!def.domains.includes(domain) || this.pending.has(entity)) throw new Error("\u041A\u0430\u043D\u0430\u043B \u0437\u0430\u043D\u044F\u0442 \u0438\u043B\u0438 \u0434\u043E\u043C\u0435\u043D \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D.");
    let service, data2, target;
    if (action === "brightness" && def.type === "rgb") {
      if (!Number.isInteger(request.value) || request.value < 1 || request.value > 100) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u044F\u0440\u043A\u043E\u0441\u0442\u044C.");
      service = "turn_on";
      data2 = { brightness: Math.round(request.value * 255 / 100) };
      target = (e) => e.state === "on" && Math.abs((e.attributes.brightness ?? -999) - data2.brightness) <= 2;
    } else if (action === "color" && def.type === "rgb") {
      if (!/^#[a-fA-F0-9]{6}$/.test(request.value)) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 RGB-\u0446\u0432\u0435\u0442.");
      const rgb = [1, 3, 5].map((i) => parseInt(request.value.slice(i, i + 2), 16));
      service = "turn_on";
      data2 = { rgb_color: rgb };
      target = (e) => e.state === "on" && e.attributes.rgb_color?.length === 3 && e.attributes.rgb_color.every((n, i) => Math.abs(n - rgb[i]) <= 3);
    } else {
      if (action !== "on" || typeof request.value !== "boolean") throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432\u044B\u043A\u043B\u044E\u0447\u0430\u0442\u0435\u043B\u044F.");
      service = request.value ? "turn_on" : "turn_off";
      data2 = {};
      target = (e) => e.state === (request.value ? "on" : "off");
    }
    this.pending.add(entity);
    try {
      const before = await this.request("/api/states/" + entity);
      if (!["on", "off"].includes(before.state)) throw new Error("\u0421\u0443\u0449\u043D\u043E\u0441\u0442\u044C \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430. \u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0430.");
      if (action === "brightness" && !before.attributes.supported_color_modes?.some((m) => m !== "onoff")) throw new Error("\u042F\u0440\u043A\u043E\u0441\u0442\u044C \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C\u044E.");
      if (action === "color" && !before.attributes.supported_color_modes?.includes("rgb")) throw new Error("RGB-\u0446\u0432\u0435\u0442 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D \u043A\u0430\u043A \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u044B\u0439.");
      if (device.powerId) {
        const power = p.bindings[device.powerId];
        if (!power?.verified || !power.entityId) throw new Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u043A\u0430\u043D\u0430\u043B \u043F\u0438\u0442\u0430\u043D\u0438\u044F \u043F\u0440\u0438\u0445\u043E\u0436\u0435\u0439.");
        const e = await this.request("/api/states/" + power.entityId);
        if (e.state !== "on") throw new Error("\u0423 RGB-\u043B\u0430\u043C\u043F\u044B \u043D\u0435\u0442 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u043E\u0433\u043E \u043F\u0438\u0442\u0430\u043D\u0438\u044F.");
      }
      if (target(before)) return { id: request.id, value: request.value, confirmedAt: Date.now() };
      await this.request(`/api/services/${domain}/${service}`, { entity_id: entity, ...data2 });
      const deadline = Date.now() + 1e4;
      do {
        const e = await this.request("/api/states/" + entity);
        if (target(e)) return { id: request.id, value: request.value, confirmedAt: Date.now() };
        await new Promise((r) => setTimeout(r, 350));
      } while (Date.now() < deadline);
      throw new Error("\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043C\u043E\u0433\u043B\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C\u0441\u044F; \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u043F\u0435\u0440\u0435\u0434 \u043F\u043E\u0432\u0442\u043E\u0440\u043E\u043C.");
    } finally {
      this.pending.delete(entity);
    }
  }
  // Список покупок: позиции не приходят в /api/states, читаем ответом сервиса todo/get_items.
  async shoppingItems() {
    const entity = "todo.shopping_list";
    if (!this.enabled) throw new Error("Home Assistant \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D. \u0421\u043F\u0438\u0441\u043E\u043A \u043F\u043E\u043A\u0443\u043F\u043E\u043A \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D.");
    const e = await this.request("/api/states/" + entity);
    if (e.entity_id !== entity || ["unknown", "unavailable"].includes(e.state)) throw new Error("\u0421\u043F\u0438\u0441\u043E\u043A \u043F\u043E\u043A\u0443\u043F\u043E\u043A todo.shopping_list \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u0432 HA.");
    const result = await this.request("/api/services/todo/get_items?return_response", { entity_id: [entity], status: "needs_action" });
    const raw = !Array.isArray(result) && (result?.[entity] || result?.service_response?.[entity])?.items;
    if (!Array.isArray(raw)) throw new Error("HA \u043D\u0435 \u0432\u0435\u0440\u043D\u0443\u043B \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0435 \u0441\u043F\u0438\u0441\u043A\u0430 \u043F\u043E\u043A\u0443\u043F\u043E\u043A.");
    const items = raw.filter((i) => i && typeof i.uid === "string" && typeof i.summary === "string").map((i) => ({ uid: i.uid, summary: i.summary, status: i.status === "completed" ? "completed" : "needs_action" }));
    return { entity, count: items.length, items: items.slice(0, 50), truncated: raw.length > 50 };
  }
  async shoppingMutate(action, target) {
    if (!["add", "complete"].includes(action)) throw new Error("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0441\u043F\u0438\u0441\u043A\u0430 \u0437\u0430\u043F\u0440\u0435\u0449\u0435\u043D\u043E.");
    const t = String(target ?? "").trim();
    if (!t || t.length > 80) throw new Error("\u041F\u043E\u0437\u0438\u0446\u0438\u044F \u0441\u043F\u0438\u0441\u043A\u0430: \u043E\u0442 1 \u0434\u043E 80 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.");
    const entity = "todo.shopping_list";
    if (this.pending.has(entity)) throw new Error("\u0414\u043E\u0436\u0434\u0438\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0433\u043E \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0441\u043F\u0438\u0441\u043A\u0430.");
    this.pending.add(entity);
    try {
      const before = await this.shoppingItems();
      if (action === "add" && before.items.some((i) => i.summary.toLowerCase() === t.toLowerCase())) throw new Error("\u0422\u0430\u043A\u0430\u044F \u043F\u043E\u0437\u0438\u0446\u0438\u044F \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u0432 \u0441\u043F\u0438\u0441\u043A\u0435.");
      const found = action === "complete" ? before.items.find((i) => i.uid === t || i.summary.toLowerCase() === t.toLowerCase()) : null;
      if (action === "complete" && !found) throw new Error("\u041F\u043E\u0437\u0438\u0446\u0438\u044F \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430. \u041E\u0431\u043D\u043E\u0432\u0438 \u0441\u043F\u0438\u0441\u043E\u043A \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0441\u043D\u043E\u0432\u0430.");
      await this.request("/api/services/todo/" + (action === "add" ? "add_item" : "update_item"), { entity_id: entity, ...action === "add" ? { item: t } : { item: found.uid || t, status: "completed" } });
      let after;
      try {
        after = await this.shoppingItems();
      } catch {
        return { action, confirmed: false, items: before.items, message: "HA \u043F\u0440\u0438\u043D\u044F\u043B \u0437\u0430\u043F\u0440\u043E\u0441, \u043D\u043E \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0435 \u0447\u0442\u0435\u043D\u0438\u0435 \u0441\u043F\u0438\u0441\u043A\u0430 \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C. \u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D; \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435\u043C." };
      }
      const confirmed = action === "add" ? after.items.some((i) => i.summary === t && !before.items.some((b) => b.uid === i.uid)) : !after.items.some((i) => i.uid === found.uid);
      return {
        action,
        confirmed,
        items: after.items,
        message: confirmed ? action === "add" ? "\u041F\u043E\u0437\u0438\u0446\u0438\u044F \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0430, \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E \u0447\u0442\u0435\u043D\u0438\u0435\u043C \u0441\u043F\u0438\u0441\u043A\u0430." : "\u041F\u043E\u0437\u0438\u0446\u0438\u044F \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0430, \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E \u0447\u0442\u0435\u043D\u0438\u0435\u043C \u0441\u043F\u0438\u0441\u043A\u0430." : action === "add" ? "HA \u043F\u0440\u0438\u043D\u044F\u043B \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435; \u0444\u0430\u043A\u0442\u0430 \u0432 \u0441\u043F\u0438\u0441\u043A\u0435 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442, \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435\u043C." : "HA \u043F\u0440\u0438\u043D\u044F\u043B \u043E\u0442\u043C\u0435\u0442\u043A\u0443; \u043F\u043E\u0437\u0438\u0446\u0438\u044F \u043F\u043E\u043A\u0430 \u0432\u0438\u0434\u043D\u0430, \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435\u043C."
      };
    } finally {
      this.pending.delete(entity);
    }
  }
  // Охрана: статус для клиента и подтверждаемые команды постановки/снятия.
  // Код охраны никогда не попадает в логи, ответы и тексты ошибок.
  async alarmState() {
    if (!this.enabled) throw new Error("Home Assistant \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D. \u041E\u0445\u0440\u0430\u043D\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430.");
    const all = await this.request("/api/states");
    const e = Array.isArray(all) ? all.find((e2) => /^alarm_control_panel\.[a-z0-9_]+$/.test(e2.entity_id)) : null;
    if (!e) throw new Error("\u0421\u0443\u0449\u043D\u043E\u0441\u0442\u044C \u043E\u0445\u0440\u0430\u043D\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0432 Home Assistant.");
    return this.sanitize(e);
  }
  async alarmService(service, code) {
    const names = { arm_away: "alarm_arm_away", arm_home: "alarm_arm_home", disarm: "alarm_disarm" };
    if (!Object.keys(names).includes(service)) throw new Error("\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043E\u0445\u0440\u0430\u043D\u044B \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F.");
    const current = await this.alarmState(), entity = current.entity_id, format = current.attributes?.code_format;
    let clean = "";
    if (format && format !== "None") {
      clean = String(code ?? "").trim();
      if (!clean) throw new Error("\u0412\u0432\u0435\u0434\u0438 \u043A\u043E\u0434 \u043E\u0445\u0440\u0430\u043D\u044B.");
      if (clean.length > 16) throw new Error("\u041A\u043E\u0434 \u043E\u0445\u0440\u0430\u043D\u044B: \u043D\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 16 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.");
      if (format === "Number" && !/^[0-9]+$/.test(clean)) throw new Error("\u041A\u043E\u0434 \u043E\u0445\u0440\u0430\u043D\u044B: \u0442\u043E\u043B\u044C\u043A\u043E \u0446\u0438\u0444\u0440\u044B.");
    } else if (typeof code === "string") clean = code.slice(0, 16);
    const target = { arm_away: "armed_away", arm_home: "armed_home", disarm: "disarmed" }[service];
    const done = service === "disarm" ? "\u041E\u0445\u0440\u0430\u043D\u0430 \u0441\u043D\u044F\u0442\u0430, \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E Home Assistant." : "\u041F\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u043E\u0434 \u043E\u0445\u0440\u0430\u043D\u0443 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430.";
    this.pending.add(entity);
    try {
      if (current.state === target) return { service, confirmed: true, state: target, message: done };
      await this.request(`/api/services/alarm_control_panel/${names[service]}`, { entity_id: entity, ...clean ? { code: clean } : {} });
      const deadline = Date.now() + 15e3;
      let last = current.state;
      do {
        await new Promise((r) => setTimeout(r, 500));
        const e = await this.request("/api/states/" + entity);
        last = e.state;
        if (last === target) return { service, confirmed: true, state: target, message: done };
        if (["triggered", "unavailable", "unknown"].includes(last)) break;
      } while (Date.now() < deadline);
      if (["arming", "pending"].includes(last)) return { service, confirmed: false, state: last, message: "\u0412 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u0435; \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u0447\u0435\u0440\u0435\u0437 \u043C\u0438\u043D\u0443\u0442\u0443." };
      throw new Error("\u041E\u0445\u0440\u0430\u043D\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B\u0430 \u0441\u043C\u0435\u043D\u0443 \u0440\u0435\u0436\u0438\u043C\u0430. \u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043C\u043E\u0433\u043B\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C\u0441\u044F; \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u0441\u0442\u0430\u0442\u0443\u0441.");
    } finally {
      this.pending.delete(entity);
    }
  }
  // Голосовая команда: произвольная фраза в conversation.process HA.
  // Честно возвращаем speech агента; readback не проверяем — разговорный агент HA сам отвечает.
  async converse(text) {
    const t = String(text ?? "").trim();
    if (!t || t.length > 120) throw new Error("\u0413\u043E\u043B\u043E\u0441\u043E\u0432\u0430\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430: \u043E\u0442 1 \u0434\u043E 120 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.");
    const r = await this.request("/api/services/conversation/process", { text: t, language: "ru" }, { timeout: 15e3 });
    return { speech: String(r?.response?.speech?.plain?.speech ?? "").trim(), success: true };
  }
  // TTS-фраза на станцию. Формат как в assistant.sendMedia: play_media c media_content_type 'text'.
  // media_player не отдаёт результат озвучивания — честно возвращаем «принято, не подтверждено».
  async announce(text, p) {
    const t = String(text ?? "").trim();
    if (!t || t.length > 100) throw new Error("\u0422\u0435\u043A\u0441\u0442 \u0444\u0440\u0430\u0437\u044B: \u043E\u0442 1 \u0434\u043E 100 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.");
    const d = p.devices.find((d2) => d2.id === "station"), b = p.bindings.station;
    if (d?.type !== "station" || d.status !== "installed" || !b?.verified || !/^media_player\.[a-z0-9_]+$/.test(b.entityId)) throw new Error("\u0421\u0442\u0430\u043D\u0446\u0438\u044F \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u0438\u043B\u0438 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u0430.");
    const entity = b.entityId;
    if (this.pending.has(entity)) throw new Error("\u0421\u0442\u0430\u043D\u0446\u0438\u044F \u0437\u0430\u043D\u044F\u0442\u0430 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0439 \u043A\u043E\u043C\u0430\u043D\u0434\u043E\u0439.");
    this.pending.add(entity);
    try {
      const e = await this.request("/api/states/" + entity);
      if (!stationAvailable(e) || !(Number(e.attributes?.supported_features) & 512)) throw new Error("\u0421\u0442\u0430\u043D\u0446\u0438\u044F \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0438\u043B\u0438 play_media \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F.");
      await this.request("/api/services/media_player/play_media", { entity_id: entity, media_content_type: "text", media_content_id: t });
      return { accepted: true, message: "HA \u043F\u0440\u0438\u043D\u044F\u043B \u0437\u0430\u043F\u0440\u043E\u0441. \u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u043E\u0437\u0432\u0443\u0447\u0438\u0432\u0430\u043D\u0438\u044F \u043D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E: media_player \u043D\u0435 \u043E\u0442\u0434\u0430\u0451\u0442 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 TTS." };
    } finally {
      this.pending.delete(entity);
    }
  }
  async stationCommand(request, p) {
    const d = p.devices.find((d2) => d2.id === "station"), b = p.bindings.station, action = request.id.slice(8);
    if (d?.type !== "station" || d.status !== "installed" || !b?.verified || !/^media_player\.[a-z0-9_]+$/.test(b.entityId)) throw new Error("\u0421\u0442\u0430\u043D\u0446\u0438\u044F \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u0438\u043B\u0438 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u0430.");
    if (action === "volume") {
      if (!Number.isInteger(request.value) || request.value < 0 || request.value > 100) throw new Error("\u0413\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u044C \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u043E\u0442 0 \u0434\u043E 100.");
    } else if (!["playing", "next", "previous"].includes(action) || typeof request.value !== "boolean" || ["next", "previous"].includes(action) && request.value !== true) throw new Error("\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u0441\u0442\u0430\u043D\u0446\u0438\u0438 \u0437\u0430\u043F\u0440\u0435\u0449\u0435\u043D\u0430.");
    const entity = b.entityId;
    if (this.pending.has(entity)) throw new Error("\u0421\u0442\u0430\u043D\u0446\u0438\u044F \u0437\u0430\u043D\u044F\u0442\u0430 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0439 \u043A\u043E\u043C\u0430\u043D\u0434\u043E\u0439.");
    this.pending.add(entity);
    try {
      const before = await this.request("/api/states/" + entity);
      if (!stationSupports(before, action, request.value)) throw new Error("\u0424\u0443\u043D\u043A\u0446\u0438\u044F \u0441\u0442\u0430\u043D\u0446\u0438\u0438 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0438\u043B\u0438 \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0435\u0439.");
      const skip = ["next", "previous"].includes(action);
      const target = skip ? (e) => !!(e.attributes?.media_title && e.attributes.media_title !== before.attributes?.media_title || e.attributes?.media_artist && e.attributes.media_artist !== before.attributes?.media_artist || Number.isFinite(e.attributes?.media_position) && Number.isFinite(before.attributes?.media_position) && e.attributes.media_position < before.attributes.media_position - 2) : action === "volume" ? (e) => Number.isFinite(e.attributes?.volume_level) && Math.abs(e.attributes.volume_level - request.value / 100) <= 0.015 : (e) => e.state === (request.value ? "playing" : "paused");
      if (!skip && target(before)) return { id: request.id, value: request.value, confirmedAt: Date.now() };
      const service = skip ? action === "next" ? "media_next_track" : "media_previous_track" : action === "volume" ? "volume_set" : request.value ? "media_play" : "media_pause";
      await this.request("/api/services/media_player/" + service, { entity_id: entity, ...action === "volume" ? { volume_level: request.value / 100 } : {} });
      const deadline = Date.now() + 1e4;
      do {
        if (target(await this.request("/api/states/" + entity))) return { id: request.id, value: request.value, confirmedAt: Date.now() };
        await new Promise((r) => setTimeout(r, 350));
      } while (Date.now() < deadline);
      throw new Error("\u0421\u0442\u0430\u043D\u0446\u0438\u044F \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B\u0430 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435. \u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043C\u043E\u0433\u043B\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C\u0441\u044F; \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043F\u043E\u0432\u0442\u043E\u0440\u0430 \u043D\u0435\u0442.");
    } finally {
      this.pending.delete(entity);
    }
  }
};

// server/stream.js
import WebSocket2 from "ws";
import { randomBytes } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
var assetPattern = /^(?:master_playlist\.m3u8|playlist\.m3u8|init\.mp4|segment\/\d+(?:\.\d+)?\.m4s)$/;
var CameraStreams = class {
  constructor(ha2) {
    this.ha = ha2;
    this.sessions = /* @__PURE__ */ new Map();
  }
  prune() {
    for (const [key, s] of this.sessions) if (s.expires < Date.now()) this.close(key);
  }
  close(key) {
    const s = this.sessions.get(key);
    if (s) for (const c of s.pending) c.abort();
    this.sessions.delete(key);
  }
  async start(id, preferences, owner) {
    this.prune();
    const entity = this.ha.cameraEntity(id, preferences);
    if (this.sessions.size >= 12) throw new Error("\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0445 \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u043E\u0432. \u0417\u0430\u043A\u0440\u043E\u0439 \u0434\u0440\u0443\u0433\u043E\u0435 \u043E\u043A\u043D\u043E \u043A\u0430\u043C\u0435\u0440\u044B.");
    const url = await this.streamURL(entity);
    const match = /^\/api\/hls\/([a-f0-9]+)\/master_playlist\.m3u8$/.exec(url);
    if (!match) throw new Error("Home Assistant \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u044B\u0439 \u0430\u0434\u0440\u0435\u0441 HLS.");
    const key = randomBytes(24).toString("hex");
    this.sessions.set(key, { owner, id, entity, token: match[1], expires: Date.now() + 9e4, pending: /* @__PURE__ */ new Set() });
    return { key, url: `ha/stream/${key}/master_playlist.m3u8` };
  }
  streamURL(entity) {
    const endpoint = new URL(this.ha.url);
    endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
    endpoint.pathname = endpoint.hostname === "supervisor" ? "/core/websocket" : endpoint.pathname.replace(/\/$/, "") + "/api/websocket";
    return new Promise((resolve2, reject) => {
      let settled = false;
      const ws = new WebSocket2(endpoint, { headers: { Authorization: `Bearer ${this.ha.token}` }, maxPayload: 1024 * 1024, followRedirects: false });
      const finish = (error, url) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ws.close();
        error ? reject(error) : resolve2(url);
      };
      const timer = setTimeout(() => {
        finish(new Error("Home Assistant \u043D\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u043B \u043F\u043E\u0442\u043E\u043A \u0437\u0430 25 \u0441\u0435\u043A\u0443\u043D\u0434. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0432\u0438\u0434\u0435\u043E \u0432 HA."));
        ws.terminate();
      }, 25e3);
      ws.on("error", () => finish(new Error("\u041D\u0435\u0442 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u0441 \u0432\u0438\u0434\u0435\u043E API Home Assistant.")));
      ws.on("close", () => {
        if (!settled) finish(new Error("\u0421\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0441 \u0432\u0438\u0434\u0435\u043E API Home Assistant \u0437\u0430\u043A\u0440\u044B\u0442\u043E."));
      });
      ws.on("message", (bytes) => {
        try {
          const message = JSON.parse(bytes.toString());
          if (message.type === "auth_required") ws.send(JSON.stringify({ type: "auth", access_token: this.ha.token }));
          else if (message.type === "auth_invalid") finish(new Error("Home Assistant \u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u044E \u0432\u0438\u0434\u0435\u043E."));
          else if (message.type === "auth_ok") ws.send(JSON.stringify({ id: 1, type: "camera/stream", entity_id: entity, format: "hls" }));
          else if (message.type === "result" && message.id === 1) {
            if (message.success && typeof message.result?.url === "string") finish(null, message.result.url);
            else finish(new Error("\u041A\u0430\u043C\u0435\u0440\u0430 \u043D\u0435 \u043E\u0442\u0434\u0430\u043B\u0430 HLS-\u043F\u043E\u0442\u043E\u043A. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0432\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0435 \u044D\u0442\u043E\u0439 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0438 \u0432 Home Assistant \u0438 \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044E Stream."));
          }
        } catch {
          finish(new Error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442 \u0432\u0438\u0434\u0435\u043E API Home Assistant."));
        }
      });
    });
  }
  get(key, owner, p) {
    this.prune();
    const s = this.sessions.get(key);
    if (!s || s.owner !== owner) throw new Error("\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D. \u041E\u0442\u043A\u0440\u043E\u0439 \u043A\u0430\u043C\u0435\u0440\u0443 \u0437\u0430\u043D\u043E\u0432\u043E.");
    if (this.ha.cameraEntity(s.id, p) !== s.entity) {
      this.close(key);
      throw new Error("\u041F\u0440\u0438\u0432\u044F\u0437\u043A\u0430 \u043A\u0430\u043C\u0435\u0440\u044B \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0430\u0441\u044C. \u041E\u0442\u043A\u0440\u043E\u0439 \u0435\u0451 \u0437\u0430\u043D\u043E\u0432\u043E.");
    }
    s.expires = Date.now() + 9e4;
    return s;
  }
  async proxy(key, asset, query, owner, p, req, res) {
    if (!assetPattern.test(asset)) throw new Error("\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u0444\u0430\u0439\u043B \u043F\u043E\u0442\u043E\u043A\u0430.");
    const s = this.get(key, owner, p), params = new URLSearchParams();
    for (const [name, value] of query) {
      if (!["_HLS_msn", "_HLS_part", "_HLS_skip"].includes(name) || !(/^\d{1,12}$/.test(value) || name === "_HLS_skip" && ["YES", "v2"].includes(value))) throw new Error("\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 \u043F\u043E\u0442\u043E\u043A\u0430.");
      params.set(name, value);
    }
    const controller = new AbortController();
    s.pending.add(controller);
    const abort = () => controller.abort(), timer = setTimeout(abort, 3e4);
    res.once("close", abort);
    try {
      const upstream = await fetch(`${this.ha.url}/api/hls/${s.token}/${asset}${params.size ? "?" + params : ""}`, {
        headers: { Authorization: `Bearer ${this.ha.token}` },
        redirect: "error",
        signal: controller.signal
      });
      if (!upstream.ok) {
        await upstream.body?.cancel();
        throw new Error(`\u041F\u043E\u0442\u043E\u043A Home Assistant \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D (${upstream.status}).`);
      }
      const playlist = asset.endsWith(".m3u8"), limit = playlist ? 512 * 1024 : 24 * 1024 * 1024;
      if (!playlist) {
        let size2 = 0;
        const bounded = new Transform({ transform(chunk, encoding, callback) {
          size2 += chunk.length;
          callback(size2 > limit ? new Error("\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442 \u0432\u0438\u0434\u0435\u043E.") : null, chunk);
        } });
        res.writeHead(200, { "Content-Type": asset === "init.mp4" ? "video/mp4" : "video/iso.segment", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
        await pipeline(Readable.fromWeb(upstream.body), bounded, res, { signal: controller.signal });
        return;
      }
      const reader = upstream.body.getReader(), parts = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > limit) throw new Error("\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442 \u0432\u0438\u0434\u0435\u043E.");
          parts.push(Buffer.from(value));
        }
      } finally {
        await reader.cancel();
      }
      let bytes = Buffer.concat(parts);
      if (playlist) {
        const text = bytes.toString("utf8");
        if (!text.startsWith("#EXTM3U")) throw new Error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 HLS-\u043F\u043B\u0435\u0439\u043B\u0438\u0441\u0442.");
        const rewrite = (value) => {
          const u = new URL(value, `http://stream/api/hls/${s.token}/${asset}`);
          const prefix = `/api/hls/${s.token}/`, relative = u.pathname.slice(prefix.length);
          if (u.origin !== "http://stream" || !u.pathname.startsWith(prefix) || !assetPattern.test(relative) || u.search || u.hash) throw new Error("\u041D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u044B\u0439 \u0440\u0435\u0441\u0443\u0440\u0441 HLS.");
          return `/api/panel/ha/stream/${key}/${relative}`;
        };
        bytes = Buffer.from(text.split("\n").map((line) => line.startsWith("#") ? line.replace(/URI="([^"]+)"/g, (_, value) => `URI="${rewrite(value)}"`) : line.trim() ? rewrite(line.trim()) : line).join("\n"));
      }
      if (!res.destroyed) {
        res.writeHead(200, { "Content-Type": playlist ? "application/vnd.apple.mpegurl" : asset === "init.mp4" ? "video/mp4" : "video/iso.segment", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
        res.end(bytes);
      }
    } finally {
      clearTimeout(timer);
      res.removeListener("close", abort);
      s.pending.delete(controller);
    }
  }
};

// server/rtc.js
import WebSocket3 from "ws";
import { randomBytes as randomBytes2 } from "node:crypto";
function candidate(value) {
  if (!value || typeof value.candidate !== "string" || value.candidate.length > 4096) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 ICE-\u043A\u0430\u043D\u0434\u0438\u0434\u0430\u0442.");
  const result = { candidate: value.candidate };
  if (value.sdpMid != null) {
    if (typeof value.sdpMid !== "string" || value.sdpMid.length > 64) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 ICE mid.");
    result.sdpMid = value.sdpMid;
  }
  if (value.sdpMLineIndex != null) {
    if (!Number.isInteger(value.sdpMLineIndex) || value.sdpMLineIndex < 0 || value.sdpMLineIndex > 32) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 ICE index.");
    result.sdpMLineIndex = value.sdpMLineIndex;
  }
  if (value.usernameFragment != null && typeof value.usernameFragment === "string" && value.usernameFragment.length <= 256) result.usernameFragment = value.usernameFragment;
  return result;
}
function clientConfig(raw) {
  const c = raw?.configuration || {}, configuration = {};
  if (Array.isArray(c.iceServers)) {
    configuration.iceServers = c.iceServers.slice(0, 12).map((server2) => {
      const urls = (Array.isArray(server2.urls) ? server2.urls : [server2.urls]).filter((u) => typeof u === "string" && /^(stun|stuns|turn|turns):[^@\s]+$/.test(u) && u.length < 2048);
      if (!urls.length) throw new Error("\u041D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u0430\u044F \u043A\u043E\u043D\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044F ICE.");
      const out2 = { urls };
      for (const key of ["username", "credential"]) if (typeof server2[key] === "string" && server2[key].length <= 4096) out2[key] = server2[key];
      return out2;
    });
  }
  for (const [key, values] of Object.entries({ iceTransportPolicy: ["all", "relay"], bundlePolicy: ["balanced", "max-compat", "max-bundle"], rtcpMuxPolicy: ["require"] })) if (values.includes(c[key])) configuration[key] = c[key];
  const out = { configuration };
  if (typeof raw?.dataChannel === "string" && raw.dataChannel.length <= 128) out.dataChannel = raw.dataChannel;
  return out;
}
var CameraRTC = class {
  constructor(ha2) {
    this.ha = ha2;
    this.sessions = /* @__PURE__ */ new Map();
  }
  prune() {
    for (const [key, s] of this.sessions) if (s.expires < Date.now()) this.close(key);
  }
  close(key) {
    const s = this.sessions.get(key);
    if (!s) return;
    this.sessions.delete(key);
    s.closed = true;
    for (const pending of s.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D."));
    }
    s.pending.clear();
    if (s.ws.readyState === WebSocket3.OPEN) s.ws.close();
    else s.ws.terminate();
  }
  get(key, owner, p) {
    this.prune();
    const s = this.sessions.get(key);
    if (!s || s.owner !== owner) throw new Error("WebRTC-\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D.");
    if (this.ha.cameraEntity(s.id, p) !== s.entity) {
      this.close(key);
      throw new Error("\u041F\u0440\u0438\u0432\u044F\u0437\u043A\u0430 \u043A\u0430\u043C\u0435\u0440\u044B \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0430\u0441\u044C.");
    }
    s.expires = Date.now() + 9e4;
    return s;
  }
  push(s, event) {
    if (s.closed) return;
    if (s.events.length >= 128) {
      s.events.shift();
    }
    s.events.push({ seq: ++s.seq, ...event });
  }
  call(s, type, fields = {}) {
    if (s.closed || s.ws.readyState !== WebSocket3.OPEN) return Promise.reject(new Error("\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438 \u0441 \u0432\u0438\u0434\u0435\u043E API HA."));
    const id = ++s.counter;
    return new Promise((resolve2, reject) => {
      const timer = setTimeout(() => {
        s.pending.delete(id);
        reject(new Error("\u0412\u0438\u0434\u0435\u043E API HA \u043D\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u043B \u0437\u0430 12 \u0441\u0435\u043A\u0443\u043D\u0434."));
      }, 12e3);
      s.pending.set(id, { resolve: resolve2, reject, timer });
      s.ws.send(JSON.stringify({ id, type, ...fields }));
    });
  }
  async start(id, p, owner) {
    this.prune();
    const entity = this.ha.cameraEntity(id, p);
    if (this.sessions.size >= 6) throw new Error("\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E WebRTC-\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u043E\u0432.");
    const endpoint = new URL(this.ha.url);
    endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
    endpoint.pathname = endpoint.hostname === "supervisor" ? "/core/websocket" : endpoint.pathname.replace(/\/$/, "") + "/api/websocket";
    const key = randomBytes2(24).toString("hex");
    const ws = new WebSocket3(endpoint, { headers: { Authorization: `Bearer ${this.ha.token}` }, maxPayload: 256 * 1024, followRedirects: false });
    const s = { key, owner, id, entity, ws, expires: Date.now() + 9e4, counter: 0, pending: /* @__PURE__ */ new Map(), events: [], seq: 0, closed: false, offered: false, subscription: null, sessionId: null, candidates: 0 };
    this.sessions.set(key, s);
    try {
      await new Promise((resolve2, reject) => {
        const timer = setTimeout(() => reject(new Error("\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438 \u0441 WebRTC API HA.")), 12e3);
        const done = (error) => {
          clearTimeout(timer);
          error ? reject(error) : resolve2();
        };
        ws.on("message", (bytes) => {
          try {
            const m = JSON.parse(bytes.toString());
            if (m.type === "auth_required") ws.send(JSON.stringify({ type: "auth", access_token: this.ha.token }));
            else if (m.type === "auth_invalid") done(new Error("HA \u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u044E WebRTC."));
            else if (m.type === "auth_ok") done();
            else if (m.type === "result") {
              const request = s.pending.get(m.id);
              if (request) {
                s.pending.delete(m.id);
                clearTimeout(request.timer);
                m.success ? request.resolve(m.result) : request.reject(new Error("HA \u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B \u0437\u0430\u043F\u0440\u043E\u0441 WebRTC."));
              }
            } else if (m.type === "event" && m.id === s.subscription) {
              const e = m.event;
              if (e?.type === "session" && typeof e.session_id === "string" && e.session_id.length <= 256) {
                s.sessionId = e.session_id;
                this.push(s, { type: "session" });
              } else if (e?.type === "answer" && typeof e.answer === "string" && e.answer.startsWith("v=0") && e.answer.length <= 131072) this.push(s, { type: "answer", answer: e.answer });
              else if (e?.type === "candidate") this.push(s, { type: "candidate", candidate: candidate(e.candidate) });
              else if (e?.type === "error") this.push(s, { type: "error", message: "Home Assistant \u043D\u0435 \u0441\u043C\u043E\u0433 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C WebRTC-\u043F\u043E\u0442\u043E\u043A." });
            }
          } catch {
            this.push(s, { type: "error", message: "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442 \u0432\u0438\u0434\u0435\u043E API HA." });
          }
        });
        ws.on("error", () => done(new Error("\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438 \u0441 WebRTC API HA.")));
        ws.on("close", () => {
          done(new Error("\u0421\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 WebRTC \u0441 HA \u0437\u0430\u043A\u0440\u044B\u0442\u043E."));
          if (!s.closed) {
            for (const request of s.pending.values()) {
              clearTimeout(request.timer);
              request.reject(new Error("\u0421\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 WebRTC \u0441 HA \u0437\u0430\u043A\u0440\u044B\u0442\u043E."));
            }
            s.pending.clear();
            this.push(s, { type: "error", message: "\u0421\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0432\u0438\u0434\u0435\u043E API HA \u0437\u0430\u043A\u0440\u044B\u0442\u043E." });
          }
        });
      });
      const caps = await this.call(s, "camera/capabilities", { entity_id: entity });
      if (!caps?.frontend_stream_types?.includes("web_rtc")) throw new Error("\u042D\u0442\u0430 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C HA \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 WebRTC.");
      const config = clientConfig(await this.call(s, "camera/webrtc/get_client_config", { entity_id: entity }));
      return { key, ...config };
    } catch (error) {
      this.close(key);
      throw error;
    }
  }
  async offer(key, owner, p, offer) {
    const s = this.get(key, owner, p);
    if (s.offered) throw new Error("WebRTC offer \u0443\u0436\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D.");
    if (typeof offer !== "string" || !offer.startsWith("v=0") || offer.length > 131072) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 WebRTC offer.");
    s.offered = true;
    s.subscription = s.counter + 1;
    await this.call(s, "camera/webrtc/offer", { entity_id: s.entity, offer });
    return { accepted: true };
  }
  async addCandidate(key, owner, p, value) {
    const s = this.get(key, owner, p), c = candidate(value);
    if (!s.sessionId) throw new Error("ICE-\u0441\u0435\u0441\u0441\u0438\u044F \u0435\u0449\u0451 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0430.");
    if (++s.candidates > 128) throw new Error("\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E ICE-\u043A\u0430\u043D\u0434\u0438\u0434\u0430\u0442\u043E\u0432.");
    await this.call(s, "camera/webrtc/candidate", { entity_id: s.entity, session_id: s.sessionId, candidate: c });
    return { accepted: true };
  }
  events(key, owner, p, after) {
    if (!Number.isSafeInteger(after) || after < 0) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043A\u0443\u0440\u0441\u043E\u0440 WebRTC.");
    const s = this.get(key, owner, p);
    if (after > s.seq || s.events.length && after < s.events[0].seq - 1) throw new Error("WebRTC-\u0441\u0438\u0433\u043D\u0430\u043B\u044B \u0443\u0441\u0442\u0430\u0440\u0435\u043B\u0438. \u041E\u0442\u043A\u0440\u043E\u0439 \u043A\u0430\u043C\u0435\u0440\u0443 \u0437\u0430\u043D\u043E\u0432\u043E.");
    return { events: s.events.filter((e) => e.seq > after), cursor: s.seq };
  }
};

// server/journal.js
var MAX_JOURNAL = 50;
var journalBuf = [];
function journal(text, level = "info") {
  journalBuf.push({ at: Date.now(), level: level === "warn" ? "warn" : "info", text: String(text).slice(0, 200) });
  if (journalBuf.length > MAX_JOURNAL) journalBuf.shift();
}
function journalList() {
  return [...journalBuf].reverse();
}

// server/live-stream.js
var LiveFeed = class {
  constructor({ ha: ha2 }) {
    this.ha = ha2;
    this.clients = /* @__PURE__ */ new Set();
    this.last = /* @__PURE__ */ new Map();
    this.states = [];
    this.timer = null;
    this.hb = null;
    this.lastError = null;
    this.lastLatencyMs = null;
    if (ha2.enabled) {
      this.poll();
      this.timer = setInterval(() => this.poll(), 5e3);
      this.timer.unref();
      this.hb = setInterval(() => this.tick(), 15e3);
      this.hb.unref();
    }
  }
  send(client, event, data2) {
    if (client.res.destroyed || client.res.writableEnded) return this.clients.delete(client);
    try {
      client.res.write(`event: ${event}
data: ${data2}

`);
    } catch {
      this.clients.delete(client);
    }
  }
  broadcast(event, data2) {
    for (const client of [...this.clients]) this.send(client, event, data2);
  }
  async poll() {
    if (!this.ha.enabled) return;
    let states;
    const started = Date.now();
    try {
      states = await this.ha.states();
    } catch (error) {
      this.lastError = error.message;
      if (!this.journaled) {
        this.journaled = true;
        journal("\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438 \u0441 Home Assistant: " + error.message, "warn");
      }
      this.broadcast("error", JSON.stringify({ message: error.message }));
      return;
    }
    this.journaled = false;
    this.lastError = null;
    this.lastLatencyMs = Date.now() - started;
    const next = new Map(states.map((e) => [e.entity_id, JSON.stringify(e)]));
    const changed = states.filter((e) => this.last.get(e.entity_id) !== next.get(e.entity_id));
    this.last = next;
    this.states = states;
    if (changed.length) this.broadcast("patch", JSON.stringify(changed));
  }
  subscribe(res) {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
    const client = { res };
    this.clients.add(client);
    if (!res.writableEnded) res.write(`event: snapshot
data: ${JSON.stringify({ states: this.states })}

`);
    res.on("close", () => this.clients.delete(client));
    return client;
  }
  tick() {
    for (const client of [...this.clients]) {
      try {
        client.res.write(":hb\n\n");
      } catch {
        this.clients.delete(client);
      }
    }
  }
  stop() {
    clearInterval(this.timer);
    clearInterval(this.hb);
    this.timer = this.hb = null;
    this.clients.clear();
  }
};

// server/yard-motion.js
var import_jpeg_js = __toESM(require_jpeg_js());
var GRID_W = 32;
var GRID_H = 18;
var THROTTLE = 3e3;
var DEFAULT_THRESHOLD = 6;
var YardMotion = class {
  constructor({ ha: ha2, cameraId = null, threshold = DEFAULT_THRESHOLD } = {}) {
    this.ha = ha2;
    this.cameraId = cameraId;
    this.threshold = threshold;
    this.prev = null;
    this.lastMotionAt = 0;
    this.lastCheck = 0;
    this.cache = null;
    this.busy = false;
  }
  // Средняя яркость по блокам: data — RGBA-массив декодированного JPEG.
  grid(data2, width, height) {
    const g = new Float32Array(GRID_W * GRID_H), bw = width / GRID_W, bh = height / GRID_H;
    for (let gy = 0; gy < GRID_H; gy++) for (let gx = 0; gx < GRID_W; gx++) {
      let sum = 0, count = 0;
      const x0 = Math.floor(gx * bw), x1 = Math.max(x0 + 1, Math.min(width, Math.floor((gx + 1) * bw))), y0 = Math.floor(gy * bh), y1 = Math.max(y0 + 1, Math.min(height, Math.floor((gy + 1) * bh)));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        sum += 0.299 * data2[i] + 0.587 * data2[i + 1] + 0.114 * data2[i + 2];
        count++;
      }
      g[gy * GRID_W + gx] = count ? sum / count : 0;
    }
    return g;
  }
  diff(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s / a.length;
  }
  result(available, motion, score) {
    return { available, motion, lastMotionAt: this.lastMotionAt || null, score };
  }
  // Событие от внешнего детектора (ONVIF): тот же путь, что и jpeg-дифф —
  // общий lastMotionAt и общий троттлинг через cache, без дублирования логики.
  externalMotion(at = Date.now()) {
    this.lastMotionAt = at;
    this.cache = { available: true, motion: true, lastMotionAt: at, score: this.cache?.score ?? 0 };
    this.lastCheck = Date.now();
  }
  // entityId разрешается на каждый вызов (маршрут тянет его из активного профиля);
  // null/ошибка HA → available:false, без исключений наружу.
  async check(entityId = this.cameraId) {
    if (this.busy) return this.cache || this.result(false, false, 0);
    const now = Date.now();
    if (this.cache && now - this.lastCheck < THROTTLE) return this.cache;
    if (!entityId || !this.ha?.enabled) return this.result(false, false, 0);
    this.busy = true;
    try {
      if (this.cache && Date.now() - this.lastCheck < THROTTLE) return this.cache;
      let raw = null;
      try {
        raw = await this.ha.requestRaw("/api/camera_proxy/" + entityId + "?width=320&height=180");
      } catch {
        raw = null;
      }
      if (!raw || raw.type !== "image/jpeg" || !raw.bytes?.length) {
        this.lastCheck = Date.now();
        return this.cache = this.result(false, false, 0);
      }
      let frame;
      try {
        frame = import_jpeg_js.default.decode(raw.bytes, { useTArray: true });
      } catch {
        this.lastCheck = Date.now();
        return this.cache = this.result(false, false, 0);
      }
      if (!frame?.data || !(frame.width > 0)) {
        this.lastCheck = Date.now();
        return this.cache = this.result(false, false, 0);
      }
      const g = this.grid(frame.data, frame.width, frame.height);
      const score = this.prev ? this.diff(this.prev, g) : 0;
      this.prev = g;
      const motion = score > this.threshold;
      if (motion) this.lastMotionAt = Date.now();
      this.lastCheck = Date.now();
      return this.cache = { available: true, motion, lastMotionAt: this.lastMotionAt || null, score: Math.round(score * 10) / 10 };
    } finally {
      this.busy = false;
    }
  }
};

// server/yard-onvif.js
import { createHash, randomBytes as randomBytes3 } from "node:crypto";
var WSSE = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd";
var WSU = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd";
var DIGEST_DEFAULTS = {
  pullIntervalMs: 1e3,
  responseTimeoutMs: 6e3,
  renewIntervalMs: 2 * 60 * 1e3,
  retryLimit: 3,
  restartPausesMs: [5e3, 15e3, 6e4],
  motionThrottleMs: 2e3
};
var enc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function usernameTokenEnvelope(user, pass, bodyXml, created, nonceB64) {
  const raw = Buffer.from(nonceB64, "base64");
  const digest = createHash("sha1").update(Buffer.concat([raw, Buffer.from(created, "utf8"), Buffer.from(pass, "utf8")])).digest("base64");
  return `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:wsse="${WSSE}" xmlns:wsu="${WSU}"><s:Header><wsse:Security s:mustUnderstand="1"><wsse:UsernameToken><wsse:Username>${enc(user)}</wsse:Username><wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</wsse:Password><wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonceB64}</wsse:Nonce><wsu:Created>${created}</wsu:Created></wsse:UsernameToken></wsse:Security></s:Header><s:Body>${bodyXml}</s:Body></s:Envelope>`;
}
async function soapPost(url, bodyXml, { user, pass }, timeoutMs = 5e3, { created, nonce } = {}) {
  const body2 = usernameTokenEnvelope(user, pass, bodyXml, created || (/* @__PURE__ */ new Date()).toISOString(), nonce || randomBytes3(16).toString("base64"));
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", signal: ctrl.signal, headers: {
      "Content-Type": "application/soap+xml; charset=utf-8",
      "Content-Length": String(Buffer.byteLength(body2))
    }, body: body2 });
    const text = await res.text();
    if (!res.ok) throw new Error(`SOAP ${res.status} ${url}: ${text.slice(0, 200)}`);
    if (/:Fault[\s>]|<Fault[\s>]/.test(text.slice(0, 4e3))) throw new Error(`SOAP Fault: ${text.replace(/\s+/g, " ").slice(0, 300)}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}
async function probeDeviceTime(url, creds, timeoutMs) {
  const body2 = '<tds:GetSystemDateAndTime xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>';
  const text = await soapPost(url, body2, creds, timeoutMs);
  const tag = text.match(/<[\w:.-]*UTCDateTime[\s\S]{0,400}?<\/[\w:.-]*UTCDateTime>/)?.[0];
  let offset = 0;
  if (tag) {
    const num = (k) => Number(tag.match(new RegExp(`<[^>]*:${k}>(-?\\d+)</`))?.[1] ?? NaN);
    const h = num("Hour"), m = num("Minute"), s = num("Second"), y = num("Year"), mo = num("Month"), d = num("Day");
    if ([h, m, s, y, mo, d].every(Number.isFinite)) {
      const cam = new Date(Date.UTC(y, mo - 1, d, h, m, s, 0)).getTime();
      const local = new Date(Date.UTC(
        (/* @__PURE__ */ new Date()).getUTCFullYear(),
        (/* @__PURE__ */ new Date()).getUTCMonth(),
        (/* @__PURE__ */ new Date()).getUTCDate(),
        (/* @__PURE__ */ new Date()).getUTCHours(),
        (/* @__PURE__ */ new Date()).getUTCMinutes(),
        (/* @__PURE__ */ new Date()).getUTCSeconds(),
        0
      )).getTime();
      offset = cam - local;
    }
  }
  return { offset };
}
function onvifSnapshots({ host, port: port2 = 2020, user, pass, timeoutMs = 5e3, log = () => {
} } = {}) {
  const mediaService = `http://${host}:${port2}/onvif/media_service`;
  let snapUri = null, snapAt = 0;
  const getSnapshot = async () => {
    const now = Date.now();
    if (!snapUri || now - snapAt > 5 * 60 * 1e3) {
      snapUri = null;
      let last = null;
      for (const token of ["Profile_1", "profile_1", "1"]) {
        try {
          const text = await soapPost(
            mediaService,
            `<trt:GetSnapshotUri xmlns:trt="http://www.onvif.org/ver10/media/wsdl"><trt:ProfileToken>${token}</trt:ProfileToken></trt:GetSnapshotUri>`,
            { user, pass },
            timeoutMs
          );
          const uri = text.match(/<[^>]*Uri[^>]*>(https?:\/\/[^<]+)<\/[^>]*Uri>/)?.[1];
          if (uri) {
            snapUri = uri;
            snapAt = now;
            log("snapshot uri", uri);
            break;
          }
          last = new Error("Snapshot URI not found in GetSnapshotUri response");
        } catch (e) {
          last = e;
        }
      }
      if (!snapUri) throw last || new Error("GetSnapshotUri failed for all profile tokens");
    }
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      let res = await fetch(snapUri, { signal: ctrl.signal });
      if (res.status === 401) {
        res = await fetch(snapUri, {
          signal: ctrl.signal,
          headers: { Authorization: "Basic " + Buffer.from(user + ":" + pass).toString("base64") }
        });
      }
      if (!res.ok) throw new Error("Snapshot HTTP " + res.status + " " + snapUri);
      return { type: "image/jpeg", bytes: Buffer.from(await res.arrayBuffer()) };
    } finally {
      clearTimeout(timer);
    }
  };
  return { getSnapshot };
}
function onvifWatch({ host, port: port2 = 2020, user, pass, onMotion, onError, onReady, log = () => {
}, ...timing } = {}) {
  const t = { ...DIGEST_DEFAULTS, ...timing };
  let stopped = false, restarts = 0, pullFailures = 0;
  let status = { alive: false, eventService: null, subscription: null, lastMotionAt: 0, lastError: null };
  const state = () => ({ ...status, alive: !stopped && status.alive, restarts });
  const controller = { status: state, stop: () => {
    stopped = true;
    status = { ...status, alive: false };
  } };
  const fail = (error) => {
    status = { ...status, alive: false, lastError: String(error?.message || error).slice(0, 300) };
    onError?.(error);
  };
  (async () => {
    const base = `http://${host}:${port2}`;
    let deviceService = base + "/onvif/device_service";
    while (!stopped) {
      let pullPoint = null, offset = 0;
      try {
        ({ offset } = await probeDeviceTime(deviceService, { user, pass }, t.responseTimeoutMs));
        const creds = { user, pass }, opts = () => ({ created: new Date(Date.now() + offset).toISOString() });
        const caps = await soapPost(
          deviceService,
          '<tds:GetCapabilities xmlns:tds="http://www.onvif.org/ver10/device/wsdl"><tds:Category>Device</tds:Category></tds:GetCapabilities>',
          creds,
          t.responseTimeoutMs,
          opts()
        );
        const eventAddr = caps.match(/EventXAddr[^>]*>([^<]+)</)?.[1] || caps.match(/<[^>]*Events[^>]*>[\s\S]{0,600}?<[^>]*XAddr[^>]*>(https?:\/\/[^<]+)</)?.[1];
        if (eventAddr) deviceService = eventAddr;
        status = { ...status, eventService: deviceService };
        const sub = await soapPost(
          deviceService,
          '<tev:CreatePullPointSubscription xmlns:tev="http://www.onvif.org/ver10/events/wsdl"/>',
          creds,
          t.responseTimeoutMs,
          opts()
        );
        pullPoint = sub.match(/SubscriptionReference[\s\S]{0,800}?Address[^>]*>([^<]+)</)?.[1] || sub.match(/https?:\/\/[^<\s"]+/)?.[0];
        if (!pullPoint) throw new Error("PullPoint address not found in CreatePullPointSubscription response");
        status = { ...status, subscription: pullPoint, alive: true, lastError: null };
        pullFailures = 0;
        restarts = 0;
        onReady?.({ eventService: deviceService, subscription: pullPoint });
        let lastMotion = 0, lastRenew = Date.now();
        while (!stopped) {
          let text = null, error = null;
          try {
            text = await soapPost(
              pullPoint,
              '<tev:PullMessages xmlns:tev="http://www.onvif.org/ver10/events/wsdl"><tev:Timeout>PT5S</tev:Timeout><tev:MessageLimit>10</tev:MessageLimit></tev:PullMessages>',
              creds,
              t.responseTimeoutMs,
              opts()
            );
          } catch (e) {
            error = e;
          }
          if (stopped) break;
          if (error) {
            pullFailures++;
            status = { ...status, lastError: String(error?.message || error).slice(0, 300) };
            log("pull failure", pullFailures, error?.message);
            if (pullFailures >= t.retryLimit) {
              fail(error);
              break;
            }
            await sleep(Math.min(1e3, t.responseTimeoutMs));
            continue;
          }
          pullFailures = 0;
          if (status.lastError) status = { ...status, lastError: null };
          if (/MotionDetected|MotionAlarm/.test(text) || /IsMotion[^>]*>\s*(true|1)\s*</i.test(text)) {
            const now = Date.now();
            status = { ...status, lastMotionAt: now };
            if (now - lastMotion >= t.motionThrottleMs) {
              lastMotion = now;
              onMotion?.();
            }
          }
          if (Date.now() - lastRenew >= t.renewIntervalMs) {
            lastRenew = Date.now();
            try {
              await soapPost(
                pullPoint,
                '<tev:Renew xmlns:tev="http://www.onvif.org/ver10/events/wsdl"><tev:TerminationTime>PT5M</tev:TerminationTime></tev:Renew>',
                creds,
                t.responseTimeoutMs,
                opts()
              );
            } catch (e) {
              status = { ...status, lastError: "renew: " + String(e?.message || e).slice(0, 250) };
            }
          }
          await sleep(t.pullIntervalMs);
        }
      } catch (error) {
        fail(error);
      }
      if (pullPoint) await unsubscribe(pullPoint, { user, pass }, t);
      if (stopped) break;
      const pause = t.restartPausesMs[Math.min(restarts, t.restartPausesMs.length - 1)];
      restarts++;
      log("restart", restarts, "pause", pause);
      for (let waited = 0; waited < pause && !stopped; waited += 250) await sleep(Math.min(250, pause - waited));
    }
  })();
  return controller;
}
async function unsubscribe(pullPoint, creds, t) {
  try {
    await soapPost(pullPoint, '<tev:Unsubscribe xmlns:tev="http://www.onvif.org/ver10/events/wsdl"/>', creds, t.responseTimeoutMs, {});
  } catch {
  }
}
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// server/yard-clips.js
var import_jpeg_js2 = __toESM(require_jpeg_js());
var RING = 3;
var TICK_MS = 8e3;
var DEDUP_MS = 15e3;
var POST_DELAYS = [3e3, 9e3];
var KEEP = 30;
var BLANK = import_jpeg_js2.default.encode({ data: Buffer.alloc(4, 255), width: 1, height: 1 }, 80).data.toString("base64");
var YardClips = class {
  constructor({ ha: ha2, db: db2, notify = null, getEntityId = () => null, yardOnvif = null } = {}) {
    this.ha = ha2;
    this.notify = notify;
    this.getEntityId = getEntityId;
    this.yardOnvif = yardOnvif;
    this.ring = [];
    this.timer = null;
    this.busy = false;
    this.lastClipAt = 0;
    db2.exec("CREATE TABLE IF NOT EXISTS yard_clips (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, source TEXT NOT NULL, frames BLOB NOT NULL);");
    this.insert = db2.prepare("INSERT INTO yard_clips(at,source,frames) VALUES(?,?,?)");
    this.prune = db2.prepare("DELETE FROM yard_clips WHERE id NOT IN (SELECT id FROM yard_clips ORDER BY at DESC, id DESC LIMIT ?)");
    this.byId = db2.prepare("SELECT * FROM yard_clips WHERE id=?");
    this.recent = db2.prepare("SELECT id,at,source,frames FROM yard_clips ORDER BY at DESC, id DESC LIMIT ?");
  }
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref();
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.capture();
    } catch {
    } finally {
      this.busy = false;
    }
  }
  // Один кадр камеры тем же путём, что yard-motion: base64 jpeg или null.
  async capture() {
    let raw = null;
    const onvif = this.yardOnvif?.();
    if (onvif?.getSnapshot) {
      try {
        raw = await onvif.getSnapshot();
      } catch {
      }
    }
    if (!raw || raw.type !== "image/jpeg" || !raw.bytes?.length) {
      const entityId = this.getEntityId();
      if (!entityId || !this.ha?.enabled) return null;
      try {
        raw = await this.ha.requestRaw("/api/camera_proxy/" + entityId + "?width=320&height=180");
      } catch {
        return null;
      }
    }
    if (!raw || raw.type !== "image/jpeg" || !raw.bytes?.length) return null;
    const b64 = Buffer.from(raw.bytes).toString("base64");
    if (this.ring.length && this.ring[this.ring.length - 1] === b64) return b64;
    this.ring.push(b64);
    if (this.ring.length > RING) this.ring = this.ring.slice(-RING);
    return b64;
  }
  // Событие движения → клип. Дедуп: <15с от последнего клипа — окно продлевается,
  // новый клип не создаётся. pre-кадры из кольца, пост-кадры через POST_DELAYS.
  async record({ at = Date.now(), source = "onvif", dedup = true, posts = true } = {}) {
    if (dedup && this.lastClipAt && at - this.lastClipAt < DEDUP_MS) {
      this.lastClipAt = at;
      return null;
    }
    this.lastClipAt = at;
    const frames = [...this.ring];
    if (!frames.length) {
      const f = await this.capture();
      if (f) frames.push(f);
    }
    if (!frames.length) frames.push(BLANK);
    if (posts) {
      for (const ms of POST_DELAYS) {
        const timer = setTimeout(async () => {
          try {
            const f = await this.capture();
            if (f) frames.push(f);
          } catch {
          }
        }, ms);
        timer.unref?.();
      }
      await new Promise((r) => setTimeout(r, Math.max(...POST_DELAYS) + 500));
    }
    const unique = [];
    for (const f of frames) if (!unique.length || unique[unique.length - 1] !== f) unique.push(f);
    const info = this.insert.run(at, source, Buffer.from(JSON.stringify(unique)));
    this.prune.run(KEEP);
    const result = { id: Number(info.lastInsertRowid), at, source, frameCount: unique.length };
    this.notify?.(result);
    return result;
  }
  // Тест-хук: клип сразу, без ожидания пост-кадров; дедуп по флагу.
  testCapture(opts = {}) {
    return this.record({ posts: false, ...opts });
  }
  list(limit = 20) {
    const n = Math.min(KEEP, Math.max(1, Number(limit) || 20));
    return this.recent.all(n).map(({ id, at, source, frames }) => ({ id, at, source, frameCount: JSON.parse(frames.toString("utf8")).length }));
  }
  frame(id, idx) {
    const row = this.byId.get(id);
    if (!row) return null;
    const frames = JSON.parse(row.frames.toString("utf8"));
    if (!Number.isInteger(idx) || idx < 0 || idx >= frames.length) return null;
    return Buffer.from(frames[idx], "base64");
  }
};

// src/dom.js
var PANEL_TIMEZONE = "Europe/Moscow";

// src/energy.js
var BAD = ["unavailable", "unknown", ""];
var meterValue = (e) => e && !BAD.includes(e.state) && Number.isFinite(Number(e.state)) ? Number(e.state) : null;
var READING_DATE = /^\d{4}-\d{2}-\d{2}$/;
var monthDelta = (currentValue, currentDate, readings) => {
  const date = READING_DATE.exec(String(currentDate ?? "")) && String(currentDate);
  const current = Number(currentValue);
  if (!date || !Number.isFinite(current)) return { prevValue: null, prevDate: null, delta: null };
  const prev = (Array.isArray(readings) ? readings : []).filter((r) => r && READING_DATE.test(String(r?.date)) && Number.isFinite(Number(r?.value)) && String(r.date) < date).sort((a, b) => a.date < b.date ? -1 : 1).at(-1);
  if (!prev) return { prevValue: null, prevDate: null, delta: null };
  const prevValue = Number(prev.value);
  return { prevValue, prevDate: String(prev.date), delta: current < prevValue ? null : Math.round((current - prevValue) * 10) / 10 };
};
var monthCost = (delta, tariff) => Number.isFinite(delta) && Number.isFinite(tariff) && tariff > 0 ? Math.round(delta * tariff) : null;

// src/sensor-state.js
function binaryValue(type, value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "on" || v === "true") return true;
  if (v === "off" || v === "false") return false;
  if (type === "door") return v === "open" ? true : v === "closed" ? false : null;
  if (type === "leak") return ["wet", "leak", "detected"].includes(v) ? true : ["dry", "no_leak", "not_detected"].includes(v) ? false : null;
  if (type === "motion") return ["detected", "motion"].includes(v) ? true : ["not_detected", "no_motion"].includes(v) ? false : null;
  return null;
}

// src/house-profile.js
var houseBindings = {
  "living:0": "light.gostinaia_levyi_vykliuchatel",
  "living:1": "light.gostinaia_pravyi_vykliuchatel",
  "hall:0": "light.prikhozhaia_levyi_vykliuchatel",
  "hall:1": "light.prikhozhaia_pravyi_vykliuchatel",
  "office:0": "light.kabinet_levyi_vykliuchatel",
  "office:1": "light.kabinet_pravyi_vykliuchatel",
  "bedroom:0": "light.spalnia_levyi_vykliuchatel",
  "bedroom:1": "light.spalnia_pravyi_vykliuchatel",
  "children:0": "light.detskaia_levyi_vykliuchatel",
  "children:1": "light.detskaia_pravyi_vykliuchatel",
  "bath:0": "light.vannaia_levyi_vykliuchatel",
  "bath:1": "light.vannaia_pravyi_vykliuchatel",
  "utility:0": "light.tualet_vykliuchatel",
  "pantry:0": "light.kladovaia_vykliuchatel",
  "corridor-main": "light.koridor_vykliuchatel",
  "temperature:living": "sensor.gostinaia_datchik_temperatury_temperatura",
  "humidity:living": "sensor.gostinaia_datchik_temperatury_vlazhnost",
  "temperature:well": "sensor.skvazhina_datchik_temperatury_temperatura",
  "humidity:well": "sensor.skvazhina_datchik_temperatury_vlazhnost",
  "temperature:attic": "sensor.cherdak_datchik_temperatury_temperatura",
  "humidity:attic": "sensor.cherdak_datchik_temperatury_vlazhnost",
  door: "binary_sensor.e4aaec90027a_contact",
  "terrace-motion": "sensor.terrasa_datchik_dvizheniia_dvizhenie",
  "terrace-lux": "sensor.terrasa_datchik_dvizheniia_osveshchennost",
  "camera-yard": "camera.dvor_kamera_dvor_live_view",
  "terrace-door": "sensor.gostinaia_datchik_dveri_dver_okno",
  "leak:utility": "sensor.kotelnaia_datchik_protechki_vody_protechka_vody",
  "leak:bath": "sensor.vannaia_datchik_protechki_vody_protechka_vody",
  "battery:terrace-door": "sensor.gostinaia_datchik_dveri_uroven_zariada",
  "battery:leak-utility": "sensor.kotelnaia_datchik_protechki_vody_uroven_zariada",
  "battery:leak-bath": "sensor.vannaia_datchik_protechki_vody_uroven_zariada",
  "master-event": "sensor.prikhozhaia_master_svet_knopka",
  "station": "media_player.yandex_station_r10c5zt00h7hek",
  "battery:living": "sensor.gostinaia_datchik_temperatury_uroven_zariada",
  "battery:well": "sensor.skvazhina_datchik_temperatury_uroven_zariada",
  "battery:attic": "sensor.cherdak_datchik_temperatury_uroven_zariada",
  "battery:door": "sensor.e4aaec90027a_battery",
  "battery:terrace": "sensor.terrasa_datchik_dvizheniia_uroven_zariada",
  "battery:master": "sensor.prikhozhaia_master_svet_uroven_zariada"
};
var extra = (id, type, room, name) => ({ id, type, room, name, status: "installed", masterOff: false, note: "\u041F\u043E \u0432\u044B\u0433\u0440\u0443\u0437\u043A\u0435 HA \xB7 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u0435" });
var houseExtras = [
  extra("station", "station", "living", "\u042F\u043D\u0434\u0435\u043A\u0441 \u0421\u0442\u0430\u043D\u0446\u0438\u044F \u041C\u0438\u0434\u0438"),
  extra("yard-motion", "motion", "yard", "\u0414\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \xB7 \u043A\u0430\u043C\u0435\u0440\u0430 \u0434\u0432\u043E\u0440\u0430"),
  extra("master-event", "button_event", "hall", "\u041C\u0430\u0441\u0442\u0435\u0440-\u0441\u0432\u0435\u0442 \xB7 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u0435"),
  ...[
    ["living", "living", "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430 \xB7 \u0433\u043E\u0441\u0442\u0438\u043D\u0430\u044F"],
    ["well", "well", "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430 \xB7 \u0441\u043A\u0432\u0430\u0436\u0438\u043D\u0430"],
    ["attic", "attic", "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430 \xB7 \u0447\u0435\u0440\u0434\u0430\u043A"],
    ["door", "hall", "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430 \xB7 \u0432\u0445\u043E\u0434\u043D\u0430\u044F \u0434\u0432\u0435\u0440\u044C"],
    ["terrace", "terrace", "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430 \xB7 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u0442\u0435\u0440\u0440\u0430\u0441\u044B"],
    ["master", "hall", "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430 \xB7 \u043C\u0430\u0441\u0442\u0435\u0440-\u043A\u043D\u043E\u043F\u043A\u0430"]
  ].map(([id, room, name]) => extra("battery:" + id, "battery", room, name))
];
function migrateCorridor(input) {
  let p;
  const copy = () => p || (p = JSON.parse(JSON.stringify(input)));
  const main = input.devices.find((d) => d.id === "corridor-main");
  const other = input.devices.some((d) => d.room === "corridor" && d.type === "light" && d.status === "installed" && d.id !== "corridor-main");
  if (main?.type === "light" && main.room === "corridor" && main.status === "planned" && main.name === "\u0411\u0443\u0434\u0443\u0449\u0438\u0439 \u0432\u044B\u043A\u043B\u044E\u0447\u0430\u0442\u0435\u043B\u044C 1" && !other) {
    const next = copy().devices.find((d) => d.id === main.id);
    next.status = "installed";
    next.name = "\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0441\u0432\u0435\u0442";
    next.note = "\u041E\u0434\u043D\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u0430\u044F \u043B\u0438\u043D\u0438\u044F \xB7 \u0432\u044B\u0431\u0435\u0440\u0438 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C HA";
    if (!input.bindings[main.id]?.entityId) next.masterOff = false;
  }
  const extra2 = input.devices.find((d) => d.id === "corridor-extra");
  if (extra2?.status === "planned" && extra2.room === "corridor" && extra2.type === "light" && extra2.name === "\u0411\u0443\u0434\u0443\u0449\u0438\u0439 \u0432\u044B\u043A\u043B\u044E\u0447\u0430\u0442\u0435\u043B\u044C 2" && !input.bindings[extra2.id]?.entityId && !input.deviceModel?.groups.some((g) => g.members.includes(extra2.id))) {
    const next = copy();
    next.devices = next.devices.filter((d) => d.id !== extra2.id);
    delete next.bindings[extra2.id];
    if (next.deviceModel) next.deviceModel = detachChannel(next.deviceModel, extra2.id);
  }
  return p ? validatePreferences(p) : input;
}
var yandexSensors = [
  { id: "terrace-door", type: "door", room: "terrace", name: "\u0414\u0432\u0435\u0440\u044C \u043D\u0430 \u0442\u0435\u0440\u0440\u0430\u0441\u0443", status: "installed", masterOff: false, note: "\u042F\u043D\u0434\u0435\u043A\u0441 \xB7 Zigbee \u0447\u0435\u0440\u0435\u0437 \u0441\u0442\u0430\u043D\u0446\u0438\u044E; \u043F\u0440\u0438\u0432\u044F\u0436\u0438 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C HA", demoValue: "off" },
  { id: "leak:utility", type: "leak", room: "utility", name: "\u041F\u0440\u043E\u0442\u0435\u0447\u043A\u0430 \u0432 \u043A\u043E\u0442\u0435\u043B\u044C\u043D\u043E\u0439", status: "installed", masterOff: false, note: "\u042F\u043D\u0434\u0435\u043A\u0441 \xB7 Zigbee \u0447\u0435\u0440\u0435\u0437 \u0441\u0442\u0430\u043D\u0446\u0438\u044E; \u043F\u0440\u0438\u0432\u044F\u0436\u0438 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C HA", demoValue: "off" },
  { id: "leak:bath", type: "leak", room: "bath", name: "\u041F\u0440\u043E\u0442\u0435\u0447\u043A\u0430 \u0432 \u0432\u0430\u043D\u043D\u043E\u0439", status: "installed", masterOff: false, note: "\u042F\u043D\u0434\u0435\u043A\u0441 \xB7 Zigbee \u0447\u0435\u0440\u0435\u0437 \u0441\u0442\u0430\u043D\u0446\u0438\u044E; \u043F\u0440\u0438\u0432\u044F\u0436\u0438 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C HA", demoValue: "off" }
];
function migrateYandexSensors(input) {
  if ((input.housePresetVersion || 0) >= 4) return input;
  const p = JSON.parse(JSON.stringify(input));
  for (const d of yandexSensors) if (!p.devices.some((x) => x.id === d.id)) p.devices.push({ ...d });
  p.housePresetVersion = 4;
  return validatePreferences(p);
}
function migrateHouseProfile(input) {
  if ((input.housePresetVersion || 0) >= 3) return migrateInventory20261022(migrateYandexSensors(migrateCorridor(input)));
  const p = JSON.parse(JSON.stringify(input));
  const previousVersion = input.housePresetVersion || 0;
  p.houseProfileConfirmed = input.houseProfileConfirmed === true || previousVersion < 2 && input.mode === "live" && Object.values(input.bindings || {}).some((b) => b.verified);
  if (previousVersion < 1) {
    for (const d of houseExtras) if (!p.devices.some((x) => x.id === d.id)) p.devices.push({ ...d });
    const bath = p.devices.find((d) => d.id === "bath:1");
    if (bath?.status === "planned" && !p.bindings["bath:1"]?.entityId) {
      bath.status = "installed";
      bath.note = "\u041F\u0440\u0430\u0432\u0430\u044F \u043A\u043B\u0430\u0432\u0438\u0448\u0430 \xB7 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430";
    }
    p.devices = p.devices.filter((d) => d.id !== "pump" || p.bindings.pump?.entityId);
    for (const d of p.devices) {
      const entityId = houseBindings[d.id], old = p.bindings[d.id];
      if (entityId && !old?.entityId && d.status === "installed") {
        p.bindings[d.id] = { entityId, verified: false };
        if (d.type !== "light") d.note = d.type === "station" ? "Yandex Station \xB7 \u043A\u043E\u043C\u0430\u043D\u0434\u044B \u0438 \u0441\u0442\u0430\u0442\u0443\u0441\u044B \u0447\u0435\u0440\u0435\u0437 HA" : "\u0421\u0443\u0449\u043D\u043E\u0441\u0442\u044C HA \u0438\u0437 \u0432\u044B\u0433\u0440\u0443\u0437\u043A\u0438 \u0434\u043E\u043C\u0430";
      }
      if (d.id === "smoke" && !old?.entityId) d.status = "planned";
    }
  }
  const oldClimate = {
    "temperature:living": "sensor.a4c1383cc159_temperature",
    "humidity:living": "sensor.a4c1383cc159_humidity",
    "temperature:well": "sensor.a4c1386265b5_temperature",
    "humidity:well": "sensor.a4c1386265b5_humidity",
    "battery:living": "sensor.a4c1383cc159_battery",
    "battery:well": "sensor.a4c1386265b5_battery"
  };
  if (previousVersion < 2) for (const [id, legacy] of Object.entries(oldClimate)) {
    const d = p.devices.find((d2) => d2.id === id), b = p.bindings[id], next = houseBindings[id];
    if (!d || !b || b.entityId !== legacy || Object.entries(p.bindings).some(([key, v]) => key !== id && v.entityId === next)) continue;
    p.bindings[id] = { entityId: next, verified: false };
    d.note = "Yandex Station \xB7 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0437\u0430\u043C\u0435\u043D\u0451\u043D \u043F\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0435 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430";
  }
  const camera = p.devices.find((d) => d.id === "camera-yard"), binding = p.bindings["camera-yard"], nextCamera = houseBindings["camera-yard"];
  if (camera && binding?.entityId === "camera.c320ws_mainstream" && !Object.entries(p.bindings).some(([id, b]) => id !== "camera-yard" && b.entityId === nextCamera)) {
    p.bindings["camera-yard"] = { entityId: nextCamera, verified: false };
    camera.note = "TP-Link \xB7 Live View \xB7 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0437\u0430\u043C\u0435\u043D\u0451\u043D \u043F\u043E \u0432\u044B\u0431\u043E\u0440\u0443 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430";
  }
  p.housePresetVersion = 3;
  return migrateInventory20261022(migrateYandexSensors(migrateCorridor(validatePreferences(p))));
}
function migrateInventory20261022(input) {
  if ((input.housePresetVersion || 0) >= 5) return input;
  const p = JSON.parse(JSON.stringify(input));
  const batteries = [
    extra("battery:terrace-door", "battery", "living", "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430 \xB7 \u0434\u0432\u0435\u0440\u044C \u043D\u0430 \u0442\u0435\u0440\u0440\u0430\u0441\u0443"),
    extra("battery:leak-utility", "battery", "utility", "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430 \xB7 \u043F\u0440\u043E\u0442\u0435\u0447\u043A\u0430 \u0432 \u043A\u043E\u0442\u0435\u043B\u044C\u043D\u043E\u0439"),
    extra("battery:leak-bath", "battery", "bath", "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430 \xB7 \u043F\u0440\u043E\u0442\u0435\u0447\u043A\u0430 \u0432 \u0432\u0430\u043D\u043D\u043E\u0439")
  ];
  for (const d of batteries) if (!p.devices.some((x) => x.id === d.id)) p.devices.push(d);
  const station = p.devices.find((d) => d.id === "station" && d.type === "station");
  if (station) {
    station.room = "corridor";
    station.note = "\u042F\u043D\u0434\u0435\u043A\u0441 \u0421\u0442\u0430\u043D\u0446\u0438\u044F \xB7 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0435 \u043C\u0435\u0441\u0442\u043E: \u043A\u043E\u0440\u0438\u0434\u043E\u0440";
  }
  const door = p.devices.find((d) => d.id === "terrace-door" && d.type === "door");
  if (door) door.room = "living";
  const ghost = p.devices.find((d) => d.id === "yard-motion" && d.type === "motion");
  if (ghost && (!p.bindings[ghost.id]?.entityId || p.bindings[ghost.id].entityId === "binary_sensor.dvor_c320ws_motion_alarm")) {
    p.devices = p.devices.filter((d) => d.id !== ghost.id);
    delete p.bindings[ghost.id];
    if (p.deviceModel) p.deviceModel = detachChannel(p.deviceModel, ghost.id);
  }
  for (const d of p.devices) {
    const target = houseBindings[d.id], old = p.bindings[d.id];
    if (!target || d.status !== "installed") continue;
    if (old?.entityId && old.entityId !== target) continue;
    if (Object.entries(p.bindings).some(([id, b]) => id !== d.id && b.entityId === target)) continue;
    p.bindings[d.id] = { entityId: target, verified: p.mode === "live" };
    if (d.id === "corridor-main") d.masterOff = true;
  }
  if (p.deviceModel) {
    const assigned = new Set(p.deviceModel.groups.flatMap((g) => g.members));
    for (const [key, name, ids] of [
      ["terrace-door", "\u0414\u0432\u0435\u0440\u044C \u043D\u0430 \u0442\u0435\u0440\u0440\u0430\u0441\u0443", ["terrace-door", "battery:terrace-door"]],
      ["leak-utility", "\u041F\u0440\u043E\u0442\u0435\u0447\u043A\u0430 \u0432 \u043A\u043E\u0442\u0435\u043B\u044C\u043D\u043E\u0439", ["leak:utility", "battery:leak-utility"]],
      ["leak-bath", "\u041F\u0440\u043E\u0442\u0435\u0447\u043A\u0430 \u0432 \u0432\u0430\u043D\u043D\u043E\u0439", ["leak:bath", "battery:leak-bath"]]
    ]) {
      const members = ids.filter((id) => p.devices.some((d) => d.id === id));
      if (members.length === 2 && !members.some((id) => assigned.has(id)) && !p.deviceModel.groups.some((g) => g.id === "unit-" + key)) {
        p.deviceModel.groups.push({ id: "unit-" + key, name, room: p.devices.find((d) => d.id === ids[0]).room, members, visual: { mode: "room" } });
        members.forEach((id) => assigned.add(id));
      }
    }
  }
  if (p.mode === "live") p.houseProfileConfirmed = true;
  p.housePresetVersion = 5;
  return validatePreferences(p);
}
function bindingProblem(d, e) {
  const t = deviceTypes[d.type];
  if (!e || ["unknown", "unavailable", ""].includes(e.state)) return "\u043D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0433\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F";
  if (!t.domains.includes(e.entity_id.split(".")[0])) return "\u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0434\u043E\u043C\u0435\u043D";
  if (t.controllable && d.type !== "station" && !["on", "off"].includes(e.state)) return "\u043D\u0435\u0442 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F on/off";
  if (t.classes) {
    if (!t.classes.includes(e.attributes?.device_class)) return "\u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043A\u043B\u0430\u0441\u0441 \u0434\u0430\u0442\u0447\u0438\u043A\u0430";
    if (e.entity_id.startsWith("binary_sensor.") && !["on", "off"].includes(e.state)) return "\u043D\u0435\u0442 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F on/off";
    if (["door", "leak", "motion"].includes(d.type) && binaryValue(d.type, e.state) === null) return "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0434\u0430\u0442\u0447\u0438\u043A\u0430";
  }
  if (t.unit && (e.attributes?.unit_of_measurement !== t.unit || !Number.isFinite(Number(e.state)))) return "\u043D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0435\u0434\u0438\u043D\u0438\u0446\u0430 \u0438\u043B\u0438 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435";
  if (d.type === "battery" && (Number(e.state) < 0 || Number(e.state) > 100)) return "\u0437\u0430\u0440\u044F\u0434 \u0432\u043D\u0435 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430 0\u2013100";
  return "";
}
function activateHouseProfile(input, states) {
  const p = validatePreferences(input), byEntity = new Map(states.map((e) => [e.entity_id, e])), report = [];
  for (const d of p.devices) {
    const b = p.bindings[d.id];
    if (d.status !== "installed" || !houseBindings[d.id] || b.entityId !== houseBindings[d.id]) continue;
    const e = byEntity.get(b.entityId), problem = bindingProblem(d, e);
    const offline = !!e && ["unknown", "unavailable", ""].includes(e.state);
    b.verified = !problem || offline && b.verified;
    report.push({ id: d.id, name: d.name, entityId: b.entityId, ok: !problem, offline, missing: !e, kept: offline && b.verified, problem: !e ? "\u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0432 HA" : offline ? "\u0441\u0435\u0439\u0447\u0430\u0441 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430" : problem });
  }
  p.mode = "live";
  p.houseProfileConfirmed = true;
  return { preferences: validatePreferences(p), report };
}

// server/history.js
var types2 = /* @__PURE__ */ new Set(["temperature", "humidity", "door", "motion", "leak", "light"]);
var cache = /* @__PURE__ */ new Map();
function historyScope(p) {
  return p.devices.filter((d) => d.status === "installed" && types2.has(d.type) && p.bindings[d.id]?.verified && p.bindings[d.id]?.entityId).map((d) => ({ id: d.id, name: d.name, room: d.room, type: d.type, entityId: p.bindings[d.id].entityId }));
}
function chartPoints(rows, limit = 420) {
  if (rows.length <= limit) return rows;
  const result = [], step = Math.ceil(rows.length / (limit / 5));
  for (let i = 0; i < rows.length; i += step) {
    const bucket = rows.slice(i, i + step), valid = bucket.filter((p) => p.value !== null);
    const chosen = [bucket[0], bucket[bucket.length - 1]];
    if (bucket.some((p) => p.value === null)) chosen.push(bucket.find((p) => p.value === null));
    if (valid.length) {
      chosen.push(valid.reduce((a, b) => a.value < b.value ? a : b));
      chosen.push(valid.reduce((a, b) => a.value > b.value ? a : b));
    }
    for (const p of [...new Set(chosen)].sort((a, b) => a.at - b.at)) result.push(p);
  }
  return result;
}
function summarizeHistory(raw, scope, start, end) {
  if (!Array.isArray(raw)) throw new Error("HA \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0443\u044E \u0438\u0441\u0442\u043E\u0440\u0438\u044E.");
  const allowed = new Map(scope.map((d) => [d.entityId, d])), series = [], events = [], lights = [], recorded = /* @__PURE__ */ new Set();
  for (const group of raw) {
    if (!Array.isArray(group) || !group.length) continue;
    const d = allowed.get(group[0]?.entity_id);
    if (!d) continue;
    const rows = group.map((r) => ({ at: Date.parse(r.last_changed || r.last_updated), state: String(r.state ?? "") })).filter((r) => Number.isFinite(r.at) && r.at <= end).sort((a, b) => a.at - b.at);
    if (rows.length) recorded.add(d.id);
    if (["temperature", "humidity"].includes(d.type)) {
      const points = rows.map((r) => ({ at: Math.max(start, r.at), value: !["unknown", "unavailable", ""].includes(r.state) && Number.isFinite(Number(r.state)) ? Number(r.state) : null }));
      const valid = points.filter((p) => p.value !== null);
      series.push({ ...d, points: chartPoints(points), count: valid.length, min: valid.length ? valid.reduce((n, p) => Math.min(n, p.value), Infinity) : null, max: valid.length ? valid.reduce((n, p) => Math.max(n, p.value), -Infinity) : null, last: points.at(-1)?.value ?? null });
    } else {
      let last;
      for (const r of rows) {
        if (r.at > start && r.state !== last) events.push({ ...d, at: r.at, state: r.state });
        last = r.state;
      }
      if (d.type === "light") {
        let onMs = 0, knownMs = 0;
        rows.forEach((r, i) => {
          const from = Math.max(start, r.at), to = Math.min(end, rows[i + 1]?.at ?? end), ms = Math.max(0, to - from);
          if (["on", "off"].includes(r.state)) {
            knownMs += ms;
            if (r.state === "on") onMs += ms;
          }
        });
        lights.push({ ...d, onMs, knownMs, coverage: Math.min(1, knownMs / (end - start)) });
      }
    }
  }
  for (const d of scope) {
    if (d.type === "light" && !lights.some((e) => e.id === d.id)) lights.push({ ...d, onMs: 0, knownMs: 0, coverage: 0 });
    if (["temperature", "humidity"].includes(d.type) && !series.some((e) => e.id === d.id)) series.push({ ...d, points: [], count: 0, min: null, max: null, last: null });
  }
  const count = events.length;
  events.sort((a, b) => b.at - a.at);
  const perType = {};
  const retained = events.filter((e) => {
    perType[e.type] = (perType[e.type] || 0) + 1;
    return perType[e.type] <= 200;
  });
  return {
    source: "Home Assistant History",
    start,
    end,
    series,
    events: retained,
    eventCount: count,
    lights,
    scopeCount: scope.length,
    recordedCount: recorded.size,
    truncated: count > 200
  };
}
async function loadHistory(ha2, p, hoursText) {
  const hours = Number(hoursText || 24);
  if (![6, 24, 168].includes(hours)) throw new Error("\u041F\u0435\u0440\u0438\u043E\u0434 \u0438\u0441\u0442\u043E\u0440\u0438\u0438: 6, 24 \u0438\u043B\u0438 168 \u0447\u0430\u0441\u043E\u0432.");
  if (p.mode !== "live" || !ha2.enabled) throw new Error("\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0432 \u0440\u0430\u0431\u043E\u0447\u0435\u043C \u0440\u0435\u0436\u0438\u043C\u0435 \u0441 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C Home Assistant. \u0414\u0435\u043C\u043E\u0438\u0441\u0442\u043E\u0440\u0438\u044E \u043D\u0435 \u0440\u0438\u0441\u0443\u0435\u043C.");
  const scope = historyScope(p);
  const key = JSON.stringify([ha2.url, hours, scope.map((d) => [d.id, d.entityId, d.room, d.name])]);
  const saved = cache.get(key);
  if (saved && Date.now() - saved.at < 3e4) return saved.promise;
  const promise = (async () => {
    const end = Date.now(), start = end - hours * 36e5;
    if (!scope.length) return summarizeHistory([], scope, start, end);
    const query = new URLSearchParams({ filter_entity_id: scope.map((d) => d.entityId).join(","), end_time: new Date(end).toISOString(), minimal_response: "", no_attributes: "", significant_changes_only: "0" });
    let raw;
    try {
      raw = await ha2.request("/api/history/period/" + encodeURIComponent(new Date(start).toISOString()) + "?" + query);
    } catch (error) {
      throw new Error("\u0418\u0441\u0442\u043E\u0440\u0438\u044F HA \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C History/Recorder \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u043D\u0443\u0436\u043D\u044B\u0445 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0435\u0439. " + error.message);
    }
    return summarizeHistory(raw, scope, start, end);
  })();
  if (cache.size >= 12) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), promise });
  try {
    return await promise;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

// server/assistant.js
import { createHash as createHash2 } from "node:crypto";

// src/readings.js
function stateTimes(e, now = Date.now()) {
  const parse = (value) => {
    const at = typeof value === "string" ? Date.parse(value) : NaN;
    return Number.isFinite(at) && at <= now + 6e4 ? at : null;
  };
  return { reportedAt: parse(e?.last_reported), updatedAt: parse(e?.last_updated), changedAt: parse(e?.last_changed) };
}
function numericReading(e, { online = true, unit, now = Date.now() } = {}) {
  const times = stateTimes(e, now), raw = e?.state;
  const valid = online && e && typeof raw === "string" && raw.trim() !== "" && !["unknown", "unavailable"].includes(raw) && Number.isFinite(Number(raw));
  const available = Boolean(valid && (!unit || e.attributes?.unit_of_measurement === unit));
  return {
    ...times,
    available,
    value: available ? Number(raw) : null,
    reason: !online ? "ha-offline" : !e ? "missing" : !valid ? "unavailable" : unit && e.attributes?.unit_of_measurement !== unit ? "wrong-unit" : null
  };
}

// server/assistant.js
var DEFAULTS = { leakAlerts: true, doorAlerts: true, doorMinutes: 10, quietNight: true, volume: 0.45, cameraName: "\u0434\u0432\u043E\u0440" };
var PLAY_MEDIA = 512;
var labels = { brief: "\u0421\u0432\u043E\u0434\u043A\u0430 \u0434\u043E\u043C\u0430", announce: "\u041E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u0435", leave: "\u042F \u0443\u0445\u043E\u0436\u0443", camera: "\u0414\u0432\u043E\u0440 \u043D\u0430 \u044D\u043A\u0440\u0430\u043D\u0435", timer: "\u0422\u0430\u0439\u043C\u0435\u0440", cancelTimers: "\u041E\u0442\u043C\u0435\u043D\u0430 \u0442\u0430\u0439\u043C\u0435\u0440\u043E\u0432", favorite: "\u041C\u043E\u044F \u0432\u043E\u043B\u043D\u0430", weather: "\u041F\u043E\u0433\u043E\u0434\u0430", shoppingAdd: "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u043E\u043A\u0443\u043F\u043A\u0438", shoppingComplete: "\u041F\u043E\u043A\u0443\u043F\u043A\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0430", shoppingSync: "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u043F\u043E\u043A\u0443\u043F\u043E\u043A", alert: "\u0413\u043E\u043B\u043E\u0441\u043E\u0432\u043E\u0435 \u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435" };
var todo = "todo.shopping_list";
function validateAssistantSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((k) => !Object.prototype.hasOwnProperty.call(DEFAULTS, k))) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0441\u0442\u0430\u043D\u0446\u0438\u0438.");
  const s = { ...DEFAULTS, ...input };
  if (["leakAlerts", "doorAlerts", "quietNight"].some((k) => typeof s[k] !== "boolean")) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0435 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0430\u0442\u0435\u043B\u0438 \u043E\u043F\u043E\u0432\u0435\u0449\u0435\u043D\u0438\u0439.");
  if (!Number.isInteger(s.doorMinutes) || s.doorMinutes < 5 || s.doorMinutes > 60) throw new Error("\u041D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435 \u043E \u0434\u0432\u0435\u0440\u0438: \u043E\u0442 5 \u0434\u043E 60 \u043C\u0438\u043D\u0443\u0442.");
  if (!Number.isFinite(s.volume) || s.volume < 0.1 || s.volume > 0.7) throw new Error("\u0413\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u044C \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F: 10\u201370%.");
  if (typeof s.cameraName !== "string" || !s.cameraName.trim() || s.cameraName.length > 40 || !/^[- а-яёa-z0-9]+$/iu.test(s.cameraName) || /(^|\s)(и|затем|потом|включи|выключи|открой|закрой|удали|скажи|отмени)(\s|$)/iu.test(s.cameraName)) throw new Error("\u0423\u043A\u0430\u0436\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u0440\u043E\u0442\u043A\u043E\u0435 \u0438\u043C\u044F \u043A\u0430\u043C\u0435\u0440\u044B, \u043D\u0435 \u043A\u043E\u043C\u0430\u043D\u0434\u0443.");
  s.cameraName = s.cameraName.trim();
  return s;
}
function homeBrief(p, states) {
  const byId = new Map(states.map((e) => [e.entity_id, e]));
  const read = (id) => {
    const d = p.devices.find((d2) => d2.id === id), b = p.bindings[id];
    return d?.status === "installed" && b?.verified ? byId.get(b.entityId) : null;
  };
  const parts = ["\u041F\u043E HA:"];
  for (const [id, name] of [["leak:utility", "\u043A\u043E\u0442\u0435\u043B\u044C\u043D\u0430\u044F"], ["leak:bath", "\u0432\u0430\u043D\u043D\u0430\u044F"]]) if (binaryValue("leak", read(id)?.state) === true) parts.push("\u043F\u0440\u043E\u0442\u0435\u0447\u043A\u0430, " + name + ".");
  const missing = [["door", "\u0432\u0445\u043E\u0434"], ["terrace-door", "\u0442\u0435\u0440\u0440\u0430\u0441\u0430"], ["leak:utility", "\u043A\u043E\u0442\u0435\u043B\u044C\u043D\u0430\u044F"], ["leak:bath", "\u0432\u0430\u043D\u043D\u0430\u044F"]].filter(([id]) => {
    const d = p.devices.find((d2) => d2.id === id && d2.status === "installed");
    return d && binaryValue(d.type, read(id)?.state) === null;
  }).map(([, name]) => name);
  if (missing.length) parts.push("\u043D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445: " + missing.join(", ") + ".");
  for (const [id, name] of [["door", "\u0432\u0445\u043E\u0434"], ["terrace-door", "\u0442\u0435\u0440\u0440\u0430\u0441\u0430"]]) {
    const v = binaryValue("door", read(id)?.state);
    if (v === true) parts.push(name + " \u043E\u0442\u043A\u0440\u044B\u0442" + (id === "terrace-door" ? "\u0430" : "") + ".");
  }
  const lights = p.devices.filter((d) => d.status === "installed" && ["light", "rgb"].includes(d.type));
  const unknown = lights.filter((d) => !["on", "off"].includes(read(d.id)?.state)).length;
  const on = lights.filter((d) => read(d.id)?.state === "on").length;
  parts.push(!lights.length ? "\u043D\u0435\u0442 \u043B\u0438\u043D\u0438\u0439 \u0441\u0432\u0435\u0442\u0430." : unknown ? `\u0441\u0432\u0435\u0442: ${on} \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u043E, ${unknown} \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E.` : on ? `\u0441\u0432\u0435\u0442: ${on} \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u043E.` : "\u0441\u0432\u0435\u0442 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D.");
  for (const [id, name] of [["temperature:living", "\u0433\u043E\u0441\u0442\u0438\u043D\u0430\u044F"], ["temperature:well", "\u0441\u043A\u0432\u0430\u0436\u0438\u043D\u0430"]]) {
    const v = numericReading(read(id), { unit: "\xB0C" });
    parts.push(v.available ? `${name} ${String(v.value).replace(".", ",")} \u0433\u0440\u0430\u0434\u0443\u0441\u0430.` : `${name}: \u043D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445.`);
  }
  let text = "";
  for (const part of parts) if ((text + " " + part).trim().length <= 100) text = (text + " " + part).trim();
  return text;
}
var StationAssistant = class {
  constructor(ha2, db2, profiles, { now = () => Date.now() } = {}) {
    this.ha = ha2;
    this.db = db2;
    this.profiles = profiles;
    this.now = now;
    this.ticking = false;
    db2.exec(`CREATE TABLE IF NOT EXISTS assistant_settings(profile_id TEXT PRIMARY KEY,settings TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS assistant_requests(profile_id TEXT NOT NULL,request_id TEXT NOT NULL,fingerprint TEXT NOT NULL,action TEXT NOT NULL,status TEXT NOT NULL,result TEXT,created_at INTEGER NOT NULL,PRIMARY KEY(profile_id,request_id));
   CREATE TABLE IF NOT EXISTS assistant_observations(profile_id TEXT NOT NULL,device_id TEXT NOT NULL,entity_id TEXT NOT NULL,active INTEGER NOT NULL,opened_at INTEGER,notified INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(profile_id,device_id,entity_id));
   CREATE INDEX IF NOT EXISTS assistant_requests_by_profile_time ON assistant_requests(profile_id,created_at DESC);`);
  }
  settings(id) {
    const row = this.db.prepare("SELECT settings FROM assistant_settings WHERE profile_id=?").get(id);
    return row ? validateAssistantSettings(JSON.parse(row.settings)) : { ...DEFAULTS };
  }
  saveSettings(id, input) {
    const s = validateAssistantSettings(input);
    this.db.prepare("INSERT INTO assistant_settings VALUES(?,?) ON CONFLICT(profile_id) DO UPDATE SET settings=excluded.settings").run(id, JSON.stringify(s));
    return s;
  }
  requireLive(p) {
    if (!this.ha.enabled || p.mode !== "live") throw new Error("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0441\u0442\u0430\u043D\u0446\u0438\u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u0440\u0430\u0431\u043E\u0447\u0435\u043C \u0440\u0435\u0436\u0438\u043C\u0435 \u0441 HA. \u0414\u0435\u043C\u043E \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u0442.");
  }
  binding(p) {
    this.requireLive(p);
    const b = p.bindings.station, d = p.devices.find((d2) => d2.id === "station");
    if (d?.type !== "station" || d.status !== "installed" || !b?.verified || !/^media_player\.[a-z0-9_]+$/.test(b.entityId)) throw new Error("\u0421\u0442\u0430\u043D\u0446\u0438\u044F \u043D\u0435 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D\u0430 \u0438\u043B\u0438 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u0430.");
    return b.entityId;
  }
  features(e) {
    return { available: stationAvailable(e), playMedia: stationAvailable(e) && !!(Number(e.attributes?.supported_features) & PLAY_MEDIA), local: stationAvailable(e) && typeof e?.attributes?.alice_state === "string" && e.attributes.alice_state.length > 0 && !!(Number(e.attributes?.supported_features) & 1) && e.attributes.assumed_state !== true };
  }
  async status(id, p) {
    this.requireLive(p);
    const entity = this.binding(p), states = await this.ha.states(), station = states.find((e) => e.entity_id === entity);
    const f = this.features(station), settings = this.settings(id), read = (key) => {
      const b = p.bindings[key];
      return b?.verified ? states.find((e) => e.entity_id === b.entityId) : null;
    };
    const lights = p.devices.filter((d) => ["light", "rgb"].includes(d.type) && d.status === "installed" && d.masterOff && read(d.id)?.state === "on").map((d) => ({ id: d.id, name: d.name, room: d.room }));
    const warnings = [];
    for (const d of p.devices.filter((d2) => d2.status === "installed" && ["door", "leak"].includes(d2.type))) {
      const v = binaryValue(d.type, read(d.id)?.state);
      if (v !== false) warnings.push({ id: d.id, name: d.name, room: d.room, kind: v === true ? d.type === "leak" ? "alarm" : "open" : "unknown" });
    }
    for (const d of p.devices.filter((d2) => d2.status === "installed" && ["light", "rgb"].includes(d2.type) && d2.masterOff)) if (!["on", "off"].includes(read(d.id)?.state)) warnings.push({ id: d.id, name: d.name, room: d.room, kind: "unknown" });
    return {
      ...f,
      entity,
      brief: homeBrief(p, states),
      settings,
      leave: { lights, pause: station?.state === "playing" && stationSupports(station, "playing", false), warnings },
      automation: { pollEverySeconds: 15, lastPollAt: this.lastPollAt || null, lastError: this.lastError || null },
      activity: this.db.prepare("SELECT action,status,created_at FROM assistant_requests WHERE profile_id=? ORDER BY created_at DESC LIMIT 8").all(id).map((r) => ({ ...r, label: labels[r.action] || r.action }))
    };
  }
  async sendMedia(p, type, text, { volume, localOnly = false } = {}) {
    const entity = this.binding(p);
    if (this.ha.pending.has(entity)) throw new Error("\u0421\u0442\u0430\u043D\u0446\u0438\u044F \u0437\u0430\u043D\u044F\u0442\u0430. \u0414\u043E\u0436\u0434\u0438\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0433\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F.");
    this.ha.pending.add(entity);
    try {
      const e = await this.ha.request("/api/states/" + entity), f = this.features(e);
      if (!f.playMedia) throw new Error("\u0421\u0442\u0430\u043D\u0446\u0438\u044F \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0438\u043B\u0438 play_media \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F.");
      if (localOnly && !f.local) throw new Error("\u041D\u0443\u0436\u043D\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u0430\u044F \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0432\u044F\u0437\u044C \u0441\u043E \u0441\u0442\u0430\u043D\u0446\u0438\u0435\u0439.");
      await this.ha.request("/api/services/media_player/play_media", {
        entity_id: entity,
        media_content_type: type,
        media_content_id: text,
        ...type === "text" && f.local && volume !== void 0 ? { extra: { volume_level: volume } } : {}
      }, { timeout: type === "shopping_list" ? 45e3 : 6e3 });
      return { phase: "accepted", message: "HA \u043F\u0440\u0438\u043D\u044F\u043B \u0437\u0430\u043F\u0440\u043E\u0441. \u0424\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u043E\u0437\u0432\u0443\u0447\u0438\u0432\u0430\u043D\u0438\u0435 \u0438\u043B\u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 \u0441\u0442\u0430\u043D\u0446\u0438\u0435\u0439 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E." };
    } finally {
      this.ha.pending.delete(entity);
    }
  }
  async shopping(p) {
    this.requireLive(p);
    const e = await this.ha.request("/api/states/" + todo);
    if (["unknown", "unavailable"].includes(e.state) || e.entity_id !== todo) throw new Error("\u0421\u043F\u0438\u0441\u043E\u043A todo.shopping_list \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D. \u0414\u043E\u0431\u0430\u0432\u044C \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u043F\u043E\u043A\u0443\u043F\u043E\u043A \u0432 HA.");
    const result = await this.ha.request("/api/services/todo/get_items?return_response", { entity_id: todo, status: "needs_action" });
    const items = result?.service_response?.[todo]?.items;
    if (!Array.isArray(items)) throw new Error("HA \u043D\u0435 \u0432\u0435\u0440\u043D\u0443\u043B \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0435 \u0441\u043F\u0438\u0441\u043A\u0430 \u043F\u043E\u043A\u0443\u043F\u043E\u043A.");
    return { entity: todo, items: items.slice(0, 100).filter((i) => typeof i.uid === "string" && typeof i.summary === "string").map((i) => ({ uid: i.uid, summary: i.summary, status: i.status })), truncated: items.length > 100 };
  }
  validateAction(r) {
    if (!r || !Object.prototype.hasOwnProperty.call(labels, r.action) || r.action === "alert") throw new Error("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0437\u0430\u043F\u0440\u0435\u0449\u0435\u043D\u043E.");
    if (typeof r.requestId !== "string" || !/^[a-zA-Z0-9_-]{8,80}$/.test(r.requestId)) throw new Error("\u041D\u0435\u0442 \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u0430 \u0437\u0430\u043F\u0440\u043E\u0441\u0430.");
    if (["leave", "camera", "shoppingSync", "cancelTimers"].includes(r.action) && r.confirmed !== true) throw new Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0438 \u0435\u0433\u043E \u043E\u0431\u043B\u0430\u0441\u0442\u044C.");
    if (r.action === "announce" && (typeof r.text !== "string" || !r.text.trim() || r.text.length > 100 || /[<>\x00-\x08\x0b-\x1f]/.test(r.text))) throw new Error("\u041E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u0435: 1\u2013100 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432 \u043E\u0431\u044B\u0447\u043D\u043E\u0433\u043E \u0442\u0435\u043A\u0441\u0442\u0430, \u0431\u0435\u0437 \u0440\u0430\u0437\u043C\u0435\u0442\u043A\u0438.");
    if (r.action === "timer" && (!Number.isInteger(r.minutes) || r.minutes < 1 || r.minutes > 180)) throw new Error("\u0422\u0430\u0439\u043C\u0435\u0440: \u043E\u0442 1 \u0434\u043E 180 \u043C\u0438\u043D\u0443\u0442.");
    if (r.action === "shoppingAdd" && (typeof r.item !== "string" || !r.item.trim() || r.item.length > 160 || /[\x00-\x1f]/.test(r.item))) throw new Error("\u041F\u043E\u043A\u0443\u043F\u043A\u0430: 1\u2013160 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.");
    if (r.action === "shoppingComplete" && (typeof r.uid !== "string" || r.uid.length > 200)) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0441\u043F\u0438\u0441\u043A\u0430.");
    if (Object.keys(r).some((k) => !["action", "requestId", "confirmed", "text", "minutes", "item", "uid"].includes(k))) throw new Error("\u041B\u0438\u0448\u043D\u0438\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F.");
  }
  async execute(id, p, r) {
    this.requireLive(p);
    this.validateAction(r);
    const fingerprint = createHash2("sha256").update(JSON.stringify(r)).digest("hex");
    const previous = this.db.prepare("SELECT * FROM assistant_requests WHERE profile_id=? AND request_id=?").get(id, r.requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new Error("\u0418\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u0443\u0436\u0435 \u043F\u0440\u0438\u043D\u0430\u0434\u043B\u0435\u0436\u0438\u0442 \u0434\u0440\u0443\u0433\u043E\u043C\u0443 \u0437\u0430\u043F\u0440\u043E\u0441\u0443.");
      return previous.result ? JSON.parse(previous.result) : { phase: "unknown", message: "\u042D\u0442\u043E\u0442 \u0437\u0430\u043F\u0440\u043E\u0441 \u0443\u0436\u0435 \u043F\u0440\u0438\u043D\u044F\u0442 \u0438\u043B\u0438 \u0431\u044B\u043B \u043F\u0440\u0435\u0440\u0432\u0430\u043D. \u041F\u043E\u0432\u0442\u043E\u0440\u0430 \u043D\u0435\u0442; \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u0441\u0442\u0430\u043D\u0446\u0438\u044E." };
    }
    this.db.prepare("INSERT INTO assistant_requests VALUES(?,?,?,?,?,?,?)").run(id, r.requestId, fingerprint, r.action, "running", null, this.now());
    try {
      const result = await this.perform(id, p, r);
      this.db.prepare("UPDATE assistant_requests SET status=?,result=? WHERE profile_id=? AND request_id=?").run(result.phase, JSON.stringify(result), id, r.requestId);
      return result;
    } catch (error) {
      const result = { phase: "unknown", message: error.message + " \u0410\u0432\u0442\u043E\u043F\u043E\u0432\u0442\u043E\u0440\u0430 \u043D\u0435\u0442. \u0415\u0441\u043B\u0438 \u0437\u0430\u043F\u0440\u043E\u0441 \u0434\u043E\u0448\u0451\u043B \u0434\u043E HA, \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043C\u043E\u0433\u043B\u043E \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C\u0441\u044F." };
      this.db.prepare("UPDATE assistant_requests SET status=?,result=? WHERE profile_id=? AND request_id=?").run("unknown", JSON.stringify(result), id, r.requestId);
      return result;
    }
  }
  async perform(id, p, r) {
    const settings = this.settings(id);
    if (r.action === "brief") return this.sendMedia(p, "text", homeBrief(p, await this.ha.states()), { volume: settings.volume });
    if (r.action === "announce") return this.sendMedia(p, "text", r.text.trim(), { volume: settings.volume });
    if (r.action === "camera") return this.sendMedia(p, "command", "\u041F\u043E\u043A\u0430\u0436\u0438 \u043A\u0430\u043C\u0435\u0440\u0443 " + settings.cameraName);
    if (r.action === "timer") return this.sendMedia(p, "command", `\u041F\u043E\u0441\u0442\u0430\u0432\u044C \u0442\u0430\u0439\u043C\u0435\u0440 \u043D\u0430 ${r.minutes} \u043C\u0438\u043D\u0443\u0442`);
    if (r.action === "cancelTimers") return this.sendMedia(p, "command", "\u041E\u0442\u043C\u0435\u043D\u0438 \u0432\u0441\u0435 \u0442\u0430\u0439\u043C\u0435\u0440\u044B");
    if (r.action === "favorite") return this.sendMedia(p, "command", "\u0412\u043A\u043B\u044E\u0447\u0438 \u043C\u043E\u044E \u0432\u043E\u043B\u043D\u0443");
    if (r.action === "weather") return this.sendMedia(p, "command", "\u041A\u0430\u043A\u0430\u044F \u0441\u0435\u0433\u043E\u0434\u043D\u044F \u043F\u043E\u0433\u043E\u0434\u0430");
    if (r.action === "shoppingSync") return this.sendMedia(p, "shopping_list", todo, { localOnly: true });
    if (["shoppingAdd", "shoppingComplete"].includes(r.action)) {
      const before = await this.shopping(p);
      if (r.action === "shoppingComplete" && !before.items.some((i) => i.uid === r.uid)) throw new Error("\u0417\u0430\u043F\u0438\u0441\u044C \u0443\u0436\u0435 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442. \u041E\u0431\u043D\u043E\u0432\u0438 \u0441\u043F\u0438\u0441\u043E\u043A.");
      await this.ha.request("/api/services/todo/" + (r.action === "shoppingAdd" ? "add_item" : "update_item"), { entity_id: todo, ...r.action === "shoppingAdd" ? { item: r.item.trim() } : { item: r.uid, status: "completed" } });
      const after = await this.shopping(p);
      const confirmed = r.action === "shoppingComplete" ? !after.items.some((i) => i.uid === r.uid) : after.items.some((i) => i.summary === r.item.trim() && !before.items.some((b) => b.uid === i.uid));
      return { phase: confirmed ? "confirmed" : "accepted", message: confirmed ? "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0441\u043F\u0438\u0441\u043A\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E \u0447\u0442\u0435\u043D\u0438\u0435\u043C HA." : "HA \u043F\u0440\u0438\u043D\u044F\u043B \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435; \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u0441\u043F\u0438\u0441\u043E\u043A.", shopping: after };
    }
    if (r.action === "leave") {
      const snapshot = await this.status(id, p);
      const results = await Promise.all(snapshot.leave.lights.map(async (d) => {
        try {
          await this.ha.command({ id: d.id, value: false }, p);
          return { name: d.name, room: d.room, ok: true };
        } catch (error) {
          return { name: d.name, room: d.room, ok: false, message: error.message };
        }
      }));
      if (snapshot.leave.pause) try {
        await this.ha.command({ id: "station:playing", value: false }, p);
      } catch (error) {
        results.push({ name: "\u041C\u0443\u0437\u044B\u043A\u0430", ok: false, message: error.message });
      }
      let speech;
      try {
        speech = await this.sendMedia(p, "text", homeBrief(p, await this.ha.states()), { volume: settings.volume });
      } catch (error) {
        speech = { phase: "unknown", message: error.message };
      }
      const warnings = (await this.status(id, p)).leave.warnings, ok = results.every((r2) => r2.ok) && !warnings.some((w) => w.kind === "unknown");
      return { phase: ok ? "confirmed" : "partial", message: `\u041F\u043E \u0434\u0430\u043D\u043D\u044B\u043C HA \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u043B\u0438\u043D\u0438\u0439: ${results.filter((r2) => r2.ok).length}/${snapshot.leave.lights.length}. ${ok ? "\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0437\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u044F \u043F\u043E \u0434\u0432\u0435\u0440\u044F\u043C \u0438 \u0434\u0430\u0442\u0447\u0438\u043A\u0430\u043C." : "\u041D\u0435 \u0432\u0441\u0451 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E; \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430."}`, results, speech, warnings };
    }
    throw new Error("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0437\u0430\u043F\u0440\u0435\u0449\u0435\u043D\u043E.");
  }
  async tick() {
    if (this.ticking || !this.ha.enabled) return;
    this.ticking = true;
    try {
      const profiles = this.profiles().filter((x) => x.preferences.mode === "live");
      if (!profiles.length) return;
      const states = await this.ha.states(), byId = new Map(states.map((e) => [e.entity_id, e])), now = this.now();
      this.lastPollAt = now;
      this.lastError = null;
      for (const { id, preferences: p } of profiles) {
        const b = p.bindings.station;
        if (!b?.verified) continue;
        const f = this.features(byId.get(b.entityId)), canSpeak = f.playMedia && f.local && !this.ha.pending.has(b.entityId) && p.devices.some((d) => d.id === "station" && d.type === "station" && d.status === "installed") && byId.get(b.entityId).attributes.alice_state.toUpperCase() === "IDLE";
        const s = this.settings(id), hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: PANEL_TIMEZONE, hour: "2-digit", hourCycle: "h23" }).format(now));
        for (const d of p.devices.filter((d2) => d2.status === "installed" && ["leak", "door"].includes(d2.type)).sort((a, b2) => (a.type === "leak" ? 0 : 1) - (b2.type === "leak" ? 0 : 1))) {
          const binding = p.bindings[d.id];
          if (!binding?.verified) continue;
          const e = byId.get(binding.entityId), value = binaryValue(d.type, e?.state);
          if (value === null) continue;
          let row = this.db.prepare("SELECT * FROM assistant_observations WHERE profile_id=? AND device_id=? AND entity_id=?").get(id, d.id, binding.entityId);
          const key = [id, d.id, binding.entityId];
          if (!value) {
            if (!row || row.active || row.notified) this.db.prepare("INSERT INTO assistant_observations VALUES(?,?,?,0,NULL,0) ON CONFLICT(profile_id,device_id,entity_id) DO UPDATE SET active=0,opened_at=NULL,notified=0").run(...key);
            continue;
          }
          if (!row?.active) {
            const timestamp = Date.parse(e.last_changed || e.last_updated);
            const opened = Number.isFinite(timestamp) && timestamp <= now ? timestamp : now;
            this.db.prepare("INSERT INTO assistant_observations VALUES(?,?,?,1,?,0) ON CONFLICT(profile_id,device_id,entity_id) DO UPDATE SET active=1,opened_at=excluded.opened_at,notified=0").run(...key, opened);
            row = { opened_at: opened, notified: 0 };
          }
          if (row.notified) continue;
          const due = d.type === "leak" ? s.leakAlerts : s.doorAlerts && now - row.opened_at >= s.doorMinutes * 6e4 && (!s.quietNight || hour >= 8 && hour < 22);
          if (!due || !canSpeak) continue;
          this.db.prepare("UPDATE assistant_observations SET notified=1 WHERE profile_id=? AND device_id=? AND entity_id=?").run(...key);
          const requestId = "alert_" + createHash2("sha256").update(JSON.stringify([...key, row.opened_at])).digest("hex");
          this.db.prepare("INSERT OR IGNORE INTO assistant_requests VALUES(?,?,?,?,?,?,?)").run(id, requestId, requestId, "alert", "running", null, now);
          let result;
          try {
            result = await this.sendMedia(p, "text", d.type === "leak" ? "\u0412\u043D\u0438\u043C\u0430\u043D\u0438\u0435! " + d.name.slice(0, 60) + "." : "\u041F\u0440\u043E\u0432\u0435\u0440\u044C: " + d.name.slice(0, 60) + " \u0434\u043E\u043B\u0433\u043E \u043E\u0442\u043A\u0440\u044B\u0442\u0430.", { volume: s.volume, localOnly: true });
          } catch (error) {
            result = { phase: "unknown", message: error.message };
          }
          this.db.prepare("UPDATE assistant_requests SET status=?,result=? WHERE profile_id=? AND request_id=?").run(result.phase, JSON.stringify(result), id, requestId);
          break;
        }
      }
    } catch (error) {
      this.lastError = error.message;
    } finally {
      this.ticking = false;
    }
  }
};

// server/scenarios.js
var lightLines = (p) => {
  const cached = p.__lightLines || (p.__lightLines = bindingDefinitions(p.devices).filter((b) => deviceTypes[b.type].module === "lights" && deviceTypes[b.type].controllable && b.device.status === "installed"));
  return cached;
};
var bound = (p) => lightLines(p).filter((b) => {
  const v = p.bindings[b.id];
  return v?.verified && v.entityId;
});
var inRooms = (p, rooms) => bound(p).filter((b) => rooms.includes(b.device.room));
var skipRest = (p, run) => lightLines(p).filter((b) => !run.some((r) => r.b === b)).map((b) => ({ b, message: "\u041D\u0435\u0442 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0439 \u043B\u0438\u043D\u0438\u0438 \u0438\u043B\u0438 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u043D\u0435 \u0442\u0440\u043E\u0433\u0430\u0435\u0442 \u044D\u0442\u0443 \u043A\u043E\u043C\u043D\u0430\u0442\u0443" }));
async function supportsDim(ha2, entity) {
  try {
    const e = await ha2.request("/api/states/" + entity);
    return ["on", "off"].includes(e.state) && (e.attributes.supported_color_modes || []).some((m) => m !== "onoff");
  } catch {
    return false;
  }
}
var scenarioRegistry = {
  leave: { name: "\u0423\u0445\u043E\u0434", plan: async (ha2, p) => {
    const run = bound(p).map((b) => ({ b, request: { id: b.id, value: false }, message: "\u0412\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u043E" }));
    return { run, skip: skipRest(p, run) };
  } },
  evening: { name: "\u0412\u0435\u0447\u0435\u0440", plan: async (ha2, p) => {
    const lines = inRooms(p, ["living", "hall"]), run = [];
    for (const b of lines) {
      const entity = p.bindings[b.id].entityId;
      if (b.type === "rgb" && await supportsDim(ha2, entity)) run.push({ b, request: { id: b.id + "/brightness", value: 100 }, message: "\u0412\u043A\u043B\u044E\u0447\u0435\u043D\u043E \xB7 100 %" });
      else run.push({ b, request: { id: b.id, value: true }, message: "\u0412\u043A\u043B\u044E\u0447\u0435\u043D\u043E" });
    }
    return { run, skip: skipRest(p, run) };
  } },
  cinema: { name: "\u041A\u0438\u043D\u043E", plan: async (ha2, p) => {
    const living = inRooms(p, ["living"]), run = [], skip = [];
    for (const b of bound(p).filter((b2) => !living.includes(b2))) run.push({ b, request: { id: b.id, value: false }, message: "\u0412\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u043E" });
    const first = living[0];
    if (first) {
      const entity = p.bindings[first.id].entityId;
      if (first.type === "rgb" && await supportsDim(ha2, entity)) run.push({ b: first, request: { id: first.id + "/brightness", value: 30 }, message: "\u041F\u0440\u0438\u0433\u043B\u0443\u0448\u0451\u043D\u043D\u044B\u0439 \u0441\u0432\u0435\u0442 \xB7 30 %" });
      else run.push({ b: first, request: { id: first.id, value: true }, message: "\u042F\u0440\u043A\u043E\u0441\u0442\u044C \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430 \xB7 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E" });
    } else skip.push({ b: null, message: "\u0412 \u0433\u043E\u0441\u0442\u0438\u043D\u043E\u0439 \u043D\u0435\u0442 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0439 \u043B\u0438\u043D\u0438\u0438" });
    for (const b of skipRest(p, run)) if (b !== first) skip.push(b);
    return { run, skip };
  } }
};
async function runScenario(id, ha2, p) {
  const def = scenarioRegistry[String(id || "")];
  if (!def) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439.");
  const { run, skip } = await def.plan(ha2, p);
  const results = [];
  let confirmed = 0, failed = 0;
  for (const { b, request, message } of run) {
    try {
      await ha2.command(request, p);
      confirmed++;
      results.push({ id: b.id, name: b.name, status: "confirmed", message });
    } catch (error) {
      failed++;
      results.push({ id: b.id, name: b.name, status: "failed", message: error.message });
    }
  }
  for (const { b, message } of skip) results.push({ id: b?.id || "", name: b?.name || "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430", status: "skipped", message });
  return { id: String(id), name: def.name, results, summary: { total: results.length, confirmed, failed, skipped: results.length - confirmed - failed } };
}
async function runUserScenario(id, ha2, p) {
  const key = String(id || ""), def = (p.userScenarios || []).find((s) => s.id === key);
  if (!def) throw new Error("\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.");
  const lines = new Map(bound(p).map((b) => [b.id, b])), run = [], skip = [];
  for (const step of def.steps) {
    const b = lines.get(step.deviceId);
    if (!b) {
      skip.push({ b: null, message: "\u041D\u0435\u0442 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0439 \u043B\u0438\u043D\u0438\u0438 \u0441\u0432\u0435\u0442\u0430" });
      continue;
    }
    if (step.action === "brightness" && !(b.type === "rgb" && await supportsDim(ha2, p.bindings[b.id].entityId))) {
      run.push({ b, request: { id: b.id, value: true }, message: "\u042F\u0440\u043A\u043E\u0441\u0442\u044C \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430 \xB7 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E" });
      continue;
    }
    run.push({
      b,
      request: step.action === "brightness" ? { id: b.id + "/brightness", value: step.value } : { id: b.id, value: step.action === "on" },
      message: step.action === "brightness" ? `\u042F\u0440\u043A\u043E\u0441\u0442\u044C ${step.value} %` : step.action === "on" ? "\u0412\u043A\u043B\u044E\u0447\u0435\u043D\u043E" : "\u0412\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u043E"
    });
  }
  const results = [];
  let confirmed = 0, failed = 0;
  for (const { b, request, message } of run) {
    try {
      await ha2.command(request, p);
      confirmed++;
      results.push({ id: b.id, name: b.name, status: "confirmed", message });
    } catch (error) {
      failed++;
      results.push({ id: b.id, name: b.name, status: "failed", message: error.message });
    }
  }
  for (const { b, message } of skip) results.push({ id: b?.id || "", name: b?.name || "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430", status: "skipped", message });
  return { id: key, name: def.name, results, summary: { total: results.length, confirmed, failed, skipped: results.length - confirmed - failed } };
}

// server/index.js
var port = Number(process.env.PORT || 8080);
var preview = process.env.PANEL_PREVIEW === "1";
var startedAt = Date.now();
var PANEL_VERSION = "3.2.0";
try {
  PANEL_VERSION = JSON.parse(await readFile(resolve("addon/home-panel/manifest.json"), "utf8")).version || PANEL_VERSION;
} catch {
}
try {
  PANEL_VERSION = JSON.parse(await readFile(resolve("package.json"), "utf8")).version || PANEL_VERSION;
} catch {
}
try {
  PANEL_VERSION = JSON.parse(await readFile(resolve("config.json"), "utf8")).version || PANEL_VERSION;
} catch {
}
var addon = process.env.PANEL_ADDON === "1";
if (addon && preview) throw new Error("Home Panel: add-on must not run in preview mode.");
var root = resolve(process.env.PANEL_ROOT || "dist");
var data = resolve(process.env.PANEL_DATA || "data");
await mkdir(data, { recursive: true });
var db = new Database(resolve(data, "panel.sqlite"));
db.pragma("journal_mode = WAL");
db.exec("CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, preferences TEXT NOT NULL, photo BLOB);");
db.exec("CREATE TABLE IF NOT EXISTS profile_backups (profile_id TEXT NOT NULL, reason TEXT NOT NULL, preferences TEXT NOT NULL, PRIMARY KEY(profile_id,reason));");
var ha = new HomeAssistant({ url: process.env.HA_URL, token: process.env.HA_TOKEN, preview });
var streams = new CameraStreams(ha);
var rtc = new CameraRTC(ha);
setInterval(() => streams.prune(), 3e4).unref();
setInterval(() => rtc.prune(), 3e4).unref();
var yardCameraEntity = (p) => {
  const b = p?.bindings["camera-yard"];
  return p?.mode === "live" && b?.verified && /^camera\.[a-z0-9_]+$/.test(b.entityId || "") ? b.entityId : null;
};
var yardMotion = new YardMotion({ ha });
var yardOnvifWatch = null;
var yardOnvifConfigKey = "";
var yardOnvifSnapshots = null;
var clientPreferences = (prefs) => {
  const c = { ...prefs };
  delete c.yard_onvif_pass;
  return c;
};
var yardOnvifStatus = () => yardOnvifWatch?.status?.() || null;
var yardOnvifEnsure = (prefs) => {
  if (prefs.yard_onvif_enabled === false) {
    if (yardOnvifWatch) {
      yardOnvifWatch.stop();
      yardOnvifWatch = null;
      yardOnvifConfigKey = "";
      yardOnvifSnapshots = null;
    }
    return false;
  }
  let host = String(prefs.yard_onvif_host || "").trim() || "192.168.8.204", port2;
  const colon = host.match(/^([\w.\[\]:-]+):(\d+)$/);
  if (colon) {
    host = colon[1].replace(/^\[|\]$/g, "");
    port2 = Number(colon[2]);
  }
  const user = String(prefs.yard_onvif_user || "").trim(), pass = String(prefs.yard_onvif_pass || "");
  if (!user) {
    if (yardOnvifWatch) {
      yardOnvifWatch.stop();
      yardOnvifWatch = null;
      yardOnvifConfigKey = "";
      yardOnvifSnapshots = null;
    }
    return false;
  }
  const key = host + "|" + port2 + "|" + user + "|" + pass;
  if (yardOnvifWatch && key === yardOnvifConfigKey) return true;
  if (yardOnvifWatch) yardOnvifWatch.stop();
  yardOnvifConfigKey = key;
  yardOnvifSnapshots = onvifSnapshots({ host, ...port2 ? { port: port2 } : {}, user, pass, log: (...a) => console.log("Yard ONVIF snapshot:", ...a) });
  yardOnvifWatch = onvifWatch({
    host,
    ...port2 ? { port: port2 } : {},
    user,
    pass,
    onMotion: () => {
      yardMotion.externalMotion();
      yardClips.record().catch((error) => journal("\u041A\u043B\u0438\u043F \u0434\u0432\u043E\u0440\u0430 \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u0430\u043D: " + (error?.message || error), "warn"));
    },
    onError: (error) => {
      console.log("Yard ONVIF fallback to jpeg diff:", error?.message || error);
      journal("ONVIF-\u0441\u043E\u0431\u044B\u0442\u0438\u044F \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B: " + (error?.message || error) + " \u2014 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0440\u0435\u0437\u0435\u0440\u0432 \u043F\u043E \u043A\u0430\u0434\u0440\u0430\u043C", "warn");
    }
  });
  journal("ONVIF-\u0434\u0435\u0442\u0435\u043A\u0442\u043E\u0440 \u0434\u0432\u043E\u0440\u0430 \u0437\u0430\u043F\u0443\u0449\u0435\u043D: " + host + (port2 ? ":" + port2 : ""));
  return true;
};
var proofs = /* @__PURE__ */ new Map();
var pendingScopes = /* @__PURE__ */ new Map();
var live = new LiveFeed({ ha });
var liveIds = /* @__PURE__ */ new Map();
var forecastCache = null;
var forecastKey = "";
var shoppingCache = null;
var energyCache = null;
var energyLastKnown = null;
var yardEntityHint = null;
var yardClips = new YardClips({
  ha,
  db,
  getEntityId: () => yardEntityHint,
  yardOnvif: () => yardOnvifSnapshots,
  notify: (info) => live.broadcast("yard-clip", JSON.stringify(info))
});
yardClips.start();
var getProfile = (id) => {
  let row = db.prepare("SELECT * FROM profiles WHERE id=?").get(id);
  if (!row) {
    db.prepare("INSERT INTO profiles(id,preferences) VALUES(?,?)").run(id, JSON.stringify(defaultPreferences()));
    row = db.prepare("SELECT * FROM profiles WHERE id=?").get(id);
  }
  const raw = JSON.parse(row.preferences), stored = validatePreferences(raw);
  let preferences = migrateHouseProfile(stored);
  if (raw.deviceModel === void 0) preferences = validatePreferences({ ...preferences, deviceModel: seedDeviceModel(preferences.devices) });
  const normalized = JSON.stringify(preferences);
  if (normalized !== row.preferences) db.transaction(() => {
    if (raw.deviceModel === void 0) db.prepare("INSERT OR IGNORE INTO profile_backups(profile_id,reason,preferences) VALUES(?,?,?)").run(id, "before-device-model-v1", row.preferences);
    if ((raw.housePresetVersion || 0) < 5 && preferences.housePresetVersion === 5) db.prepare("INSERT OR IGNORE INTO profile_backups(profile_id,reason,preferences) VALUES(?,?,?)").run(id, "before-inventory-2026-10-22", row.preferences);
    if (raw.deviceModel !== void 0 && JSON.stringify(raw.devices) !== JSON.stringify(preferences.devices)) db.prepare("INSERT OR IGNORE INTO profile_backups(profile_id,reason,preferences) VALUES(?,?,?)").run(id, "before-spatial-redesign", row.preferences);
    db.prepare("UPDATE profiles SET preferences=? WHERE id=?").run(normalized, id);
  })();
  return { preferences, photo: row.photo };
};
var assistant = new StationAssistant(ha, db, () => db.prepare("SELECT id FROM profiles").all().map(({ id }) => ({ id, preferences: getProfile(id).preferences })));
var assistantScopes = /* @__PURE__ */ new Set();
if (!preview) setInterval(() => assistant.tick(), 15e3).unref();
var json = (res, code, body2) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(body2));
};
async function body(req, max = 131072) {
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > max) throw new Error("\u0424\u0430\u0439\u043B \u0438\u043B\u0438 \u0437\u0430\u043F\u0440\u043E\u0441 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439.");
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
function identify(req) {
  if (addon) {
    const address = (req.socket.remoteAddress || "").replace(/^::ffff:/, "");
    const hostname = new URL("http://" + (req.headers.host || "")).hostname.replace(/^\[|\]$/g, "");
    const privateAddress = (ip) => ip === "::1" || /^f[cd][0-9a-f]*:/i.test(ip) || /^fe80:/i.test(ip) || isIP(ip) === 4 && (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("127.") || /^172\.(1[6-9]|2\d|3[01])\./.test(ip));
    if (!privateAddress(address)) throw new Error("Home Panel \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0435\u0442\u0438.");
    if (!privateAddress(hostname) && hostname !== "localhost" && !/^[a-z0-9-]+\.local$/i.test(hostname)) throw new Error("\u041E\u0442\u043A\u0440\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u044C \u043F\u043E \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u043C\u0443 IP \u0438\u043B\u0438 \u0438\u043C\u0435\u043D\u0438 .local.");
    return "home";
  }
  const host = req.headers.host || "", direct = /^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host);
  const visitor = req.headers["x-visitor-id"];
  if (preview && visitor) return "preview:" + createHash3("sha256").update(String(visitor)).digest("hex");
  if (direct && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)) return "local";
  throw new Error("\u0414\u043E\u0441\u0442\u0443\u043F \u0440\u0430\u0437\u0440\u0435\u0448\u0451\u043D \u0442\u043E\u043B\u044C\u043A\u043E \u0441 \u044D\u0442\u043E\u0433\u043E \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u0438\u043B\u0438 \u0447\u0435\u0440\u0435\u0437 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u0435 \u043F\u0440\u0435\u0432\u044C\u044E.");
}
function authorize(req, id) {
  const expected = proofs.get(id), actual = String(req.headers["x-panel-proof"] || "");
  if (!expected || Buffer.byteLength(actual) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
    const error = new Error("\u0417\u0430\u0449\u0438\u0442\u043D\u044B\u0439 \u043A\u043B\u044E\u0447 \u043F\u0430\u043D\u0435\u043B\u0438 \u0443\u0441\u0442\u0430\u0440\u0435\u043B. \u041E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u043C \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435.");
    error.code = "PANEL_PROOF_REQUIRED";
    throw error;
  }
  const origin = req.headers.origin;
  const allowed = addon ? [`http://${req.headers.host}`] : [`http://localhost:${port}`, `http://127.0.0.1:${port}`, `http://[::1]:${port}`];
  if (!preview && origin && !allowed.includes(origin)) throw new Error("\u0417\u0430\u043F\u0440\u043E\u0441 \u0438\u0437 \u0434\u0440\u0443\u0433\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D.");
  if (!preview && req.headers["sec-fetch-site"] === "cross-site") throw new Error("\u041C\u0435\u0436\u0441\u0430\u0439\u0442\u043E\u0432\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D.");
}
var server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost"), path = decodeURIComponent(url.pathname);
    if (path === "/health" && req.method === "GET") return json(res, 200, { ok: true });
    if (path.startsWith("/api/panel/")) {
      const id = identify(req), p = getProfile(id), route = path.slice("/api/panel/".length);
      if (req.method === "GET" && route === "session") {
        if (!proofs.has(id)) proofs.set(id, randomBytes4(32).toString("hex"));
        return json(res, 200, { proof: proofs.get(id) });
      }
      if (req.method === "GET" && route === "bootstrap") {
        if (!proofs.has(id)) proofs.set(id, randomBytes4(32).toString("hex"));
        return json(res, 200, { preferences: clientPreferences(p.preferences), photo: !!p.photo, proof: proofs.get(id), preview, addon, haConfigured: ha.enabled });
      }
      if (req.method === "GET" && route === "profile/export") {
        const data2 = Buffer.from(JSON.stringify({ exportedAt: (/* @__PURE__ */ new Date()).toISOString(), version: 3, preferences: clientPreferences(p.preferences) }, null, 2));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="home-panel-profile.json"', "Cache-Control": "no-store" });
        return res.end(data2);
      }
      if (req.method !== "GET") authorize(req, id);
      if (route === "assistant/status" && req.method === "GET") return json(res, 200, await assistant.status(id, p.preferences));
      if (route === "assistant/shopping" && req.method === "GET") return json(res, 200, await assistant.shopping(p.preferences));
      if (route === "assistant/settings" && req.method === "PUT") {
        if (pendingScopes.has(id)) throw new Error("\u0414\u043E\u0436\u0434\u0438\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F.");
        return json(res, 200, { settings: assistant.saveSettings(id, JSON.parse((await body(req)).toString())) });
      }
      if (route === "assistant/action" && req.method === "POST") {
        if (pendingScopes.has(id)) throw new Error("\u0414\u043E\u0436\u0434\u0438\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0433\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F.");
        pendingScopes.set(id, (pendingScopes.get(id) || 0) + 1);
        assistantScopes.add(id);
        try {
          return json(res, 200, await assistant.execute(id, p.preferences, JSON.parse((await body(req)).toString())));
        } finally {
          assistantScopes.delete(id);
          const n = pendingScopes.get(id) - 1;
          if (n) pendingScopes.set(id, n);
          else pendingScopes.delete(id);
        }
      }
      if (route === "ha/history" && req.method === "GET") {
        if (url.searchParams.has("entity_id") || url.searchParams.has("filter_entity_id")) throw new Error("\u0421\u0443\u0449\u043D\u043E\u0441\u0442\u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u043C\u0438 \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0430\u043C\u0438 \u043F\u0440\u043E\u0444\u0438\u043B\u044F.");
        return json(res, 200, await loadHistory(ha, p.preferences, url.searchParams.get("hours")));
      }
      if (route === "house-profile" && req.method === "POST") {
        if (preview) throw new Error("\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u0434\u043E\u043C\u0430 \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u0438.");
        if (pendingScopes.has(id)) throw new Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0434\u043E\u0436\u0434\u0438\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u044B.");
        const result = activateHouseProfile(p.preferences, await ha.states());
        if (!result.report.some((r) => r.ok)) throw new Error("\u041D\u0438 \u043E\u0434\u043D\u0430 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u043E\u0444\u0438\u043B\u044F \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0438 \u0438 \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0438.");
        db.prepare("UPDATE profiles SET preferences=? WHERE id=?").run(JSON.stringify(result.preferences), id);
        return json(res, 200, result);
      }
      if (route === "preferences" && req.method === "PUT") {
        if (pendingScopes.has(id)) throw new Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0434\u043E\u0436\u0434\u0438\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u044B.");
        const input = JSON.parse((await body(req)).toString());
        if (input && typeof input === "object" && Array.isArray(input.devices) && input.yard_onvif_pass === void 0)
          input.yard_onvif_pass = p.preferences.yard_onvif_pass;
        if (input && typeof input === "object" && Array.isArray(input.devices)) {
          if (input.yard_onvif_user === void 0) input.yard_onvif_user = p.preferences.yard_onvif_user;
          if (input.yard_onvif_host === void 0) input.yard_onvif_host = p.preferences.yard_onvif_host;
          if (input.yard_onvif_enabled === void 0) input.yard_onvif_enabled = p.preferences.yard_onvif_enabled;
          if (input.energy_readings === void 0) input.energy_readings = p.preferences.energy_readings;
          if (input.energy_tariff === void 0) input.energy_tariff = p.preferences.energy_tariff;
        }
        if (input && typeof input === "object" && input.deviceModel === void 0 && Array.isArray(input.devices)) {
          const ids = new Set(input.devices.map((d) => d?.id));
          input.deviceModel = { ...p.preferences.deviceModel, groups: p.preferences.deviceModel.groups.map((g) => ({ ...g, members: g.members.filter((id2) => ids.has(id2)) })).filter((g) => g.members.length) };
        }
        const next = validatePreferences(input);
        for (const d of next.devices) {
          const old = p.preferences.devices.find((old2) => old2.id === d.id);
          if (old && old.type !== d.type) throw new Error("\u0422\u0438\u043F \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0433\u043E \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u043D\u0435\u043B\u044C\u0437\u044F \u043C\u0435\u043D\u044F\u0442\u044C.");
          if (!samePhysicalDevice(old, d)) next.bindings[d.id].verified = false;
        }
        const newVerified = bindingDefinitions(next.devices).filter((d) => {
          const b = next.bindings[d.id], old = p.preferences.bindings[d.id];
          return b.verified && (!old?.verified || old.entityId !== b.entityId);
        });
        const rejected = [], offline = [];
        if (newVerified.length) {
          const list = await ha.states(), entities = new Map(list.map((e) => [e.entity_id, e]));
          for (const def of newVerified) {
            const b = next.bindings[def.id], e = entities.get(b.entityId);
            if (!e) {
              b.verified = false;
              rejected.push({ id: def.id, name: def.name, problem: "\u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0432 Home Assistant" });
              continue;
            }
            if (["unknown", "unavailable", ""].includes(e.state)) {
              offline.push({ id: def.id, name: def.name, problem: "\u0441\u0435\u0439\u0447\u0430\u0441 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0432 Home Assistant" });
              continue;
            }
            const problem = bindingProblem(def.device, e);
            if (problem) {
              b.verified = false;
              rejected.push({ id: def.id, name: def.name, problem });
            }
          }
        }
        db.prepare("UPDATE profiles SET preferences=? WHERE id=?").run(JSON.stringify(next), id);
        yardOnvifEnsure(next);
        journal("\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D (" + (rejected.length ? "\u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u043E: " + rejected.length : "\u0432\u0441\u0435 \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u044B") + ")");
        energyCache = null;
        energyLastKnown = null;
        return json(res, 200, { saved: true, preferences: clientPreferences(next), rejected, offline });
      }
      if (route === "photo") {
        if (req.method === "GET" && p.photo) {
          res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
          return res.end(p.photo);
        }
        if (req.method === "PUT") {
          if (preview) throw new Error("\u0412 \u043E\u0431\u043B\u0430\u0447\u043D\u043E\u043C \u043F\u0440\u0435\u0432\u044C\u044E \u0444\u043E\u0442\u043E \u043D\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A.");
          const bytes = await body(req, 2 * 1024 * 1024);
          if (req.headers["content-type"] !== "image/jpeg" || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new Error("\u041D\u0443\u0436\u0435\u043D \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 JPEG \u0434\u043E 2 \u041C\u0411.");
          db.prepare("UPDATE profiles SET photo=? WHERE id=?").run(bytes, id);
          return json(res, 200, { saved: true });
        }
        if (req.method === "DELETE") {
          db.prepare("UPDATE profiles SET photo=NULL WHERE id=?").run(id);
          return json(res, 200, { saved: true });
        }
      }
      if (route === "ha/states" && req.method === "GET") return json(res, 200, { states: await ha.states(), receivedAt: Date.now() });
      if (route === "ha/yard-motion" && req.method === "GET") {
        yardOnvifEnsure(p.preferences);
        const entity = yardCameraEntity(p.preferences);
        if (entity) yardEntityHint = entity;
        const motion = await yardMotion.check(entity);
        if (motion.motion) yardClips.record().catch((error) => journal("\u041A\u043B\u0438\u043F \u0434\u0432\u043E\u0440\u0430 \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u0430\u043D: " + (error?.message || error), "warn"));
        return json(res, 200, { ...motion, checkedAt: Date.now() });
      }
      if (route === "yard-clips" && req.method === "GET") {
        const limit = Math.min(30, Math.max(1, Number(url.searchParams.get("limit")) || 20));
        return json(res, 200, yardClips.list(limit));
      }
      const clipRoute = /^yard-clip\/(\d+)\/([0-3])$/.exec(route);
      if (clipRoute && req.method === "GET") {
        const frame = yardClips.frame(Number(clipRoute[1]), Number(clipRoute[2]));
        if (!frame) return json(res, 404, { error: "\u041A\u0430\u0434\u0440 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D." });
        res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        return res.end(frame);
      }
      if (route === "yard-clips-capture" && req.method === "POST" && process.env.PANEL_TEST_HOOKS === "1") {
        const request = JSON.parse((await body(req)).toString() || "{}");
        const clip = await yardClips.testCapture({ ...!Number.isFinite(request?.at) ? {} : { at: request.at }, ...request?.dedup === false ? { dedup: false } : {} });
        return json(res, 200, clip ? { id: clip.id, at: clip.at, source: clip.source, frameCount: clip.frameCount } : { created: false });
      }
      if (route === "yard-onvif" && req.method === "GET") {
        const enabled = p.preferences.yard_onvif_enabled !== false;
        const configured = yardOnvifEnsure(p.preferences);
        const s = yardOnvifStatus() || {};
        return json(res, 200, {
          enabled,
          configured,
          alive: !!s.alive,
          eventService: s.eventService || null,
          subscription: s.subscription || null,
          lastMotionAt: s.lastMotionAt || null,
          lastError: s.lastError || null,
          restarts: s.restarts || 0,
          fallback: !configured || !s.alive
        });
      }
      if (route === "health" && req.method === "GET") {
        const onvifOk = yardOnvifEnsure(p.preferences), onvifStatus = yardOnvifStatus() || {};
        let sqliteKB = 0;
        try {
          sqliteKB = Math.round((await stat(resolve(data, "panel.sqlite"))).size / 1024);
        } catch {
        }
        return json(res, 200, {
          ha: { enabled: ha.enabled, connected: ha.enabled && live.states.length > 0, lastError: live.lastError || null, latencyMs: live.lastLatencyMs },
          onvif: {
            enabled: p.preferences.yard_onvif_enabled !== false,
            configured: onvifOk,
            alive: !!onvifStatus.alive,
            subscription: onvifStatus.subscription || null,
            lastMotionAt: onvifStatus.lastMotionAt || null,
            lastError: onvifStatus.lastError || null,
            fallback: !onvifOk || !onvifStatus.alive
          },
          sse: { clients: live.clients.size },
          disk: { sqliteKB, backups: db.prepare("SELECT COUNT(*) c FROM profile_backups").get().c },
          uptime: { seconds: Math.floor((Date.now() - startedAt) / 1e3) },
          version: PANEL_VERSION,
          journal: journalList()
        });
      }
      if (route === "profile-snapshot" && req.method === "POST") {
        const existing = db.prepare("SELECT COUNT(*) c FROM profile_backups WHERE profile_id=? AND reason LIKE 'manual%'").get(id).c;
        const reason = existing ? "manual-" + (existing + 1) : "manual";
        db.prepare("INSERT OR REPLACE INTO profile_backups(profile_id,reason,preferences) VALUES(?,?,?)").run(id, reason, JSON.stringify(p.preferences));
        const saved = db.prepare("SELECT COUNT(*) c FROM profile_backups").get().c;
        journal("\u041F\u0440\u043E\u0444\u0438\u043B\u044C: \u0440\u0443\u0447\u043D\u043E\u0439 \u0441\u043D\u0438\u043C\u043E\u043A \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D (\u0432\u0441\u0435\u0433\u043E \u0441\u043D\u0438\u043C\u043A\u043E\u0432 " + saved + ")");
        return json(res, 200, { ok: true, saved });
      }
      if (route === "ha/weather-forecast" && req.method === "GET") {
        const asked = url.searchParams.get("entity") || "", entityId = /^weather\.[a-z0-9_]+$/.test(asked) ? asked : (await ha.states()).find((e) => e.entity_id.startsWith("weather."))?.entity_id || "";
        if (!entityId) return json(res, 400, { error: "\u0421\u0443\u0449\u043D\u043E\u0441\u0442\u044C \u043F\u043E\u0433\u043E\u0434\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0432 Home Assistant." });
        if (forecastCache && forecastKey === entityId && Date.now() - forecastCache.at < 15 * 60 * 1e3) return json(res, 200, { ...forecastCache.data, cached: true });
        const data2 = { entityId, forecast: await ha.weatherForecast(entityId) };
        forecastCache = { at: Date.now(), data: data2 };
        forecastKey = entityId;
        return json(res, 200, data2);
      }
      if (route === "ha/energy" && req.method === "GET") {
        if (!ha.enabled) throw new Error("Home Assistant \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D. \u0420\u0430\u0441\u0445\u043E\u0434 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u044D\u043D\u0435\u0440\u0433\u0438\u0438 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D.");
        const all = await ha.states();
        const list = all.filter((e) => typeof e?.entity_id === "string" && e.entity_id.startsWith("sensor.") && /schetchik|meter/.test(e.entity_id) && !/signal/.test(e.entity_id));
        const by = (tag) => list.find((e) => e.entity_id.endsWith("_" + tag)) || null;
        const reading = by("reading"), consumption = by("consumption"), meterNumber = by("meter_number"), readingsDate = by("readings_date");
        const readingValue = meterValue(reading);
        const cacheKey = String(readingValue) + "|" + String(readingsDate?.state ?? "");
        if (energyCache && Date.now() - energyCache.at < 6e4 && energyCache.key === cacheKey) return json(res, 200, { ...energyCache.data, cached: true });
        const autoDate = String(readingsDate?.state ?? "");
        if (readingValue !== null && Number.isInteger(readingValue) && readingValue > 0 && /^\d{4}-\d{2}-\d{2}$/.test(autoDate)) {
          const readings = Array.isArray(p.preferences.energy_readings) ? p.preferences.energy_readings : [];
          const existing = readings.find((r) => r?.date === autoDate);
          const maxDate = readings.reduce((m, r) => String(r?.date) > m ? String(r.date) : m, "");
          const candidate2 = existing ? existing.value !== readingValue ? readings.map((r) => r?.date === autoDate ? { date: autoDate, value: readingValue } : r) : null : autoDate > maxDate ? [...readings, { date: autoDate, value: readingValue }] : null;
          if (candidate2) try {
            const nextReadings = sanitizeEnergyReadings(candidate2);
            if (JSON.stringify(nextReadings) !== JSON.stringify(readings)) {
              p.preferences.energy_readings = nextReadings;
              db.prepare("UPDATE profiles SET preferences=? WHERE id=?").run(JSON.stringify(p.preferences), id);
              energyCache = null;
              energyLastKnown = null;
              console.log("Energy: \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u0422\u041D\u0421 " + autoDate + " = " + readingValue + " \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u044B \u0432 \u0438\u0441\u0442\u043E\u0440\u0438\u044E (" + nextReadings.length + " \u0437\u0430\u043F\u0438\u0441\u0435\u0439).");
              journal("\u0421\u0447\u0451\u0442\u0447\u0438\u043A \u0422\u041D\u0421: \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F " + autoDate + " = " + readingValue + " \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u044B \u0432 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438");
            }
          } catch (error) {
            console.log("Energy: \u0430\u0432\u0442\u043E\u043F\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u043E: " + (error?.message || error));
          }
        }
        const monthRaw = monthDelta(readingValue, readingsDate?.state, p.preferences.energy_readings);
        const month = { ...monthRaw, cost: monthCost(monthRaw.delta, p.preferences.energy_tariff) };
        const profileReadings = (Array.isArray(p.preferences.energy_readings) ? p.preferences.energy_readings : []).slice(-36).map((r) => ({ date: String(r?.date ?? ""), value: Number(r?.value) }));
        const profileTariff = Number(p.preferences.energy_tariff);
        const tariff = Number.isFinite(profileTariff) && profileTariff > 0 ? profileTariff : null;
        const history = readingValue === null ? [] : await ha.energyHistory(reading.entity_id, 168);
        const data2 = {
          reading: { value: readingValue, entityId: reading?.entity_id ?? null, updatedAt: reading?.last_updated ?? null },
          consumption: meterValue(consumption),
          meterNumber: meterNumber?.state ?? null,
          readingsDate: readingsDate?.state ?? null,
          deltas: energyDeltas(history),
          month,
          readings: profileReadings,
          tariff
        };
        if (readingValue !== null || meterValue(consumption) !== null) {
          energyLastKnown = { at: Date.now(), data: data2 };
          data2.stale = false;
        } else {
          if (!energyLastKnown) {
            const hist = await ha.energyHistory((reading || readingsDate || { entity_id: "" }).entity_id, 168);
            const last = [...hist].reverse().find((p2) => Number.isFinite(p2.value));
            if (last) energyLastKnown = { at: last.at, data: {
              reading: { value: last.value, entityId: reading?.entity_id ?? null, updatedAt: new Date(last.at).toISOString() },
              consumption: meterValue(consumption),
              meterNumber: meterNumber?.state ?? null,
              readingsDate: readingsDate?.state ?? null,
              deltas: energyDeltas(hist),
              month: { ...monthRaw, delta: null, cost: null },
              readings: profileReadings,
              tariff
            } };
          }
          if (energyLastKnown) return json(res, 200, { ...energyLastKnown.data, stale: true, staleSince: energyLastKnown.at });
        }
        energyCache = { at: Date.now(), data: data2, key: cacheKey };
        return json(res, 200, data2);
      }
      if (route === "ha/stream" && req.method === "GET") {
        if (req.headers["sec-fetch-site"] === "cross-site") return json(res, 403, { error: "\u041C\u0435\u0436\u0441\u0430\u0439\u0442\u043E\u0432\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D." });
        if (!ha.enabled) return json(res, 400, { error: "Home Assistant \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D." });
        req.socket.setNoDelay(true);
        req.socket.setTimeout(0);
        req.setTimeout(0);
        const pid = req.headers["x-panel-id"] || "", old = liveIds.get(pid);
        if (old && !old.writableEnded) old.end();
        if (pid) liveIds.set(pid, res);
        res.on("close", () => {
          if (liveIds.get(pid) === res) liveIds.delete(pid);
        });
        live.subscribe(res);
        return;
      }
      if (route === "device-model" && req.method === "GET") return json(res, 200, { version: 1, devices: buildDeviceModel(p.preferences) });
      if (route === "ha/stream/start" && req.method === "POST") {
        const request = JSON.parse((await body(req)).toString());
        return json(res, 200, await streams.start(request.id, p.preferences, id));
      }
      if (route === "ha/rtc/start" && req.method === "POST") {
        const request = JSON.parse((await body(req)).toString());
        return json(res, 200, await rtc.start(request.id, p.preferences, id));
      }
      const rtcRoute = /^ha\/rtc\/([a-f0-9]{48})(?:\/(offer|candidate|events))?$/.exec(route);
      if (rtcRoute) {
        const [, key, action] = rtcRoute;
        if (req.method === "DELETE" && !action) {
          rtc.get(key, id, p.preferences);
          rtc.close(key);
          return json(res, 200, { stopped: true });
        }
        if (req.method === "GET" && action === "events") {
          if (req.headers["sec-fetch-site"] === "cross-site") throw new Error("\u041C\u0435\u0436\u0441\u0430\u0439\u0442\u043E\u0432\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D.");
          if ([...url.searchParams.keys()].some((k) => k !== "after")) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 WebRTC.");
          return json(res, 200, rtc.events(key, id, p.preferences, Number(url.searchParams.get("after") || 0)));
        }
        if (req.method === "POST" && ["offer", "candidate"].includes(action)) {
          const request = JSON.parse((await body(req, 14e4)).toString());
          return json(res, 200, action === "offer" ? await rtc.offer(key, id, p.preferences, request.offer) : await rtc.addCandidate(key, id, p.preferences, request.candidate));
        }
      }
      const streamRoute = /^ha\/stream\/([a-f0-9]{48})(?:\/(.+))?$/.exec(route);
      if (streamRoute) {
        const [, key, asset] = streamRoute;
        if (req.method === "DELETE" && !asset) {
          streams.get(key, id, p.preferences);
          streams.close(key);
          return json(res, 200, { stopped: true });
        }
        if (req.method === "GET" && asset) {
          if (req.headers["sec-fetch-site"] === "cross-site") throw new Error("\u041C\u0435\u0436\u0441\u0430\u0439\u0442\u043E\u0432\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D.");
          return await streams.proxy(key, asset, url.searchParams, id, p.preferences, req, res);
        }
      }
      if (route === "ha/camera" && req.method === "POST") {
        const request = JSON.parse((await body(req)).toString()), image = await ha.camera(request.id, p.preferences);
        res.writeHead(200, { "Content-Type": image.type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        return res.end(image.bytes);
      }
      if (route === "ha/command" && req.method === "POST") {
        if (assistantScopes.has(id)) throw new Error("\u0414\u043E\u0436\u0434\u0438\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0441\u0442\u0430\u043D\u0446\u0438\u0438.");
        const request = JSON.parse((await body(req)).toString());
        pendingScopes.set(id, (pendingScopes.get(id) || 0) + 1);
        try {
          return json(res, 200, await ha.command(request, p.preferences));
        } finally {
          const n = pendingScopes.get(id) - 1;
          if (n) pendingScopes.set(id, n);
          else pendingScopes.delete(id);
        }
      }
      if (route === "ha/alarm" && req.method === "POST") {
        const request = JSON.parse((await body(req)).toString());
        return json(res, 200, await ha.alarmService(request?.service, request?.code));
      }
      if (route === "ha/shopping" && req.method === "GET") {
        if (shoppingCache && Date.now() - shoppingCache.at < 1e4) return json(res, 200, { ...shoppingCache.data, cached: true });
        const data2 = await ha.shoppingItems();
        shoppingCache = { at: Date.now(), data: data2 };
        return json(res, 200, data2);
      }
      if (route === "ha/shopping" && req.method === "POST") {
        const request = JSON.parse((await body(req)).toString());
        const result = await ha.shoppingMutate(request?.action === "complete" ? "complete" : "add", request?.target);
        if (Array.isArray(result.items)) shoppingCache = { at: Date.now(), data: { entity: "todo.shopping_list", count: result.items.length, items: result.items } };
        return json(res, 200, { action: result.action, confirmed: result.confirmed, message: result.message, items: result.items });
      }
      if (route === "ha/announce" && req.method === "POST") {
        const request = JSON.parse((await body(req)).toString());
        return json(res, 200, await ha.announce(request?.text, p.preferences));
      }
      if (route === "ha/converse" && req.method === "POST") {
        if (assistantScopes.has(id)) throw new Error("\u0414\u043E\u0436\u0434\u0438\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0441\u0442\u0430\u043D\u0446\u0438\u0438.");
        const request = JSON.parse((await body(req)).toString());
        return json(res, 200, await ha.converse(request?.text));
      }
      if (route === "ha/scenario" && req.method === "POST") {
        if (assistantScopes.has(id)) throw new Error("\u0414\u043E\u0436\u0434\u0438\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0441\u0442\u0430\u043D\u0446\u0438\u0438.");
        const request = JSON.parse((await body(req)).toString());
        pendingScopes.set(id, (pendingScopes.get(id) || 0) + 1);
        const scenarioId = String(request?.id || "");
        try {
          const result = scenarioId.startsWith("user-") ? await runUserScenario(scenarioId, ha, p.preferences) : await runScenario(scenarioId, ha, p.preferences);
          return json(res, 200, result);
        } finally {
          const n = pendingScopes.get(id) - 1;
          if (n) pendingScopes.set(id, n);
          else pendingScopes.delete(id);
        }
      }
      return json(res, 404, { error: "\u041C\u0430\u0440\u0448\u0440\u0443\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D." });
    }
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "\u041C\u0435\u0442\u043E\u0434 \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D." });
    const relative = path === "/" ? "index.html" : path.slice(1);
    if (!/^(index\.html|sw\.js|style\.css|app\.js|(?:model|chunk)-[A-Za-z0-9_-]+\.js|assets\/[A-Za-z0-9_./-]+\.(webp|woff2|ttf|txt|js))$/.test(relative) || relative.includes("..")) return json(res, 404, { error: "\u0424\u0430\u0439\u043B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D." });
    const file = resolve(root, relative);
    await stat(file);
    const type = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".webp": "image/webp", ".woff2": "font/woff2", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8" }[extname(file)];
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" });
    res.end(req.method === "HEAD" ? void 0 : await readFile(file));
  } catch (error) {
    if (res.headersSent) return res.end();
    const message = error instanceof SyntaxError ? "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 JSON." : error.code === "ENOENT" ? "\u0424\u0430\u0439\u043B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D." : error.message;
    json(res, error.code === "ENOENT" ? 404 : 400, { error: message, ...error.code === "PANEL_PROOF_REQUIRED" ? { code: error.code } : {} });
  }
});
server.requestTimeout = 25e3;
server.listen(port, preview || addon ? "0.0.0.0" : "127.0.0.1", () => {
  console.log(`Panel ready: port ${port} \xB7 ${addon ? "Home Assistant add-on" : preview ? "private preview" : "local only"} \xB7 HA ${ha.enabled ? "configured" : "not configured"}`);
  journal("\u041F\u0430\u043D\u0435\u043B\u044C \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u0430: \u043F\u043E\u0440\u0442 " + port + (addon ? " \xB7 add-on" : preview ? " \xB7 \u043F\u0440\u0435\u0432\u044C\u044E" : " \xB7 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E") + (ha.enabled ? " \xB7 Home Assistant \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D" : " \xB7 \u0434\u0435\u043C\u043E\u0440\u0435\u0436\u0438\u043C"));
  if (process.platform === "win32" && process.argv.includes("--open")) spawn("rundll32.exe", ["url.dll,FileProtocolHandler", `http://127.0.0.1:${port}`], { stdio: "ignore" }).on("error", () => {
  });
});
server.on("error", (error) => {
  console.error(error.code === "EADDRINUSE" ? `Port ${port} is busy. Close the other panel server or set PORT in .env.` : "Panel server could not start.");
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => {
  live.stop();
  db.close();
  process.exit(0);
}));
