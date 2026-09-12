const isNodeTest = typeof window === "undefined" || (typeof global !== "undefined" && global.window === global);
console.log(isNodeTest);
