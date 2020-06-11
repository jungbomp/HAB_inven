'use strict';

const fetch = require('node-fetch');
const express = require('express');
const router = express.Router();

const configReader = require('../util/configReader')();

let mgr = null;
let marketplaceMeta = {};

const getMarketPlaceMeta = () => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT MARKET_ID\
                 , CONCAT(BRAND_NAME, " ", CHANNEL_NAME) AS MARKETPLACE_NM\
                 , MARKET_IMAGE_PATH\
              FROM MARKET';
        
        mgr.executeSelect(sQ, []).then(resolve).catch(reject);
    });
}

const getOrderDataByTrackingNo = (trackingNo) => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT A.CHANNEL_ORDER_NO\
                 , A.MARKET_ID\
                 , A.ORDER_DATE\
                 , A.ORDER_QTY\
                 , A.ORDER_PRICE\
                 , A.ORDER_SHIPPING_PRICE\
                 , A.SHIPPING_PRICE\
                 , A.SHIPPING_STATUS\
                 , A.TRACKING_NO\
                 , A.EMPLOYEE_ID\
                 , A.PROC_DT\
                 , A.PROC_TM\
              FROM `ORDER` AS A\
             WHERE A.TRACKING_NO = ?';
        
        mgr.executeSelect(sQ, [trackingNo]).then(resolve).catch(reject);
    });
}

const getOrderItem = (channelOrderNo, marketId) => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT A.CHANNEL_ORDER_NO\
                 , A.MARKET_ID\
                 , A.LISTING_SKU\
                 , A.UNIT_PRICE\
                 , A.UNIT_QTY\
                 , A.UNIT_PRICE * A.UNIT_QTY AS UNIT_PRICE_SUM\
                 , A.PACKING_STATUS\
                 , A.NO_ITEM_YN\
                 , A.TAG_CHANGE_YN\
              FROM ORDER_ITEM AS A\
             WHERE A.CHANNEL_ORDER_NO = ?\
               AND A.MARKET_ID        = ?';

        mgr.executeSelect(sQ, [channelOrderNo, marketId]).then(resolve).catch(reject);
    });
}

const getListingItem = (listingSku, marketId) => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT A.LISTING_ITEM_ID\
                 , A.STD_SKU\
                 , A.MARKET_ID\
                 , A.LISTING_SKU\
                 , A.LISTING_PRODUCT_NAME\
                 , B.PRODUCT_SIZE\
                 , B.PRODUCT_COLOR\
                 , B.PRODUCT_DESIGN\
              FROM LISTING   A\
                 , INVENTORY B\
             WHERE A.STD_SKU     = B.STD_SKU\
               AND A.LISTING_SKU = ?\
               AND A.MARKET_ID   = ?\
               AND A.VALID_YN    = "Y"\
               AND B.VALID_YN    = "Y"';

        mgr.executeSelect(sQ, [listingSku, marketId]).then(resolve).catch(reject);
    });    
}

const getUnlinkListingItem = (listingSku, marketId) => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT A.LISTING_ITEM_ID\
                 , A.MARKET_ID\
                 , A.LISTING_SKU\
                 , A.LISTING_PRODUCT_NAME\
                 , A.LISTING_PRODUCT_SIZE\
                 , A.LISTING_PRODUCT_COLOR\
                 , A.LISTING_PRODUCT_DESIGN\
              FROM UNLINK_LISTING A\
             WHERE A.LISTING_SKU = ?\
               AND A.MARKET_ID   = ?\
               AND A.VALID_YN    = "Y"';

        mgr.executeSelect(sQ, [listingSku, marketId]).then(resolve).catch(reject);
    });
}

const getProductBrand = (brandCode) => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT BRAND_NAME\
              FROM BRAND\
             WHERE BRAND_CODE = ?';

        mgr.executeSelect(sQ, [brandCode]).then(resolve).catch(reject);
    });
}

const getImageInfo = (sku) => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT IMAGE_ID\
                 , SKU\
                 , IMAGE_PATH\
                 , IMAGE_SOURCE\
              FROM IMAGE\
             WHERE SKU = ?';

        mgr.executeSelect(sQ, [sku]).then(resolve).catch(reject);
    });
}

const updateOrderStatus = (orderNo, marketId, shippingStatus, procDt, procTm, empId) => {
    return (connection => {
        const uQ = '\
            UPDATE `ORDER`\
               SET SHIPPING_STATUS  = ?\
                 , EMPLOYEE_ID      = ?\
                 , PROC_DT          = ?\
                 , PROC_TM          = ?\
             WHERE CHANNEL_ORDER_NO = ?\
               AND MARKET_ID        = ?';

        return new Promise((resolve, reject) => {
            connection.query(uQ, [shippingStatus, empId, procDt, procTm, orderNo, marketId], (err, results) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(results);
            });
        });
    });
}

const updateOrderItemStatus = (orderNo, marketId, listingSku, noItemYn, tagChangeYn) => {
    return connection => {
        const uQ = '\
            UPDATE ORDER_ITEM\
               SET NO_ITEM_YN       = ?\
                 , TAG_CHANGE_YN    = ?\
             WHERE CHANNEL_ORDER_NO = ?\
               AND MARKET_ID        = ?\
               AND LISTING_SKU      = ?';

        return new Promise((resolve, reject) => {
            connection.query(uQ, [noItemYn, tagChangeYn, orderNo, marketId, listingSku], (err, results) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(results);
            });
        });
    }
}

const getSalesByOrderDate = (orderDateFr, orderDateTo) => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT A.ORDER_DATE\
                 , A.STD_SKU\
                 , A.LISTING_SKU\
                 , B.PRODUCT_NAME\
                 , A.MARKET_ID\
                 , CONCAT(C.BRAND_NAME, " ", C.CHANNEL_NAME) AS MARKET_NAME\
                 , A.ORDER_CNT\
                 , A.ORDER_QTY\
                 , "Y"                                       AS INVENTORY_YN\
              FROM (\
                    SELECT DISTINCT A.ORDER_DATE\
                         , B.STD_SKU\
                         , B.MARKET_ID\
                         , A.LISTING_SKU\
                         , A.ORDER_QTY\
                         , A.ORDER_CNT\
                      FROM (\
                            SELECT B.ORDER_DATE\
                                 , A.MARKET_ID\
                                 , A.LISTING_SKU\
                                 , SUM(A.UNIT_QTY) AS ORDER_QTY\
                                 , COUNT(*)        AS ORDER_CNT\
                              FROM ORDER_ITEM A\
                                 , `ORDER` B\
                             WHERE A.CHANNEL_ORDER_NO = B.CHANNEL_ORDER_NO\
                               AND A.MARKET_ID        = B.MARKET_ID\
                               AND B.ORDER_DATE      >= ?\
                               AND B.ORDER_DATE      <= ?\
                             GROUP BY B.ORDER_DATE\
                                 , A.MARKET_ID\
                                 , A.LISTING_SKU\
                           ) A\
                         , LISTING B\
                     WHERE A.LISTING_SKU = B.LISTING_SKU\
                       AND A.MARKET_ID   = B.MARKET_ID\
                       AND B.VALID_YN    = "Y"\
                 ) A\
                 , INVENTORY B\
                 , MARKET C\
             WHERE A.STD_SKU   = B.STD_SKU\
               AND A.MARKET_ID = C.MARKET_ID\
               AND B.VALID_YN  = "Y"\
             UNION\
             SELECT A.ORDER_DATE\
                  , A.LISTING_SKU          AS STD_SKU\
                  , A.LISTING_SKU\
                  , B.LISTING_PRODUCT_NAME AS PRODUCT_NAME\
                  , A.MARKET_ID\
                  , CONCAT(C.BRAND_NAME, " ", C.CHANNEL_NAME) AS MARKET_NAME\
                  , A.ORDER_CNT\
                  , A.ORDER_QTY\
                  , "N"                                       AS INVENTORY_YN\
               FROM (\
                     SELECT B.ORDER_DATE\
                          , A.MARKET_ID\
                          , A.LISTING_SKU\
                          , SUM(A.UNIT_QTY) AS ORDER_QTY\
                          , COUNT(*)        AS ORDER_CNT\
                       FROM ORDER_ITEM A\
                          , `ORDER` B\
                      WHERE A.CHANNEL_ORDER_NO = B.CHANNEL_ORDER_NO\
                        AND A.MARKET_ID        = B.MARKET_ID\
                        AND B.ORDER_DATE      >= ?\
                        AND B.ORDER_DATE      <= ?\
                        AND (A.CHANNEL_ORDER_NO, A.MARKET_ID, A.LISTING_SKU) NOT IN (\
                                                                                     SELECT A.CHANNEL_ORDER_NO\
                                                                                          , A.MARKET_ID\
                                                                                          , A.LISTING_SKU\
                                                                                       FROM ORDER_ITEM A\
                                                                                          , `ORDER` B\
                                                                                          , LISTING C\
                                                                                      WHERE A.CHANNEL_ORDER_NO = B.CHANNEL_ORDER_NO\
                                                                                        AND A.MARKET_ID        = B.MARKET_ID\
                                                                                        AND A.LISTING_SKU      = C.LISTING_SKU\
                                                                                        AND A.MARKET_ID        = C.MARKET_ID\
                                                                                        AND B.ORDER_DATE      >= ?\
                                                                                        AND B.ORDER_DATE      <= ?\
                                                                                        AND C.VALID_YN         = "Y"\
                                                                                    )\
                      GROUP BY B.ORDER_DATE\
                          , A.MARKET_ID\
                          , A.LISTING_SKU\
                    ) A\
                  , UNLINK_LISTING B\
                  , MARKET C\
              WHERE A.LISTING_SKU = B.LISTING_SKU\
                AND A.MARKET_ID   = B.MARKET_ID\
                AND A.MARKET_ID   = C.MARKET_ID\
                AND B.VALID_YN    = "Y"\
              ORDER BY 1, 5, 2';
 
        mgr.executeSelect(sQ, [orderDateFr, orderDateTo, orderDateFr, orderDateTo, orderDateFr, orderDateTo]).then(resolve).catch(reject);
    });
}

const getPackingStatus = (orderDateFr, orderDateTo) => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT A.ORDER_DATE\
                 , A.PROC_DT\
                 , A.PROC_TM\
                 , A.CHANNEL_ORDER_NO\
                 , CONCAT(E.BRAND_NAME, " ", E.CHANNEL_NAME) AS MARKET_NAME\
                 , B.LISTING_SKU\
                 , D.STD_SKU\
                 , D.PRODUCT_NAME\
                 , CONCAT(F.FIRST_NAME, " ", F.LAST_NAME)    AS EMPLOYEE_NAME\
                 , B.NO_ITEM_YN\
                 , B.TAG_CHANGE_YN\
                 , A.SHIPPING_STATUS\
                 , "Y"                                       AS INVENTORY_YN\
              FROM `ORDER`    A\
              JOIN ORDER_ITEM B\
                ON (A.CHANNEL_ORDER_NO = B.CHANNEL_ORDER_NO\
               AND A.MARKET_ID         = B.MARKET_ID)\
              JOIN LISTING C\
                ON (B.MARKET_ID        = C.MARKET_ID\
               AND B.LISTING_SKU       = C.LISTING_SKU)\
              JOIN INVENTORY D\
                ON (C.STD_SKU          = D.STD_SKU)\
              JOIN MARKET E\
                ON (A.MARKET_ID        = E.MARKET_ID)\
   LEFT OUTER JOIN USER F\
                ON (A.EMPLOYEE_ID      = F.EMPLOYEE_ID)\
             WHERE A.ORDER_DATE       >= ?\
               AND A.ORDER_DATE       <= ?\
               AND C.VALID_YN          = "Y"\
               AND D.VALID_YN          = "Y"\
             UNION\
            SELECT A.ORDER_DATE\
                 , A.PROC_DT\
                 , A.PROC_TM\
                 , A.CHANNEL_ORDER_NO\
                 , CONCAT(E.BRAND_NAME, " ", E.CHANNEL_NAME) AS MARKET_NAME\
                 , B.LISTING_SKU\
                 , B.LISTING_SKU                             AS STD_SKU\
                 , C.LISTING_PRODUCT_NAME                    AS PRODUCT_NAME\
                 , CONCAT(F.FIRST_NAME, " ", F.LAST_NAME)    AS EMPLOYEE_NAME\
                 , B.NO_ITEM_YN\
                 , B.TAG_CHANGE_YN\
                 , A.SHIPPING_STATUS\
                 , "N"                                       AS INVENTORY_YN\
              FROM `ORDER`    A\
              JOIN ORDER_ITEM B\
                ON (A.CHANNEL_ORDER_NO = B.CHANNEL_ORDER_NO\
               AND A.MARKET_ID         = B.MARKET_ID)\
              JOIN UNLINK_LISTING C\
                ON (B.MARKET_ID        = C.MARKET_ID\
               AND B.LISTING_SKU       = C.LISTING_SKU)\
              JOIN MARKET E\
                ON (A.MARKET_ID        = E.MARKET_ID)\
   LEFT OUTER JOIN USER F\
                ON (A.EMPLOYEE_ID      = F.EMPLOYEE_ID)\
             WHERE (B.CHANNEL_ORDER_NO, B.MARKET_ID, B.LISTING_SKU) NOT IN (SELECT B.CHANNEL_ORDER_NO, B.MARKET_ID, B.LISTING_SKU\
                                                                              FROM `ORDER`    A\
                                                                                 , ORDER_ITEM B\
                                                                                 , LISTING    C\
                                                                             WHERE A.CHANNEL_ORDER_NO = B.CHANNEL_ORDER_NO\
                                                                               AND A.MARKET_ID        = B.MARKET_ID\
                                                                               AND B.MARKET_ID        = C.MARKET_ID\
                                                                               AND B.LISTING_SKU      = C.LISTING_SKU\
                                                                               AND A.ORDER_DATE      >= ?\
                                                                               AND A.ORDER_DATE      <= ?\
                                                                               AND C.VALID_YN         = "Y")\
               AND A.ORDER_DATE       >= ?\
               AND A.ORDER_DATE       <= ?\
               AND C.VALID_YN          = "Y"\
             ORDER BY 1, 5, 6';
   
        mgr.executeSelect(sQ, [orderDateFr, orderDateTo, orderDateFr, orderDateTo, orderDateFr, orderDateTo]).then(resolve).catch(reject);
    });
}

const getNoItemAndTagChangeCnt = (orderDateFr, orderDateTo) => {
    return new Promise((resolve, reject) => {
        const sQ = "\
            SELECT A.PROC_DT\
                 , SUM(A.NO_ITEM)    AS NO_ITEM\
                 , SUM(A.TAG_CHANGE) AS TAG_CHANGE\
              FROM (\
                       SELECT B.PROC_DT\
                            , IF(A.NO_ITEM_YN = 'Y', 1, 0)    AS NO_ITEM\
                            , IF(A.TAG_CHANGE_YN = 'Y', 1, 0) AS TAG_CHANGE\
                       FROM ORDER_ITEM A\
                          , `ORDER` B\
                       WHERE A.CHANNEL_ORDER_NO = B.CHANNEL_ORDER_NO\
                         AND A.MARKET_ID        = B.MARKET_ID\
                         AND B.PROC_DT         >= ?\
                         AND B.PROC_DT         <= ?\
                   ) A\
             GROUP BY A.PROC_DT\
            HAVING SUM(A.NO_ITEM) > 0\
                OR SUM(A.TAG_CHANGE) > 0";

        mgr.executeSelect(sQ, [orderDateFr, orderDateTo]).then(resolve).catch(reject);
    });
}

const send_slack_message = async (message) => {
    let res = null;
    try {
        const slackConfig = configReader.getSlackConfig();
        res = await fetch(slackConfig.messageToken, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                'text': message
            })
        });
    } catch (e) {
        console.log(e);
    } finally {
        return {status: res.status, statusText: res.statusText};
    }
};

const getCurrentDttm = () => {
    const date_ob = new Date(Date.now());

    // adjust 0 before single digit date
    
    // current year
    let yyyy = date_ob.getFullYear();

    // current month
    let mm = ("0" + (date_ob.getMonth() + 1)).slice(-2);

    // current date
    let dd = ("0" + date_ob.getDate()).slice(-2);

    // current hours
    let hh = ("0" + date_ob.getHours()).slice(-2);

    // current minutes
    let mi = ("0" + date_ob.getMinutes()).slice(-2);

    // current seconds
    let ss = ("0" + date_ob.getSeconds()).slice(-2);

    return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

const convertDateFromat = date => {
    const yyyy = date.slice(0, 4);
    const mm = date.slice(4, 6);
    const dd = date.slice(6, 8);

    return `${yyyy}-${mm}-${dd}`;
}

const convertTimeFormat = time => {
    const hh = time.slice(0, 2);
    const mi = time.slice(2, 4);
    const ss = time.slice(4, 6);

    return `${hh}:${mi}:${ss}`;
}

const convertDatetimeFormat = dttm => {
    return `${convertDateFromat(dttm.slice(0, 8))} ${convertTimeFormat(dttm.slice(-6))}`;
}

router.get('/', (req, res, next) => {
    console.log(`Can't find tracking number.`);
    res.json({code: '900', status: 'Tracking number should not be empty.'})
});

router.get('/login', function(req, res, next) {
    const usercode = req.query.employee_code;
  
    fetch(`http://localhost:3000/user/${usercode}`).then(res => res.json())
    .then(json => {
      if (100 === json.code) {
          res.json({code: 100, status: "Employee id doesn't exist in the system."});
          return;
      }

      res.send(json);
    });
  });

router.get('/order_data/:trackingNo', (req, res, next) => {
    const trackingNo = `0000000000000000000000${req.params.trackingNo || ''}`.substr(-22);
    
    getOrderDataByTrackingNo(trackingNo).then(ret => {
        if (ret.length != 1) {
            console.log(`Can't find order data.`);
            res.json({"code": 100, "status": `Can't find order data with Tracking Number ${trackingNo}`});
            return;
        }

        const order = ret[0];
        (async (orderNo, marketId) => {
            try {
                const orderList = await getOrderItem(orderNo, marketId);
                for (let i = 0; i < orderList.length; i++) {
                    const item = orderList[i];
                    const listingItem = await getListingItem(item.LISTING_SKU, item.MARKET_ID);
                    if (0 < listingItem.length) {
                        Object.assign(item, listingItem[0]);

                        const imageInfo = await getImageInfo(item.STD_SKU);
                        if (0 < imageInfo.length) Object.assign(item, imageInfo[0]);
                    }
                    else {
                        const unlinkListingItem = await getUnlinkListingItem(item.LISTING_SKU, item.MARKET_ID);
                        if (0 < unlinkListingItem.length) Object.assign(item, unlinkListingItem[0]);
                    }

                    const productSupplier = await getProductBrand(item.LISTING_SKU.substr(1, 2));
                    if (0 < productSupplier.length) Object.assign(item, productSupplier[0]);

                    item.NO_ITEM_YN = item.NO_ITEM_YN || 'N';
                    item.TAG_CHANGE_YN = item.TAG_CHANGE_YN || 'N';
                }

                order.ORDER_LIST = orderList;
                order.MARKET_IMAGE_PATH = marketplaceMeta[order.MARKET_ID].MARKET_IMAGE_PATH;
                res.json(order);
            } catch (error) {
                if ("ENOTFOUND" === error.code) {
                    res.json({"code": 100, "status": "Error in connection database"})
                }
            }
        })(order.CHANNEL_ORDER_NO, order.MARKET_ID);
    }).catch(error => {
        console.log(error);
        if ("ENOTFOUND" === error.code) {
            res.json({"code": 100, "status": "Error in connection database"})
        }
    });
});

router.post('/update_packing_stat', function(req, res, next) {
    const curDttm = getCurrentDttm();
    const queryFuncs = [];
    if ('Y' === req.body.COMPLETE_YN) {
        queryFuncs.push(updateOrderStatus(req.body.CHANNEL_ORDER_NO, req.body.MARKET_ID, "01", curDttm.slice(0, 8), curDttm.slice(-6), req.body.EMPLOYEE_ID || null));
    } else if ('Y' === req.body.HOLD_YN) {
        queryFuncs.push(updateOrderStatus(req.body.CHANNEL_ORDER_NO, req.body.MARKET_ID, "02", curDttm.slice(0, 8), curDttm.slice(-6), req.body.EMPLOYEE_ID || null));
    } else {
        res.json({"code": 300, "status": "Invalid post request."});
        return;
    }

    const noItem = [];
    const tagChange = [];

    if (req.body.ORDER_LIST) {
        req.body.ORDER_LIST.forEach(order => {
            queryFuncs.push(updateOrderItemStatus(order.CHANNEL_ORDER_NO,
                order.MARKET_ID, order.LISTING_SKU, order.NO_ITEM_YN, order.TAG_CHANGE_YN));

            if ("Y" === order.NO_ITEM_YN) {
                noItem.push({SKU: order.LISTING_SKU, MARKET_ID: order.MARKET_ID, ORDER_NO: order.CHANNEL_ORDER_NO, ORDER_QTY: order.UNIT_QTY});
            }

            if ("Y" === order.TAG_CHANGE_YN) {
                tagChange.push({SKU: order.LISTING_SKU, MARKET_ID: order.MARKET_ID, ORDER_NO: order.CHANNEL_ORDER_NO, ORDER_QTY: order.UNIT_QTY});
            }
        });
    }

    mgr.executeTransaction(queryFuncs).then(() => {
        noItem.forEach(item => {
            const message = `No Item has been indicated for SKU: ${item.SKU} | Marketplace: ${marketplaceMeta[item.MARKET_ID].MARKETPLACE_NM} | Order #: ${item.ORDER_NO} | Order Qty: ${item.ORDER_QTY}.`;
            const ret = send_slack_message(message);
        });

        tagChange.forEach(item => {
            const message = `Tag Change has been indicated for SKU: ${item.SKU} | Marketplace: ${marketplaceMeta[item.MARKET_ID].MARKETPLACE_NM} | Order #: ${item.ORDER_NO} | Order Qty: ${item.ORDER_QTY}.`;
            const ret = send_slack_message(message);
        });

        res.json({"code": 200, "status": "Succed post request."});
    })
    .catch(error => {
        console.error(error);
        res.json({"code": 400, "status": "Pos request failed."});
    });
});

router.get('/statistic/sales_by_sku/', function(req, res, next) {
    const orderDateFr = req.query.order_date_fr || '00010101';
    const orderDateTo = req.query.order_date_to || '99991231';
    const fileDownload = req.query.file_download || 'N';

    getSalesByOrderDate(orderDateFr, orderDateTo).then(ret => {
        const salesObj = new Map();

        const toSalesBySKUFormat = (row) => {
            const dateSales = salesObj.get(row.ORDER_DATE) || new Map();
            const item = dateSales.get(row.STD_SKU) || {};
            item['STD_SKU'] = item.STD_SKU || row.STD_SKU || row.LISTING_SKU || '';
            item['ORDER_DATE'] = item.ORDER_DATE || row.ORDER_DATE || '';
            item['LISTING_SKU'] = item.LISTING_SKU || row.LISTING_SKU || '';
            item['PRODUCT_NAME'] = item.PRODUCT_NAME || row.PRODUCT_NAME || '';
            item['TOTAL_ORDER_CNT'] = (item.TOTAL_ORDER_CNT || 0) + (row.ORDER_QTY || 0);
            item['INVENTORY_YN'] = item.INVENTORY_YN || row.INVENTORY_YN;
            item[row.MARKET_ID] = (row.ORDER_QTY || 0); // Used to set order quantity to file by market place

            dateSales.set(row.STD_SKU, item);
            salesObj.set(row.ORDER_DATE, dateSales);

            return salesObj;
        }
        
        ret.forEach(toSalesBySKUFormat);

        if (salesObj.size < 1) {
            console.log(`Can't find sales data.`);
            reject({status: -1, order_date: "Can't find sales data."});
        }

        // Extract every order date to index
        const index = [];
        const keys = salesObj.keys();
        let keyObj = keys.next();
        while (!keyObj.done) {
            index.push(keyObj.value);
            keyObj = keys.next();
        }
            
        index.sort();

        if ("Y" === fileDownload) {
            let csv = 'Order Date\tStandard SKU\tProduct Name\ttotal\tHat and Beyond Amazon\tHat and Beyond Sears\tHat and Beyond Walmart\tHat and Beyond Website (Shopify)\tMa Croix Amazon\tMa Croix eBay\tMa Croix Walmart\tSkyhigh eBay\tInventory Y/N\n';
            index.forEach(date => {
                const salesPerDateMap = salesObj.get(date);
                salesPerDateMap.forEach(item => {
                    csv = csv + `${convertDateFromat(item.ORDER_DATE)}\t${item.STD_SKU}\t${item.PRODUCT_NAME}\t${item.TOTAL_ORDER_CNT}`;
                    [1, 8, 2, 3, 4, 5, 6, 7].forEach(i => {
                        csv = csv + `\t${item[i] || 0}`;
                    });

                    csv = csv + `\t${item.INVENTORY_YN}\n`;
                });
            });

            res.setHeader('Content-disposition', `attachment; filename=sales_by_SKU_${getCurrentDttm()}.tsv`);
            res.set('Content-Type', 'text/csv');
            res.status(200).send(csv);
        } else {
            const array = [];
            index.forEach(date => salesObj.get(date).forEach(item => array.push(item)));

            res.json(array);
        }

            
    }).catch(err => {
        if (err.status && -1 === err.status) {
            res.json(err);
            return;
        }

        console.log(err);
        return;
    });
});

router.get('/statistic/packing_status', function(req, res, next) {
    const curDate = getCurrentDttm().slice(0, 8);
    const orderDateFr = req.query.order_date_fr || curDate;
    const orderDateTo = req.query.order_date_to || curDate;
    const fileDownload = req.query.file_download || 'N';

    getPackingStatus(orderDateFr, orderDateTo).then(ret => {
        if ("Y" === fileDownload) {
            let csv = 'Order Date\tOrder #\tSKU\tProduct Name\tMarketplace\tEmployee\tNo Item\tTag Change\tFulfilled Date\n';
            ret.forEach(row => {
                csv = csv + `${convertDateFromat(row.ORDER_DATE)}\t${row.CHANNEL_ORDER_NO}\t${row.STD_SKU}\t${row.PRODUCT_NAME}\t${row.MARKET_NAME}\t${row.EMPLOYEE_NAME}\t${row.NO_ITEM_YN}\t${row.TAG_CHANGE_YN}`;
                csv = csv + `\t${'01' === row.SHIPPING_STATUS ? convertDatetimeFormat(row.PROC_DT + row.PROC_TM) : ''}\n`;
            });

            res.setHeader('Content-disposition', `attachment; filename=Packing_Data_${getCurrentDttm()}.tsv`);
            res.set('Content-Type', 'text/csv');
            res.status(200).send(csv);
        } else {
            res.json(ret);
        }
    }).catch(err => {
        if (err.status && -1 === err.status) {
            res.json(err);
            return;
        }

        console.log(err);
        return;
    });
});

router.get('/slack_message/send_total_message/', function(req, res, next) {
    const today = getCurrentDttm().slice(0, 8);
    const orderDateFr = req.query.order_date_fr || today;
    const orderDateTo = req.query.order_date_to || today;

    getNoItemAndTagChangeCnt(orderDateFr, orderDateTo).then(ret => {
        ret.forEach(async row => {
            const msg = `${row.PROC_DT.slice(4, 6)}/${row.PROC_DT.slice(-2)}: Total number of Tag Change: ${row.TAG_CHANGE}\nTotal number of No Item: ${row.NO_ITEM}`;
            send_slack_message(msg).then(json => {
                console.log(json);
            }).catch(err => {
                console.log(err);
            });
        });

        res.json({return_message: `Succeed to send message(s).`});
    }).catch(err => {
        if (err.status && -1 === err.status) {
            res.json(err);
            return;
        }

        console.log(err);
        return;
    });
});

router.post('/slack_message/send_message', function(req, res, next) {
    const text = req.body.text;

    const msg = `Total number of Tag Change: ${text}\nTotal number of No Item: ${text}`;

    const ret = send_slack_message(message);
    if (200 === ret.status) {
        res.json({return_message: "succeed."});
    } else {
        res.json(ret);
    }
});

module.exports = (transactionMgr) => {
    mgr = transactionMgr;

    getMarketPlaceMeta().then(ret => {
        ret.forEach(row => {
            marketplaceMeta[row.MARKET_ID] = row;
        });
        
        marketplaceMeta[99] = {
            MARKET_ID: 99,
            MARKET_IMAGE_PATH: "market_place_amazon_prime_icon",
            MARKETPLACE_NM: "Unknown"
        }
        console.log(marketplaceMeta);
    }).catch(error => {
        console.log(error);
        if ("ENOTFOUND" === error.code) {
            res.json({"code": 100, "status": "Error in connection database"})
        }
    });

    return router;
};
