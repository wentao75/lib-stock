// const simulate = require("./simulator");
import simulate from "./simulator";
import search from "./search";
import engine from "./transaction-engine";
import * as reports from "./reports";

import benchmark from "./rules/benchmark-basic";
import mmb from "./rules/momentum-breakthrough";
import stoploss from "./rules/stoploss";
import outsideday from "./rules/outsideday";
import opensell from "./rules/opensell";
import smashday from "./rules/smashday";
import squeeze from "./rules/squeeze";
import swing from "./rules/swing";
import holp from "./rules/holp";
import rsi from "./rules/rsi-panic";
import vixfix from "./rules/vixfix";
import everyday from "./rules/Everyday";
import trend from "./rules/trend";

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
import RSI from "./indicators/rsi";
import WVF from "./indicators/wvf";
import EVERYDAY from "./indicators/everyday";
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
    RSI,
    WVF,
    EVERYDAY,
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
    holp,
    rsi,
    vixfix,
    everyday,
    trend,
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
