import _ from "lodash";
// import { formatFxstr } from "./util";
import utils from "./utils";
import debugpkg from "debug";

// import trans from "./transaction";

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
                            } 卖出：${tradeDate}，价格：${utils.formatFxstr(
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

export default {
    executeTransaction,
    executeCapitalSettlement,
};
