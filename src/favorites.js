/**
 * 自选列表
 */
const { getDataRoot } = require("@wt/lib-wtda-query");
const _ = require("lodash");
const moment = require("moment");

const path = require("path");
const fs = require("fs");
const fp = fs.promises;

async function readFavorites() {
    let retData = {
        updateTime: null,
        favorites: [],
        // 下面考虑放个字段说明
    };

    try {
        let dataFile = getFavoritesFile();
        try {
            retData = JSON.parse(await fp.readFile(dataFile, "utf-8"));
        } catch (error) {
            // 文件不存在，不考虑其它错误
            if (!(error && error.code === "ENOENT")) {
                console.error(
                    `读取自选文件${dataFile}时发生错误：${error}, %o`,
                    error
                );
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
    return path.join(getDataRoot(), "favorites.json");
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
        retData = { updateTime: null, favorites: [] };
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

        await fp.writeFile(favoritesPath, jsonStr, { encoding: "utf-8" });
    } catch (error) {
        throw new Error("保存列表数据时出现错误，请检查后重新执行：" + error);
    }
}

export default { addFavorites, readFavorites };
