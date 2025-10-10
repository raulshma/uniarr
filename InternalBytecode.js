// Placeholder file to satisfy Metro's symbolication when Hermes internal
// bytecode frames are present in a stack trace. Some Hermes/Metro setups
// reference an `InternalBytecode.js` virtual source which doesn't exist
// on disk; Metro attempts to open it and logs ENOENT when missing. An
// empty placeholder reduces noisy ENOENT logs in development.
//
// NOTE: This file is intentionally empty; do not add executable code here.
