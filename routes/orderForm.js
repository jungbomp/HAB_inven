'use strict';

const fetch = require('node-fetch');
const express = require('express');
const router = express.Router();

const fs = require("fs");
const readline = require("readline");
const googleSpreadMgr = require('../util/googleSpreadMgr');
const datetimeUtil = require('../util/datetimeUtil')();

let mgr = null;

const getBrandList = () => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT BRAND_CODE\
                 , BRAND_NAME\
                 , EMAIL\
              FROM `BRAND`\
             ORDER BY BRAND_CODE';
        
        mgr.executeSelect(sQ, []).then(resolve).catch(reject);
    });
}

const getBrandListHasProducts = () => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT A.BRAND_CODE\
                 , A.BRAND_NAME\
                 , A.EMAIL\
              FROM `BRAND` A\
             WHERE EXISTS (\
                 SELECT 1\
                   FROM PRODUCT B\
                  WHERE A.BRAND_CODE = B.BRAND_CODE\
                )\
             ORDER BY A.BRAND_CODE';
        
        mgr.executeSelect(sQ, []).then(resolve).catch(reject);
    });
}

const getVendorList = () => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT VENDOR_CODE\
                 , VENDOR_NAME\
                 , VENDOR_EMAIL\
              FROM `VENDOR`\
             ORDER BY VENDOR_CODE';
        
        mgr.executeSelect(sQ, []).then(resolve).catch(reject);
    });
}

const getVendorMap = (vendorCode) => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT VENDOR_CODE\
                 , BRAND_CODE\
              FROM `VENDOR_MAP`\
             WHERE VENDOR_CODE = ?';

        mgr.executeSelect(sQ, [vendorCode]).then(resolve).catch(reject);
    });
}

const getProductList = (brandCode) => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT PRODUCT_CODE\
                 , PRODUCT_TITLE\
                 , BRAND_CODE\
                 , PACK_INFO\
                 , ORDER_BY_SIZE\
              FROM PRODUCT A\
             WHERE A.BRAND_CODE = ?\
               AND EXISTS (\
                 SELECT B.PRODUCT_CODE\
                   FROM PRODUCT_MAP B\
                  WHERE A.PRODUCT_CODE = B.PRODUCT_CODE\
               )\
             ORDER BY PRODUCT_CODE';

        mgr.executeSelect(sQ, [brandCode]).then(resolve).catch(reject);
    });    
}

const getVendorProductList = vendorCode => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT B.PRODUCT_CODE\
                 , B.PRODUCT_TITLE\
                 , B.BRAND_CODE\
                 , B.PACK_INFO\
                 , B.ORDER_BY_SIZE\
              FROM VENDOR_MAP A\
                 , PRODUCT B\
             WHERE A.BRAND_CODE  = B.BRAND_CODE\
               AND A.VENDOR_CODE = ?\
               AND EXISTS (\
                 SELECT C.PRODUCT_CODE\
                   FROM PRODUCT_MAP C\
                  WHERE B.PRODUCT_CODE = C.PRODUCT_CODE\
               )\
             ORDER BY B.PRODUCT_CODE';

        mgr.executeSelect(sQ, [vendorCode]).then(resolve).catch(reject);
    }); 
}

const getProductVariantList = (productCode) => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT A.PRODUCT_CODE\
                 , A.STD_SKU\
                 , B.PRODUCT_COLOR\
                 , B.SIZE_CODE\
                 , C.SHORT_SIZE_CODE\
                 , C.SIZE_ORDER\
              FROM PRODUCT_MAP A\
                 , INVENTORY B\
                 , STD_SIZE C\
             WHERE A.STD_SKU      = B.STD_SKU\
               AND B.SIZE_CODE    = C.SIZE_CODE\
               AND A.PRODUCT_CODE = ?\
             ORDER BY B.PRODUCT_COLOR\
                 , C.SIZE_ORDER';

        mgr.executeSelect(sQ, [productCode]).then(resolve).catch(reject);
    });    
}

const getMaxOrderSeq = (orderDate) => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT IFNULL(ORDER_SEQ, 0) + 1 AS ORDER_SEQ\
              FROM (\
                        SELECT ?              AS ORDER_DATE\
                             , max(ORDER_SEQ) AS ORDER_SEQ\
                          FROM PRODUCT_ORDER\
                         WHERE ORDER_DATE = ?\
                   ) A';

        mgr.executeSelect(sQ, [orderDate, orderDate]).then(resolve).catch(reject);
    });
}

const getStdSkuBySizeColor = (productCode, sizeCode, productColor) => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT A.STD_SKU\
              FROM PRODUCT_MAP A\
                 , INVENTORY B\
                 , STD_SIZE C\
             WHERE A.STD_SKU       = B.STD_SKU\
               AND B.SIZE_CODE     = C.SIZE_CODE\
               AND A.PRODUCT_CODE  = ?\
               AND C.SIZE_CODE     = ?\
               AND B.PRODUCT_COLOR = ?';

        mgr.executeSelect(sQ, [productCode, sizeCode, productColor]).then(resolve).catch(reject);
    });
}

const insertProductOrder = ({ORDER_DATE, ORDER_SEQ, STD_SKU, PRODUCT_CODE, BRAND_CODE, VENDOR_CODE, ORDER_QTY, ORDER_TM}) => {
    console.log(ORDER_DATE);
    return (connection => {
        const iQ = '\
            INSERT\
              INTO PRODUCT_ORDER (\
                   ORDER_DATE\
                 , ORDER_SEQ\
                 , STD_SKU\
                 , PRODUCT_CODE\
                 , BRAND_CODE\
                 , VENDOR_CODE\
                 , ORDER_QTY\
                 , ORDER_TM\
            )\
            VALUES (\
                   ?\
                 , ?\
                 , ?\
                 , ?\
                 , ?\
                 , ?\
                 , ?\
                 , ?\
            )';

        return new Promise((resolve, reject) => {
            connection.query(iQ, [ORDER_DATE, ORDER_SEQ, STD_SKU, PRODUCT_CODE, BRAND_CODE, VENDOR_CODE, ORDER_QTY, ORDER_TM], (err, results) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(results);
            });
        });
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

router.get('/brand_list', (req, res, next) => {
    getBrandListHasProducts().then(ret => {
        res.json(ret);
    }).catch(error => {
        console.log(error);
        if ("ENOTFOUND" === error.code) {
            res.json({"code": 100, "status": "Error in connection database"})
        }
    });
});

router.get('/vendor_list', (req, res, next) => {
    getVendorList().then(ret => {
        res.json(ret);
    }).catch(error => {
        console.log(error);
        if ("ENOTFOUND" === error.code) {
            res.json({"code": 100, "status": "Error in connection database"})
        }
    });
});

router.get('/product_list', (req, res, next) => {
    const brandCode = req.query.brand_code;

    getProductList(brandCode).then(ret => {
        res.json(ret);
    }).catch(error => {
        console.log(error);
        if ("ENOTFOUND" === error.code) {
            res.json({"code": 100, "status": "Error in connection database"})
        }
    });
})

router.get('/vendor_product_list', (req, res, next) => {
    const vendorCode = req.query.vendor_code;

    getVendorProductList(vendorCode).then(ret => {
        res.json(ret);
    }).catch(error => {
        console.log(error);
        if ("ENOTFOUND" === error.code) {
            res.json({"code": 100, "status": "Error in connection database"})
        }
    });
});

router.get('/product_variant_list', (req, res, next) => {
    const product_code = req.query.product_code;

    getProductVariantList(product_code).then(ret => {
        res.json(ret);
    }).catch(error => {
        console.log(error);
        if ("ENOTFOUND" === error.code) {
            res.json({"code": 100, "status": "Error in connection database"})
        }
    });
});

router.post('/export_to_google_spread', function(req, res, next) {
  const list = req.body.ORDER_LIST;
  const configFile = fs.readFileSync('config.json');
  const orderFormConfig = JSON.parse(configFile).OrderForm;
  googleSpreadMgr.getChildren(orderFormConfig.ORDER_FORM_FORDER_ID, null)
    .then(async list => {
      const metaList = [];
      for (let i = 0; i < list.length; i++) {
        try {
          // const fileName = '[Order Form] Order History_2020_01';
          const meta = await googleSpreadMgr.getFileMetadata(list[i].id);
          metaList.push(meta);
        } catch (err) {
          reject(err);
        }
      }

      metaList.sort((v1, v2) => {
        const num1 = parseInt(v1.title.substring(v1.title.lastIndexOf('_')+1));
        const num2 = parseInt(v2.title.substring(v2.title.lastIndexOf('_')+1));

        return num2 - num1;
      });

      return metaList[0];
    }).then(fileMeta => {
      const curMonth = parseInt(datetimeUtil.getCurrentDttm().substring(4, 6));
      let fileName = fileMeta.title;

      if (parseInt(fileName.substring(fileName.lastIndexOf('_')+1)) < curMonth) {
        fileName = `${fileName.substring(0, fileName.lastIndexOf('_')+1)}${('0'+curMonth).slice(-2)}`;
        return googleSpreadMgr.createSpreadFile(fileName)
          .then(googleSpreadMgr.getFileMetadata)
          .then(meta => {
            return googleSpreadMgr.patchFile({ fileid: meta.id, addParents: orderFormConfig.ORDER_FORM_FORDER_ID, removeParents: meta.parents[0].id })            
          }).then(fileData => fileData.id);
      }

      return fileMeta.id;
    }).then(id => {
      const curDttm = datetimeUtil.getCurrentDttm();
      const day = parseInt(curDttm.substring(6, 8), 10);
      const time = datetimeUtil.convertTimeFormat(curDttm.substring(8));

      const requests = [];
      const addSheet = {
        addSheet: {
          properties: {
            title: `${day}${1 === day ? 'st' : 2 === day ? 'nd' : 3 === day ? 'rd' : 'th'} ${time}`
          }
        }
      }

      requests.push(addSheet);
      return googleSpreadMgr.spreadSheetUpdate({ spreadsheetId: id, requests: requests })
        .then(response => {
          const { index, sheetId, title } = response.replies[0].addSheet.properties;

          return { spreadsheetId: response.spreadsheetId, sheetIndex: index, sheetId: sheetId, sheetTitle: title };
        });
    }).then(({ spreadsheetId, sheetIndex, sheetId, sheetTitle }) => {
    //   return googleSpreadMgr.spreadSheetValuesGet({ spreadsheetId: spreadsheetId, range: `${sheetTitle}!A1:A` })
    //     .then(response => {
    //       return { spreadsheetId: spreadsheetId, sheetTitle: sheetTitle, numberOfRow: (response.values && response.values.length || 0) }
    //     });
    // }).then(({ spreadsheetId, sheetTitle, numberOfRow }) => {
      const data = [];
      const sheetAction = [];
      let curRow = 1;

      for (let i = 0; i < list.length; i++) {
        const order = list[i];
        const lastSizeCol = String.fromCharCode('E'.charCodeAt(0)+order.sizeVariant.length-1);
        const totalCol = String.fromCharCode(lastSizeCol.charCodeAt(0)+1);
        
        data.push({
          range: `${sheetTitle}!A${curRow}:D${curRow}`,
          values: [ ['VENDOR', 'ITEM', 'NAME', 'COLOR'] ]
        });

        data.push({
          range: `${sheetTitle}!E${curRow}:${totalCol}${curRow}`,
          values: [ [...order.sizeVariant.map(v => v.shortCode), 'TOTAL QTY'] ]
        });

        curRow++;

        data.push({
          range: `${sheetTitle}!A${curRow}:C${curRow}`,
          values: [ [order.brandName, order.productCode, order.productTitle] ]
        })

        for (let j = 0; j < order.order.length; j++) {
          data.push({
            range: `${sheetTitle}!D${curRow+j}:${lastSizeCol}${curRow+j}`,
            values: [ [order.order[j].color, ...order.order[j].order.map(v => 0 < v ? ''+v : '')] ]
          });
        }

        data.push({
          range: `${sheetTitle}!${totalCol}${curRow}:${totalCol}${curRow}`,
          values: [ [order.totalQty] ]
        });

        sheetAction.push({
          mergeCells: {
            range: {
              sheetId: sheetId,
              startRowIndex: curRow-1,
              endRowIndex: curRow + order.order.length - 1,
              startColumnIndex: 0,
              endColumnIndex: 3
            },
            mergeType: 'MERGE_COLUMNS'
          }
        });

        sheetAction.push({
          mergeCells: {
            range: {
              sheetId: sheetId,
              startRowIndex: curRow-1,
              endRowIndex: curRow + order.order.length - 1,
              startColumnIndex: totalCol.charCodeAt(0) - 'A'.charCodeAt(0),
              endColumnIndex: totalCol.charCodeAt(0) - 'A'.charCodeAt(0) + 1
            },
            mergeType: 'MERGE_COLUMNS'
          }
        });

        const border = {
          style: "SOLID",
          width: 1,
          color: {
            red: 0,
            green: 0,
            blue: 0,
            alpha: 1
          }
        };

        sheetAction.push({
          updateBorders: {
            range: {
              sheetId: sheetId,
              startRowIndex: curRow-2,
              endRowIndex: curRow + order.order.length - 1,
              startColumnIndex: 0,
              endColumnIndex: totalCol.charCodeAt(0) - 'A'.charCodeAt(0) + 1
            },
            top: border,
            bottom: border,
            left: border,
            right: border,
            innerHorizontal: border,
            innerVertical: border
          }
        });

        curRow = curRow + order.order.length + 1;
      }

      return googleSpreadMgr.spreadSheetValuesUpdate({ spreadsheetId: spreadsheetId, data: data })
        .then(googleSpreadMgr.spreadSheetUpdate({ spreadsheetId: spreadsheetId, requests: sheetAction }));

      // return googleSpreadMgr.spreadSheetValuesUpdate({ spreadsheetId: spreadsheetId, data: data });
    }).then(response => {
      res.json({ 'code': 200, 'status': `Updated order data into Google Spreadsheet.` });
    }).catch(err => {
      console.log(err);
    });
});

router.post('/place_order', function(req, res, next) {
    const list = req.body.ORDER_LIST;
    const isError = false;
    const transactionList = [];
    let numOfOrder = 0;

    if (list.length < 1) {
        console.log("The order list is empty.");
        res.json({code: 400, status: "The Order list is empty."});
        return;
    }

    getMaxOrderSeq(list[0].ORDER_DATE).then(ret => {
        if (ret.length < 1) {
            const errMsg = `Failed to get the maximum sequence from PRODUCT_ORDER with ORDER_DATE(${list[0].ORDER_DATE})`;
            console.log(errMsg);
            isError = true;
            res.json({ code: 400, status: errMsg });
        }

        return ret[0].ORDER_SEQ;
    }).then(orderSeq => {
        for (let i = 0; i < list.length; i++) {
            const order = list[i];
            
            getStdSkuBySizeColor(order.PRODUCT_CODE, order.SIZE_CODE, order.PRODUCT_COLOR).then(ret => {
                if (isError) return;
    
                if (ret.length < 1) {
                    isError = true;
                    
                    const errMsg = `Can't find STD_SKU with PRODUCT_CODE(${order.PRODUCT_CODE}), SIZE_CODE(${order.SIZE_CODE}), PRODUCT_COLOR(${order.PRODUCT_COLOR})`
                    console.log(errMsg);
                    isError = true;
                    res.json({ code: 400, status: errMsg });
                }
    
                order.STD_SKU = ret[0].STD_SKU;
                order.ORDER_SEQ = orderSeq;
                
                return order;
            }).then(order => {
                transactionList.push(insertProductOrder(order));
                numOfOrder++;
    
                if (numOfOrder === list.length) {
                    mgr.executeTransaction(transactionList).then(() => {
                        res.json({ 'code': 200, 'status': `Inserted ${numOfOrder} orders.` });
                    }).catch(error => {
                        console.error(error);
                        res.json({"code": 400, "status": "Failed to insert order into database."});
                    });
                }
            }).catch(error => {
                console.error(error);
                
                if (!isError) {
                    isError = true;
                    res.json({ 'code': 400, 'status': 'Failed to insert order into database' });
                }
            });
        }
    }).catch(error => {
        console.error(error);
        
        if (!isError) {
            isError = true;
            const errMsg = `Failed to get the maximum sequence from PRODUCT_ORDER`;
            res.json({ 'code': 400, 'status': errMsg });
        }
    });
});

module.exports = (transactionMgr) => {
    mgr = transactionMgr;

    return router;
};
