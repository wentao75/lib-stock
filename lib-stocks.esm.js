import { readStockList, readStockData, stockDataNames, getDataRoot as getDataRoot$1 } from '@wt/lib-wtda-query';
import moment$1 from 'moment';
import _$1 from 'lodash';
import debugpkg from 'debug';
import CG from 'console-grid';

const ORGANIZED = Symbol("表示数据是否经过检查和整理");
const ADJUSTED = Symbol("已经复权处理");
/**
 * 对交易数据按照结构进行检查，检查后需要满足
 * 1. 数组结构
 * 2. 交易日期按照时间升序排列，0为最早的数据
 * 3. 如果提供了赋权因子，进行前复权计算
 * 4. 设置ORGANIZED标记为true
 *
 * @param {*} data 交易数据（日线）
 */

function checkTradeData(data, digits = 3) {
  if (_$1.isEmpty(data) || data[ORGANIZED]) return data;
  if (!_$1.isArray(data)) return data; // 检查数据排序，如果是降序，则反过来

  if (checkOrder(data)) {
    data.reverse();
  }

  if (data[0] && data[0].prevadj_factor) {
    calculatePrevAdjPrice(data, digits);
  }

  data[ORGANIZED] = true;
  return data;
}
/**
 * 将日线数据中的历史价位根据复权因子全部处理为前复权结果，方便后续计算
 *
 * @param {*} dailyData 日线数据
 * @param {int} digits 保留位数
 */


function calculatePrevAdjPrice(dailyData, digits = 3) {
  if (dailyData && dailyData.length > 0 && !dailyData[ADJUSTED]) {
    dailyData.forEach(item => {
      if (item.prevadj_factor) {
        console.log(`复权前 ${item.trade_date}, ${item.open}, ${item.close}`);
        item.open = toFixed(item.open * item.prevadj_factor, digits);
        item.close = toFixed(item.close * item.prevadj_factor, digits);
        item.high = toFixed(item.high * item.prevadj_factor, digits);
        item.low = toFixed(item.low * item.prevadj_factor, digits);
        item.pre_close = toFixed(item.pre_close * item.prevadj_factor, digits);
        item.change = toFixed(item.change * item.prevadj_factor, digits);
        console.log(`复权后 ${item.trade_date}, ${item.open}, ${item.close}`);
      }
    });
    dailyData[ADJUSTED] = true;
  }
}

function readData(item, prop) {
  if (_$1.isFunction(prop)) {
    return prop(item);
  } else if (_$1.isString(prop)) {
    return item && item[prop];
  }

  return item;
}

function toFixed(num, digits = 3) {
  return Number(num.toFixed(digits));
}

function checkOrder(array) {
  return array && _$1.isArray(array) && array.length > 1 && array[0].trade_date > array[array.length - 1].trade_date;
}

function average(array, index, n, prop, digits = 3) {
  if (index >= 0 && array && Array.isArray(array) && array.length > index && n > 0) {
    let desc = checkOrder(array);
    let step = desc ? -1 : 1;
    let lastIndex = index - step * n;

    if (lastIndex < 0 || lastIndex >= array.length) {
      return;
    }

    let i = index;
    let count = 0;
    let sum = 0;

    while (i >= 0 && i < array.length && count < n) {
      sum += readData(array[i], prop);
      i -= step;
      count++;
    }

    if (count === n) {
      return toFixed(sum / n, digits);
    } // let calcArr = array.slice(index - n + 1, index + 1);
    // return (
    //     calcArr
    //         .map((item, i, all) => {
    //             return readData(item, prop);
    //         })
    //         .reduce((total, item) => {
    //             return total + item;
    //         }, 0) / n
    // );

  }
}

function ma(array, n, prop, type, digits = 3) {
  if (type === "ma") {
    return sma(array, n, prop, digits);
  } else {
    return ema(array, n, prop, digits);
  }
}

function sma(array, n, prop, digits = 3) {
  if (array && Array.isArray(array) && array.length > 0 && n > 0) {
    let desc = checkOrder(array);
    let step = desc ? -1 : 1;
    let i = desc ? array.length - 1 : 0;
    let index = 0;
    let ret = [];

    while (i >= 0 && i < array.length) {
      ret[index] = average(array, i, n, prop, digits);
      index++;
      i += step;
    }

    return ret;
  }
}

function ema(array, n, prop, digits = 3) {
  if (array && Array.isArray(array) && array.length > 0 && n > 0) {
    let desc = checkOrder(array);
    let step = desc ? -1 : 1;
    let i = desc ? array.length - 1 : 0;
    let index = 0;
    let ret = [];
    let tmp = 0;

    while (i >= 0 && i < array.length) {
      if (index === 0) {
        tmp = readData(array[i], prop);
      } else {
        tmp = (2 * readData(array[i], prop) + (n - 1) * tmp) / (n + 1);
      }

      ret[index] = toFixed(tmp, digits);
      index++;
      i += step;
    }

    return ret;
  }
}
/**
 * 计算指定数据的TR值
 * @param {*} data 日线数据
 */


function tr(data) {
  if (data) {
    return Math.max(data.high - data.low, Math.abs(data.high - data.pre_close), Math.abs(data.pre_close - data.low));
  }
}

function ohlc(data) {
  if (data) {
    return (data.open + data.high + data.low + data.close) / 4;
  }
}

function hl(data) {
  if (data) {
    return (data.high + data.low) / 2;
  }
}
/**
 *
 * @param {Array} array 数据数组
 * @param {number} n 平均天数
 * @param {*} prop 数据属性或转换方法
 * @param {string} type 偏差类型
 * @param {boolean} desc 数据数组是否降序
 * @param {number} digits 小数保留位数
 */


function stdev(array, n, prop, digits = 3) {
  if (array && Array.isArray(array) && array.length > 0 && n > 0) {
    let desc = checkOrder(array);
    let step = desc ? -1 : 1;
    let i = desc ? array.length - 1 : 0;
    let index = 0;
    let ret = [];

    while (i >= 0 && i < array.length) {
      let ma = average(array, i, n, prop, digits);
      let d;

      if (ma) {
        let sum = 0;
        let j = i;
        let count = 0;

        while (j >= 0 && j < array.length && count < n) {
          sum += (readData(array[j], prop) - ma) ** 2;
          count++;
          j -= step;
        }

        d = toFixed(Math.sqrt(sum / (n - 1)), digits);
      }

      ret[index] = d;
      index++;
      i += step;
    }

    return ret;
  }
}

function formatFxstr(num) {
  return num.toLocaleString("zh-CN"); //, { style: "currency", currency: "CNY" });
}

var utils = {
  formatFxstr,
  average,
  ma,
  sma,
  ema,
  stdev,
  tr,
  ohlc,
  hl,
  readData,
  toFixed,
  checkTradeData
};

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
  let translog = null; // 首先检查卖出
  // 所有算法首先检查并处理止损
  // 检查是否需要止损

  let tradeDate = stockData[index].trade_date;
  let stockInfo = capitalData.info;
  let sellRules = options.rules && options.rules.sell;
  let buyRules = options.rules && options.rules.buy; // 目前的持仓情况

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
          debug(`${rule.name} 卖出检查：${tradeDate}, %o`, stockData[index]);
          translog = rule.checkSellTransaction(stockInfo, stock, index, stockData, options);
          if (translog) translog.transeq = stock.transeq;

          if (executeCapitalSettlement(stockInfo, translog, capitalData, options)) {
            debug(`${rule.name} 卖出：${tradeDate}，价格：${utils.formatFxstr(translog.price)}元，数量：${translog.count / 100}手，总价：${translog.total.toFixed(2)}元[佣金${translog.commission.toFixed(2)}元，过户费${translog.fee.toFixed(2)}，印花税${translog.duty.toFixed(2)}元], ${translog.memo}`);
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
  } // 如果非固定头寸，则检查是否有持仓，如果有不进行买入


  if (!options.fixCash && capitalData.stocks.length > 0) return; // if (capitalData && capitalData.stock && capitalData.stock.count > 0) return;
  // 执行买入
  // debug("执行买入检查");

  let cash = capitalData.balance;
  if (options.fixCash) cash = options.initBalance;

  if (buyRules) {
    for (let rule of buyRules) {
      translog = rule.checkBuyTransaction(stockInfo, cash, index, stockData, options);
      if (translog) translog.transeq = capitalData._transeq++; // debug(`买入结果：%o`, translog);

      if (executeCapitalSettlement(stockInfo, translog, capitalData, options)) {
        debug(`${rule.name} 买入交易：${tradeDate}，价格：${translog.price.toFixed(2)}元，数量：${translog.count / 100}手，总价：${translog.total.toFixed(2)}元[佣金${translog.commission.toFixed(2)}元，过户费${translog.fee.toFixed(2)}，印花税${translog.duty.toFixed(2)}元], ${translog.memo}`); // debug(`股票信息：%o`, stockInfo);
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
  if (_$1.isEmpty(translog)) return false; // 如果非固定头寸，检查当前提供的交易余额是否可执行

  if (!options.fixCash && translog.total + capitalData.balance < 0) {
    debug(`账户余额${capitalData.balance}不足(${translog.total})，无法完成清算，交易取消! 交易信息: ${translog.type === "buy" ? "买入" : "卖出"}${stockInfo.ts_code} ${translog.count}股，价格${translog.price}，共计${translog.total}元[含佣金${translog.commission}元，过户费${translog.fee}，印花税${translog.duty}元]`);
    return false;
  } // 处理交易信息


  capitalData.balance += translog.total; // 如果当前买入，stock中放置持股信息和买入交易日志，只有卖出发生时才合并生成一条交易记录，包含两个部分

  if (translog.type === "buy") {
    capitalData.stocks.push({
      transeq: translog.transeq,
      count: translog.count,
      price: translog.price,
      buy: translog
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
      debug(`没有找到要执行的交易序号：${translog.transeq}, %o`, capitalData.stocks);
      return false;
    }

    let settledlog = {
      transeq: stock.transeq,
      tradeDate: translog.date,
      profit: stock.buy.total + translog.total,
      income: translog.count * translog.price - stock.count * stock.price,
      buy: stock.buy,
      sell: translog
    }; // capitalData.stock = {
    //     //info: null,
    //     count: 0,
    //     price: 0,
    // };

    capitalData.transactions.push(settledlog);
  } // debug("完成清算！");


  return true;
}

var engine = {
  executeTransaction,
  executeCapitalSettlement
};

const debug$1 = debugpkg("transaction");
/**
 * 创建指定日期和股票信息的卖出交易
 * @param {*} stockInfo
 * @param {*} tradeDate
 * @param {*} tradeDateIndex
 * @param {*} count
 * @param {*} price
 * @param {*} memo
 */

function createSellTransaction(stockInfo, tradeDate, tradeDateIndex, count, price, methodType, memo) {
  // 计算费用
  let total = calculateTransactionFee(false, stockInfo, count, price); // 创建卖出交易记录

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
    memo
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


function createBuyTransaction(stockInfo, tradeDate, tradeDateIndex, balance, price, methodType, memo) {
  // 计算费用
  let count = parseInt(balance / price / 100) * 100; // 最小交易单位为1手，资金不足放弃！

  if (count < 100) return;
  let total = calculateTransactionFee(true, stockInfo, count, price);

  while (total.total + balance < 0) {
    count -= 100;
    if (count < 100) return;
    total = calculateTransactionFee(true, stockInfo, count, price);
  } // 创建买入交易记录


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
    memo
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
  let commission = amount * 0.25 / 1000;
  let fee = 0.0;
  let duty = 0.0;

  if (stockInfo.exchange === "SSE") {
    // 上海，过户费千分之0.2
    fee += amount * 0.02 / 1000;
  } else if (stockInfo.exchange === "SZSE") ; // 印花税，仅对卖方收取


  if (!buy) {
    duty += amount * 1 / 1000;
  }

  let total = 0.0;

  if (buy) {
    total = 0 - (amount + commission + fee + duty);
  } else {
    total = amount - commission - fee - duty;
  }

  return {
    total,
    amount,
    commission,
    fee,
    duty
  };
}

function parseCapitalReports(capitalData) {
  if (_$1.isEmpty(capitalData)) return; // 账户信息中主要需分析交易过程，正常都是为一次买入，一次卖出，这样作为一组交易，获得一次盈利结果

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
  let average_lossdays = 0; // {times: 总次数, win_times: 盈利次数, loss_times: 损失次数}

  let selltypes = {}; //let selltype_times = {};
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
        loss_times: 0
      };
    }

    selltypes[log.sell.methodType].times += 1;

    if (log.profit >= 0) {
      count_win++;
      total_win += log.profit;
      tmp_cost_win += -log.buy.total;
      if (max_profit < log.profit) max_profit = log.profit;
      tmp_windays += days;
      if (max_windays < days) max_windays = days; // 连续计数

      if (currentType === 1) {
        tmp_times++;
      } else {
        if (currentType === -1) {
          if (max_losstimes < tmp_times) max_losstimes = tmp_times;
        } // 初始化


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
      if (max_lossdays < days) max_lossdays = days; // 连续计数

      if (currentType === -1) {
        tmp_times++;
      } else {
        if (currentType === 1) {
          if (max_wintimes < tmp_times) max_wintimes = tmp_times;
        } // 初始化


        currentType = -1;
        tmp_times = 1;
      }

      selltypes[log.sell.methodType].loss_times += 1;
    }

    total_profit += log.profit;
    total_fee += log.buy.commission + log.buy.fee + log.buy.duty + (log.sell.commission + log.sell.fee + log.sell.duty);
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
    ror_loss
  };
}

function showCapitalReports(log, capitalData) {
  log(`******************************************************************************************`); // log(
  //     "*                                                                                                                      *"
  // );

  if (capitalData.stocks && capitalData.stocks.length > 0) {
    let stockvalue = 0;

    for (let stock of capitalData.stocks) {
      stockvalue += stock.count * stock.price;
    }

    log(`  账户价值 ${utils.formatFxstr(capitalData.balance + stockvalue)}元  【余额 ${utils.formatFxstr(capitalData.balance)}元, 持股: ${utils.formatFxstr(stockvalue)}元】`);
  } else {
    log(`  账户余额 ${utils.formatFxstr(capitalData.balance)}元`);
  }

  let capitalResult = parseCapitalReports(capitalData); // log(``);

  log(`  总净利润：${utils.formatFxstr(capitalResult.total_profit)},  收益率 ${(capitalResult.ror * 100).toFixed(2)}%`);
  log(`  毛利润： ${utils.formatFxstr(capitalResult.total_win)},  总亏损：${utils.formatFxstr(capitalResult.total_loss)}`);
  log(`  盈利收益率： ${(capitalResult.ror_win * 100).toFixed(2)}%,  亏损收益率：${(capitalResult.ror_loss * 100).toFixed(2)}%`);
  log("");
  log(`  总交易次数： ${capitalResult.count},  利润率：${(capitalResult.count_win * 100 / capitalResult.count).toFixed(1)}%`);
  log(`  总盈利次数： ${capitalResult.count_win},  总亏损次数：${capitalResult.count_loss}`);
  log("");
  log(`  最大单笔盈利： ${utils.formatFxstr(capitalResult.max_profit)},  最大单笔亏损：${utils.formatFxstr(capitalResult.max_loss)}`);
  log(`  平均盈利： ${utils.formatFxstr(capitalResult.average_win)},  平均亏损：${utils.formatFxstr(capitalResult.average_loss)}`);
  log(`  平均盈利/平均亏损： ${(capitalResult.average_win / capitalResult.average_loss).toFixed(2)},  平均每笔总盈利：${utils.formatFxstr(capitalResult.average_profit)}`);
  log("");
  log(`  最多连续盈利次数： ${capitalResult.max_wintimes},  最多连续亏损次数：${capitalResult.max_losstimes}`);
  log(`  盈利最多持有天数： ${capitalResult.max_windays},  亏损最多持有天数：${capitalResult.max_lossdays}`);
  log(`  盈利平均持有天数： ${capitalResult.average_windays},  亏损平均持有天数：${capitalResult.average_lossdays}`);
  log("");

  for (let methodType in capitalResult.selltypes) {
    let selltype = capitalResult.selltypes[methodType];
    log(`  卖出类型${methodType} 共${selltype.times}次,  盈利${selltype.win_times}次， 损失${selltype.loss_times}次`);
  } // log(
  //     "*                                                                                                                      *"
  // );


  log(`******************************************************************************************`);
  log("");
}

function showTransactions(log, capitalData) {
  log(`  交易日志分析
******************************************************************************************`);

  for (let translog of capitalData.transactions) {
    log(logTransaction(translog));
  }

  if (capitalData.stock && capitalData.stock.count > 0) {
    let holdlog = {
      buy: capitalData.stock.buy
    };
    log(logTransaction(holdlog));
  }

  log(`******************************************************************************************`);
} // settledlog = {
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
    return `收入：${utils.formatFxstr(translog.profit)}, 持有 ${sell.dateIndex - buy.dateIndex + 1}天，盈利 ${(-(translog.profit * 100) / buy.total).toFixed(2)}%, ${translog.transeq}
       [买入 ${buy.date}, ${utils.formatFxstr(buy.price)}, ${buy.count}, ${utils.formatFxstr(buy.total)}, ${buy.transeq}] 
       [卖出 ${sell.date}, ${utils.formatFxstr(sell.price)}, ${sell.count}, ${utils.formatFxstr(sell.total)}, ${sell.methodType}, ${sell.memo}, ${sell.transeq}]`;
  } else {
    // 持有未卖出
    return `收入：---, 持有 ---天，盈利 ---
       [买入 ${buy.date}, ${utils.formatFxstr(buy.price)}, ${buy.count}, ${utils.formatFxstr(buy.total)}]`;
  }
}

var trans = {
  createSellTransaction,
  createBuyTransaction,
  calculateTransactionFee,
  parseCapitalReports,
  showCapitalReports,
  showTransactions
};

const debug$2 = debugpkg("reports");

function parseWorkdayReports(transactions) {
  if (!transactions || transactions.length <= 0) return; // 报告包含5+1行信息，1-5对应周一到周五的信息，0表示汇总
  // 每行信息包括：count(交易次数), win_ratio(盈利比例)，win(平均盈利金额)，
  //      loss_ratio(亏损比例) ，loss（平均亏损金额），ratio_winloss(盈利亏损比),
  //      average(平均交易规模), max_loss（最大亏损），profit(利润)

  let results = [{
    day: "",
    count: 0,
    count_win: 0,
    count_loss: 0,
    win_ratio: 0,
    win: 0,
    loss_ratio: 0,
    loss: 0,
    ratio_winloss: 0,
    average: 0,
    max_win: 0,
    max_loss: 0,
    profit: 0
  }, {
    day: "周一",
    count: 0,
    count_win: 0,
    count_loss: 0,
    win_ratio: 0,
    win: 0,
    loss_ratio: 0,
    loss: 0,
    ratio_winloss: 0,
    average: 0,
    max_win: 0,
    max_loss: 0,
    profit: 0
  }, {
    day: "周二",
    count: 0,
    count_win: 0,
    count_loss: 0,
    win_ratio: 0,
    win: 0,
    loss_ratio: 0,
    loss: 0,
    ratio_winloss: 0,
    average: 0,
    max_win: 0,
    max_loss: 0,
    profit: 0
  }, {
    day: "周三",
    count: 0,
    count_win: 0,
    count_loss: 0,
    win_ratio: 0,
    win: 0,
    loss_ratio: 0,
    loss: 0,
    ratio_winloss: 0,
    average: 0,
    max_win: 0,
    max_loss: 0,
    profit: 0
  }, {
    day: "周四",
    count: 0,
    count_win: 0,
    count_loss: 0,
    win_ratio: 0,
    win: 0,
    loss_ratio: 0,
    loss: 0,
    ratio_winloss: 0,
    average: 0,
    max_win: 0,
    max_loss: 0,
    profit: 0
  }, {
    day: "周五",
    count: 0,
    count_win: 0,
    count_loss: 0,
    win_ratio: 0,
    win: 0,
    loss_ratio: 0,
    loss: 0,
    ratio_winloss: 0,
    average: 0,
    max_win: 0,
    max_loss: 0,
    profit: 0
  }];

  for (let trans of transactions) {
    let buy = trans.buy; // let sell = trans.sell;

    let date = moment$1(buy.date, "YYYYMMDD");
    let day = date.day();

    if (day < 1 && day > 5) {
      // 超出了周一～周五的范围，跳过这个日期
      debug$2(`${buy.tradeDate}交易超出星期范围：${day}, %o`, trans);
      continue;
    }

    let days = [0, day]; // console.log(`%o`, days);
    // console.log(
    //     `%o, ${buy.tradeDate}, ${date}, ${day}, %o %o`,
    //     trans,
    //     days,
    //     results
    // );

    for (let index of days) {
      let res = results[index];
      res.count++;
      res.profit += trans.profit;

      if (trans.profit >= 0) {
        res.count_win++;
        res.win += trans.profit;
        if (res.max_win < trans.profit) res.max_win = trans.profit;
      } else {
        res.count_loss++;
        res.loss += trans.profit;
        if (res.max_loss > trans.profit) res.max_loss = trans.profit;
      } // console.log(`${index}, %o`, res);

    }
  }

  for (let res of results) {
    res.win_ratio = res.count_win / res.count;
    res.win = res.win / res.count_win;
    res.loss_ratio = res.count_loss / res.count;
    res.loss = res.loss / res.count_loss;
    res.ratio_winloss = res.win / res.loss;
    res.average = res.profit / res.count;
  }

  return results;
}

function showWorkdayReports(log, transactions) {
  let reports = parseWorkdayReports(transactions); // console.log("%o", reports);
  //     let days = ["总计", "周一", "周二", "周三", "周四", "周五"];
  //     log(`
  // 工作日    交易次数    盈利比例    平均盈利    亏损比例    平均亏损    盈亏比    平均利润    最大亏损    利润`);
  //     for (let report of reports) {
  //         log(
  //             `${report.day}       ${report.count}          ${(
  //                 report.win_ratio * 100
  //             ).toFixed(1)}%    ${report.win.toFixed(2)}    ${(
  //                 report.loss_ratio * 100
  //             ).toFixed(1)}%    ${report.loss.toFixed(
  //                 2
  //             )}    ${report.ratio_winloss.toFixed(
  //                 2
  //             )}    ${report.average.toFixed(2)}    ${report.max_loss.toFixed(
  //                 2
  //             )}    ${report.profit.toFixed(2)}`
  //         );
  //     }
  // 采用console-grid打印格式

  let grid = new CG();
  let CGS = CG.Style;
  let columns = [{
    id: "workday",
    name: "日期",
    type: "string",
    align: "left"
  }, {
    id: "count",
    name: "交易次数",
    type: "number",
    align: "right"
  }, {
    id: "win_ratio",
    name: "盈利比例",
    type: "number",
    align: "right"
  }, {
    id: "win_average",
    name: "平均盈利",
    type: "number",
    align: "right"
  }, {
    id: "loss_ratio",
    name: "亏损比例",
    type: "number",
    align: "right"
  }, {
    id: "loss_average",
    name: "平均亏损",
    type: "number",
    align: "right"
  }, {
    id: "ratio_winloss",
    name: "盈亏比",
    type: "number",
    align: "right"
  }, {
    id: "profit_average",
    name: "平均利润",
    type: "number",
    align: "right"
  }, {
    id: "max_loss",
    name: "最大亏损",
    type: "number",
    align: "right"
  }, {
    id: "profit",
    name: "利润",
    type: "number",
    align: "right"
  }];
  let rows = [];

  for (let report of reports) {
    rows.push({
      workday: report.win_ratio > 0.5 && report.profit >= 0 ? CGS.red(report.day) : report.day,
      count: report.count,
      win_ratio: report.win_ratio >= 0.5 ? CGS.red(`${(report.win_ratio * 100).toFixed(1)}%`) : `${(report.win_ratio * 100).toFixed(1)}%`,
      //CGS.green
      win_average: `${utils.formatFxstr(report.win)}`,
      loss_ratio: report.loss_ratio >= 0.5 ? CGS.green(`${(report.loss_ratio * 100).toFixed(1)}%`) : `${(report.loss_ratio * 100).toFixed(1)}%`,
      loss_average: `${utils.formatFxstr(report.loss)}`,
      ratio_winloss: report.ratio_winloss < -1 ? CGS.cyan(`${(-report.ratio_winloss).toFixed(2)}`) : `${(-report.ratio_winloss).toFixed(2)}`,
      profit_average: report.average >= 0 ? CGS.red(`${utils.formatFxstr(report.average)}`) : CGS.green(`${utils.formatFxstr(report.average)}`),
      max_loss: `${utils.formatFxstr(report.max_loss)}`,
      profit: report.profit >= 0 ? CGS.red(`${report.profit.toFixed(2)}`) : CGS.green(`${report.profit.toFixed(2)}`)
    });
  }

  let data = {
    option: {},
    columns,
    rows
  };
  grid.render(data); // 采用console-table-printer库打印格式
  // const p = new Table({
  //     columns: [
  //         { name: "workday", alignment: "center" },
  //         { name: "count", alignment: "right" },
  //         { name: "win ratio", alignment: "right" },
  //         { name: "win/trade", alignment: "right" },
  //         { name: "loss ratio", alignment: "right" },
  //         { name: "loss/trade", alignment: "right" },
  //         { name: "ratio win/loss", alignment: "right" },
  //         { name: "profit/trade", alignment: "right" },
  //         { name: "max loss", alignment: "right" },
  //         { name: "profit", alignment: "right" },
  //     ],
  // });
  // for (let report of reports) {
  //     p.addRow(
  //         {
  //             workday: report.day,
  //             count: report.count,
  //             "win ratio": `${(report.win_ratio * 100).toFixed(1)}%`,
  //             "win/trade": `${report.win.toFixed(2)}`,
  //             "loss ratio": `${(report.loss_ratio * 100).toFixed(1)}%`,
  //             "loss/trade": `${report.loss.toFixed(2)}`,
  //             "ratio win/loss": `${(-report.ratio_winloss).toFixed(2)}`,
  //             "profit/trade": `${report.average.toFixed(2)}`,
  //             "max loss": `${report.max_loss.toFixed(2)}`,
  //             profit: `${report.profit.toFixed(2)}`,
  //         },
  //         { color: report.win_ratio > 0.5 ? "red" : "green" }
  //     );
  // }
  // p.printTable();
}
// {
//     transeq: stock.transeq,
//     tradeDate: translog.tradeDate,
//     profit: stock.buy.total + translog.total,
//     income: translog.count * translog.price - stock.count * stock.price,
//     buy: stock.buy,
//     sell: translog,
// }
// transaction
// {
//     date: tradeDate,
//     dateIndex: tradeDateIndex,
//     type: "buy",
//     count: count,
//     price,
//     total: total.total,
//     amount: total.amount,
//     fee: total.fee,
//     commission: total.commission,
//     duty: total.duty,
//     methodType,
//     memo,
// }

var reports = /*#__PURE__*/Object.freeze({
    __proto__: null,
    parseWorkdayReports: parseWorkdayReports,
    showWorkdayReports: showWorkdayReports
});

const log = console.log;
const debug$3 = debugpkg("sim");

function showOptionsInfo(options) {
  let buys = "";
  let usedRules = {};

  for (let rule of options.rules.buy) {
    buys += `${rule.name}, `;

    if (!(rule.label in usedRules)) {
      usedRules[rule.label] = rule;
    }
  }

  let sells = "";

  for (let rule of options.rules.sell) {
    sells += `${rule.name}, `;

    if (!(rule.label in usedRules)) {
      usedRules[rule.label] = rule;
    }
  }

  let rules_desc = "";

  for (let label in usedRules) {
    rules_desc += usedRules[label].showOptions(options);
  }

  console.log(`初始资金:        ${utils.formatFxstr(options.initBalance)}元 
测试交易资金模式:  ${options.fixCash ? "固定头寸" : "累计账户"}
测试数据周期: ${options.startDate}

规则：
买入模型：${buys}
卖出模型：${sells}

${rules_desc}
`);
}

async function simulate(options) {
  // 显示目前的配置模拟信息
  showOptionsInfo(options); // 首先根据设置获得列表，列表内容为需要进行算法计算的各个股票
  //  TODO: 这里先读取全部的列表

  let stockListData = await readStockList();

  if (!stockListData || !stockListData.data) {
    log(`没有读取到股票列表，无法处理日线数据`);
    return;
  }

  let stockList = stockListData.data; // 重新过滤可用的

  stockList = await filterStockList(stockList, options);
  log(`算法执行 ${stockList && stockList.length} 条数据`); // data存放股票列表的基本信息：
  // {
  //      ts_code: '000001.SZ', symbol: '000001', name: '平安银行',
  //      market: '主板', exchange: 'SZSE',
  //      area: '深圳', industry: '银行', fullname: '平安银行股份有限公司',
  //      enname: 'Ping An Bank Co., Ltd.', curr_type: 'CNY',
  //      list_status: 'L', list_date: '19910403', delist_date: null, is_hs: 'S'
  // }
  // this.log(`%o`, stockList[0]);
  // 后续的执行为列表的循环计算，这里的算法因为主要是CPU计算类型，只有输入和输出部分有I/O运算，因此不考虑

  log(""); // 下一步开始按照给出的数据循环进行处理

  for (let stockItem of stockList) {
    // this.log(`处理数据：%o`, stockItem);
    // 首先读取日线信息
    let stockData = await readStockData(stockDataNames.daily, stockItem.ts_code); // 准备资金账户数据

    let capitalData = {
      info: stockItem,
      balance: options.fixCash ? 0 : options.initBalance,
      // 初始资金
      stocks: [],
      // 持有的股票信息，每次买入单独一笔记录，分别进行处理，结构{ count: 0, price: 0, buy: transaction }, // 持有股票信息
      transactions: [],
      // 交易记录 {tradeDate: 完成日期, profit: 利润, income: 收入, buy: transaction, sell: transaction}
      //transaction { date: , count: 交易数量, price: 交易价格, total: 总金额, amount: 总价, fee: 交易费用, memo: 备注信息 }
      _transeq: 0 // 当前交易序号，获取后要自己增加，对应一次股票的买卖使用同一个序号

    };

    if (stockData) {
      log(`[${stockItem.ts_code}]${stockItem.name} 【数据更新时间：${moment$1(stockData.updateTime).format("YYYY-MM-DD HH:mm")}】`); // 日线数据条数 ${
      //     stockData.data && stockData.data.length
      // }, 从${stockData.startDate}到${
      //     stockData.endDate
      // }，
      // 首先过滤历史数据，这里将日线数据调整为正常日期从历史到现在

      stockData = await filterStockData(stockData, options); // 全部数据调整为前复权后再执行计算
      // calculatePrevAdjPrice(stockData);
      // 开始按照日期执行交易算法

      let startDate = moment$1(options.startDate, "YYYYMMDD");
      let currentDate = null;

      for (let index = 0; index < stockData.data.length; index++) {
        let daily = stockData.data[index];
        let tradeDate = moment$1(daily.trade_date, "YYYYMMDD");

        if (_$1.isEmpty(currentDate)) {
          if (startDate.isAfter(tradeDate)) {
            continue;
          }

          debug$3(`找到开始日期，开始执行算法！${index}, ${daily.trade_date}`);
        } else {
          debug$3(`执行算法！${index}, ${daily.trade_date}`);
        }

        currentDate = tradeDate; // this.log(`%o`, engine);
        // let trans =

        await engine.executeTransaction(index, stockData.data, capitalData, options);
      }

      trans.showCapitalReports(log, capitalData);

      if (options.showTrans) {
        trans.showTransactions(log, capitalData);
      }

      if (options.showWorkdays) {
        showWorkdayReports(log, capitalData.transactions);
      }
    } else {
      log(`[${stockItem.ts_code}]${stockItem.name} 没有日线数据，请检查！`);
    }
  }
} // /**
//  * 将日线数据中的历史价位根据复权因子全部处理为前复权结果，方便后续计算
//  *
//  * @param {*} dailyData 日线数据
//  * @param {int} digits 保留位数
//  */
// function calculatePrevAdjPrice(dailyData, digits = 2) {
//     if (dailyData && dailyData.data && dailyData.data.length > 0) {
//         dailyData.data.forEach((item) => {
//             if (item.prevadj_factor) {
//                 item.open = Number(
//                     (item.open * item.prevadj_factor).toFixed(digits)
//                 );
//                 item.close = Number(
//                     (item.close * item.prevadj_factor).toFixed(digits)
//                 );
//                 item.high = Number(
//                     (item.high * item.prevadj_factor).toFixed(digits)
//                 );
//                 item.low = Number(
//                     (item.low * item.prevadj_factor).toFixed(digits)
//                 );
//                 item.pre_close = Number(
//                     (item.pre_close * item.prevadj_factor).toFixed(digits)
//                 );
//                 item.change = Number(
//                     (item.change * item.prevadj_factor).toFixed(digits)
//                 );
//             }
//         });
//     }
// }

/**
 * 这里定义一个过滤列表的接口方法，利用options来过滤后续使用的股票
 * 返回为一个符合条件的列表
 * 这里后续考虑调整一下接口定义，目前暂时简化处理
 */


async function filterStockList(stockList, options) {
  // let retStockList = [];
  return options.selectedStocks.map(tsCode => {
    let tmp = stockList.filter(item => {
      return item.ts_code === tsCode;
    }); // console.log(`${tmp && tmp.length}, %o`, tmp[0]);

    return tmp[0];
  });
}
/**
 * 这里提供对单个数据的调整，主要应当是一些额外的数据计算添加，周期过滤等
 *
 * @param {*} stockData 股票日线数据对象
 * @param {*} options 数据过滤条件
 */


async function filterStockData(stockData, options) {
  utils.checkTradeData(stockData && stockData.data);
  debug$3(`过滤数据范围：${options && options.startDate}, ${stockData && stockData.data && stockData.data.length}`);

  if (options && options.startDate && stockData && stockData.data && stockData.data.length > 0) {
    if (stockData.data[0].trade_date < options.startDate) {
      let index = stockData.data.findIndex((data, i) => {
        return data.trade_date >= options.startDate;
      });

      if (index) {
        stockData.data = stockData.data.slice(index);
      } else {
        stockData.data = [];
      }
    }
  }

  debug$3(`过滤后数据长度：${stockData && stockData.data && stockData.data.length}`); // stockData.data.reverse();

  return stockData;
}

// import engine from "./transaction-engine";
// import trans from "./transaction";

const path = require("path");

const fs = require("fs");

const fp = fs.promises;
const log$1 = console.log;
const debug$4 = debugpkg("search");

function showOptionsInfo$1(options) {
  let rules = options && options.match && options.match.rules;
  console.log(`测试数据周期: ${options.startDate}`);

  for (let rule of rules) {
    console.log(`${rule.showOptions(options)}`);
  }
}

async function search(options) {
  // 显示目前的配置模拟信息
  showOptionsInfo$1(options); // 首先根据设置获得列表，列表内容为需要进行算法计算的各个股票

  let stockListData = await readStockList();

  if (!stockListData || !stockListData.data) {
    log$1(`没有读取到股票列表，无法处理日线数据`);
    return;
  }

  let stockList = stockListData.data; // 重新过滤可用的

  stockList = await filterStockList$1(stockList, options);
  log$1(`算法执行 ${stockList && stockList.length} 条数据`);
  log$1("");
  let foundSignals = {}; // 下一步开始按照给出的数据循环进行处理

  for (let stockItem of stockList) {
    // this.log(`处理数据：%o`, stockItem);
    if (stockItem.name.match("ST")) {
      continue;
    } // 首先读取日线信息


    let stockData = await readStockData(stockDataNames.daily, stockItem.ts_code);

    if (stockData) {
      debug$4(`[${stockItem.ts_code}]${stockItem.name} 【数据更新时间：${moment$1(stockData.updateTime).format("YYYY-MM-DD HH:mm")}】`); // 首先过滤历史数据，这里将日线数据调整为正常日期从历史到现在

      stockData = await prepareStockData(stockData, options); // 全部数据调整为前复权后再执行计算，不再需要
      // calculatePrevAdjPrice(stockData);

      debug$4(`执行算法！${stockData.data.length - 1}`);
      let rules = options && options.match && options.match.rules;

      for (let rule of rules) {
        let matched = rule.check(stockData.data.length - 1, stockData.data, options, stockItem.ts_code);

        if (matched && matched.hasSignals) {
          log$1(`**  [${stockItem.ts_code}]${stockItem.name} 信号:${matched.tradeType} ${matched.memo}`);
          let signal = matched.signal;

          if (signal) {
            if (signal in foundSignals) {
              foundSignals[signal].push(matched);
            } else {
              foundSignals[signal] = [matched];
            }
          }
        }
      }
    }
  }

  let report = options && options.match && options.match.report;
  let reports = await report.createReports(foundSignals, options);
  await saveReports(reports);

  for (let item in foundSignals) {
    let list = foundSignals[item];
    log$1(`*** 信号类型：${item}，共发现${list && list.length} ***`); // for (let code of list) {
    //     log(`  "${code}",`);
    // }
  }

  let buyList = reports && reports.squeeze && reports.squeeze.buyList;
  let readyList = reports && reports.squeeze && reports.squeeze.readyList;
  let boundaries = ["1天", "2天", "3天", "5~8天", "8~13天", "超13天"];

  for (let i = 0; i < boundaries.length; i++) {
    log$1(`** 买入信号【${boundaries[i]}】： ${buyList && buyList[i].length}`);
  }

  for (let i = 0; i < boundaries.length; i++) {
    log$1(`** 准备信号【${boundaries[i]}】： ${readyList && readyList[i].length}`);
  }
}

function getReportsFile() {
  return path.join(getDataRoot$1(), "reports.json");
}

async function saveReports(data) {
  try {
    let jsonStr = JSON.stringify(data);
    let filePath = getReportsFile();
    await fp.writeFile(filePath, jsonStr, {
      encoding: "utf-8"
    });
  } catch (error) {
    throw new Error("保存报告数据时出现错误，请检查后重新执行：" + error);
  }
}

async function readReports() {
  let retData = {
    updateTime: null
  };

  try {
    let dataFile = getReportsFile();

    try {
      retData = JSON.parse(await fp.readFile(dataFile, "utf-8"));
    } catch (error) {
      // 文件不存在，不考虑其它错误
      if (!(error && error.code === "ENOENT")) {
        console.error(`读取报告文件${dataFile}时发生错误：${error}, %o`, error);
      } else {
        console.error(`读取报告文件${dataFile}不存在，%o`, error);
      }
    }
  } catch (error) {
    console.error(`从本地读取报告数据发生错误 ${error}`);
  }

  return retData;
}
/**
 * 这里定义一个过滤列表的接口方法，利用options来过滤后续使用的股票
 * 返回为一个符合条件的列表
 * 这里后续考虑调整一下接口定义，目前暂时简化处理
 */


async function filterStockList$1(stockList, options) {
  if (options.all) return stockList; // let retStockList = [];

  return options.selectedStocks.map(tsCode => {
    let tmp = stockList.filter(item => {
      return item.ts_code === tsCode;
    }); // console.log(`${tmp && tmp.length}, %o`, tmp[0]);

    return tmp[0];
  });
}
/**
 * 这里提供对单个数据的调整，主要应当是一些额外的数据计算添加，周期过滤等
 *
 * @param {*} stockData 股票日线数据对象
 * @param {*} options 数据过滤条件
 */


async function prepareStockData(stockData, options) {
  utils.checkTradeData(stockData && stockData.data);

  if (stockData && stockData.data && stockData.data.length > 0) {
    if (stockData.data[0].trade_date < options.startDate) {
      let index = stockData.data.findIndex((data, i) => {
        return data.trade_date >= options.startDate;
      });

      if (index) {
        stockData.data = stockData.data.slice(index);
      } else {
        stockData.data = [];
      }
    }
  } // stockData.data.reverse();


  return stockData;
}

var search$1 = {
  search,
  readReports
};

const debug$5 = debugpkg("mmb");
const OPTIONS_NAME = "mmb";
/**
 * 检查买入条件
 * @param {*} stockInfo 股票信息
 * @param {double} balance 账户余额
 * @param {*} tradeDate 交易日期
 * @param {int} index 交易日数据索引位置
 * @param {*} stockData 数据
 * @param {*} options 算法参数
 */

function checkMMBBuyTransaction(stockInfo, balance, index, stockData, options) {
  if (balance <= 0) return; // debug(`买入检查: ${balance}, ${tradeDate}, %o, ${index}`, stockData);

  let mmboptions = options && options[OPTIONS_NAME]; // 平均波幅的计算日数

  let N = mmboptions.N; // 波幅突破的百分比

  let P = mmboptions.P;
  let moment = 0;

  for (let i = 0; i < N; i++) {
    if (index - i - 1 >= 0) {
      let tmp = stockData[index - i - 1];

      if (mmboptions.mmbType === "hl") {
        moment += tmp.high - tmp.low;
      } else {
        moment += tmp.high - tmp.close;
      }
    }
  }

  moment = moment / N;
  let currentData = stockData[index]; // console.log(`跟踪信息： ${stockData.length}, ${index}`, currentData);

  let targetPrice = currentData.open + moment * P;
  let tradeDate = stockData[index].trade_date;
  debug$5(`买入条件检查${tradeDate}: ${targetPrice.toFixed(2)}=${currentData.open}+${moment.toFixed(2)}*${P} [o: ${currentData.open}, h: ${currentData.high}, l: ${currentData.low}, c: ${currentData.close}, d: ${currentData.trade_date}]`);

  if (currentData.high >= targetPrice && currentData.open <= targetPrice) {
    // 执行买入交易
    debug$5(`符合条件：${tradeDate}`);
    return trans.createBuyTransaction(stockInfo, tradeDate, index, balance, targetPrice, "mmb", `动能突破买入 ${targetPrice.toFixed(2)} (=${currentData.open}+${moment.toFixed(2)}*${(P * 100).toFixed(2)}%)`);
  }
}
/**
 * 检查是否可以生成卖出交易，如果可以卖出，产生卖出交易记录
 *
 * @param {*} info 股票信息
 * @param {*} stock 持仓信息
 * @param {*} index 今日数据索引位置
 * @param {*} stockData 日线数据
 * @param {*} options 算法参数
 */


function checkMMBSellTransaction(stockInfo, stock, index, stockData, options) {
  if (_$1.isEmpty(stock) || stock.count <= 0) return; // 检查是否符合动能突破买入条件
  // if (
  //     !options.nommbsell &&
  //     !_.isEmpty(
  //         checkMMBBuyTransaction(
  //             stockInfo,
  //             options.initBalance,
  //             index,
  //             stockData,
  //             options
  //         )
  //     )
  // ) {
  //     // 可以买入，那么当日保持
  //     return;
  // }

  let currentData = stockData[index];
  let tradeDate = currentData.trade_date;
  let mmboptions = options && options[OPTIONS_NAME]; // 目前有持仓，检查是否达到盈利卖出条件

  if (!mmboptions.nommb1 && currentData.open > stock.price) {
    // 采用第二天开盘价盈利就卖出的策略
    debug$5(`开盘盈利策略符合：${currentData.open.toFixed(2)} (> ${stock.price.toFixed(2)})`);
    return engine.createSellTransaction(stockInfo, tradeDate, index, stock.count, currentData.open, "mmb1", `开盘盈利卖出 ${currentData.open} (> ${stock.price.toFixed(2)})`);
  }

  if (!mmboptions.nommb2) {
    // 平均波幅的计算日数
    let N = mmboptions.N; // 止损使用的波幅下降百分比

    let L = mmboptions.L; // 有持仓，检查是否达到卖出条件
    // 第一个卖出条件是买入后按照买入价格及波动数据的反向百分比设置

    let moment = 0;

    for (let i = 0; i < N; i++) {
      if (index - i - 1 >= 0) {
        let tmp = stockData[index - i - 1];

        if (mmboptions.mmbType === "hl") {
          moment += tmp.high - tmp.low;
        } else {
          moment += tmp.high - tmp.close;
        }
      }
    }

    moment = moment / N;
    let targetPrice = currentData.open - moment * L;

    if (targetPrice <= currentData.open && targetPrice >= currentData.low) {
      // 执行波动卖出
      return trans.createSellTransaction(stockInfo, tradeDate, index, stock.count, targetPrice, "mmb2", `动能突破卖出：${targetPrice.toFixed(2)} (= ${currentData.open}-${moment.toFixed(2)}*${L * 100}%)`);
    }
  }
}
/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */


function showOptions(options) {
  return `
模型 ${mmb.name}[${mmb.label}] 参数：
波幅类型 [${options.mmb.mmbType === "hc" ? "最高-收盘" : "最高-最低"}]
动能平均天数: ${options.mmb.N}
动能突破买入比例: ${options.mmb.P * 100}%
动能突破卖出比例: ${options.mmb.L * 100}%
规则：
  1. [${options.mmb.nommb1 ? "🚫" : "✅"}] 开盘盈利锁定
  2. [${options.mmb.nommb2 ? "🚫" : "✅"}] 动能向下突破卖出
`;
}

let mmb = {
  name: "MMB(动能穿透)",
  label: "mmb",
  description: "动能穿透",
  methodTypes: {
    mmb: "动能突破买入",
    mmb1: "开盘盈利卖出",
    mmb2: "动能突破卖出"
  },
  checkBuyTransaction: checkMMBBuyTransaction,
  checkSellTransaction: checkMMBSellTransaction,
  showOptions
};

// const _ = require("lodash");
const debug$6 = debugpkg("stoploss");
const OPTIONS_NAME$1 = "stoploss";
/**
 * 检查是否需要执行止损
 * @param {*} stocks 持仓信息
 * @param {int} index 交易日索引位置
 * @param {*} stockData 日线数据
 */

function checkStoplossTransaction(stockInfo, stock, index, stockData, options) {
  if (_$1.isEmpty(stock) || stock.count <= 0) return;
  let currentData = stockData[index]; // 止损最大损失比例

  let S = options && options[OPTIONS_NAME$1].S; // 这里检查纯粹的百分比止损

  let tradeDate = currentData.trade_date;
  let lossPrice = stock.price * (1 - S);
  debug$6(`止损检查${tradeDate}: ${currentData.low}] <= ${lossPrice.toFixed(2)} (=${stock.price.toFixed(2)}*(1-${(S * 100).toFixed(2)}%))`);

  if (currentData.low <= lossPrice) {
    // 当日价格范围达到止损值
    return trans.createSellTransaction(stockInfo, tradeDate, index, stock.count, lossPrice, "stoploss", `止损 ${lossPrice.toFixed(2)} (=${stock.price.toFixed(2)}*(1-${S * 100}%))`);
  }
}
/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */


function showOptions$1(options) {
  return `
模型 ${stoploss.name}[${stoploss.label}] 参数：
止损比例: ${options.stoploss.S * 100}%
`;
}

let stoploss = {
  name: "止损",
  label: "stoploss",
  description: "止损",
  methodTypes: {
    stoploss: "止损卖出"
  },
  checkSellTransaction: checkStoplossTransaction,
  showOptions: showOptions$1
};

const debug$7 = debugpkg("benchmark");
/**
 * 基准参数，用于测量正常买入卖出情况下的基准效果
 * 采用的买入策略为开盘买入，第二天收盘卖出；或者止损平仓
 */

const RULE_NAME = "benchmark";
/**
 * 检查买入条件
 * @param {*} stockInfo 股票信息
 * @param {double} balance 账户余额
 * @param {int} index 交易日数据索引位置
 * @param {*} stockData 数据
 * @param {*} options 算法参数
 */

function checkBuyTransaction(stockInfo, balance, index, stockData, options) {
  if (balance <= 0) return; // debug(`买入检查: ${balance}, ${tradeDate}, %o, ${index}`, stockData);
  // let bmOptions = options && options[RULE_NAME];

  let currentData = stockData[index]; // console.log(`跟踪信息： ${stockData.length}, ${index}`, currentData);

  let targetPrice = currentData.open;
  let tradeDate = stockData[index].trade_date;
  debug$7(`基准买入：[${tradeDate} price=${targetPrice} open=${currentData.open} close=${currentData.close}]`);
  return trans.createBuyTransaction(stockInfo, tradeDate, index, balance, targetPrice, RULE_NAME, `基准买入 ${targetPrice.toFixed(2)}`);
}
/**
 * 检查是否可以生成卖出交易，如果可以卖出，产生卖出交易记录
 *
 * @param {*} info 股票信息
 * @param {*} stock 持仓信息
 * @param {*} index 今日数据索引位置
 * @param {*} stockData 日线数据
 * @param {*} options 算法参数
 */


function checkSellTransaction(stockInfo, stock, index, stockData, options) {
  if (_$1.isEmpty(stock) || stock.count <= 0) return;
  let currentData = stockData[index];
  let tradeDate = currentData.trade_date;
  let bmoptions = options && options[RULE_NAME];
  let priceType = bmoptions.sellPrice;

  if (priceType === "open") {
    debug$7(`基准卖出：[${tradeDate} price=${currentData.open} open=${currentData.open} close=${currentData.close}]`);
    return trans.createSellTransaction(stockInfo, tradeDate, index, stock.count, currentData.open, priceType, `开盘卖出 ${currentData.open})`);
  } else if (priceType === "close") {
    debug$7(`基准卖出：[${tradeDate} price=${currentData.close} open=${currentData.open} close=${currentData.close}]`);
    return trans.createSellTransaction(stockInfo, tradeDate, index, stock.count, currentData.open, priceType, `收盘卖出 ${currentData.close}`);
  }
}
/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */


function showOptions$2(options) {
  return `
模型 ${benchmark.name}[${benchmark.label}] 参数：
卖出类型: ${options.benchmark.sellPrice}
`;
}

let benchmark = {
  name: "基准",
  label: RULE_NAME,
  description: "基准测试",
  methodTypes: {
    open: "开盘卖出",
    close: "收盘卖出"
  },
  checkBuyTransaction,
  checkSellTransaction,
  showOptions: showOptions$2
};

const debug$8 = debugpkg("outsideday");
/**
 * 外包日模式，主要针对买入定义
 */

const RULE_NAME$1 = "outsideday";
/**
 * 检查外包日买入条件
 * 1. 前一天为外包日结构，T-1， T-2两天的价格要求满足，T-1价格范围外包T-2，并且T-1收盘价低于T-2最低价
 * 2. 今日T日的开盘价低于T-1外包日收盘价以下
 *
 * 买入价格定为T-1日收盘价
 *
 * @param {*} stockInfo 股票信息
 * @param {double} balance 账户余额
 * @param {int} index 交易日数据索引位置
 * @param {*} stockData 数据
 * @param {*} options 算法参数
 */

function checkBuyTransaction$1(stockInfo, balance, index, stockData, options) {
  if (balance <= 0) return;
  if (index < 2) return; // debug(`外包日买入检查: ${balance}, ${tradeDate}, %o, ${index}`, stockData);
  // let bmOptions = options && options[RULE_NAME];

  let data2 = stockData[index - 2];
  let data1 = stockData[index - 1];
  let currentData = stockData[index]; // 外包日条件

  if (data1.high < data2.high || data1.low > data2.low) return; // 外包日收盘低于前一日最低

  if (data1.close > data2.low) return; // 今日开盘低于外包日收盘

  if (currentData.open >= data1.close) return; // console.log(`跟踪信息： ${stockData.length}, ${index}`, currentData);

  let targetPrice = currentData.close; // data1.close;

  let tradeDate = currentData.trade_date;
  debug$8(`找到外包日模式：
    [${tradeDate} open=${currentData.open}, close=${currentData.close}] 
    [${data1.trade_date}: high=${data1.high}, low=${data1.low}, close=${data1.close}]
    [${data2.trade_date}: high=${data1.high}, low=${data1.low}]
    `);
  return trans.createBuyTransaction(stockInfo, tradeDate, index, balance, targetPrice, RULE_NAME$1, `外包日买入 ${targetPrice.toFixed(2)}`);
} // /**
//  * 检查是否可以生成卖出交易，如果可以卖出，产生卖出交易记录
//  *
//  * @param {*} info 股票信息
//  * @param {*} stock 持仓信息
//  * @param {*} index 今日数据索引位置
//  * @param {*} stockData 日线数据
//  * @param {*} options 算法参数
//  */
// function checkSellTransaction(stockInfo, stock, index, stockData, options) {
//     if (_.isEmpty(stock) || stock.count <= 0) return;
//     let currentData = stockData[index];
//     let tradeDate = currentData.trade_date;
//     let bmoptions = options && options[RULE_NAME];
//     let priceType = bmoptions.sellPrice;
//     if (priceType === "open") {
//         return engine.createSellTransaction(
//             stockInfo,
//             tradeDate,
//             index,
//             stock.count,
//             currentData.open,
//             priceType,
//             `开盘卖出 ${currentData.open})`
//         );
//     } else if (priceType === "close") {
//         return engine.createSellTransaction(
//             stockInfo,
//             tradeDate,
//             index,
//             stock.count,
//             currentData.open,
//             priceType,
//             `收盘卖出 ${currentData.close}`
//         );
//     }
// }

/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */


function showOptions$3(options) {
  return `
`;
}

let outsideday = {
  name: "外包日",
  label: RULE_NAME$1,
  description: "外包日买入",
  methodTypes: {},
  checkBuyTransaction: checkBuyTransaction$1,
  // checkSellTransaction,
  showOptions: showOptions$3
};

const debug$9 = debugpkg("opensell");
const OPTIONS_NAME$2 = "opensell";
/**
 * 开盘盈利卖出
 *
 * @param {*} info 股票信息
 * @param {*} stock 持仓信息
 * @param {*} index 今日数据索引位置
 * @param {*} stockData 日线数据
 * @param {*} options 算法参数
 */

function checkSellTransaction$1(stockInfo, stock, index, stockData, options) {
  if (_$1.isEmpty(stock) || stock.count <= 0) return;
  let currentData = stockData[index];
  let tradeDate = currentData.trade_date; // 目前有持仓，检查是否达到开盘盈利卖出条件

  if (currentData.open > stock.price) {
    debug$9(`开盘盈利策略符合：${currentData.open.toFixed(2)} (> ${stock.price.toFixed(2)})`);
    return trans.createSellTransaction(stockInfo, tradeDate, index, stock.count, currentData.open, OPTIONS_NAME$2, `开盘盈利卖出 ${currentData.open} (> ${stock.price.toFixed(2)})`);
  }
}
/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */


function showOptions$4(options) {
  return `
`;
}

let opensell = {
  name: "开盘盈利",
  label: OPTIONS_NAME$2,
  description: "开盘盈利卖出",
  methodTypes: {},
  // checkBuyTransaction: checkMMBBuyTransaction,
  checkSellTransaction: checkSellTransaction$1,
  showOptions: showOptions$4
};

const debug$a = debugpkg("smashday");
/**
 * 攻击日模式
 */

const RULE_NAME$2 = "smashday";
/**
 * 检查指定序号的日期数据是否符合当前模型定义形态
 *
 * @param {int} index 日期序号
 * @param {*} stockData 数据
 * @param {*} options 参数配置
 */

function check(index, stockData, options) {
  if (index < 1) return;
  let type = options && options.smashday.type;
  let currentData = stockData[index];
  let data1 = stockData[index - 1];
  let tradeDate = currentData.trade_date;

  if (type === "smash1" && currentData.close < data1.low) {
    return {
      dataIndex: index,
      date: tradeDate,
      tradeType: "buy",
      type: "smash1",
      targetPrice: currentData.high,
      memo: `突出收盘买入 [${tradeDate} ${currentData.close} < ${data1.low}，小于前一日最低]，在达到今日最大为反转可买入 ${currentData.high}`
    };
  } else if (type === "smash1" && currentData.close > data1.high) {
    return {
      dataIndex: index,
      date: tradeDate,
      tradeType: "sell",
      type: "smash1",
      targetPrice: currentData.low,
      memo: `突出收盘卖出 [${tradeDate} ${currentData.close} > ${data1.high}，大于前一日最高]，在达到今日最低为反转可卖出 ${currentData.low}`
    };
  } else if (type === "smash2" && currentData.close > data1.close && (currentData.close - currentData.low) / (currentData.high - currentData.low) < 0.25) {
    return {
      dataIndex: index,
      date: tradeDate,
      tradeType: "buy",
      type: "smash2",
      targetPrice: currentData.high,
      memo: `隐藏攻击买入 [${tradeDate} ${currentData.close} > ${data1.close}，收盘上涨，且在今日价格下方25% (${currentData.high}, ${currentData.low})]，在达到今日最高可买入 ${currentData.high}`
    };
  } else if (type === "smash2" && currentData.close < data1.close && (currentData.close - currentData.low) / (currentData.high - currentData.low) > 0.75) {
    return {
      dataIndex: index,
      date: tradeDate,
      tradeType: "sell",
      type: "smash2",
      targetPrice: currentData.low,
      memo: `隐藏攻击卖出 [${tradeDate} ${currentData.close} < ${data1.close}，收盘下跌，且在今日价格上方25% (${currentData.high}, ${currentData.low})]，在达到今日最低可卖出 ${currentData.low}`
    };
  }
}
/**
 * 检查买入条件
 * @param {*} stockInfo 股票信息
 * @param {double} balance 账户余额
 * @param {int} index 交易日数据索引位置
 * @param {*} stockData 数据
 * @param {*} options 算法参数
 */


function checkBuyTransaction$2(stockInfo, balance, index, stockData, options) {
  if (balance <= 0) return; // debug(`买入检查: ${balance}, ${tradeDate}, %o, ${index}`, stockData);

  let buy = options.smashday && options.smashday.buy;
  let validDays = buy.validDays || 3;

  for (let i = 0; i < validDays; i++) {
    let matched = check(index - i, stockData, options);
    let smashType = buy.type || "smash1";
    let currentData = stockData[index];
    let tradeDate = currentData.trade_date;
    let targetPrice = matched.targetPrice;

    if (matched && matched.trade_date === "buy") {
      if (matched.type === smashType && currentData.high >= matched.targetPrice) {
        debug$a(`攻击日为[${matched.date}]，今日满足目标价位：${matched.targetPrice} [${currentData.low}, ${currentData.high}]`);
        return trans.createBuyTransaction(stockInfo, tradeDate, index, balance, targetPrice, RULE_NAME$2, `攻击日[${matched.type}]买入${targetPrice.toFixed(2)}`);
      }
    }
  }
}
/**
 * 检查是否可以生成卖出交易，如果可以卖出，产生卖出交易记录
 *
 * @param {*} info 股票信息
 * @param {*} stock 持仓信息
 * @param {*} index 今日数据索引位置
 * @param {*} stockData 日线数据
 * @param {*} options 算法参数
 */


function checkSellTransaction$2(stockInfo, stock, index, stockData, options) {
  if (_$1.isEmpty(stock) || stock.count <= 0) return;
  let sell = options.smashday && options.smashday.sell;
  let validDays = sell.validDays || 3;

  for (let i = 0; i < validDays; i++) {
    let matched = check(index - i, stockData, options);
    let smashType = sell.type || "smash1";
    let currentData = stockData[index];
    let tradeDate = currentData.trade_date;
    let targetPrice = matched.targetPrice;

    if (matched && matched.trade_date === "sell") {
      if (matched.type === smashType && currentData.low <= targetPrice) {
        debug$a(`攻击日为[${matched.date}]，今日满足目标价位：${targetPrice} [${currentData.low}, ${currentData.high}]`);
        return trans.createSellTransaction(stockInfo, tradeDate, index, stock.count, targetPrice, RULE_NAME$2, `攻击日[${matched.type}]卖出${targetPrice.toFixed(2)}`);
      }
    }
  }
}
/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */


function showOptions$5(options) {
  let buy = options && options.smashday && options.smashday.buy;
  let sell = options && options.smashday && options.smashday.sell;
  return `
模型 ${smashday.name}[${smashday.label}] 参数：
买入有效期: ${buy.validDays}
买入类型: ${buy.type}, ${smashday.methodTypes[buy.type]}

卖出有效期: ${sell.validDays}
卖出类型: ${sell.type}, ${smashday.methodTypes[sell.type]}
`;
}

let smashday = {
  name: "攻击日",
  label: RULE_NAME$2,
  description: "攻击日模型",
  methodTypes: {
    smash1: "突出收盘价",
    smash2: "隐藏攻击日"
  },
  checkBuyTransaction: checkBuyTransaction$2,
  checkSellTransaction: checkSellTransaction$2,
  check,
  showOptions: showOptions$5
};

/**
 * 平均价
 *
 * 参数
 *  type：ma，算术平均； ema，指数移动平均
 *  source: close | ohlc
 */
/**
 * 计算移动平均，返回ma数据
 * @param {*} tradeData 所有数据
 * @param {*} options 参数，n 平均周期, type 平均类型, digits 保留小数位数
 */

function ma$1(tradeData, options) {
  utils.checkTradeData(tradeData);
  return utils.ma(tradeData, options && options.n, (options && options.source) === "ohlc" ? utils.ohlc : "close", options && options.type, options && options.digits);
}

var MA = {
  name: "均值",
  label: "MA",
  description: "平均收盘价",
  calculate: ma$1
};

/**
 * ATR 指标，平均真实幅度
 *
 * 参数
 *  n: 表示平均天数
 *  type：表示均值类型，ma 算术平均，ema 指数移动平均
 *
 * TR = max[h-l, abs(h-cp), abs(l-cp)]
 * cp 表示昨日收盘
 *
 * ATR = Sum(TR, n)/n, 表示n天TR的算术平均
 */
/**
 * 计算ATR指标
 * @param {Array} tradeData 数据数组
 * @param {*} options 参数配置，ATR包含n属性
 */

function atr(tradeData, options) {
  utils.checkTradeData(tradeData);
  return utils.ma(tradeData, options.n, utils.tr, options && options.type, options && options.digits);
}

var ATR = {
  name: "ATR",
  label: "平均真实波幅",
  description: "表示在一定周期内价格的最大波动偏离幅度",
  calculate: atr
};

/**
 * Keltner Channel，肯特钠通道
 * 类似于布林带的带状指标，由上中下三条轨道组成
 *
 * 中轨：移动平均线，参数n
 * 上/下轨：移动平均线上下ATR*m距离
 *
 * 参数定义：
 *  n：移动平均天数，默认12，（Squeeze 为20）
 *  m：通道和中轨之间ATR值的倍数，默认1.5
 *  type1：价格移动平均类型，ma 简单移动平均，ema 指数移动平均，默认ema
 *  type2：atr移动平均类型，ma ｜ ema，默认 ma
 *  source: close | ohlc
 */

function keltner(tradeData, options) {
  if (!tradeData || tradeData.length < 0) return;
  utils.checkTradeData(tradeData);
  let ma = MA.calculate(tradeData, {
    n: options.n,
    type: options.type1,
    source: options.source,
    digits: options.digits
  });
  if (!ma) return;
  let atr = ATR.calculate(tradeData, {
    n: options.n,
    type: options.type2,
    digits: options.digits
  });
  if (!atr) return;
  let up = [];
  let down = [];

  for (let i = 0; i < ma.length; i++) {
    up[i] = utils.toFixed(ma[i] + options.m * atr[i], options.digits);
    down[i] = utils.toFixed(ma[i] - options.m * atr[i], options.digits);
  }

  return [ma, up, down, atr];
}

var KC = {
  name: "科特钠通道",
  label: "KC",
  description: "科特钠通道",
  calculate: keltner
};

/**
 * 布林线指标
 *
 * 参数：
 *  n: 移动平均天数
 *  m: 上下轨到移动平均的标准差倍数
 *  source: close | ohlc
 *  ma: 移动平均类型，ma | ema
 *
 */

function boll(tradeData, options) {
  utils.checkTradeData(tradeData);
  let ma = MA.calculate(tradeData, {
    n: options.n,
    type: options.ma,
    source: options.source,
    digits: options.digits
  });
  if (!ma) return;
  let stdev = utils.stdev(tradeData, options.n, (options && options.source) === "ohlc" ? utils.ohlc : "close", options.digits);
  if (!stdev) return;
  let up = [];
  let down = [];

  for (let i = 0; i < ma.length; i++) {
    up[i] = utils.toFixed(ma[i] + options.m * stdev[i], options.digits);
    down[i] = utils.toFixed(ma[i] - options.m * stdev[i], options.digits);
  }

  return [ma, up, down, stdev];
}

var BOLL = {
  name: "BOLL",
  label: "布林线",
  description: "布林线指标",
  calculate: boll
};

/**
 * 基本动量指标
 *
 * 参数：
 *  n: 动量周期
 *  m: 平均天数
 *  source: close, ohlc
 */

function mtm(tradeData, options) {
  utils.checkTradeData(tradeData);

  if (!_$1.isEmpty(tradeData) && _$1.isArray(tradeData) && tradeData.length > 0 && options && options.n > 1) {
    let source = options && options.source === "ohlc" ? utils.ohlc : "close";
    let digits = options.digits || 3;
    let ma;

    if (options && options.m && options.m > 1) {
      ma = utils.ma(tradeData, options.m, source, "ma", digits);
    } else {
      ma = utils.ma(tradeData, 1, source, "ma", digits);
    }

    let momentum = tradeData.map((item, i, all) => {
      if (i > options.n) {
        return utils.toFixed(ma[i] - ma[i - options.n], //utils.readData(item, source) - ma[i - options.n],
        //utils.readData(all[i - options.n], source),
        digits);
      } else {
        return 0;
      }
    }); // momentum = utils.ma(momentum, 6, undefined, "ma");

    return momentum;
  }
}

var MTM = {
  name: "MTM",
  label: "动量指标",
  description: "动量振荡器指标",
  calculate: mtm
};

/**
 * TTM Wave A & B & C
 *
 * 参数：
 *  n: wave 短周期平均
 *  ma: wave a 周期平均1
 *  la: wave a 周期平均2
 *  mb: wave b 周期平均1
 *  lb: wave b 周期平均2
 *  mc: wave c 周期平均1
 *  lc: wave c 周期平均2
 *
 *  useb: true
 *  usec: true
 *  source: close, ohlc
 */

function subtract(array1, array2, digits) {
  if (_$1.isEmpty(array1) || _$1.isEmpty(array2) || array1.length !== array2.length) {
    return;
  }

  return array1.map((item, i, all) => {
    if (digits) {
      return utils.toFixed(item - array2[i], digits);
    } else {
      return item - array2[i];
    }
  });
}

function ttmwave(tradeData, {
  n = 8,
  // 5
  ma = 34,
  // 21
  la = 55,
  // 34
  useb = true,
  mb = 89,
  // 55
  lb = 144,
  // 89
  usec = true,
  mc = 233,
  // 144
  lc = 377,
  // 233
  source = "close",
  digits = 3
} = {}) {
  utils.checkTradeData(tradeData);

  if (_$1.isEmpty(tradeData) || !_$1.isArray(tradeData) || tradeData.length <= 0) {
    return;
  }

  if (source === "ohlc") {
    source = utils.ohlc;
  } else {
    source = "close";
  } // let source = (options && options.source) == "ohlc" ? utils.ohlc : "close";
  // let digits = (options && options.digits) || 3;
  // let n = (options && options.n) || 8;
  // let ma = (options && options.ma) || 34;
  // let la = (options && options.la) || 55;
  // let mb = (options && options.mb) || 89;
  // let lb = (options && options.lb) || 144;
  // let mc = (options && options.mb) || 233;
  // let lc = (options && options.lb) || 377;
  // wave A


  let fastMA1 = utils.ma(tradeData, n, source, "ema", digits);
  let slowMA1 = utils.ma(tradeData, ma, source, "ema", digits);
  let macd1 = subtract(fastMA1, slowMA1);
  let signal1 = utils.ma(macd1, ma, null, "ema", digits);
  let hist1 = subtract(macd1, signal1, digits);
  let fastMA2 = utils.ma(tradeData, n, source, "ema", digits);
  let slowMA2 = utils.ma(tradeData, la, source, "ema", digits);
  let macd2 = subtract(fastMA2, slowMA2);
  let signal2 = utils.ma(macd2, la, null, "ema", digits);
  let hist2 = subtract(macd2, signal2, digits); // wave B

  let fastMA3 = useb ? utils.ma(tradeData, n, source, "ema", digits) : null;
  let slowMA3 = useb ? utils.ma(tradeData, mb, source, "ema", digits) : null;
  let macd3 = useb ? subtract(fastMA3, slowMA3) : null;
  let signal3 = useb ? utils.ma(macd3, mb, null, "ema", digits) : null;
  let hist3 = useb ? subtract(macd3, signal3, digits) : null;
  let fastMA4 = useb ? utils.ma(tradeData, n, source, "ema", digits) : null;
  let slowMA4 = useb ? utils.ma(tradeData, lb, source, "ema", digits) : null;
  let macd4 = useb ? subtract(fastMA4, slowMA4) : null;
  let signal4 = useb ? utils.ma(macd4, lb, null, "ema", digits) : null;
  let hist4 = useb ? subtract(macd4, signal4, digits) : null; // wave C

  let fastMA5 = usec ? utils.ma(tradeData, n, source, "ema", digits) : null;
  let slowMA5 = usec ? utils.ma(tradeData, mc, source, "ema", digits) : null;
  let macd5 = usec ? subtract(fastMA5, slowMA5) : null;
  let signal5 = usec ? utils.ma(macd5, mc, null, "ema", digits) : null;
  let hist5 = usec ? subtract(macd5, signal5, digits) : null;
  let fastMA6 = usec ? utils.ma(tradeData, n, source, "ema", digits) : null;
  let slowMA6 = usec ? utils.ma(tradeData, lc, source, "ema", digits) : null;
  let macd6 = usec ? subtract(fastMA6, slowMA6, digits) : null;
  let signal6 = usec ? utils.ma(macd6, mc, null, "ema", digits) : null;
  let hist6 = usec ? subtract(macd6, signal6, digits) : null;
  return [hist1, hist2, hist3, hist4, hist5, hist6, macd6];
}

var TTMWave = {
  name: "TTM Wave",
  label: "TTMWave",
  description: "TTM 波浪A B C",
  calculate: ttmwave
}; // function ttmwave_ol(tradeData, options) {
//     utils.checkTradeData(tradeData);
//     if (
//         _.isEmpty(tradeData) ||
//         !_.isArray(tradeData) ||
//         tradeData.length <= 0
//     ) {
//         return;
//     }
//     let source = (options && options.source) == "ohlc" ? utils.ohlc : "close";
//     let digits = (options && options.digits) || 3;
//     let n = (options && options.n) || 8;
//     // wave A
//     let ma = (options && options.ma) || 34;
//     let la = (options && options.la) || 55;
//     // wave B
//     let mb = (options && options.mb) || 89;
//     let lb = (options && options.lb) || 144;
//     // wave C
//     let mc = (options && options.mb) || 233;
//     let lc = (options && options.lb) || 377;
//     // 优化方式下，从头开始，每天的数据一次性完成
//     let ttmwaves = [];
//     let last = [];
//     for (let i = 0; i < tradeData.length; i++) {
//         let tmp = [];
//         if (i === 0) {
//             // 第一天的特殊数据
//         } else {
//             // wave a
//             // let fastma1 =
//         }
//     }
// }

/**
 * 鸡排指标，Squeeze，From Mastering the Trade (3rd Ed)
 *
 * 参数：
 *  source: close | ohlc
 *  ma: ma | ema
 *  n: 20
 *  bm: 2
 *  km: 1.5
 *  mt: "MTM" || "WAVE"
 *  mn: 5
 *  mm: 12
 *
 *  ditis: 3
 *
 */
const READY = "READY";
const REST = "--";
const BUY = "BUY";
const SELL = "SELL";

function squeeze(tradeData, {
  source = "close",
  digits = 3,
  ma = "ema",
  n = 20,
  km = 1.5,
  bm = 2,
  mt = "MTM",
  mn = 12,
  mm = 1,
  tn = 5,
  tm = 21,
  tl = 34
} = {}) {
  utils.checkTradeData(tradeData);

  if (source === "ohlc") {
    source = utils.ohlc;
  } else {
    source = "close";
  } // let source = (options && options.source) || "close";
  // let digits = (options && options.digits) || 3;
  // let ma = (options && options.ma) || "ema";
  // let n = (options && options.n) || 20;
  // // kc边界倍数
  // let km = (options && options.km) || 1.5;
  // // boll边界倍数
  // let bm = (options && options.bm) || 2;
  // // 动量指标参数
  // let mt = (options && options.mt) || "MTM";
  // let mn = (options && options.mn) || 12;
  // let mm = (options && options.mm) || 1;
  // let mmsource = (options && options.mmsource) || "hl";
  // // TTM Wave
  // let tn = (options && options.tn) || 5;
  // let tm = (options && options.tm) || 21;
  // let tl = (options && options.tl) || 34;


  let kcData = KC.calculate(tradeData, {
    n,
    m: km,
    type1: ma,
    type2: ma,
    source,
    digits
  });
  let bollData = BOLL.calculate(tradeData, {
    n,
    m: bm,
    ma,
    source,
    digits
  });
  let mtmData = MTM.calculate(tradeData, {
    n: mn,
    m: mm,
    source,
    digits
  });
  let waveData = TTMWave.calculate(tradeData, {
    n: tn,
    ma: tm,
    la: tl,
    source,
    digits,
    useb: false,
    usec: false
  });
  let mmData = mt === "MTM" ? mtmData : waveData && waveData[0]; // 下面根据轨道情况，判断状态，状态区分如下
  // 1. boll进kc，启动警告状态：READY
  // 2. boll出kc，进入交易状态：
  //   2.1 mm>0，买入（多头）：BUY
  //   2.2 mm<=0，卖出（空头）：SELL
  // 3. mm 降低，交易结束：--

  let currentState = REST;
  let states = tradeData.map((item, i, all) => {
    let ready = bollData && kcData && bollData[1][i] && kcData[1][i] && bollData[1][i] <= kcData[1][i];
    let mmUp = mmData && mmData[i] && mmData[i] >= 0; // mt === "MTM"
    //     ? mmData && mmData[i] && mmData[i] >= 0
    //     : waveData && waveData[0] && waveData[0][i] >= 0;

    let nextState = currentState;

    if (currentState === REST) {
      if (ready) {
        nextState = READY;
      }
    } else if (currentState === READY) {
      if (!ready) {
        nextState = mmUp ? BUY : SELL;
      }
    } else if (currentState === BUY || currentState === SELL) {
      if (ready) {
        // 再次进入等待
        nextState = READY;
      } else {
        // 检查是否出现动能减弱
        if (mmData && mmData[i] && mmData[i - 1] && (currentState === BUY && mmData[i] < mmData[i - 1] || currentState === SELL && mmData[i] > mmData[i - 1])) {
          nextState = REST;
        }
      }
    }

    currentState = nextState;
    return nextState;
  });
  return [kcData && kcData[0], bollData && bollData[1], bollData && bollData[2], kcData && kcData[1], kcData && kcData[2], mmData, states, mtmData, waveData && waveData[0], waveData && waveData[1]];
}

var SQUEEZE = {
  name: "SQUEEZE",
  label: "鸡排",
  description: "挤牌信号器指标",
  calculate: squeeze,
  states: {
    REST,
    READY,
    BUY,
    SELL
  }
};

const debug$b = debugpkg("rules:squeeze");
const RULE_NAME$3 = "squeeze";
const SQUEEZE_DATA = Symbol("SQUEEZE_DATA");
const TTMWAVE_DATA = Symbol("TTMWAVE_DATA");

function checkTTM(index, ttmwave) {
  // 检查TTM Wave ABC的趋势
  let upTrend = 0;
  let downTrend = 0;
  let ups = 0;
  let downs = 0;

  if (index - 2 >= 0) {
    for (let i = 0; i < 6; i++) {
      if (ttmwave[i][index] >= 0) {
        ups++;
      } else {
        downs++;
      }

      if (ttmwave[i][index] > ttmwave[i][index - 1] && ttmwave[i][index - 1] > ttmwave[i][index - 2]) {
        upTrend++;
      } else {
        downTrend++;
      }
    }
  }

  return [ups, downs, upTrend, downTrend];
}

function check$1(index, stockData, options, tsCode) {
  let sdata = SQUEEZE.calculate(stockData, options.squeeze); // 使用TTMWave同步进行检查

  let ttmwave = TTMWave.calculate(stockData, options.ttmwave);

  if (stockData && _$1.isArray(stockData) && index < stockData.length && index >= 0) {
    let tradeDate = stockData[index].trade_date;
    let days = checkDays(index, sdata[6]);
    let trends = checkTTM(index, ttmwave);

    if (sdata[6][index] === SQUEEZE.states.READY) {
      // 有信号
      if (trends[0] >= 3 && trends[2] >= 3) {
        return {
          tsCode,
          dataIndex: index,
          date: tradeDate,
          tradeType: "signal",
          hasSignals: true,
          signal: "READY",
          type: "squeeze",
          squeeze: {
            days,
            trends
          },
          // targetPrice: stockData[index].close,
          memo: `挤牌信号，可考虑挤入 [${stockData[index].trade_date} ${sdata[6][index]}]`
        };
      }
    } else if (sdata[6][index] === SQUEEZE.states.BUY) {
      // 检查Wave ABC的趋势变化
      if (trends[0] >= 3 && trends[2] >= 3) {
        return {
          tsCode,
          dataIndex: index,
          date: tradeDate,
          tradeType: "buy",
          hasSignals: true,
          signal: "BUY",
          type: "squeeze",
          squeeze: {
            days,
            trends
          },
          // targetPrice: stockData[index].close,
          memo: `挤牌信号明确，买入 [${stockData[index].trade_date} ${sdata[6][index]}]`
        };
      }
    } else if (sdata[6][index] === SQUEEZE.states.SELL && options.squeeze.needSell) {
      if (trends[1] <= 3 && trends[3] <= 3) {
        return {
          tsCode,
          dataIndex: index,
          date: tradeDate,
          hasSignals: true,
          tradeType: "sell",
          signal: "SELL",
          type: "squeeze",
          squeeze: {
            days,
            trends
          },
          // targetPrice: stockData[index].close,
          memo: `挤牌信号明确，卖出 [${stockData[index].trade_date} ${sdata[6][index]}]`
        };
      }
    }
  }
}

function checkDays(index, states) {
  if (states[index] === SQUEEZE.states.REST) return [0, 0];
  let trade_days = 0;
  let state = states[index];

  if (state === SQUEEZE.states.BUY || state === SQUEEZE.states.SELL) {
    while (index - trade_days >= 0 && states[index - trade_days] === state) {
      trade_days++;
    }
  }

  let ready_days = 0;

  if (states[index - trade_days] === SQUEEZE.states.READY) {
    while (index - trade_days - ready_days >= 0 && states[index - trade_days - ready_days] === SQUEEZE.states.READY) {
      ready_days++;
    }
  }

  return [ready_days, trade_days];
}

function calculateSqueeze(stockData, options) {
  if (_$1.isNil(stockData)) return; // debug(
  //     `squeeze? ${_.isNil(stockData[SQUEEZE_DATA])} ${_.isNil(
  //         stockData[TTMWAVE_DATA]
  //     )}`
  // );

  if (_$1.isNil(stockData[SQUEEZE_DATA])) {
    stockData[SQUEEZE_DATA] = SQUEEZE.calculate(stockData, options.squeeze);
  }

  if (_$1.isNil(stockData[TTMWAVE_DATA])) {
    stockData[TTMWAVE_DATA] = TTMWave.calculate(stockData, options.ttmwave);
  }
}

function checkBuyTransaction$3(stockInfo, balance, index, stockData, options) {
  debug$b(`检查挤牌买入：${index}, ${balance}`);
  if (balance <= 0) return;
  calculateSqueeze(stockData, options);
  if (index < 1) return; // 检查今天index的条件

  let squeeze = stockData[SQUEEZE_DATA]; // debug(`%o`, squeeze);

  let squeeze_today = squeeze && squeeze[6] && squeeze[6][index];
  let squeeze_lday = squeeze && squeeze[6] && squeeze[6][index - 1]; // if (_.isNil(squeeze_today)) {
  //     debug(`意外退出...`);
  //     return;
  // }

  debug$b(`检查买入规则：${squeeze_today}, ${squeeze_lday}`);

  if (squeeze_today === SQUEEZE.states.BUY && squeeze_lday === SQUEEZE.states.READY) {
    let currentData = stockData[index];
    let tradeDate = currentData.trade_date;
    let targetPrice = currentData.close;
    return trans.createBuyTransaction(stockInfo, tradeDate, index, balance, targetPrice, RULE_NAME$3, `挤牌买入 ${targetPrice.toFixed(2)}`);
  }
}

function checkSellTransaction$3(stockInfo, stock, index, stockData, options) {
  if (_$1.isNil(stock) || stock.count <= 0) return;
  calculateSqueeze(stockData, options);
  if (index < 1) return; // 检查今天index的条件

  let squeeze = stockData[SQUEEZE_DATA];
  let squeeze_today = squeeze && squeeze[6] && squeeze[6][index];
  let squeeze_lday = squeeze && squeeze[6] && squeeze[6][index - 1]; // if (_.isNil(squeeze_today)) {
  //     return;
  // }

  if (squeeze_today === SQUEEZE.states.REST && squeeze_lday === SQUEEZE.states.BUY) {
    let currentData = stockData[index];
    let tradeDate = currentData.trade_date;
    let targetPrice = currentData.close;
    return trans.createSellTransaction(stockInfo, tradeDate, index, stock.count, targetPrice, RULE_NAME$3, `挤牌卖出 ${targetPrice.toFixed(2)}`);
  }
}
/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */


function showOptions$6(options) {
  let opt = options && options.squeeze; // let buy = opt && options.squeeze.buy;
  // let sell = opt && options.squeeze.sell;

  return `
模型 ${squeeze$1.name}[${squeeze$1.label}] 参数：
source: ${opt.source}
均值类型: ${opt.ma},    平均天数: ${opt.n}
布林线倍率: ${opt.bm}   Keltner通道倍率: ${opt.km}
动量类型:  ${opt.mt}
动量平均天数：  ${opt.mn},     动量天数：${opt.mm}
价格类型: ${opt.source}

`;
}
/**
 * 将搜索得到的列表生成分析报表
 *
 * @param {*} results 搜索的匹配列表
 * @param {*} options 匹配使用的参数
 */


async function createReports(results, options) {
  if (_$1.isNil(results)) return; // results 当中按照signal进行了分组
  // 下面主要分析signal==="READY"情况下，时间的分布

  let readyList = results && results[SQUEEZE.states.READY]; // 1, 2, 3, 5, 8, 13
  // let boundaries = [1, 2, 3, 5, 8, 13, _];

  let days = [[], [], [], [], [], [], []];

  for (let item of readyList) {
    let ready_days = item.squeeze && item.squeeze.days && item.squeeze.days[0];
    let i = 0;
    if (ready_days === 1) i = 0;else if (ready_days === 2) i = 1;else if (ready_days === 3) i = 2;else if (ready_days > 3 && ready_days <= 5) i = 3;else if (ready_days > 5 && ready_days <= 8) i = 4;else if (ready_days > 8 && ready_days <= 13) i = 5;else i = 6;

    if (days[i]) {
      days[i].push(item.tsCode);
    } else {
      days[i] = [item.tsCode];
    }
  }

  let buyList = results && results[SQUEEZE.states.BUY];
  let bdays = [[], [], [], [], [], [], []];

  for (let item of buyList) {
    let buy_days = item.squeeze && item.squeeze.days && item.squeeze.days[1];
    let i = 0;
    if (buy_days === 1) i = 0;else if (buy_days === 2) i = 1;else if (buy_days === 3) i = 2;else if (buy_days > 3 && buy_days <= 5) i = 3;else if (buy_days > 5 && buy_days <= 8) i = 4;else if (buy_days > 8 && buy_days <= 13) i = 5;else i = 7;

    if (bdays[i]) {
      bdays[i].push(item.tsCode);
    } else {
      bdays[i] = [item.tsCode];
    }
  }

  let reports = {
    updateTime: moment$1().toISOString(),
    squeeze: {
      readyList: days,
      buyList: bdays
    }
  };
  return reports;
}

const squeeze$1 = {
  name: "挤牌",
  label: RULE_NAME$3,
  description: "挤牌模型",
  methodTypes: {},
  checkBuyTransaction: checkBuyTransaction$3,
  checkSellTransaction: checkSellTransaction$3,
  check: check$1,
  showOptions: showOptions$6,
  createReports
};

/**
 * 推进器交易，波段
 *
 */
const debug$c = debugpkg("rules:swing");
const RULE_NAME$4 = "swing";
const SWING_DATA = Symbol("SWING_DATA");

function calculateSwing(stockData, {
  n = 8,
  m = 21,
  l = 50,
  earn1 = 0.04,
  earn2 = 0.08,
  loss = 0.04,
  digits = 3
} = {}) {
  if (_$1.isNil(stockData)) return;
  let type = "ema";
  let source = "close";
  debug$c(`swing options: n=${n} m=${m} l=${l}`);

  if (_$1.isNil(stockData[SWING_DATA])) {
    let ma1 = MA.calculate(stockData, {
      n,
      source,
      type,
      digits
    });
    debug$c(`%o`, ma1);
    let ma2 = MA.calculate(stockData, {
      n: m,
      source,
      type,
      digits
    });
    debug$c(`%o`, ma2);
    let ma3 = MA.calculate(stockData, {
      n: l,
      source,
      type,
      digits
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
      let times = currentState && currentState.times || 0;
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
        if (index > 0 && index >= Math.max(n, m) - 1 && ma1[index] && ma2[index] && ma1[index] < ma2[index]) {
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

          times = currentState.times; // 今日穿墙

          if (currentState.state === -1) {
            // 当前非符合条件状态，查看今天
            if (data.open >= ma1[index]) {
              debug$c(`** ${data.trade_date} 进入等待回调区间`);
              state = 0;
            } else {
              debug$c(`** ${data.trade_date} 进入初始状态，等待进入多头区间`);
              state = 9;
            }

            lossState = 0;
            ready_days = 1;
            pullback_days = 0;
            times = 0;
            target = 0;
            lossTarget = 0;
            ruleTarget = 0;
          } // 止损/初始后等待进入正常回调区间


          if (currentState.state === 9) {
            if (data.high >= ma1[index]) {
              debug$c(` ** ${data.trade_date} 进入等待回调区间`);
              state = 0;
            }
          } // 交易跟踪，检查止损目标是否需要调整


          if (lossState === 1 && (currentState.state === 1 || state === 1) && data.high >= ruleTarget) {
            debug$c(` ** ${data.trade_date} 达到目标1，调整止损策略`);
            lossState = 2;
          } // 交易跟踪，止损


          if (currentState.state === 1 && (lossState === 1 && data.low <= lossTarget || lossState === 2 && data.low <= ma2[index])) {
            // 达到止损
            state = 9; // 根据当前止损类型确定止损价格，需要注意当天价格是否在范围内

            let price = lossState === 1 ? lossTarget : ma2[index];
            price = Math.min(price, data.high);
            trans.push({
              type: "SELL",
              price
            });
            debug$c(`** ${data.trade_date} 达到止损价位，交易: ${price}`);
            lossTarget = 0;
            target = 0;
            ruleTarget = 0;
          } // 交易跟踪，到达预期价位成交


          if (currentState.state === 1 && data.high >= target) {
            // 目标价位达到
            let price = currentState.targets[0];
            price = Math.max(data.low, price);
            trans.push({
              type: "SELL",
              price
            });
            lossState = 0;
            lossTarget = 0;
            target = 0;
            ruleTarget = 0;
            state = 0;
            debug$c(`** ${data.trade_date} 达到目标价位，交易: ${price}`);
          } // 等待回调


          if (currentState.state === 0 || state === 0) {
            // 检查是否回调到ma1
            if (ma1[index] >= data.low) {
              state = 1;
              let price = ma1[index];
              trans.push({
                type: "BUY",
                price
              });
              times++;
              lossState = 1;
              lossTarget = Math.min(price * (1 - loss), ma2[index]);
              target = price * (1 + earn2);
              ruleTarget = price * (1 + earn1);
              pullback_days = 1;
              debug$c(`** ${data.trade_date} 回调发生，交易：${price}, 目标 ${target}, 止损 ${lossTarget}, ${ruleTarget}; [${ma1[index]} ,${ma2[index]}, ${data.high}, ${data.low}]`);
            }
          } // 对于今日调整到初始状态的，最后检查是否进入回调等待阶段


          if (state === 9) {
            if (data.close >= ma1[index]) {
              debug$c(` ** ${data.trade_date} 收盘进入等待回调区间`);
              state = 0;
            }
          }
        } else {
          debug$c(` ** ${data.trade_date} 进入空头阶段，检查平仓`); // 价格已经走出交易区间，如果有头寸，平仓结束

          if (currentState.state === 1) {
            state = -1;
            let price = data.close;
            trans.push({
              type: "SELL",
              price
            });
            debug$c(`** ${data.trade_date} 进入空头，完成平仓： ${price}`);
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
        times
      };
      currentState = swingData[index];
    }

    stockData[SWING_DATA] = [swingData, ma1, ma2, ma3];
  }
}

function checkSwing(index, stockData, options, tsCode) {
  let opt = options && options.swing;
  calculateSwing(stockData, opt);
  let swingData = stockData[SWING_DATA];

  if (swingData && _$1.isArray(swingData) && index < swingData.length && index >= 0) {
    let data = swingData[index];

    if (data.state >= 0) {
      let state = data.state;
      let memo;

      if (state === 0) {
        memo = `波段：等待回调，目标 ¥${data.targets[0]}，持续${data.days[0]}天`;
      } else if (state === 1) {
        memo = `波段：已买入，目标价位 ¥${data.targets[0]}， ${data.lossState === 1 ? "初始止损" : "跟随止损"} ¥${data.targets[1]}}`;
      } else if (state === 9) {
        memo = `波段：发生止损，等待下一次回调，目标 ${data.targets[0]}`;
      }

      return {
        tsCode,
        dataIndex: index,
        date: stockData[index].trade_date,
        tradeType: "signal",
        hasSignals: true,
        signal: state === 0 ? "READY" : state === 1 ? "BUY" : state === 9 ? "PULLBACK" : "NA",
        type: "swing",
        swing: {
          days: swing.days,
          times: swing.times,
          state: swing.state,
          lossState: swing.lossState,
          targets: swing.targets
        },
        memo
      };
    }
  } // let range = (opt && opt.range) || 8;
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

function check$2(index, stockData, options, tsCode) {
  let ret = checkSwing(index, stockData, options, tsCode);
  if (!ret) return; // 只有等待回调的阶段需要进入返回列表

  if (ret.swing && ret.swing.state !== 0) return;
  return ret;
} // function readContext(index, stockData) {
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


function checkBuyTransaction$4(stockInfo, balance, index, stockData, options) {
  debug$c(`检查波段买入：${index}, ${balance}`);
  if (balance <= 0) return;
  calculateSwing(stockData, options && options.swing);
  let swingData = stockData[SWING_DATA];

  if (swingData && _$1.isArray(swingData) && index < swingData.length && index >= 0) {
    let data = swingData[index];

    if (!_$1.isEmpty(data.trans)) {
      let currentData = stockData[index];
      let tradeDate = currentData.trade_date;

      for (let tran of data.trans) {
        if (tran.type === "BUY") {
          let targetPrice = tran.price;
          return trans.createBuyTransaction(stockInfo, tradeDate, index, balance, targetPrice, RULE_NAME$4, `波段买入 ${targetPrice.toFixed(2)}`);
        }
      }
    }
  }
}

function checkSellTransaction$4(stockInfo, stock, index, stockData, options) {
  if (_$1.isNil(stock) || stock.count <= 0) return;
  calculateSwing(stockData, options && options.swing);
  let swingData = stockData[SWING_DATA];

  if (swingData && _$1.isArray(swingData) && index < swingData.length && index >= 0) {
    let data = swingData[index];

    if (!_$1.isEmpty(data.trans)) {
      let currentData = stockData[index];
      let tradeDate = currentData.trade_date;

      for (let tran of data.trans) {
        if (tran.type === "SELL") {
          let targetPrice = tran.price;
          return trans.createSellTransaction(stockInfo, tradeDate, index, stock.count, targetPrice, RULE_NAME$4, `波段卖出 ${targetPrice.toFixed(2)}`);
        }
      }
    }
  }
}
/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */


function showOptions$7(options) {
  let opt = options && options.swing;
  return `
模型 ${swing.name}[${swing.label}] 参数：
均线1: ${opt.n},  均线2: ${opt.m}
目标价位：${opt.earn2 * 100}%
止损价位：${opt.loss * 100}%
止损条件价位：${opt.earn1 * 100}%
`;
}

async function createReports$1(results, options) {
  if (_$1.isNil(results)) return;
  let reports = {
    updateTime: moment$1().toISOString(),
    swing: {}
  };
  return reports;
}

const swing = {
  name: "波段交易",
  label: RULE_NAME$4,
  description: "波段选择",
  methodTypes: {},
  checkBuyTransaction: checkBuyTransaction$4,
  checkSellTransaction: checkSellTransaction$4,
  check: check$2,
  showOptions: showOptions$7,
  createReports: createReports$1
};

/**
 * 基本动量指标
 *
 * 参数：
 *  n: 短期平均天数
 *  m: 长期平均天数
 *  source: hl, ohlc
 */

function ao(tradeData, options) {
  utils.checkTradeData(tradeData);

  if (!_$1.isEmpty(tradeData) && _$1.isArray(tradeData) && tradeData.length > 0 && options && options.n >= 1 && options.m >= 1) {
    let source = options && options.source === "ohlc" ? utils.ohlc : utils.hl;
    let digits = options.digits || 3;
    let ma1 = utils.ma(tradeData, options.n, source, "ma", digits);
    let ma2 = utils.ma(tradeData, options.m, source, "ma", digits);
    let momentum = tradeData.map((item, i, all) => {
      if (i >= options.n && i > options.m) {
        return utils.toFixed(ma1[i] - ma2[i], digits);
      } else {
        return 0;
      }
    });
    return momentum;
  }
}

var AO = {
  name: "AO",
  label: "动量震动指标",
  description: "比尔威廉姆斯动量振荡器指标",
  calculate: ao
};

/**
 * TTM Trend
 * 暂未完成，这个部分书上的描述并不清晰，对于如何比较前六个柱价格和当前柱的关系无法准确确定
 *
 * 摘抄：
 * 这项技术将前6根柱状线价格做平均。如果前面6根柱状线的平均价格位于交易区间的上半部分，
 * 则把当前柱状线涂成蓝色，代表偏向看涨和稳定的买方压力。然而，如果前面6根柱状线的平均
 * 价格位于交易区间的下半部分，那么当前柱状线将被涂成红色，代表偏向看跌和稳定的卖方压力。
 *
 * 参数
 *  n: 6 过去的天数
 *  type: TTM | HA
 */
/**
 * 计算每日的趋势情况，返回值设置为涨或跌，用1和0表示
 * @param {*} tradeData 所有数据
 * @param {*} options 参数，n 平均周期, type 平均类型, digits 保留小数位数
 */

function ttmtrend(tradeData, {
  n = 6,
  type = "TTM"
} = {}) {
  utils.checkTradeData(tradeData);
  let trends = []; // TTM暂未实现，只能给出HA结果！

  type = "HA";

  if (!_$1.isNil(tradeData) && !_$1.isEmpty(tradeData)) {
    for (let i = 0; i < tradeData.length; i++) {
      let data = tradeData[i];
      let up = data.close >= data.open;
      let trend;

      if (type === "TTM") {
        if (i === 0) {
          trend = (tradeData[0].open + tradeData[0].close) / 2 >= (tradeData[0].high + tradeData[0].low) / 2 ? 1 : 0;
        } else {
          // let hl = (data.high + data.low) / 2;
          let avg = 0;
          let high = 0;
          let low = Number.MAX_VALUE;
          let len = 0;

          for (let j = 0; j < n; j++) {
            if (i - j - 1 >= 0) {
              let ld = tradeData[i - j - 1];
              avg += (ld.open + ld.close) / 2;
              high = Math.max(high, ld.high);
              low = Math.min(low, ld.low);
              len++;
            } else {
              break;
            }
          }

          avg = avg / len / 2;
          let hl = (high + low) / 2;
          trend = hl >= avg;
        }
      } else if (type === "HA") {
        // HA pattern
        if (i > 0) {
          let o = (tradeData[i - 1].open + tradeData[i - 1].close) / 2;
          let c = (tradeData[i].open + tradeData[i].high + tradeData[i].low + tradeData[i].close) / 4; //up = c >= o;
          // 1/0表示正常升降，3/2表示修改升降

          trend = c >= o;
        } //trends[i] = up;

      }

      if (up) {
        trends[i] = trend ? 1 : 2;
      } else {
        trends[i] = trend ? 3 : 0;
      }
    }
  }

  return trends;
}

var TTMTrend = {
  name: "TTM趋势",
  label: "TTMTrend",
  description: "将前几日的市场情况纳入到对今日趋势的判断中",
  calculate: ttmtrend
};

/**
 * 抢帽子警报，内容非常简单，连续三个收盘价涨/跌作为警报，警报放在第一根线（3个连续的第一个）
 */
const REST$1 = "--";
const BUY_READY = "BUY_READY";
const SELL_READY = "SELL_READY";
const BUY$1 = "BUY";
const SELL$1 = "SELL";

function scalper(tradeData) {
  let retData = [];

  if (!_$1.isNil(tradeData) && !_$1.isEmpty(tradeData)) {
    let currentState = REST$1;

    for (let i = 0; i < tradeData.length; i++) {
      if (i < 2) {
        retData[i] = [tradeData[i].trade_date, REST$1, tradeData[i].close];
      } else {
        let data = tradeData[i];
        let data1 = tradeData[i - 1];
        let data2 = tradeData[i - 2];

        if (currentState !== BUY$1 && data.close > data1.close && data1.close > data2.close) {
          // UP
          retData[i - 2] = [data2.trade_date, BUY_READY, data2.low];
          retData[i - 1] = [data1.trade_date, BUY$1, data2.close];
          retData[i] = [data.trade_date, BUY$1, data.close];
          currentState = BUY$1;
        } else if (currentState !== SELL$1 && data.close < data1.close && data1.close < data2.close) {
          retData[i - 2] = [data2.trade_date, SELL_READY, data2.high];
          retData[i - 1] = [data1.trade_date, SELL$1, data2.close];
          retData[i] = [data.trade_date, SELL$1, data.close];
          currentState = SELL$1;
        } else {
          retData[i] = [data.trade_date, currentState, data.close];
        }
      }
    }
  }

  return retData;
}

var Scalper = {
  name: "Scalper",
  label: "抢帽子",
  description: "抢帽子警报",
  calculate: scalper,
  states: {
    REST: REST$1,
    BUY_READY,
    SELL_READY,
    BUY: BUY$1,
    SELL: SELL$1
  }
};

/**
 * 自选列表
 */
const {
  getDataRoot
} = require("@wt/lib-wtda-query");

const _ = require("lodash");

const moment = require("moment");

const path$1 = require("path");

const fs$1 = require("fs");

const fp$1 = fs$1.promises;

async function readFavorites() {
  let retData = {
    updateTime: null,
    favorites: [] // 下面考虑放个字段说明

  };

  try {
    let dataFile = getFavoritesFile();

    try {
      retData = JSON.parse(await fp$1.readFile(dataFile, "utf-8"));
    } catch (error) {
      // 文件不存在，不考虑其它错误
      if (!(error && error.code === "ENOENT")) {
        console.error(`读取自选文件${dataFile}时发生错误：${error}, %o`, error);
      } else {
        console.error(`读取自选文件${dataFile}不存在，%o`, error);
      }
    }
  } catch (error) {
    console.error(`从本地读取自选数据发生错误 ${error}`);
  }

  return retData;
}

function getFavoritesFile() {
  return path$1.join(getDataRoot(), "favorites.json");
}

async function removeFavorites(tsCodes) {
  let retData = await readFavorites();
  if (_.isEmpty(tsCodes)) return retData;
  let newCodes = [];

  if (_.isArray(tsCodes)) {
    if (tsCodes.length <= 0) return retData;
    newCodes = tsCodes;
  } else {
    newCodes.push(tsCodes);
  }

  if (_.isEmpty(retData)) {
    retData = {
      updateTime: null,
      favorites: []
    };
  }

  if (_.isEmpty(retData.favorites) || !_.isArray(retData.favorites)) {
    retData.favorites = [];
  }

  for (let newCode of newCodes) {
    for (let i in retData.favorites) {
      if (retData.favorites[i] === newCode) {
        retData.favorites.splice(i, 1);
        break;
      }
    }
  }

  retData.updateTime = moment().toISOString();
  await saveFavorites(retData);
  return retData;
}

async function addFavorites(tsCodes) {
  let retData = await readFavorites();
  if (_.isEmpty(tsCodes)) return retData;
  let newCodes = [];

  if (_.isArray(tsCodes)) {
    if (tsCodes.length <= 0) return retData;
    newCodes = tsCodes;
  } else {
    newCodes.push(tsCodes);
  }

  if (_.isEmpty(retData)) {
    retData = {
      updateTime: null,
      favorites: []
    };
  }

  if (_.isEmpty(retData.favorites) || !_.isArray(retData.favorites)) {
    retData.favorites = [];
  }

  for (let newCode of newCodes) {
    let found = false;

    for (let code of retData.favorites) {
      if (code === newCode) {
        found = true;
        break;
      }
    }

    if (!found) retData.favorites.push(newCode);
  }

  retData.updateTime = moment().toISOString();
  await saveFavorites(retData);
  return retData;
}

async function saveFavorites(data) {
  try {
    let jsonStr = JSON.stringify(data);
    let favoritesPath = getFavoritesFile();
    await fp$1.writeFile(favoritesPath, jsonStr, {
      encoding: "utf-8"
    });
  } catch (error) {
    throw new Error("保存列表数据时出现错误，请检查后重新执行：" + error);
  }
}

var favorites = {
  addFavorites,
  removeFavorites,
  readFavorites
};

// const simulate = require("./simulator");
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
  Scalper
};
const rules = {
  mmb,
  stoploss,
  benchmark,
  outsideday,
  opensell,
  smashday,
  squeeze: squeeze$1,
  swing
};

export { engine, favorites, indicators, reports, rules, search$1 as search, simulate, utils };
