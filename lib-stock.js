(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@wt/lib-wtda-query'), require('moment'), require('lodash'), require('debug')) :
    typeof define === 'function' && define.amd ? define(['exports', '@wt/lib-wtda-query', 'moment', 'lodash', 'debug'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global['@wt/lib-stock'] = {}, global.libWtdaQuery, global.moment, global._, global.debugpkg));
}(this, (function (exports, libWtdaQuery, moment, _, debugpkg) { 'use strict';

    function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

    var moment__default = /*#__PURE__*/_interopDefaultLegacy(moment);
    var ___default = /*#__PURE__*/_interopDefaultLegacy(_);
    var debugpkg__default = /*#__PURE__*/_interopDefaultLegacy(debugpkg);

    function formatFxstr(num) {
      return num.toLocaleString("zh-CN"); //, { style: "currency", currency: "CNY" });
    }

    // const moment = require("moment");
    const debug = debugpkg__default['default']("trans");
    /**
     * 主处理过程
     * 1. 当前持仓是否需要止损，options.stoploss指定算法执行止损，如果止损立刻清算并记录
     * 2. 卖出算法执行是否卖出，如果卖出，清算并记录
     * 3. 买入算法执行是否买入，如果买入，清算并记录
     *
     * TODO：主过程可以考虑持有多次买入，这样只要记录相应的总投入即可
     *
     * @param {*} tradeDate 当前计算交易日
     * @param {*} index 当前日股票数据索引
     * @param {*} stockData 股票数据信息
     * @param {*} stockInfo 股票信息
     * @param {*} capitalData 账户信息
     * @param {*} options 算法参数
     */

    async function executeTransaction(tradeMethod, // tradeDate,
    index, stockData, capitalData, options) {
      let translog = null; // 首先检查卖出
      // 所有算法首先检查并处理止损
      // 检查是否需要止损

      let tradeDate = stockData[index].trade_date;
      let stockInfo = capitalData.info;

      if (options.stoploss) {
        translog = options.stoploss.checkStoplossTransaction(stockInfo, capitalData && capitalData.stock, // tradeDate,
        index, stockData, options);

        if (executeCapitalSettlement( // tradeDate,
        stockInfo, translog, capitalData, options)) {
          debug(`卖出止损：${tradeDate}，价格：${formatFxstr(translog.price)}元，数量：${translog.count / 100}手，总价：${translog.total.toFixed(2)}元[佣金${translog.commission.toFixed(2)}元，过户费${translog.fee.toFixed(2)}，印花税${translog.duty.toFixed(2)}元], ${translog.memo}`); // return translog;
        }
      } // debug("执行卖出检查");


      translog = tradeMethod.checkSellTransaction(stockInfo, capitalData && capitalData.stock, // tradeDate,
      index, stockData, options);

      if (executeCapitalSettlement( // tradeDate,
      stockInfo, translog, capitalData, options)) {
        debug(`卖出交易：${tradeDate}，价格：${translog.price.toFixed(2)}元，数量：${translog.count / 100}手，总价：${translog.total.toFixed(2)}元[佣金${translog.commission.toFixed(2)}元，过户费${translog.fee.toFixed(2)}，印花税${translog.duty.toFixed(2)}元], ${translog.memo}`); // return translog;
      } // 检查是否仍然有持仓


      if (capitalData && capitalData.stock && capitalData.stock.count > 0) return; // 执行买入
      // debug("执行买入检查");

      let cash = capitalData.balance;
      if (options.fixCash) cash = options.initBalance;
      translog = tradeMethod.checkBuyTransaction(stockInfo, cash, // tradeDate,
      index, stockData, options); // debug(`买入结果：%o`, translog);

      if (executeCapitalSettlement( // tradeDate,
      stockInfo, translog, capitalData, options)) {
        debug(`买入交易：${tradeDate}，价格：${translog.price.toFixed(2)}元，数量：${translog.count / 100}手，总价：${translog.total.toFixed(2)}元[佣金${translog.commission.toFixed(2)}元，过户费${translog.fee.toFixed(2)}，印花税${translog.duty.toFixed(2)}元], ${translog.memo}`); // debug(`股票信息：%o`, stockInfo);
        // debug(`账户信息：%o`, capitalData);
        // return translog;
      }
    }
    /**
     * 根据交易记录完成账户清算
     * @param {*} stockInfo 股票信息
     * @param {*} translog 交易记录
     * @param {*} capitalData 账户数据
     * @param {*} options 配置参数
     */


    function executeCapitalSettlement( // tradeDate,
    stockInfo, translog, capitalData, options) {
      // debug(`执行清算 %o`, translog);
      if (___default['default'].isEmpty(translog)) return false; // 检查当前提供的交易是否可以进行，主要是针对累计账户买卖模式下买入交易是否会造成余额不足

      if (!options.fixCash && translog.total + capitalData.balance < 0) {
        debug(`账户余额${capitalData.balance}不足(${translog.total})，无法完成清算，交易取消! 交易信息: ${translog.type === "buy" ? "买入" : "卖出"}${stockInfo.ts_code} ${translog.count}股，价格${translog.price}，共计${translog.total}元[含佣金${translog.commission}元，过户费${translog.fee}，印花税${translog.duty}元]`);
        return false;
      } // 处理交易信息


      capitalData.balance += translog.total; // 如果当前买入，stock中放置持股信息和买入交易日志，只有卖出发生时才合并生成一条交易记录，包含两个部分

      if (translog.type === "buy") {
        capitalData.stock = {
          //info: stockInfo,
          count: translog.count,
          price: translog.price,
          buy: translog
        };
      } else {
        let settledlog = {
          tradeDate: translog.tradeDate,
          profit: capitalData.stock.buy.total + translog.total,
          income: translog.count * translog.price - capitalData.stock.count * capitalData.stock.price,
          buy: capitalData.stock.buy,
          sell: translog
        };
        capitalData.stock = {
          //info: null,
          count: 0,
          price: 0
        };
        capitalData.transactions.push(settledlog);
      } // debug("完成清算！");


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

    function parseCapital(capitalData) {
      if (___default['default'].isEmpty(capitalData)) return; // 账户信息中主要需分析交易过程，正常都是为一次买入，一次卖出，这样作为一组交易，获得一次盈利结果

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

    function logCapitalReport(log, capitalData) {
      log(`******************************************************************************************`); // log(
      //     "*                                                                                                                      *"
      // );

      if (capitalData.stock && capitalData.stock.count > 0) {
        log(`  账户价值 ${formatFxstr(capitalData.balance + capitalData.stock.count * capitalData.stock.price)}元  【余额 ${formatFxstr(capitalData.balance)}元, 持股: ${formatFxstr(capitalData.stock.count * capitalData.stock.price)}元】`);
      } else {
        log(`  账户余额 ${formatFxstr(capitalData.balance)}元`);
      }

      let capitalResult = parseCapital(capitalData); // log(``);

      log(`  总净利润：${formatFxstr(capitalResult.total_profit)},  收益率 ${(capitalResult.ror * 100).toFixed(2)}%`);
      log(`  毛利润： ${formatFxstr(capitalResult.total_win)},  总亏损：${formatFxstr(capitalResult.total_loss)}`);
      log(`  盈利收益率： ${(capitalResult.ror_win * 100).toFixed(2)}%,  亏损收益率：${(capitalResult.ror_loss * 100).toFixed(2)}%`);
      log("");
      log(`  总交易次数： ${capitalResult.count},  利润率：${(capitalResult.count_win * 100 / capitalResult.count).toFixed(1)}%`);
      log(`  总盈利次数： ${capitalResult.count_win},  总亏损次数：${capitalResult.count_loss}`);
      log("");
      log(`  最大单笔盈利： ${formatFxstr(capitalResult.max_profit)},  最大单笔亏损：${formatFxstr(capitalResult.max_loss)}`);
      log(`  平均盈利： ${formatFxstr(capitalResult.average_win)},  平均亏损：${formatFxstr(capitalResult.average_loss)}`);
      log(`  平均盈利/平均亏损： ${(capitalResult.average_win / capitalResult.average_loss).toFixed(2)},  平均每笔总盈利：${formatFxstr(capitalResult.average_profit)}`);
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

    function logTransactions(log, capitalData) {
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
        return `收入：${formatFxstr(translog.profit)}, 持有 ${sell.dateIndex - buy.dateIndex + 1}天，盈利 ${(-(translog.profit * 100) / buy.total).toFixed(2)}%
       [买入 ${buy.date}, ${formatFxstr(buy.price)}, ${buy.count}, ${formatFxstr(buy.total)}] 
       [卖出 ${sell.date}, ${formatFxstr(sell.price)}, ${sell.count}, ${formatFxstr(sell.total)}, ${sell.methodType}, ${sell.memo}]`;
      } else {
        // 持有未卖出
        return `收入：---, 持有 ---天，盈利 ---
       [买入 ${buy.date}, ${formatFxstr(buy.price)}, ${buy.count}, ${formatFxstr(buy.total)}]`;
      }
    }

    var engine = {
      executeTransaction,
      executeCapitalSettlement,
      createSellTransaction,
      createBuyTransaction,
      calculateTransactionFee,
      parseCapital,
      logCapitalReport,
      logTransactions
    };

    const debug$1 = debugpkg__default['default']("mmb");
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
      // 平均波幅的计算日数

      let N = options && options.N || 1; // 波幅突破的百分比

      let P = options && options.P || 0.5;
      let moment = 0;

      for (let i = 0; i < N; i++) {
        if (index - i - 1 >= 0) {
          let tmp = stockData[index - i - 1];

          if (options.mmbType === "hl") {
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
      debug$1(`买入条件检查${tradeDate}: ${targetPrice.toFixed(2)}=${currentData.open}+${moment.toFixed(2)}*${P} [o: ${currentData.open}, h: ${currentData.high}, l: ${currentData.low}, c: ${currentData.close}, d: ${currentData.trade_date}]`);

      if (currentData.high >= targetPrice && currentData.open <= targetPrice) {
        // 执行买入交易
        debug$1(`符合条件：${tradeDate}`);
        return engine.createBuyTransaction(stockInfo, tradeDate, index, balance, targetPrice, "mmb", `动能突破买入 ${targetPrice.toFixed(2)} (=${currentData.open}+${moment.toFixed(2)}*${(P * 100).toFixed(2)}%)`);
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
      if (___default['default'].isEmpty(stock) || stock.count <= 0) return; // 检查是否符合动能突破买入条件

      if (!options.nommbsell && !___default['default'].isEmpty(checkMMBBuyTransaction(stockInfo, options.initBalance, index, stockData, options))) {
        // 可以买入，那么当日保持
        return;
      }

      let currentData = stockData[index];
      let tradeDate = currentData.trade_date; // 目前有持仓，检查是否达到盈利卖出条件

      if (!options.nommb1 && currentData.open > stock.price) {
        // 采用第二天开盘价盈利就卖出的策略
        debug$1(`开盘盈利策略符合：${currentData.open.toFixed(2)} (> ${stock.price.toFixed(2)})`);
        return engine.createSellTransaction(stockInfo, tradeDate, index, stock.count, currentData.open, "mmb1", `开盘盈利卖出 ${currentData.open} (> ${stock.price.toFixed(2)})`);
      }

      if (!options.nommb2) {
        // 平均波幅的计算日数
        let N = options && options.N || 1; // 止损使用的波幅下降百分比

        let L = options && options.L || 0.5; // 有持仓，检查是否达到卖出条件
        // 第一个卖出条件是买入后按照买入价格及波动数据的反向百分比设置

        let moment = 0;

        for (let i = 0; i < N; i++) {
          if (index - i - 1 >= 0) {
            let tmp = stockData[index - i - 1];

            if (options.mmbType === "hl") {
              moment += tmp.high - tmp.low;
            } else {
              moment += tmp.high - tmp.close;
            }
          }
        }

        moment = moment / N;
        let targetPrice = currentData.open - moment * L; // let targetPrice2 = stock.price - moment * L;
        // let targetPrice =
        //     targetPrice1 >= targetPrice2 ? targetPrice1 : targetPrice2;

        if (targetPrice <= currentData.open && targetPrice >= currentData.low) {
          // 执行波动卖出
          return engine.createSellTransaction(stockInfo, tradeDate, index, stock.count, targetPrice, "mmb2", `动能突破卖出：${targetPrice.toFixed(2)} (= ${currentData.open}-${moment.toFixed(2)}*${L * 100}%)`);
        }
      }
    }

    let mmb = {
      name: "MMB",
      description: "动能穿透",
      methodTyps: {
        mmb: "动能突破买入",
        mmb1: "开盘盈利卖出",
        mmb2: "动能突破卖出"
      },
      checkBuyTransaction: checkMMBBuyTransaction,
      checkSellTransaction: checkMMBSellTransaction
    };

    const log = console.log;
    const debug$2 = debugpkg__default['default']("sim");

    async function simulate(options) {
      // 首先根据设置获得列表，列表内容为需要进行算法计算的各个股票
      //  TODO: 这里先读取全部的列表
      let stockListData = await libWtdaQuery.readStockList();

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
        let stockData = await libWtdaQuery.readStockData(libWtdaQuery.stockDataNames.daily, stockItem.ts_code); // 准备资金账户数据

        let capitalData = {
          info: stockItem,
          balance: options.initBalance,
          // 初始资金
          stock: {
            info: null,
            count: 0,
            price: 0
          },
          // 持有股票信息
          transactions: [] // 交易记录 {date: , count: 交易数量, price: 交易价格, total: 总金额, amount: 总价, fee: 交易费用, memo: 备注信息}

        };

        if (stockData) {
          log(`[${stockItem.ts_code}]${stockItem.name} 【数据更新时间：${moment__default['default'](stockData.updateTime).format("YYYY-MM-DD HH:mm")}】`); // 日线数据条数 ${
          //     stockData.data && stockData.data.length
          // }, 从${stockData.startDate}到${
          //     stockData.endDate
          // }，
          // 首先过滤历史数据，这里将日线数据调整为正常日期从历史到现在

          stockData = await filterStockData(stockData); // 全部数据调整为前复权后再执行计算

          calculatePrevAdjPrice(stockData); // 开始按照日期执行交易算法

          let startDate = moment__default['default'](options.startDate, "YYYYMMDD");
          let currentDate = null;

          for (let index = 0; index < stockData.data.length; index++) {
            let daily = stockData.data[index];
            let tradeDate = moment__default['default'](daily.trade_date, "YYYYMMDD");

            if (___default['default'].isEmpty(currentDate)) {
              if (startDate.isAfter(tradeDate)) {
                continue;
              }

              debug$2(`找到开始日期，开始执行算法！${index}, ${daily.trade_date}`);
            }

            currentDate = tradeDate; // this.log(`%o`, engine);

            let trans = await engine.executeTransaction(mmb, index, stockData.data, capitalData, options);
          }

          engine.logCapitalReport(log, capitalData);

          if (options.showTrans) {
            engine.logTransactions(log, capitalData);
          }
        } else {
          log(`[${stockItem.ts_code}]${stockItem.name} 没有日线数据，请检查！`);
        }
      }
    }
    /**
     * 将日线数据中的历史价位根据复权因子全部处理为前复权结果，方便后续计算
     *
     * @param {*} dailyData 日线数据
     * @param {int} digits 保留位数
     */


    function calculatePrevAdjPrice(dailyData, digits = 2) {
      if (dailyData && dailyData.data && dailyData.data.length > 0) {
        dailyData.data.forEach(item => {
          if (item.prevadj_factor) {
            item.open = Number((item.open * item.prevadj_factor).toFixed(digits));
            item.close = Number((item.close * item.prevadj_factor).toFixed(digits));
            item.high = Number((item.high * item.prevadj_factor).toFixed(digits));
            item.low = Number((item.low * item.prevadj_factor).toFixed(digits));
            item.pre_close = Number((item.pre_close * item.prevadj_factor).toFixed(digits));
            item.change = Number((item.change * item.prevadj_factor).toFixed(digits));
          }
        });
      }
    }
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
      stockData.data.reverse();
      return stockData;
    }

    // const _ = require("lodash");
    /**
     * 检查是否需要执行止损
     * @param {*} stock 持仓信息
     * @param {int} index 交易日索引位置
     * @param {*} stockData 日线数据
     */

    function checkStoplossTransaction(stockInfo, stock, index, stockData, options) {
      if (___default['default'].isEmpty(stock) || stock.count <= 0) return;
      let currentData = stockData[index]; // 止损最大损失比例

      let S = options && options.S || 0.1; // 这里检查纯粹的百分比止损

      let lossPrice = stock.price * (1 - S);
      let tradeDate = currentData.trade_date;

      if (currentData.low <= lossPrice) {
        // 当日价格范围达到止损值
        return engine.createSellTransaction(stockInfo, tradeDate, index, stock.count, lossPrice, "stoploss", `止损 ${lossPrice.toFixed(2)} (=${stock.price.toFixed(2)}*(1-${S * 100}%))`);
      }
    }

    let stoploss = {
      name: "SL",
      description: "止损",
      methodTypes: {
        stoploss: "止损卖出"
      },
      checkStoplossTransaction
    };

    exports.engine = engine;
    exports.formatFxstr = formatFxstr;
    exports.mmb = mmb;
    exports.simulate = simulate;
    exports.stoploss = stoploss;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=lib-stock.js.map
