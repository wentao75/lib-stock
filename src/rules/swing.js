/**
 * 推进器交易，波段
 *
 */
import _ from "lodash";
import moment from "moment";
import utils from "../indicators/utils";
import trans from "../transaction";
import debugpkg from "debug";
import { getDataRoot } from "@wt/lib-wtda-query";

import MA from "../indicators/ma";

const debug = debugpkg("engine");

const RULE_NAME = "swing";
const SWING_DATA = Symbol("SWING_DATA");
const SWING_CONTEXT = Symbol("SWING_CONTEXT");

function calculateSwing(stockData, { n = 8, m = 21, l = 50, digits = 3 } = {}) {
    if (_.isNil(stockData)) return;
    let type = "ema";
    let source = "close";
    if (_.isNil(stockData[SWING_DATA])) {
        let ma1 = MA.calculate(stockData, {
            n,
            source,
            type,
            digits,
        });
        let ma2 = MA.calculate(stockData, {
            m,
            source,
            type,
            digits,
        });
        let ma3 = MA.calculate(stockData, {
            l,
            source,
            type,
            digits,
        });
        stockData[SWING_DATA] = [ma1, ma2, ma3];
    }
}

function checkSwing(index, stockData, options, tsCode) {
    let opt = options && options.swing;
    calculateSwing(stockData, opt);

    let range = (opt && opt.range) || 8;
    let earn1 = (opt && opt.earn1) || 0.04;
    let earn2 = (opt && opt.earn2) || 0.08;
    let loss = (opt && opt.loss) || 0.04;

    let data = stockData[SWING_DATA];
    if (!data || !data[0] || !data[1]) return;
    if (
        stockData &&
        _.isArray(stockData) &&
        index < stockData.length &&
        index >= 0
    ) {
        let tradeDate = stockData[index].trade_date;
        // 找到ma1<=ma2 && ma1>ma2的交叉日，这是READY状态；注意READY状态不能太远，考虑仅查找最多8天
        // READY后，如果 ma1 >= daily.low，则发生“回撤”，进入BUY状态，设定目标
        let ma1 = data[0];
        let ma2 = data[1];
        if (ma1[index] <= ma2[index]) return;

        let start = index;
        let ready_days = 1;
        for (let i = 0; i < range; i++) {
            if (ma1[index - i - 1] <= ma2[index - i - 1]) {
                // index-i 是交叉发生点
                start = index - i;
                ready_days = i + 1;
                break;
            }
        }

        let pullback_days = 0;
        let times = 0;
        let state = 0;
        let lossState = 0;

        let target = 0;
        let ruleTarget = 0;
        let maxLoss = 0;
        for (let i = index - ready_days + 1; i <= index; i++) {
            // 当天开始是交易状态，首先完成交易
            if (state === 1) {
                // 交易过程状态，等待止损或者改变条件
                if (
                    (lossState === 1 && maxLoss >= tradeDate[i].high) ||
                    (lossState === 2 && ma2[i] >= tradeDate[i].high)
                ) {
                    // 触发止损
                    state = 9;
                } else if (lossState === 1 && ruleTarget <= tradeDate[i].high) {
                    // 止损规则目标达成，这时调整止损规则到跟随ma2
                    lossState = 2;
                } else if (target <= tradeDate[i].high) {
                    // 达到
                    state = 0;
                }
            }

            // 状态为等待回调，确定是否可以交易，每次交易表示一个周期增加
            if (state === 0 && ma1[i] >= tradeDate[i].low) {
                // 等待机会并且触发
                // 触发回调
                target1 = ma1[i] * (1 + earn1);
                target2 = ma1[i] * (1 + earn2);

                // 止损初期采用固定比例和ma2价格低的那个
                maxLoss = Math.min(ma1[i] * (1 - loss), ma2[i]);
                lossState = 1;

                if (pullback_days <= 0) {
                    pullback_days = i + 1;
                }

                times++;
                state = 1;
                pullback_days = index - i + 1;
            }

            if (state === 9 && tradeDate[i].close > ma1[i]) {
                // 价格重新进入等待回调状态
                state = 0;
            }
        }

        let signal = state === 0 ? "READY" : state === 1 ? "BUY" : "LOSS";
        let memo = "";
        let targets = ["--", "--"];
        if (state === 1) {
            targets[0] = utils.toFixed(target1, 2);
            if (lossState === 1) {
                targets[1] = utils.toFixed(maxLoss, 2);
            } else if (lossState === 2) {
                target[1] = utils.toFixed(ma2[index], 2);
            }
        } else if (state === 0 || state === 9) {
            targets[0] = utils.toFixed(ma1[index], 2);
        }

        if (state === 0) {
            memo = `波段：等待回调，目标 ¥${targets[0]}，持续${ready_days}天`;
        } else if (state === 1) {
            memo = `波段：已买入，目标价位 ¥${targets[0]}， ${
                lossState === 1 ? "初始止损" : "跟随止损"
            } ¥${targets[1]}}`;
        } else if (state === 9) {
            memo = `波段：发生止损，等待下一次回调，目标 ${targets[0]}`;
        }

        return {
            tsCode,
            dataIndex: index,
            date: tradeDate,
            tradeType: "signal",
            hasSignals: true,
            signal,
            type: "swing",
            swing: {
                days: [ready_days, pullback_days],
                times,
                state,
                lossState,
                targets,
            },
            memo,
        };
    }
}

function check(index, stockData, options, tsCode) {
    let ret = checkSwing(index, stockData, options, tsCode);
    if (!ret) return;
    // 只有等待回调的阶段需要进入返回列表
    if (ret.swing && ret.swing.state !== 0) return;
    return ret;
}

function readContext(index, stockData) {
    if (!stockData || !_.isArray(stockData)) return;
    if (index < stockData.length && index >= 0) {
        let contexts = stockData[SWING_CONTEXT];
        if (contexts && _.isArray(contexts)) {
            return contexts[index];
        }
    }
}

function saveContext(index, context, stockData) {
    if (!stockData && !_.isArray(stockData)) {
        return;
    }
    if (index < stockData.length && index >= 0) {
        let contexts = stockData[SWING_CONTEXT];
        if (!contexts) {
            stockData[SWING_CONTEXT] = [];
            contexts = stockData[SWING_CONTEXT];
        }
        contexts[index] = context;
    }
}

function checkBuyTransaction(stockInfo, balance, index, stockData, options) {
    debug(`检查波段买入：${index}, ${balance}`);
    if (balance <= 0) return;

    let ret = checkSwing(index, stockData, options, stockInfo.ts_code);
    if (!ret) return;

    let state = ret && ret.swing && ret.swing.state;
    let data = stockData[index];
    if (state === 0) {
    }
}

function checkSellTransaction(stockInfo, stock, index, stockData, options) {
    if (_.isNil(stock) || stock.count <= 0) return;

    let ret = checkSwing(index, stockData, options, stockInfo.ts_code);
    if (!ret) return;
}

/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */
function showOptions(options) {
    let opt = options && options.swing;
    return `
模型 ${swing.name}[${swing.label}] 参数：
均线1: ${opt.n},  均线2: ${opt.m}
`;
}

async function createReports(results, options) {
    if (_.isNil(results)) return;

    let reports = {
        updateTime: moment().toISOString(),
        swing: {},
    };

    return reports;
}

const swing = {
    name: "波段交易",
    label: RULE_NAME,

    description: "波段选择",
    methodTypes: {},
    checkBuyTransaction,
    checkSellTransaction,
    check,
    showOptions,
    createReports,
};

export default swing;
