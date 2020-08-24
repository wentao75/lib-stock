import { terser } from "rollup-plugin-terser";
import resolve from "@rollup/plugin-node-resolve";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import pkg from "./package.json";

// const externalDeps = Object.keys(
//     Object.assign({}, pkg.dependencies, pkg.peerDependencies)
// );

export default {
    input: "src/index.js",
    external: ["lodash", "moment", "debug", "@wt/lib-wtda-query"],
    plugins: [
        resolve(),
        babel({
            exclude: "node_modules/**",
            babelHelpers: "runtime",
        }),
        commonjs({
            include: "node_modules/**",
        }),
        terser(),
    ],
    output: [
        {
            file: "lib-stock.js",
            format: "umd",
            name: pkg.name,
            sourcemap: true,
        },
        // {
        //     file: "flowcontrol.esm.js",
        //     format: "es",
        // },
        // {
        //     file: "dist/flowcontrol.cjs.js",
        //     format: "cjs",
        //     name,
        //     sourcemap: "inline",
        // },
    ],
};
