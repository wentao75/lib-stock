// const simulate = require("./simulator");
import simulate from "./simulator";
import search from "./search";
import mmb from "./momentum-breakthrough";
import stoploss from "./stoploss";
import benchmark from "./benchmark-basic";
import outsideday from "./outsideday";
import opensell from "./opensell";
import smashday from "./smashday";
import engine from "./transaction-engine";
import * as reports from "./reports";
import { formatFxstr } from "./util";

const rules = {
    mmb,
    stoploss,
    benchmark,
    outsideday,
    opensell,
    smashday,
};

export { simulate, search, engine, rules, reports, formatFxstr };
