"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "_rsc_src_db_pool_ts";
exports.ids = ["_rsc_src_db_pool_ts"];
exports.modules = {

/***/ "(rsc)/./src/db/pool.ts":
/*!************************!*\
  !*** ./src/db/pool.ts ***!
  \************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   getPool: () => (/* binding */ getPool)\n/* harmony export */ });\n/* harmony import */ var pg__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! pg */ \"pg\");\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([pg__WEBPACK_IMPORTED_MODULE_0__]);\npg__WEBPACK_IMPORTED_MODULE_0__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];\n\nconst DEFAULT_CONNECTION = \"postgres://rapportax:rapportax@localhost:5432/rapportax\";\nlet pool = null;\nfunction getPool() {\n    if (!pool) {\n        pool = new pg__WEBPACK_IMPORTED_MODULE_0__.Pool({\n            connectionString: process.env.DATABASE_URL ?? DEFAULT_CONNECTION\n        });\n    }\n    return pool;\n}\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvZGIvcG9vbC50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUEwQjtBQUUxQixNQUFNQyxxQkFDSjtBQUVGLElBQUlDLE9BQW9CO0FBRWpCLFNBQVNDO0lBQ2QsSUFBSSxDQUFDRCxNQUFNO1FBQ1RBLE9BQU8sSUFBSUYsb0NBQUlBLENBQUM7WUFDZEksa0JBQ0VDLFFBQVFDLEdBQUcsQ0FBQ0MsWUFBWSxJQUFJTjtRQUNoQztJQUNGO0lBQ0EsT0FBT0M7QUFDVCIsInNvdXJjZXMiOlsid2VicGFjazovL0ByYXBwb3J0YXgvYWRtaW4tZXhlY3V0b3IvLi9zcmMvZGIvcG9vbC50cz8xNGEzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFBvb2wgfSBmcm9tIFwicGdcIjtcblxuY29uc3QgREVGQVVMVF9DT05ORUNUSU9OID1cbiAgXCJwb3N0Z3JlczovL3JhcHBvcnRheDpyYXBwb3J0YXhAbG9jYWxob3N0OjU0MzIvcmFwcG9ydGF4XCI7XG5cbmxldCBwb29sOiBQb29sIHwgbnVsbCA9IG51bGw7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRQb29sKCk6IFBvb2wge1xuICBpZiAoIXBvb2wpIHtcbiAgICBwb29sID0gbmV3IFBvb2woe1xuICAgICAgY29ubmVjdGlvblN0cmluZzpcbiAgICAgICAgcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMID8/IERFRkFVTFRfQ09OTkVDVElPTixcbiAgICB9KTtcbiAgfVxuICByZXR1cm4gcG9vbDtcbn1cbiJdLCJuYW1lcyI6WyJQb29sIiwiREVGQVVMVF9DT05ORUNUSU9OIiwicG9vbCIsImdldFBvb2wiLCJjb25uZWN0aW9uU3RyaW5nIiwicHJvY2VzcyIsImVudiIsIkRBVEFCQVNFX1VSTCJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./src/db/pool.ts\n");

/***/ })

};
;