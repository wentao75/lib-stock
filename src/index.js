// const simulate = require("./simulator");
import simulate from "./simulator";
import mmb from "./momentum-breakthrough";
import stoploss from "./stoploss";
import engine from "./transaction-engine";
import { formatFxstr } from "./util";

const rules = {
    mmb,
    stoploss,
};

export { simulate, engine, rules, formatFxstr };
