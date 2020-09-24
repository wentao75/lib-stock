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
// import { formatFxstr } from "./util";

import squeeze from "./rules/squeeze";
import swing from "./rules/swing";

import MA from "./indicators/ma";
import ATR from "./indicators/atr";
import KC from "./indicators/keltner-channel";
import BOLL from "./indicators/boll";
import MTM from "./indicators/mtm";
import AO from "./indicators/ao";
import SQUEEZE from "./indicators/squeeze";
import TTMWave from "./indicators/ttmwave";
import TTMTrend from "./indicators/ttmtrend";
import Scalper from "./indicators/scalper";
import utils from "./utils";

import favorites from "./favorites";

const indicators = {
    MA,
    ATR,
    KC,
    BOLL,
    MTM,
    AO,
    SQUEEZE,
    TTMWave,
    TTMTrend,
    Scalper,
};

const rules = {
    mmb,
    stoploss,
    benchmark,
    outsideday,
    opensell,
    smashday,
    squeeze,
    swing,
};

export {
    simulate,
    search,
    engine,
    rules,
    reports,
    indicators,
    utils,
    favorites,
};
