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

import MA from "./indicators/ma";
import ATR from "./indicators/atr";
import KC from "./indicators/keltner-channel";

const indicators = {
    MA,
    ATR,
    KC,
};

const rules = {
    mmb,
    stoploss,
    benchmark,
    outsideday,
    opensell,
    smashday,
};

export { simulate, search, engine, rules, reports, formatFxstr, indicators };
