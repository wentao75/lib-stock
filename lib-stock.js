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

    const debug = debugpkg__default['default']("engine");
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
                debug(`${rule.name} 卖出：${tradeDate}，价格：${formatFxstr(translog.price)}元，数量：${translog.count / 100}手，总价：${translog.total.toFixed(2)}元[佣金${translog.commission.toFixed(2)}元，过户费${translog.fee.toFixed(2)}，印花税${translog.duty.toFixed(2)}元], ${translog.memo}`);
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
      if (___default['default'].isEmpty(translog)) return false; // 如果非固定头寸，检查当前提供的交易余额是否可执行

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
          tradeDate: translog.tradeDate,
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

    function showCapitalReports(log, capitalData) {
      log(`******************************************************************************************`); // log(
      //     "*                                                                                                                      *"
      // );

      if (capitalData.stocks && capitalData.stocks.length > 0) {
        let stockvalue = 0;

        for (let stock of capitalData.stocks) {
          stockvalue += stock.count * stock.price;
        }

        log(`  账户价值 ${formatFxstr(capitalData.balance + stockvalue)}元  【余额 ${formatFxstr(capitalData.balance)}元, 持股: ${formatFxstr(stockvalue)}元】`);
      } else {
        log(`  账户余额 ${formatFxstr(capitalData.balance)}元`);
      }

      let capitalResult = parseCapitalReports(capitalData); // log(``);

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
        return `收入：${formatFxstr(translog.profit)}, 持有 ${sell.dateIndex - buy.dateIndex + 1}天，盈利 ${(-(translog.profit * 100) / buy.total).toFixed(2)}%, ${translog.transeq}
       [买入 ${buy.date}, ${formatFxstr(buy.price)}, ${buy.count}, ${formatFxstr(buy.total)}, ${buy.transeq}] 
       [卖出 ${sell.date}, ${formatFxstr(sell.price)}, ${sell.count}, ${formatFxstr(sell.total)}, ${sell.methodType}, ${sell.memo}, ${sell.transeq}]`;
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
      parseCapitalReports,
      showCapitalReports,
      showTransactions
    };

    const debug$1 = debugpkg__default['default']("reports");

    function parseWorkdayReports(transactions) {
      if (!transactions || transactions.length <= 0) return; // 报告包含5+1行信息，1-5对应周一到周五的信息，0表示汇总
      // 每行信息包括：count(交易次数), win_ratio(盈利比例)，win(平均盈利金额)，
      //      loss_ratio(亏损比例) ，loss（平均亏损金额），ratio_winloss(盈利亏损比),
      //      average(平均交易规模), max_loss（最大亏损），profit(利润)

      let results = [{
        count: 0,
        win_ratio: 0,
        win: 0,
        loss_ratio: 0,
        loss: 0,
        ratio_winloss: 0,
        average: 0,
        max_loss: 0,
        profit: 0
      }, {
        count: 0,
        win_ratio: 0,
        win: 0,
        loss_ratio: 0,
        loss: 0,
        ratio_winloss: 0,
        average: 0,
        max_loss: 0,
        profit: 0
      }, {
        count: 0,
        win_ratio: 0,
        win: 0,
        loss_ratio: 0,
        loss: 0,
        ratio_winloss: 0,
        average: 0,
        max_loss: 0,
        profit: 0
      }, {
        count: 0,
        win_ratio: 0,
        win: 0,
        loss_ratio: 0,
        loss: 0,
        ratio_winloss: 0,
        average: 0,
        max_loss: 0,
        profit: 0
      }, {
        count: 0,
        win_ratio: 0,
        win: 0,
        loss_ratio: 0,
        loss: 0,
        ratio_winloss: 0,
        average: 0,
        max_loss: 0,
        profit: 0
      }, {
        count: 0,
        win_ratio: 0,
        win: 0,
        loss_ratio: 0,
        loss: 0,
        ratio_winloss: 0,
        average: 0,
        max_loss: 0,
        profit: 0
      }];

      for (let trans of transactions) {
        let buy = trans.buy; // let sell = trans.sell;

        let date = moment__default['default'](buy.date, "YYYYMMDD");
        let day = date.day();

        if (day < 1 && day > 5) {
          // 超出了周一～周五的范围，跳过这个日期
          debug$1(`${buy.tradeDate}交易超出星期范围：${day}, %o`, trans);
          continue;
        }

        let days = [0, day];
        console.log(`%o`, trans); // console.log(
        //     `%o, ${buy.tradeDate}, ${date}, ${day}, %o %o`,
        //     trans,
        //     days,
        //     results
        // );

        for (let index of days) {
          results[index].count++;
          results[index].profit += trans.profit;

          if (trans.profit >= 0) {
            results[index].count_win++;
            results[index].win += trans.profit;
            if (results[index].max_win < trans.profit) results[index].max_win = trans.profit;
          } else {
            results[index].count_loss++;
            results[index].loss += trans.profit;
            if (results[index].max_loss > trans.profit) results[index].max_loss = trans.profit;
          }
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
      let reports = parseWorkdayReports(transactions);
      console.log("%o", reports);
      log(`
工作日    交易次数    盈利比例    平均盈利    亏损比例    平均亏损    盈亏比    平均利润    最大亏损    利润`);

      for (let report of reports) {
        log(`          ${report.count}    ${(report.win_ratio * 100).toFixed(1)}%    ${report.win.toFixed(2)}    ${(report.loss_ratio * 100).toFixed(1)}%    ${report.loss.toFixed(2)}    ${report.ratio_winloss.toFixed(2)}    ${report.average.toFixed(2)}    ${report.max_loss.toFixed(2)}    ${report.profit.toFixed(2)}`);
      }
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
            } else {
              debug$2(`执行算法！${index}, ${daily.trade_date}`);
            }

            currentDate = tradeDate; // this.log(`%o`, engine);
            // let trans =

            await engine.executeTransaction(index, stockData.data, capitalData, options);
          }

          engine.showCapitalReports(log, capitalData);

          if (options.showTrans) {
            engine.showTransactions(log, capitalData);
          }

          if (options.showWorkdays) {
            showWorkdayReports(log, capitalData.transactions);
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

    const debug$3 = debugpkg__default['default']("mmb");
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
      debug$3(`买入条件检查${tradeDate}: ${targetPrice.toFixed(2)}=${currentData.open}+${moment.toFixed(2)}*${P} [o: ${currentData.open}, h: ${currentData.high}, l: ${currentData.low}, c: ${currentData.close}, d: ${currentData.trade_date}]`);

      if (currentData.high >= targetPrice && currentData.open <= targetPrice) {
        // 执行买入交易
        debug$3(`符合条件：${tradeDate}`);
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
        debug$3(`开盘盈利策略符合：${currentData.open.toFixed(2)} (> ${stock.price.toFixed(2)})`);
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
          return engine.createSellTransaction(stockInfo, tradeDate, index, stock.count, targetPrice, "mmb2", `动能突破卖出：${targetPrice.toFixed(2)} (= ${currentData.open}-${moment.toFixed(2)}*${L * 100}%)`);
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
      methodTyps: {
        mmb: "动能突破买入",
        mmb1: "开盘盈利卖出",
        mmb2: "动能突破卖出"
      },
      checkBuyTransaction: checkMMBBuyTransaction,
      checkSellTransaction: checkMMBSellTransaction,
      showOptions
    };

    // const _ = require("lodash");
    const debug$4 = debugpkg__default['default']("stoploss");
    const OPTIONS_NAME$1 = "stoploss";
    /**
     * 检查是否需要执行止损
     * @param {*} stocks 持仓信息
     * @param {int} index 交易日索引位置
     * @param {*} stockData 日线数据
     */

    function checkStoplossTransaction(stockInfo, stock, index, stockData, options) {
      if (___default['default'].isEmpty(stock) || stock.count <= 0) return;
      let currentData = stockData[index]; // 止损最大损失比例

      let S = options && options[OPTIONS_NAME$1].S; // 这里检查纯粹的百分比止损

      let tradeDate = currentData.trade_date;
      let lossPrice = stock.price * (1 - S);
      debug$4(`止损检查${tradeDate}: ${currentData.low}] <= ${lossPrice.toFixed(2)} (=${stock.price.toFixed(2)}*(1-${(S * 100).toFixed(2)}%))`);

      if (currentData.low <= lossPrice) {
        // 当日价格范围达到止损值
        return engine.createSellTransaction(stockInfo, tradeDate, index, stock.count, lossPrice, "stoploss", `止损 ${lossPrice.toFixed(2)} (=${stock.price.toFixed(2)}*(1-${S * 100}%))`);
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

    const debug$5 = debugpkg__default['default']("benchmark");
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
      return engine.createBuyTransaction(stockInfo, tradeDate, index, balance, targetPrice, RULE_NAME, `基准买入 ${targetPrice.toFixed(2)}`);
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
      if (___default['default'].isEmpty(stock) || stock.count <= 0) return;
      let currentData = stockData[index];
      let tradeDate = currentData.trade_date;
      let bmoptions = options && options[RULE_NAME];
      let priceType = bmoptions.sellPrice;

      if (priceType === "open") {
        return engine.createSellTransaction(stockInfo, tradeDate, index, stock.count, currentData.open, priceType, `开盘卖出 ${currentData.open})`);
      } else if (priceType === "close") {
        return engine.createSellTransaction(stockInfo, tradeDate, index, stock.count, currentData.open, priceType, `收盘卖出 ${currentData.close}`);
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
      methodTyps: {
        open: "开盘卖出",
        close: "收盘卖出"
      },
      checkBuyTransaction,
      checkSellTransaction,
      showOptions: showOptions$2
    };

    // const simulate = require("./simulator");
    const rules = {
      mmb,
      stoploss,
      benchmark
    };

    exports.engine = engine;
    exports.formatFxstr = formatFxstr;
    exports.reports = reports;
    exports.rules = rules;
    exports.simulate = simulate;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=lib-stock.js.map
