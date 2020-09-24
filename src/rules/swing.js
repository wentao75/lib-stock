/**
 * 推进器交易，波段
 *
 */
import _ from "lodash";
import moment from "moment";
import utils from "../utils";
import trans from "../transaction";
import debugpkg from "debug";
import { getDataRoot } from "@wt/lib-wtda-query";

import MA from "../indicators/ma";

const debug = debugpkg("rules:swing");

const RULE_NAME = "swing";
const SWING_DATA = Symbol("SWING_DATA");
const SWING_CONTEXT = Symbol("SWING_CONTEXT");

function calculateSwing(
    stockData,
    {
        n = 8,
        m = 21,
        l = 50,
        earn1 = 0.04,
        earn2 = 0.08,
        loss = 0.04,
        digits = 3,
    } = {}
) {
    if (_.isNil(stockData)) return;
    let type = "ema";
    let source = "close";
    debug(`swing options: n=${n} m=${m} l=${l}`);
    if (_.isNil(stockData[SWING_DATA])) {
        let ma1 = MA.calculate(stockData, {
            n,
            source,
            type,
            digits,
        });
        debug(`%o`, ma1);
        let ma2 = MA.calculate(stockData, {
            n: m,
            source,
            type,
            digits,
        });
        debug(`%o`, ma2);
        let ma3 = MA.calculate(stockData, {
            n: l,
            source,
            type,
            digits,
        });

        let swingData = [];
        let started = false;
        let currentState;
        for (let index = 0; index < stockData.length; index++) {
            // 从第一天开始检查

            // 响应的状态持续值
            let state = -1;
            let lossState = 0;
            let target = 0;
            let ruleTarget = 0;
            let lossTarget = 0;
            let trans = [];
            let ready_days = 0;
            let pullback_days = 0;
            let times = (currentState && currentState.times) || 0;
            let data = stockData[index];

            if (index === 0 || index < Math.max(n, m) || !started) {
                // 第一天为特殊定义，确认初始值，内容为状态定义，为后续下一天判断提供依据
                // newState = {
                //     state: -1, // 状态，-1 反向状态；0 区间等待回撤；1 回撤已交易，等待目标或止损；9 止损/初始，等待重新进入正常等待回撤区间（超过ma1）
                //     lossState: -1, // 止损状态，1 指定止损，交易后，按照交易价格 min(止损比例，ma2）；2 跟随止损（ma2）
                //     targets: [], // [0] 目标价格 [1] 止损价格 [2] 止损规则价格
                //     trans: [], // 交易，{type: BUY|SELL, price}
                //     days: [], // [0] 进入非-1的持续天数, [1] 上一次回撤后的持续天数
                //     times, // 交易发生次数
                // };
                // 这里要找到适当的ma1穿过ma2的时间点才能启动
                if (
                    index > 0 &&
                    index >= Math.max(n, m) - 1 &&
                    ma1[index] &&
                    ma2[index] &&
                    ma1[index] < ma2[index]
                ) {
                    started = true;
                }
            } else {
                if (ma1[index] >= ma2[index]) {
                    // 在ma1 >= ma2正确的曲线范围内
                    state = currentState.state;
                    lossState = currentState.lossState;
                    [target, lossTarget, ruleTarget] = currentState.targets;
                    [ready_days, pullback_days] = currentState.days;
                    if (pullback_days > 0) {
                        pullback_days++;
                    }
                    if (ready_days > 0) {
                        ready_days++;
                    }
                    times = currentState.times;

                    // 今日穿墙
                    if (currentState.state === -1) {
                        // 当前非符合条件状态，查看今天
                        if (data.open >= ma1[index]) {
                            debug(`** ${data.trade_date} 进入等待回调区间`);
                            state = 0;
                        } else {
                            debug(
                                `** ${data.trade_date} 进入初始状态，等待进入多头区间`
                            );
                            state = 9;
                        }
                        lossState = 0;
                        ready_days = 1;
                        pullback_days = 0;
                        times = 0;

                        target = 0;
                        lossTarget = 0;
                        ruleTarget = 0;
                    }

                    // 止损/初始后等待进入正常回调区间
                    if (currentState.state === 9) {
                        if (data.high >= ma1[index]) {
                            debug(` ** ${data.trade_date} 进入等待回调区间`);
                            state = 0;
                        }
                    }

                    // 交易跟踪，检查止损目标是否需要调整
                    if (
                        lossState === 1 &&
                        (currentState.state === 1 || state === 1) &&
                        data.high >= ruleTarget
                    ) {
                        debug(` ** ${data.trade_date} 达到目标1，调整止损策略`);
                        lossState = 2;
                    }

                    // 交易跟踪，止损
                    if (
                        currentState.state === 1 &&
                        ((lossState === 1 && data.low <= lossTarget) ||
                            (lossState === 2 && data.low <= ma2[index]))
                    ) {
                        // 达到止损
                        state = 9;
                        // 根据当前止损类型确定止损价格，需要注意当天价格是否在范围内
                        let price = lossState === 1 ? lossTarget : ma2[index];
                        price = Math.min(price, data.high);
                        trans.push({ type: "SELL", price });
                        debug(
                            `** ${data.trade_date} 达到止损价位，交易: ${price}`
                        );

                        lossTarget = 0;
                        target = 0;
                        ruleTarget = 0;
                    } else if (
                        currentState.state === 1 &&
                        data.high >= target &&
                        target > 0
                    ) {
                        // 交易跟踪，到达预期价位成交
                        // 目标价位达到
                        let price = currentState.targets[0];
                        price = Math.max(data.low, price);
                        trans.push({ type: "SELL", price });

                        lossState = 0;
                        lossTarget = 0;
                        target = 0;
                        ruleTarget = 0;
                        state = 0;
                        debug(
                            `** ${data.trade_date} 达到目标价位，交易: ${price}`
                        );
                    }

                    // 等待回调
                    if (currentState.state === 0 || state === 0) {
                        // 检查是否回调到ma1
                        if (ma1[index] >= data.low) {
                            state = 1;
                            let price = ma1[index];
                            trans.push({ type: "BUY", price });
                            times++;
                            lossState = 1;
                            lossTarget = Math.min(
                                price * (1 - loss),
                                ma2[index]
                            );

                            target = price * (1 + earn2);
                            ruleTarget = price * (1 + earn1);
                            pullback_days = 1;
                            debug(
                                `** ${data.trade_date} 回调发生，交易：${price}, 目标 ${target}, 止损 ${lossTarget}, ${ruleTarget}; [${ma1[index]} ,${ma2[index]}, ${data.open}, ${data.high}, ${data.low}, ${data.close}]`
                            );
                        }
                    }

                    // 对于今日调整到初始状态的，最后检查是否进入回调等待阶段
                    if (state === 9) {
                        if (data.close >= ma1[index]) {
                            debug(
                                ` ** ${data.trade_date} 收盘进入等待回调区间`
                            );
                            state = 0;
                        }
                    }
                } else {
                    debug(` ** ${data.trade_date} 进入空头阶段，检查平仓`);
                    // 价格已经走出交易区间，如果有头寸，平仓结束
                    if (currentState.state === 1) {
                        state = -1;
                        let price = data.close;
                        trans.push({ type: "SELL", price });
                        debug(
                            `** ${data.trade_date} 进入空头，完成平仓： ${price}`
                        );
                    }

                    state = -1;
                    ready_days = 0;
                    pullback_days = 0;
                }
            }

            swingData[index] = {
                state,
                lossState,
                targets: [target, lossTarget, ruleTarget],
                trans,
                days: [ready_days, pullback_days],
                times,
            };
            currentState = swingData[index];
        }

        stockData[SWING_DATA] = [swingData, ma1, ma2, ma3];
    }
}

function checkSwing(index, stockData, options, tsCode) {
    let opt = options && options.swing;
    calculateSwing(stockData, opt);

    let swingData = stockData[SWING_DATA][0];
    if (
        swingData &&
        _.isArray(swingData) &&
        index < swingData.length &&
        index >= 0
    ) {
        let data = swingData[index];
        if (data.state >= 0) {
            let state = data.state;
            let memo;
            if (state === 0) {
                memo = `波段：等待回调，目标 ¥${utils.toFixed(
                    data.targets[0],
                    2
                )}，持续${data.days[0]}天`;
            } else if (state === 1) {
                memo = `波段：已买入，目标价位 ¥${utils.toFixed(
                    data.targets[0],
                    2
                )}， ${
                    data.lossState === 1 ? "初始止损" : "跟随止损"
                } ¥${utils.toFixed(data.targets[1], 2)}}`;
            } else if (state === 9) {
                memo = `波段：发生止损，等待下一次回调，目标 ${utils.toFixed(
                    data.targets[0],
                    2
                )}`;
            }

            return {
                tsCode,
                dataIndex: index,
                date: stockData[index].trade_date,
                tradeType: "signal",
                hasSignals: true,
                signal:
                    state === 0
                        ? "READY"
                        : state === 1
                        ? "BUY"
                        : state === 9
                        ? "PULLBACK"
                        : "NA",
                type: "swing",
                swing: {
                    days: data.days,
                    times: data.times,
                    state: data.state,
                    lossState: data.lossState,
                    targets: data.targets,
                },
                memo,
            };
        }
    }

    // let range = (opt && opt.range) || 8;
    // let earn1 = (opt && opt.earn1) || 0.04;
    // let earn2 = (opt && opt.earn2) || 0.08;
    // let loss = (opt && opt.loss) || 0.04;

    // if (
    //     stockData &&
    //     _.isArray(stockData) &&
    //     index < stockData.length &&
    //     index >= 0
    // ) {
    //     let tradeDate = stockData[index].trade_date;
    //     // 找到ma1<=ma2 && ma1>ma2的交叉日，这是READY状态；注意READY状态不能太远，考虑仅查找最多8天
    //     // READY后，如果 ma1 >= daily.low，则发生“回撤”，进入BUY状态，设定目标
    //     let ma1 = data[0];
    //     let ma2 = data[1];
    //     if (ma1[index] <= ma2[index]) return;

    //     let start = index;
    //     let ready_days = 1;
    //     for (let i = 0; i < range; i++) {
    //         if (ma1[index - i - 1] <= ma2[index - i - 1]) {
    //             // index-i 是交叉发生点
    //             start = index - i;
    //             ready_days = i + 1;
    //             break;
    //         }
    //     }

    //     let pullback_days = 0;
    //     let times = 0;
    //     let state = 0;
    //     let lossState = 0;

    //     let target = 0;
    //     let ruleTarget = 0;
    //     let maxLoss = 0;
    //     for (let i = index - ready_days + 1; i <= index; i++) {
    //         // 当天开始是交易状态，首先完成交易
    //         if (state === 1) {
    //             // 交易过程状态，等待止损或者改变条件
    //             if (
    //                 (lossState === 1 && maxLoss >= tradeDate[i].high) ||
    //                 (lossState === 2 && ma2[i] >= tradeDate[i].high)
    //             ) {
    //                 // 触发止损
    //                 state = 9;
    //             } else if (lossState === 1 && ruleTarget <= tradeDate[i].high) {
    //                 // 止损规则目标达成，这时调整止损规则到跟随ma2
    //                 lossState = 2;
    //             } else if (target <= tradeDate[i].high) {
    //                 // 达到
    //                 state = 0;
    //             }
    //         }

    //         // 状态为等待回调，确定是否可以交易，每次交易表示一个周期增加
    //         if (state === 0 && ma1[i] >= tradeDate[i].low) {
    //             // 等待机会并且触发
    //             // 触发回调
    //             target1 = ma1[i] * (1 + earn1);
    //             target2 = ma1[i] * (1 + earn2);

    //             // 止损初期采用固定比例和ma2价格低的那个
    //             maxLoss = Math.min(ma1[i] * (1 - loss), ma2[i]);
    //             lossState = 1;

    //             if (pullback_days <= 0) {
    //                 pullback_days = i + 1;
    //             }

    //             times++;
    //             state = 1;
    //             pullback_days = index - i + 1;
    //         }

    //         if (state === 9 && tradeDate[i].close > ma1[i]) {
    //             // 价格重新进入等待回调状态
    //             state = 0;
    //         }
    //     }

    //     let signal = state === 0 ? "READY" : state === 1 ? "BUY" : "LOSS";
    //     let memo = "";
    //     let targets = ["--", "--"];
    //     if (state === 1) {
    //         targets[0] = utils.toFixed(target1, 2);
    //         if (lossState === 1) {
    //             targets[1] = utils.toFixed(maxLoss, 2);
    //         } else if (lossState === 2) {
    //             target[1] = utils.toFixed(ma2[index], 2);
    //         }
    //     } else if (state === 0 || state === 9) {
    //         targets[0] = utils.toFixed(ma1[index], 2);
    //     }

    //     if (state === 0) {
    //         memo = `波段：等待回调，目标 ¥${targets[0]}，持续${ready_days}天`;
    //     } else if (state === 1) {
    //         memo = `波段：已买入，目标价位 ¥${targets[0]}， ${
    //             lossState === 1 ? "初始止损" : "跟随止损"
    //         } ¥${targets[1]}}`;
    //     } else if (state === 9) {
    //         memo = `波段：发生止损，等待下一次回调，目标 ${targets[0]}`;
    //     }

    //     return {
    //         tsCode,
    //         dataIndex: index,
    //         date: tradeDate,
    //         tradeType: "signal",
    //         hasSignals: true,
    //         signal,
    //         type: "swing",
    //         swing: {
    //             days: [ready_days, pullback_days],
    //             times,
    //             state,
    //             lossState,
    //             targets,
    //         },
    //         memo,
    //     };
    // }
}

function check(index, stockData, options, tsCode) {
    let ret = checkSwing(index, stockData, options, tsCode);
    // console.log(`检查${index}波段结果：%o`, ret);
    if (!ret) return;
    // 只有等待回调的阶段需要进入返回列表
    if (ret.swing && ret.swing.state !== 0) {
        return ret;
    }
}

// function readContext(index, stockData) {
//     if (!stockData || !_.isArray(stockData)) return;
//     if (index < stockData.length && index >= 0) {
//         let contexts = stockData[SWING_CONTEXT];
//         if (contexts && _.isArray(contexts)) {
//             return contexts[index];
//         }
//     }
// }

// function saveContext(index, context, stockData) {
//     if (!stockData && !_.isArray(stockData)) {
//         return;
//     }
//     if (index < stockData.length && index >= 0) {
//         let contexts = stockData[SWING_CONTEXT];
//         if (!contexts) {
//             stockData[SWING_CONTEXT] = [];
//             contexts = stockData[SWING_CONTEXT];
//         }
//         contexts[index] = context;
//     }
// }

function checkBuyTransaction(stockInfo, balance, index, stockData, options) {
    debug(`检查波段买入：${index}, ${balance}`);
    if (balance <= 0) return;

    calculateSwing(stockData, options && options.swing);

    let swingData = stockData[SWING_DATA] && stockData[SWING_DATA][0];
    if (
        swingData &&
        _.isArray(swingData) &&
        index < swingData.length &&
        index >= 0
    ) {
        let data = swingData[index];
        debug(`swing data 买入检查: ${index}, %o`, data);
        if (!_.isEmpty(data.trans)) {
            let currentData = stockData[index];
            let tradeDate = currentData.trade_date;
            for (let tran of data.trans) {
                if (tran.type === "BUY") {
                    let targetPrice = tran.price;
                    return trans.createBuyTransaction(
                        stockInfo,
                        tradeDate,
                        index,
                        balance,
                        targetPrice,
                        RULE_NAME,
                        `波段买入 ${targetPrice.toFixed(2)}`
                    );
                }
            }
        }
    }
}

function checkSellTransaction(stockInfo, stock, index, stockData, options) {
    debug(`检查波段卖出：${index}, ${stock.count}`);
    if (_.isNil(stock) || stock.count <= 0) return;

    calculateSwing(stockData, options && options.swing);

    let swingData = stockData[SWING_DATA] && stockData[SWING_DATA][0];
    if (
        swingData &&
        _.isArray(swingData) &&
        index < swingData.length &&
        index >= 0
    ) {
        let data = swingData[index];
        debug(`swing data 卖出检查: ${index}, %o`, data);
        if (!_.isEmpty(data.trans)) {
            let currentData = stockData[index];
            let tradeDate = currentData.trade_date;
            for (let tran of data.trans) {
                if (tran.type === "SELL") {
                    let targetPrice = tran.price;
                    return trans.createSellTransaction(
                        stockInfo,
                        tradeDate,
                        index,
                        stock.count,
                        targetPrice,
                        RULE_NAME,
                        `波段卖出 ${targetPrice.toFixed(2)}`
                    );
                }
            }
        }
    }
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
目标价位：${opt.earn2 * 100}%
止损价位：${opt.loss * 100}%
止损条件价位：${opt.earn1 * 100}%
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
