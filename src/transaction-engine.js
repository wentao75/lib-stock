import _ from "lodash";
import { formatFxstr } from "./util";
import debugpkg from "debug";

const debug = debugpkg("engine");

/**
 * 主处理过程
 * 1. 查看设置中的卖出模型列表，按序执行，如果成交，则直接清算
 * 2. 如果执行完卖出，仍然有持仓，检查配置是否许可买入
 * 3. 如果需要买入，查看设置的买入模型列表，按序执行，如果成交，则直接清算
 *
 * 2020.8.26 目前已经支持按照规则，非固定头寸方式下，可以在持仓下仍然买入
 *           持仓卖出按照每笔单独进行，不合并进行
 *
 * @param {*} index 当前日股票数据索引
 * @param {*} stockData 股票数据信息
 * @param {*} capitalData 账户信息
 * @param {*} options 算法参数
 */
async function executeTransaction(index, stockData, capitalData, options) {
    let translog = null;
    // 首先检查卖出
    // 所有算法首先检查并处理止损
    // 检查是否需要止损
    let tradeDate = stockData[index].trade_date;
    let stockInfo = capitalData.info;

    let sellRules = options.rules && options.rules.sell;
    let buyRules = options.rules && options.rules.buy;

    // 目前的持仓情况
    let stocks = capitalData && capitalData.stocks;
    if (sellRules) {
        // 每个买入持股单独处理
        let stockId = 0;
        while (stockId < stocks.length) {
            let stock = stocks[stockId];
            debug(`卖出股票信息: %o`, stock);

            let sold = false;
            for (let rule of sellRules) {
                if (rule) {
                    debug(
                        `${rule.name} 卖出检查：${tradeDate}, %o`,
                        stockData[index]
                    );
                    translog = rule.checkSellTransaction(
                        stockInfo,
                        stock,
                        index,
                        stockData,
                        options
                    );
                    if (translog) translog.transeq = stock.transeq;
                    if (
                        executeCapitalSettlement(
                            stockInfo,
                            translog,
                            capitalData,
                            options
                        )
                    ) {
                        debug(
                            `${
                                rule.name
                            } 卖出：${tradeDate}，价格：${formatFxstr(
                                translog.price
                            )}元，数量：${
                                translog.count / 100
                            }手，总价：${translog.total.toFixed(
                                2
                            )}元[佣金${translog.commission.toFixed(
                                2
                            )}元，过户费${translog.fee.toFixed(
                                2
                            )}，印花税${translog.duty.toFixed(2)}元], ${
                                translog.memo
                            }`
                        );
                        sold = true;
                        break;
                    }
                }
            }
            if (!sold) {
                // 没有卖出，需要查看下一条持股进行检查
                stockId++;
            }
        }
    }

    // 如果非固定头寸，则检查是否有持仓，如果有不进行买入
    if (!options.fixCash && capitalData.stocks.length > 0) return;
    // if (capitalData && capitalData.stock && capitalData.stock.count > 0) return;

    // 执行买入
    // debug("执行买入检查");
    let cash = capitalData.balance;
    if (options.fixCash) cash = options.initBalance;
    if (buyRules) {
        for (let rule of buyRules) {
            translog = rule.checkBuyTransaction(
                stockInfo,
                cash,
                index,
                stockData,
                options
            );
            if (translog) translog.transeq = capitalData._transeq++;
            // debug(`买入结果：%o`, translog);
            if (
                executeCapitalSettlement(
                    stockInfo,
                    translog,
                    capitalData,
                    options
                )
            ) {
                debug(
                    `${
                        rule.name
                    } 买入交易：${tradeDate}，价格：${translog.price.toFixed(
                        2
                    )}元，数量：${
                        translog.count / 100
                    }手，总价：${translog.total.toFixed(
                        2
                    )}元[佣金${translog.commission.toFixed(
                        2
                    )}元，过户费${translog.fee.toFixed(
                        2
                    )}，印花税${translog.duty.toFixed(2)}元], ${translog.memo}`
                );
                // debug(`股票信息：%o`, stockInfo);
                // debug(`账户信息：%o`, capitalData);
                // return translog;
            }
        }
    }
}

/**
 * 根据交易记录完成账户清算
 * @param {*} stockInfo 股票信息
 * @param {*} translog 交易记录
 * @param {*} capitalData 账户数据
 * @param {*} options 配置参数
 */
function executeCapitalSettlement(stockInfo, translog, capitalData, options) {
    // debug(`执行清算 %o`, translog);
    if (_.isEmpty(translog)) return false;
    // 如果非固定头寸，检查当前提供的交易余额是否可执行
    if (!options.fixCash && translog.total + capitalData.balance < 0) {
        debug(
            `账户余额${capitalData.balance}不足(${
                translog.total
            })，无法完成清算，交易取消! 交易信息: ${
                translog.type === "buy" ? "买入" : "卖出"
            }${stockInfo.ts_code} ${translog.count}股，价格${
                translog.price
            }，共计${translog.total}元[含佣金${translog.commission}元，过户费${
                translog.fee
            }，印花税${translog.duty}元]`
        );
        return false;
    }

    // 处理交易信息
    capitalData.balance += translog.total;
    // 如果当前买入，stock中放置持股信息和买入交易日志，只有卖出发生时才合并生成一条交易记录，包含两个部分
    if (translog.type === "buy") {
        capitalData.stocks.push({
            transeq: translog.transeq,
            count: translog.count,
            price: translog.price,
            buy: translog,
        });
    } else {
        let stock;
        for (let i = 0; i < capitalData.stocks.length; i++) {
            if (capitalData.stocks[i].transeq === translog.transeq) {
                stock = capitalData.stocks[i];
                capitalData.stocks.splice(i, 1);
                break;
            }
        }
        if (!stock) {
            debug(
                `没有找到要执行的交易序号：${translog.transeq}, %o`,
                capitalData.stocks
            );
            return false;
        }

        let settledlog = {
            transeq: stock.transeq,
            tradeDate: translog.date,
            profit: stock.buy.total + translog.total,
            income: translog.count * translog.price - stock.count * stock.price,
            buy: stock.buy,
            sell: translog,
        };
        // capitalData.stock = {
        //     //info: null,
        //     count: 0,
        //     price: 0,
        // };
        capitalData.transactions.push(settledlog);
    }
    // debug("完成清算！");
    return true;
}

/**
 * 创建指定日期和股票信息的卖出交易
 * @param {*} stockInfo
 * @param {*} tradeDate
 * @param {*} tradeDateIndex
 * @param {*} count
 * @param {*} price
 * @param {*} memo
 */
function createSellTransaction(
    stockInfo,
    tradeDate,
    tradeDateIndex,
    count,
    price,
    methodType,
    memo
) {
    // 计算费用
    let total = calculateTransactionFee(false, stockInfo, count, price);
    // 创建卖出交易记录
    return {
        date: tradeDate,
        dateIndex: tradeDateIndex,
        type: "sell",
        count,
        price,
        total: total.total,
        amount: total.amount,
        fee: total.fee,
        commission: total.commission,
        duty: total.duty,
        methodType,
        memo,
    };
}

/**
 * 构建买入交易信息
 * @param {*} stockInfo 股票信息
 * @param {*} tradeDate 交易日期
 * @param {*} tradeDateIndex 交易日期索引（方便用于计算交易日数）
 * @param {*} balance 可用余额
 * @param {*} price 买入价格
 * @param {*} memo 交易备注
 */
function createBuyTransaction(
    stockInfo,
    tradeDate,
    tradeDateIndex,
    balance,
    price,
    methodType,
    memo
) {
    // 计算费用
    let count = parseInt(balance / price / 100) * 100;
    // 最小交易单位为1手，资金不足放弃！
    if (count < 100) return;
    let total = calculateTransactionFee(true, stockInfo, count, price);
    while (total.total + balance < 0) {
        count -= 100;
        if (count < 100) return;
        total = calculateTransactionFee(true, stockInfo, count, price);
    }
    // 创建买入交易记录
    return {
        date: tradeDate,
        dateIndex: tradeDateIndex,
        type: "buy",
        count: count,
        price,
        total: total.total,
        amount: total.amount,
        fee: total.fee,
        commission: total.commission,
        duty: total.duty,
        methodType,
        memo,
    };
}

/**
 * 计算交易价格和费用
 * @param {boolean}} buy 买卖标记
 * @param {*} stockInfo 股票信息
 * @param {*} count 买卖数量
 * @param {*} price 买卖单价
 */
function calculateTransactionFee(buy, stockInfo, count, price) {
    let amount = count * price;
    let commission = (amount * 0.25) / 1000;
    let fee = 0.0;
    let duty = 0.0;
    if (stockInfo.exchange === "SSE") {
        // 上海，过户费千分之0.2
        fee += (amount * 0.02) / 1000;
    } else if (stockInfo.exchange === "SZSE") {
        // 深圳，无
    }
    // 印花税，仅对卖方收取
    if (!buy) {
        duty += (amount * 1) / 1000;
    }

    let total = 0.0;
    if (buy) {
        total = 0 - (amount + commission + fee + duty);
    } else {
        total = amount - commission - fee - duty;
    }

    return { total, amount, commission, fee, duty };
}

function parseCapitalReports(capitalData) {
    if (_.isEmpty(capitalData)) return;
    // 账户信息中主要需分析交易过程，正常都是为一次买入，一次卖出，这样作为一组交易，获得一次盈利结果
    let count = capitalData.transactions.length;
    let count_win = 0;
    let total_win = 0;
    let count_loss = 0;
    let total_loss = 0;
    let total_profit = 0;
    let total_fee = 0;
    let max_profit = 0;
    let max_loss = 0;
    let average_profit = 0;
    let average_win = 0;
    let average_loss = 0;
    let max_wintimes = 0; // 连续盈利次数
    let max_losstimes = 0; // 连续亏损次数
    let max_windays = 0;
    let max_lossdays = 0;
    let average_windays = 0;
    let average_lossdays = 0;
    // {times: 总次数, win_times: 盈利次数, loss_times: 损失次数}
    let selltypes = {};
    //let selltype_times = {};

    // 收益率：表示单位成本的收入比例
    let ror_win = 0;
    let ror_loss = 0;
    let ror = 0;

    let tmp_cost = 0;
    let tmp_cost_win = 0;
    let tmp_cost_loss = 0;

    let currentType = 0;
    let tmp_times = 0;
    let tmp_windays = 0;
    let tmp_lossdays = 0;
    for (let log of capitalData.transactions) {
        let days = log.sell.dateIndex - log.buy.dateIndex + 1;

        let selltype = selltypes[log.sell.methodType];
        if (!selltype) {
            selltypes[log.sell.methodType] = {
                times: 0,
                win_times: 0,
                loss_times: 0,
            };
        }
        selltypes[log.sell.methodType].times += 1;

        if (log.profit >= 0) {
            count_win++;
            total_win += log.profit;
            tmp_cost_win += -log.buy.total;
            if (max_profit < log.profit) max_profit = log.profit;

            tmp_windays += days;
            if (max_windays < days) max_windays = days;

            // 连续计数
            if (currentType === 1) {
                tmp_times++;
            } else {
                if (currentType === -1) {
                    if (max_losstimes < tmp_times) max_losstimes = tmp_times;
                }
                // 初始化
                currentType = 1;
                tmp_times = 1;
            }

            selltypes[log.sell.methodType].win_times += 1;
        } else {
            count_loss++;
            total_loss += log.profit;
            tmp_cost_loss += -log.buy.total;
            if (max_loss > log.profit) max_loss = log.profit;

            tmp_lossdays += days;
            if (max_lossdays < days) max_lossdays = days;

            // 连续计数
            if (currentType === -1) {
                tmp_times++;
            } else {
                if (currentType === 1) {
                    if (max_wintimes < tmp_times) max_wintimes = tmp_times;
                }
                // 初始化
                currentType = -1;
                tmp_times = 1;
            }

            selltypes[log.sell.methodType].loss_times += 1;
        }

        total_profit += log.profit;
        total_fee +=
            log.buy.commission +
            log.buy.fee +
            log.buy.duty +
            (log.sell.commission + log.sell.fee + log.sell.duty);
        tmp_cost += -log.buy.total;
    }

    if (currentType === 1) {
        if (max_wintimes < tmp_times) max_wintimes = tmp_times;
    } else if (currentType === -1) {
        if (max_losstimes < tmp_times) max_losstimes = tmp_times;
    }

    average_profit = total_profit / count;
    average_win = total_win / count_win;
    average_loss = -total_loss / count_loss;

    average_windays = Number((tmp_windays / count_win).toFixed(1));
    average_lossdays = Number((tmp_lossdays / count_loss).toFixed(1));

    ror = total_profit / tmp_cost;
    ror_win = total_win / tmp_cost_win;
    ror_loss = total_loss / tmp_cost_loss;

    return {
        count,
        total_profit,
        total_fee,
        count_win,
        total_win,
        count_loss,
        total_loss,
        max_profit,
        max_loss,
        average_profit,
        average_win,
        average_loss,
        max_wintimes,
        max_losstimes,
        max_windays,
        max_lossdays,
        average_windays,
        average_lossdays,
        selltypes,

        ror,
        ror_win,
        ror_loss,
    };
}

function showCapitalReports(log, capitalData) {
    log(
        `******************************************************************************************`
    );
    // log(
    //     "*                                                                                                                      *"
    // );
    if (capitalData.stocks && capitalData.stocks.length > 0) {
        let stockvalue = 0;
        for (let stock of capitalData.stocks) {
            stockvalue += stock.count * stock.price;
        }
        log(
            `  账户价值 ${formatFxstr(
                capitalData.balance + stockvalue
            )}元  【余额 ${formatFxstr(
                capitalData.balance
            )}元, 持股: ${formatFxstr(stockvalue)}元】`
        );
    } else {
        log(`  账户余额 ${formatFxstr(capitalData.balance)}元`);
    }

    let capitalResult = parseCapitalReports(capitalData);
    // log(``);
    log(
        `  总净利润：${formatFxstr(capitalResult.total_profit)},  收益率 ${(
            capitalResult.ror * 100
        ).toFixed(2)}%`
    );
    log(
        `  毛利润： ${formatFxstr(
            capitalResult.total_win
        )},  总亏损：${formatFxstr(capitalResult.total_loss)}`
    );
    log(
        `  盈利收益率： ${(capitalResult.ror_win * 100).toFixed(
            2
        )}%,  亏损收益率：${(capitalResult.ror_loss * 100).toFixed(2)}%`
    );
    log("");
    log(
        `  总交易次数： ${capitalResult.count},  利润率：${(
            (capitalResult.count_win * 100) /
            capitalResult.count
        ).toFixed(1)}%`
    );
    log(
        `  总盈利次数： ${capitalResult.count_win},  总亏损次数：${capitalResult.count_loss}`
    );
    log("");
    log(
        `  最大单笔盈利： ${formatFxstr(
            capitalResult.max_profit
        )},  最大单笔亏损：${formatFxstr(capitalResult.max_loss)}`
    );
    log(
        `  平均盈利： ${formatFxstr(
            capitalResult.average_win
        )},  平均亏损：${formatFxstr(capitalResult.average_loss)}`
    );
    log(
        `  平均盈利/平均亏损： ${(
            capitalResult.average_win / capitalResult.average_loss
        ).toFixed(2)},  平均每笔总盈利：${formatFxstr(
            capitalResult.average_profit
        )}`
    );
    log("");
    log(
        `  最多连续盈利次数： ${capitalResult.max_wintimes},  最多连续亏损次数：${capitalResult.max_losstimes}`
    );
    log(
        `  盈利最多持有天数： ${capitalResult.max_windays},  亏损最多持有天数：${capitalResult.max_lossdays}`
    );
    log(
        `  盈利平均持有天数： ${capitalResult.average_windays},  亏损平均持有天数：${capitalResult.average_lossdays}`
    );

    log("");
    for (let methodType in capitalResult.selltypes) {
        let selltype = capitalResult.selltypes[methodType];
        log(
            `  卖出类型${methodType} 共${selltype.times}次,  盈利${selltype.win_times}次， 损失${selltype.loss_times}次`
        );
    }
    // log(
    //     "*                                                                                                                      *"
    // );
    log(
        `******************************************************************************************`
    );
    log("");
}

function showTransactions(log, capitalData) {
    log(`  交易日志分析
******************************************************************************************`);
    for (let translog of capitalData.transactions) {
        log(logTransaction(translog));
    }
    if (capitalData.stock && capitalData.stock.count > 0) {
        let holdlog = { buy: capitalData.stock.buy };
        log(logTransaction(holdlog));
    }
    log(
        `******************************************************************************************`
    );
}

// settledlog = {
//     transeq: 交易序号
//     tradeDate: translog.tradeDate,
//     profit: capitalData.stock.buy.total + translog.total,
//     income:
//         translog.count * translog.price -
//         capitalData.stock.count * capitalData.stock.price,
//     buy: capitalData.stock.buy,
//     sell: translog,
// };
// trans: {
// date: tradeDate.format("YYYYMMDD"),
// dateIndex: tradeDateIndex,
// type: "sell",
// count,
// price,
// total: total.total,
// amount: total.amount,
// fee: total.fee,
// commission: total.commission,
// duty: total.duty,
// methodType,
// memo,
// }
function logTransaction(translog) {
    if (!translog) return "";
    let buy = translog.buy;
    let sell = translog.sell;
    if (sell) {
        return `收入：${formatFxstr(translog.profit)}, 持有 ${
            sell.dateIndex - buy.dateIndex + 1
        }天，盈利 ${(-(translog.profit * 100) / buy.total).toFixed(2)}%, ${
            translog.transeq
        }
       [买入 ${buy.date}, ${formatFxstr(buy.price)}, ${
            buy.count
        }, ${formatFxstr(buy.total)}, ${buy.transeq}] 
       [卖出 ${sell.date}, ${formatFxstr(sell.price)}, ${
            sell.count
        }, ${formatFxstr(sell.total)}, ${sell.methodType}, ${sell.memo}, ${
            sell.transeq
        }]`;
    } else {
        // 持有未卖出
        return `收入：---, 持有 ---天，盈利 ---
       [买入 ${buy.date}, ${formatFxstr(buy.price)}, ${
            buy.count
        }, ${formatFxstr(buy.total)}]`;
    }
}

export default {
    executeTransaction,
    executeCapitalSettlement,
    createSellTransaction,
    createBuyTransaction,
    calculateTransactionFee,
    parseCapitalReports,
    showCapitalReports,
    showTransactions,
};
