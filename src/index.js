// const simulate = require("./simulator");
import simulate from "./simulator";
import mmb from "./momentum-breakthrough";
import stoploss from "./stoploss";
import benchmark from "./benchmark-basic";
import engine from "./transaction-engine";
import * as reports from "./reports";
import { formatFxstr } from "./util";

const rules = {
    mmb,
    stoploss,
    benchmark,
};

export { simulate, engine, rules, reports, formatFxstr };
