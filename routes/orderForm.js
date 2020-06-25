'use strict';

const fetch = require('node-fetch');
const express = require('express');
const router = express.Router();

const fs = require("fs");
const readline = require("readline");
const googleSpreadMgr = require('../util/googleSpreadMgr');
const datetimeUtil = require('../util/datetimeUtil')();
const googleMailUtil = require('../util/googleMailUtil');
const path = require('path');
const configReader = require('../util/configReader')();

const readQuery = (queryId) => {
  const queryPath = path.join(process.env.__basedir, 'query', queryId) + '.sql';
  return fs.readFileSync(queryPath, {encoding: 'utf8', flag: 'r'});
}

function getQuery() {
  if (null === queryStr) {
    const queryPath = path.join(process.env.__basedir, 'query', queryId) + '.sql';
    queryStr = fs.readFileSync(queryPath, {encoding: 'utf8', flag: 'r'});
  }

  return queryStr;
}


const queries = {
  retrieveProductList: (queryId => {
    let queryStr = null;
    return () => {
      if (null === queryStr) {
        queryStr = readQuery(queryId);
      }

      return queryStr;
    };
  })('retrieveProductList'),

  retrieveProductOrderList: ((queryId) => {
    let queryStr = null;
    return () => {
      if (null === queryStr) {
        queryStr = readQuery(queryId);
      }

      return queryStr;
    };
  })('retrieveProductOrderList'),
  
  retrieveProductOrderDetail: ((queryId) => {
    let queryStr = null;
    return () => {
      if (null === queryStr) {
        queryStr = readQuery(queryId);
      }

      return queryStr;
    };
  })('retrieveProductOrderDetail'),

  retrieveProductSizeVariant: ((queryId) => {
    let queryStr = null;
    return () => {
      if (null === queryStr) {
        queryStr = readQuery(queryId);
      }

      return queryStr;
    };
  })('retrieveProductSizeVariant'),

  retrieveBrandList: (queryId => {
    let queryStr = null;
    return () => {
      if (null === queryStr) {
        queryStr = readQuery(queryId);
      }

      return queryStr;
    };
  })('retrieveBrandList'),

  retrieveBrandListHasProduct: (queryId => {
    let queryStr = null;
    return () => {
      if (null === queryStr) {
        queryStr = readQuery(queryId);
      }

      return queryStr;
    };
  })('retrieveBrandListHasProduct'),

  retrieveVendorList: (queryId => {
    let queryStr = null;
    return () => {
      if (null === queryStr) {
        queryStr = readQuery(queryId);
      }

      return queryStr;
    };
  })('retrieveVendorList'),

  retrieveVendorMap: (queryId => {
    let queryStr = null;
    return () => {
      if (null === queryStr) {
        queryStr = readQuery(queryId);
      }

      return queryStr;
    };
  })('retrieveVendorMap'),

  retrieveVendorProductList: (queryId => {
    let queryStr = null;
    return () => {
      if (null === queryStr) {
        queryStr = readQuery(queryId);
      }

      return queryStr;
    };
  })('retrieveVendorProductList'),

  retrieveProductVariantList: (queryId => {
    let queryStr = null;
    return () => {
      if (null === queryStr) {
        queryStr = readQuery(queryId);
      }

      return queryStr;
    };
  })('retrieveProductVariantList'),

  retrieveMaxProductOrderSeq: (queryId => {
    let queryStr = null;
    return () => {
      if (null === queryStr) {
        queryStr = readQuery(queryId);
      }

      return queryStr;
    };
  })('retrieveMaxProductOrderSeq'),

  retrieveStdSkuBySizeColor: (queryId => {
    let queryStr = null;
    return () => {
      if (null === queryStr) {
        queryStr = readQuery(queryId);
      }

      return queryStr;
    };
  })('retrieveStdSkuBySizeColor'),

  insertProductOrder: (queryId => {
    let queryStr = null;
    return () => {
      if (null === queryStr) {
        queryStr = readQuery(queryId);
      }

      return queryStr;
    };
  })('insertProductOrder')
}

let mgr = null;

const getBrandList = () => {
  return new Promise((resolve, reject) => {
    const query = queries.retrieveBrandList();
    mgr.executeSelect(query, []).then(resolve).catch(reject);
  });
}

const getBrandListHasProducts = () => {
  return new Promise((resolve, reject) => {
    const query = queries.retrieveBrandListHasProduct();
    mgr.executeSelect(query, []).then(resolve).catch(reject);
  });
}

const getVendorList = () => {
  return new Promise((resolve, reject) => {
    const query = queries.retrieveVendorList();
    mgr.executeSelect(query, []).then(resolve).catch(reject);
  });
}

const getVendorMap = (vendorCode) => {
  return new Promise((resolve, reject) => {
    const query = queries.retrieveVendorMap();
    mgr.executeSelect(query, [vendorCode]).then(resolve).catch(reject);
  });
}

const getProductList = (brandCode) => {
  return new Promise((resolve, reject) => {
    const query = queries.retrieveProductList();
    mgr.executeSelect(query, [brandCode]).then(resolve).catch(reject);
  });
}

const getVendorProductList = (vendorCode) => {
  return new Promise((resolve, reject) => {
    const query = queries.retrieveVendorProductList();
    mgr.executeSelect(query, [vendorCode]).then(resolve).catch(reject);
  });
}

const getProductVariantList = (productCode) => {
  return new Promise((resolve, reject) => {
    const query = queries.retrieveProductVariantList();
    mgr.executeSelect(query, [productCode]).then(resolve).catch(reject);
  });
}

const getProductSizeVariantList = productCode => {
  return new Promise((resolve, reject) => {
    const query = queries.retrieveProductSizeVariant();
    mgr.executeSelect(query, [productCode]).then(resolve).catch(reject);
  });
}

const getMaxProductOrderSeq = orderDate => {
  return new Promise((resolve, reject) => {
    const query = queries.retrieveMaxProductOrderSeq();
    mgr.executeSelect(query, [orderDate, orderDate]).then(resolve).catch(reject);
  });
}

const getStdSkuBySizeColor = (productCode, sizeCode, productColor) => {
  return new Promise((resolve, reject) => {
    const query = queries.retrieveStdSkuBySizeColor();
    mgr.executeSelect(query, [productCode, sizeCode, productColor]).then(resolve).catch(reject);
  });
}

const insertProductOrder = ({ORDER_DATE, ORDER_SEQ, STD_SKU, PRODUCT_CODE, BRAND_CODE, VENDOR_CODE, ORDER_QTY, ORDER_TM}) => {
    console.log(ORDER_DATE);
    return (connection => {
      const query = queries.insertProductOrder();

        return new Promise((resolve, reject) => {
            connection.query(query, [ORDER_DATE, ORDER_SEQ, STD_SKU, PRODUCT_CODE, BRAND_CODE, VENDOR_CODE, ORDER_QTY, ORDER_TM], (err, results) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(results);
            });
        });
    });
}

const getOrderHistory = (orderDateFr, orderDateTo) => {
  return new Promise((resolve, reject) => {
    const query = queries.retrieveProductOrderList();
    mgr.executeSelect(query, [orderDateFr, orderDateTo]).then(resolve).catch(reject);
  });
} 

const getOrderDetail = (orderDate, orderSeq) => {
  return new Promise((resolve, reject) => {
    const query = queries.retrieveProductOrderDetail();
    mgr.executeSelect(query, [orderDate, orderSeq]).then(resolve).catch(reject);
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
  const orderFormConfig = configReader.getOrderFormConfig;
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

    getMaxProductOrderSeq(list[0].ORDER_DATE).then(ret => {
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

router.get('/place_order', function(req, res, next) {

  // const gmailConfig = configReader.getGmailConfig();
  // const param = {
  //   id: gmailConfig.id,
  //   to: receiver,
  //   subject: 'Email Test',
  //   message: 'Hello World!'
  // }

  // googleMailUtil.sendEmail(param)
  //   .then(response => {
  //     console.log(response);
  //     res.json({ status: response.status, statusText: response.statusText });
  //   }).catch(err => {
  //     console.log(err);
  //     res.json({ status: '400', statusText: 'Failed to send email' });
  //   });

  
  let loc = path.resolve('.');
  loc = path.join(loc, 'Book1.xlsx');

  const data = fs.readFileSync(loc);

  // const readStream = fs.createReadStream(loc);
  // readStream.on('data', (chunk => data += chunk)).on('end', () => {
    // const base64Encorded = Base64.encode(data).replace(/\+/g, '-').replace(/\//g, '_');
    const base64Encorded = data.toString('BASE64');

    // console.log(base64Encorded);
    
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const msg = {
      to: [{email: 'test@test.com', name: 'tester'}],
      cc: [{email: 'test.test@test.com', name: 'tester'}],
      from: {email: process.env.DEFAULT_EMAIL_ADDRESS, name: process.env.DEFAULT_EMAIL_ADDRESS},
      subject: 'Sending email test',
      text: 'Hello world',
      html: '<strong>and easy to do anywhere, even with Node.js</strong>',
      attachments: [{
        content: base64Encorded,
        filename: 'Book1.xlsx'
      }]
    };

    sgMail.send(msg).then(response => console.log(response));
  // });
});

router.get('/order_history', function(req, res, next) {
  const curDate = datetimeUtil.getCurrentDttm().slice(0, 8);
  const orderDateFr = req.query.order_date_fr || curDate;
  const orderDateTo = req.query.order_date_to || curDate;

  getOrderHistory(orderDateFr, orderDateTo).then(ret => {
    res.json(ret);
  }).catch(err => {
    if (err.status && -1 === err.status) {
        res.json(err);
        return;
    }

    console.log(err);
    return;
  });
});

router.get('/order_detail', function(req, res, next) {
  const orderDate = req.query.order_date;
  const orderSeq = req.query.order_seq;

  getOrderDetail(orderDate, orderSeq).then(async ret => {
    const orderObj = {};
    ret.forEach(order => {
      const orderSet = orderObj[order["PRODUCT_CODE"]] || {}
      const colorVariant = orderSet["colorVariant"] || {};
      const orderItems = colorVariant[order.PRODUCT_COLOR] || {};
      
      orderItems[order.SIZE_CODE] = order;
      colorVariant[order.PRODUCT_COLOR] = orderItems;
      orderSet["colorVariant"] = colorVariant;
      orderSet["vendorName"] = order.VENDOR_NAME;
      orderSet["productTitle"] = order.PRODUCT_TITLE;
      orderSet["productCode"] = order.PRODUCT_CODE;
      orderSet["totalQty"] = (orderSet["totalQty"] || 0) + order.ORDER_QTY;
      orderObj[order.PRODUCT_CODE] = orderSet;
    });

    const orderList = [];
    for (let item in orderObj) {
      const orderSet = orderObj[item];
      
      const colorVariant = [];
      for (let color in orderSet.colorVariant) {
        colorVariant.push({"productColor": color, "sizeVariant": orderSet.colorVariant[color]});
      }

      orderSet.colorVariant = colorVariant;

      const sizeVariant = await getProductSizeVariantList(item);
      orderSet['sizeVariant'] = sizeVariant;

      orderList.push(orderSet);
    }

    res.json(orderList);
  }).catch(err => {
    if (err.status && -1 === err.status) {
        res.json(err);
        return;
    }

    console.log(err);
    return;
  });
});

module.exports = (transactionMgr) => {
    mgr = transactionMgr;
    return router;
};
