SELECT PRODUCT_CODE
     , PRODUCT_TITLE
     , BRAND_CODE
     , PACK_INFO
     , ORDER_BY_SIZE
  FROM PRODUCT A
 WHERE A.BRAND_CODE = ?
   AND EXISTS (
     SELECT B.PRODUCT_CODE
       FROM PRODUCT_MAP B
      WHERE A.PRODUCT_CODE = B.PRODUCT_CODE
   )
 ORDER BY PRODUCT_CODE