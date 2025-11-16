import { Platform } from "react-native";
import structuredClone from "@ungap/structured-clone";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import * as Crypto from "expo-crypto";
import { Buffer } from "buffer";
import {
  ReadableStream,
  WritableStream,
  TransformStream,
} from "web-streams-polyfill";

// Polyfill Buffer globally for React Native
if (!global.Buffer) {
  global.Buffer = Buffer;
}

// Polyfill process for Node.js compatibility
if (!global.process) {
  global.process = require("process");
  // Set minimal process.env for compatibility
  global.process.env = global.process.env || {};
}

if (Platform.OS !== "web") {
  const setupPolyfills = async () => {
    const { polyfillGlobal } = await import(
      "react-native/Libraries/Utilities/PolyfillFunctions"
    );

    const { TextEncoderStream, TextDecoderStream } = await import(
      "@stardazed/streams-text-encoding"
    );

    if (!("structuredClone" in global)) {
      polyfillGlobal("structuredClone", () => structuredClone);
    }

    // Polyfill Web Streams API
    if (!global.ReadableStream) {
      polyfillGlobal("ReadableStream", () => ReadableStream);
    }
    if (!global.WritableStream) {
      polyfillGlobal("WritableStream", () => WritableStream);
    }
    if (!global.TransformStream) {
      polyfillGlobal("TransformStream", () => TransformStream);
    }

    polyfillGlobal("TextEncoderStream", () => TextEncoderStream);
    polyfillGlobal("TextDecoderStream", () => TextDecoderStream);

    // Polyfill crypto for AWS SDK
    if (!global.crypto) {
      global.crypto = {
        getRandomValues: (array) => {
          // react-native-get-random-values handles this automatically
          return array;
        },
        randomUUID: () => {
          return Crypto.randomUUID();
        },
      };
    }
  };

  setupPolyfills();
}

export {};
